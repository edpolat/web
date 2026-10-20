"""Eserlerin tam yerini OpenStreetMap'teki cami ve mescit kayıtlarından bulur.

Kullanım (internete bağlı bilgisayarda):
  python3 araclar/osm_camiler.py         # bulduklarını yalnızca listeler
  python3 araclar/osm_camiler.py --yaz   # veri/iller/*.json dosyalarına yazar

Her şehir için tek istekle o bölgedeki adı olan bütün ibadet yerlerini çeker (Overpass API),
adlarını eserlerin adlarıyla eşleştirir. Eşleşen yapı eserin bilinen konumuna (çoğu zaman mahalle
merkezi) 2 km'den uzaksa atılır. Yazılan konum "yontem": "osm", "hassasiyet": "eser",
"dogrulandi": false olur; elle doğrulanmış konumlara dokunmaz.
Bulunamayan her eser için bilinen konumunun 500 m yakınındaki ibadet yerleri de listelenir.
Sonra /tr/duzenle/konum sayfasında her eser için "Nokta zaten doğru yerde" ile onaylanır.
"""
import json
import math
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
YAZ = "--yaz" in sys.argv
AZAMI_KM = 2.0
SUNUCULAR = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]

# Ad karşılaştırmasında anlam taşımayan kelimeler
GENEL = {
    "camii", "cami", "camisi", "mescidi", "mescit", "mescid", "ve", "haziresi", "hazire", "kabri", "turbesi",
    "kulliyesi", "hz", "hazreti", "koyu", "cesme", "cesmesi", "tekke", "tekkesi", "i", "seyh", "bey", "pasa", "sultan",
}


