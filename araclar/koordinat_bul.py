"""Adresten koordinat bulur (OpenStreetMap Nominatim).

Kullanım:
  python3 araclar/koordinat_bul.py               # konumu olmayanları arar, yalnızca listeler
  python3 araclar/koordinat_bul.py --yaz         # bulduklarını veri/iller/*.json dosyalarına yazar
  python3 araclar/koordinat_bul.py --iyilestir   # mahalle düzeyindeki konumları da eser düzeyinde yeniden dener

Her konum "dogrulandi": false ve neyi gösterdiğini söyleyen bir "hassasiyet" ile yazılır:
  eser    → eserin adıyla bulundu
  adres   → sokak adresiyle bulundu
  mahalle → yalnız mahalle merkezi (aynı mahalledeki eserler üst üste düşer)
Haritada kontrol edip doğru olanları "dogrulandi": true yapın.

Bir sonuç ilçe merkezine 8 km'den uzaksa başka bir yerdeki aynı adlı yapı sayılır ve atılır.
İnternet bağlantısı gerekir. Nominatim kuralı gereği saniyede en fazla bir istek atılır.
"""
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
YAZ = "--yaz" in sys.argv or "--iyilestir" in sys.argv
IYILESTIR = "--iyilestir" in sys.argv
AZAMI_KM = 8

# Eser türünün aramada kullanılacak adı (OSM'de külliyeler çoğu zaman camisinin adıyla kayıtlı)
TUR_ADI = {"cami": "Camii", "mescit": "Mescidi", "kulliye": "Camii", "turbe": "Türbesi", "zaviye-tekke": "Tekkesi"}


def ara(sorgu):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": sorgu, "format": "json", "limit": 1, "countrycodes": "tr"}
    )
    istek = urllib.request.Request(url, headers={"User-Agent": "vakfiye-hackathon/0.2 (Tekinoglu Firin)"})
    try:
        with urllib.request.urlopen(istek, timeout=20) as yanit:
            sonuc = json.load(yanit)
    except Exception as hata:
        print("  ağ hatası:", hata)
        sonuc = []
    time.sleep(1.1)
    return (float(sonuc[0]["lat"]), float(sonuc[0]["lon"])) if sonuc else None


def km(a, b):
    """İki (enlem, boylam) arasındaki yaklaşık mesafe."""
    dy = (a[0] - b[0]) * 111.0
    dx = (a[1] - b[1]) * 111.0 * math.cos(math.radians(a[0]))
    return math.hypot(dx, dy)


def ad_adaylari(eser):
    """'Şerafettin Paşa (Okçular) Camii ve Haziresi' → ['Şerafettin Paşa (Okçular) Camii ve Haziresi',
    'Şerafettin Paşa Camii', 'Okçular Camii']"""
    ad = eser["ad"]["tr"]
    tur = TUR_ADI.get(eser["tur"], "")
    sade = re.sub(r"\s+ve\s+Haziresi.*$|,.*$", "", ad).strip()
    adaylar = [ad, sade]
    parantez = re.search(r"\(([^)]+)\)", sade)
    govde = re.sub(r"\s*\([^)]*\)", "", sade).strip()
    if govde != sade:
        adaylar.append(govde)
    if parantez:
        for parca in re.split(r"\s*[-–]\s*", parantez.group(1)):
            adaylar.append(f"{parca} {tur}".strip())
    if eser["tur"] == "kulliye":
        kok = re.sub(r"\s*Külliyesi$", "", govde)
        kok = re.sub(r"^I\.\s*", "", kok)  # "I. Murad Hüdavendigâr" → "Murad Hüdavendigâr"
        adaylar.append(f"{kok} Camii")
        son = kok.split()[-1]
        if len(son) >= 8:  # "Hüdavendigâr Camii" gibi tek ayırt edici kelime; "Paşa", "Sultan" gibi genel kelimeler değil
            adaylar.append(f"{son} Camii")
    # Şapkasız yazım OSM'de daha yaygın: "Hüdavendigâr" → "Hüdavendigar"
    adaylar += [a.translate(str.maketrans("âîûÂÎÛ", "aiuAIU")) for a in adaylar]
    return list(dict.fromkeys(a for a in adaylar if a))


ilce_merkezleri = {}


def ilce_merkezi(ilce, il):
    if (ilce, il) not in ilce_merkezleri:
        ilce_merkezleri[(ilce, il)] = ara(f"{ilce}, {il}")
    return ilce_merkezleri[(ilce, il)]


def bul(eser, il, mahalle_olur):
    ilce = eser.get("ilce", "")
    merkez = ilce_merkezi(ilce, il) if ilce else None
    adres = eser.get("adres", {}).get("tr", "")
    mahalle = next((p.strip() for p in adres.split(",") if "Mahalle" in p), "")
    denemeler = [(f"{a}, {ilce}, {il}", "eser") for a in ad_adaylari(eser)]
    if adres:
        denemeler.append((adres, "adres"))
    if mahalle and mahalle_olur:
        denemeler.append((f"{mahalle}, {ilce}, {il}", "mahalle"))
    for sorgu, hassasiyet in denemeler:
        konum = ara(sorgu)
        if not konum:
            continue
        if merkez and km(konum, merkez) > AZAMI_KM:
            print(f"  atıldı ({km(konum, merkez):.1f} km uzakta): {sorgu}")
            continue
        return konum, hassasiyet, sorgu
    return None


for dosya in sorted((KOK / "veri" / "iller").glob("*.json")):
    veri = json.loads(dosya.read_text(encoding="utf-8"))
    il = veri["il"]["ad"]["tr"]
    degisti = False
    for eser in veri["eserler"]:
        mevcut = eser.get("konum")
        if mevcut and not (IYILESTIR and mevcut.get("hassasiyet") == "mahalle" and not mevcut["dogrulandi"]):
            continue
        sonuc = bul(eser, il, mahalle_olur=not mevcut)
        if not sonuc:
            print(f"{eser['id']}: {'daha iyisi bulunamadı' if mevcut else 'BULUNAMADI'}")
            continue
        (enlem, boylam), hassasiyet, sorgu = sonuc
        print(f"{eser['id']}: {enlem:.5f}, {boylam:.5f}  [{hassasiyet}]  ({sorgu})")
        eser["konum"] = {
            "enlem": round(enlem, 6),
            "boylam": round(boylam, 6),
            "dogrulandi": False,
            "yontem": "geocoding",
            "hassasiyet": hassasiyet,
        }
        degisti = True
    if YAZ and degisti:
        dosya.write_text(json.dumps(veri, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("yazıldı:", dosya.relative_to(KOK))