def sade(metin):
    """'Şeyh Hamit (Somuncu Baba-Ayazma) Camii' → 'seyh hamit somuncu baba ayazma camii'"""
    metin = metin.replace("ı", "i").replace("İ", "i").lower()
    metin = "".join(c for c in unicodedata.normalize("NFD", metin) if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", metin).strip()


def anahtarlar(ad):
    """Eser adından aranacak kelime kümeleri: govde ve parantez içindeki her ad ayrı ayrı."""
    govde = re.sub(r"\s*\([^)]*\)", "", ad)
    parcalar = [govde] + [p for grup in re.findall(r"\(([^)]+)\)", ad) for p in re.split(r"\s*[-–]\s*", grup)]
    kumeler = []
    for p in parcalar:
        kelimeler = set(sade(p).split()) - GENEL
        if kelimeler:
            kumeler.append(kelimeler)
    # Yedek: tek başına ayırt edici uzun kelime ("Hüdavendigâr Camii" gibi kısa yazılmış OSM adları için)
    for kelime in sorted(set().union(*kumeler) if kumeler else set()):
        if len(kelime) >= 8 and {kelime} not in kumeler:
            kumeler.append({kelime})
    return kumeler


def km(a, b):
    dy = (a[0] - b[0]) * 111.0
    dx = (a[1] - b[1]) * 111.0 * math.cos(math.radians(a[0]))
    return math.hypot(dx, dy)


def osm_cek(kutu):
    guney, bati, kuzey, dogu = kutu
    sorgu = (
        f'[out:json][timeout:90];(nwr["religion"="muslim"]["name"]({guney},{bati},{kuzey},{dogu});nwr["amenity"="place_of_worship"]["name"]({guney},{bati},{kuzey},{dogu}););out center tags;'
    )
    govde = urllib.parse.urlencode({"data": sorgu}).encode()
    for sunucu in SUNUCULAR:
        try:
            istek = urllib.request.Request(sunucu, data=govde, headers={"User-Agent": "vakfiye-hackathon/0.3 (Tekinoglu Firin)"})
            with urllib.request.urlopen(istek, timeout=120) as yanit:
                ogeler = json.load(yanit)["elements"]
            break
        except Exception as hata:
            print(f"  {sunucu}: {hata}")
    else:
        sys.exit("Overpass'a ulaşılamadı.")
    yapilar = []
    for o in ogeler:
        yer = (o.get("lat"), o.get("lon")) if "lat" in o else (o.get("center", {}).get("lat"), o.get("center", {}).get("lon"))
        if yer[0] is None:
            continue
        adlar = {o["tags"][k] for k in ("name", "name:tr", "old_name", "alt_name", "official_name") if k in o["tags"]}
        yapilar.append({
            "adlar": adlar,
            "kelimeler": [set(sade(a).split()) for a in adlar],
            "bitisik": [sade(a).replace(" ", "") for a in adlar],  # "Nakkaşali Camii" gibi bitişik yazımlar için
            "yer": yer,
        })
    return yapilar


def eslestir(eser, yapilar, referans):
    """Adı uyan ve referansa en yakın yapıyı döner: (yer, osm adı, mesafe) ya da None."""
    adaylar = []
    for kume in anahtarlar(eser["ad"]["tr"]):
        for y in yapilar:
            if any(kume <= k for k in y["kelimeler"]) or (
                max(map(len, kume)) >= 5 and any(all(w in b for w in kume) for b in y["bitisik"])
            ):
                uzaklik = km(y["yer"], referans) if referans else 0.0
                adaylar.append((uzaklik, -len(kume), y))
    if not adaylar:
        return None
    adaylar.sort(key=lambda a: (a[1], a[0]))  # önce daha çok kelimesi uyan, sonra en yakın
    uzaklik, _, y = adaylar[0]
    if referans and uzaklik > AZAMI_KM:
        return ("uzak", sorted(y["adlar"])[0], uzaklik)
    return (y["yer"], sorted(y["adlar"])[0], uzaklik)


def yakinlar(referans, yapilar, yaricap=0.5, adet=6):
    """Bulunamayan eser için bilinen konumunun yakınındaki ibadet yerlerini listeler; elle seçmek için."""
    if not referans:
        return
    liste = sorted((km(y["yer"], referans), y) for y in yapilar if km(y["yer"], referans) <= yaricap)
    for uzaklik, y in liste[:adet]:
        print(f"      yakında: {sorted(y['adlar'])[0]}  {y['yer'][0]:.6f}, {y['yer'][1]:.6f}  ({uzaklik * 1000:.0f} m)")


def main():
    for dosya in sorted((KOK / "veri" / "iller").glob("*.json")):
        veri = json.loads(dosya.read_text(encoding="utf-8"))
        konumlar = [(e["konum"]["enlem"], e["konum"]["boylam"]) for e in veri["eserler"] if e.get("konum")]
        merkez = (veri["il"]["merkez"]["enlem"], veri["il"]["merkez"]["boylam"])
        noktalar = konumlar or [merkez]
        kutu = (
            round(min(p[0] for p in noktalar) - 0.03, 4), round(min(p[1] for p in noktalar) - 0.03, 4),
            round(max(p[0] for p in noktalar) + 0.03, 4), round(max(p[1] for p in noktalar) + 0.03, 4),
        )
        print(f"\n{veri['il']['ad']['tr']}: OpenStreetMap'ten ibadet yerleri çekiliyor {kutu}")
        yapilar = osm_cek(kutu)
        print(f"  {len(yapilar)} yapı geldi")
        degisti = False
        for eser in veri["eserler"]:
            mevcut = eser.get("konum")
            if mevcut and mevcut.get("dogrulandi"):
                continue
            referans = (mevcut["enlem"], mevcut["boylam"]) if mevcut else None
            sonuc = eslestir(eser, yapilar, referans)
            if not sonuc:
                print(f"  {eser['id']}: OSM'de bulunamadı")
                yakinlar(referans, yapilar)
                continue
            yer, osm_adi, uzaklik = sonuc
            if yer == "uzak":
                print(f"  {eser['id']}: atıldı, '{osm_adi}' {uzaklik:.1f} km uzakta")
                yakinlar(referans, yapilar)
                continue
            print(f"  {eser['id']}: {yer[0]:.6f}, {yer[1]:.6f}  ← '{osm_adi}' ({uzaklik:.2f} km kaydı)")
            eser["konum"] = {
                "enlem": round(yer[0], 6), "boylam": round(yer[1], 6),
                "dogrulandi": False, "yontem": "osm", "hassasiyet": "eser",
            }
            degisti = True
        if YAZ and degisti:
            dosya.write_text(json.dumps(veri, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print("  yazıldı:", dosya.relative_to(KOK))
    if not YAZ:
        print("\nDosyalara yazmak için: python3 araclar/osm_camiler.py --yaz")


if __name__ == "__main__":
    main()
