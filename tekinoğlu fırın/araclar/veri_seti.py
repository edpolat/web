"""veri/ klasöründen, her bilginin nereden geldiği işaretli bir veri seti üretir (veri_seti/ klasörü).

Kullanım:
  python3 araclar/veri_seti.py      # ya da: npm run veri-seti

Üretilen dosyalar:
  eserler.json     tüm alanlar, her alanın yanında "kaynak"
  eserler.jsonl    aynısı, satır başına bir eser (yapay zekâ araçları için)
  eserler.geojson  konumlu eserler, harita kütüphaneleri için
  konumlar.csv     yalnız eser-konum tablosu
  belgeler.jsonl   her eser için tek paragraf düz metin (RAG / soru-cevap için)

Kaynak kodları README'de (veri_seti/README.md) açıklanır. Veri değiştikçe yeniden çalıştırın.
"""
import csv
import json
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
CIKTI = KOK / "veri_seti"

KAYNAK_KODLARI = {
    "kitap": "Vakıf Katılım envanter kitabından birebir alındı (kaynak_id ve sayfa ile).",
    "osm": "OpenStreetMap'teki aynı adlı yapının noktası, araclar/osm_camiler.py ile eşleştirildi.",
    "osm_elle_eslesme": "OpenStreetMap'te adı farklı yazılan yapı, Claude tarafından elle eşleştirildi.",
    "geocoding": "Adres OpenStreetMap Nominatim ile koordinata çevrildi; 'hassasiyet' neyi gösterdiğini söyler.",
    "claude": "Claude'un çıkarımı ya da genel bilgisi; kitapta birebir yok. Doğrulanmadan kesin bilgi gibi kullanılmamalı.",
    "ekip": "Takım üyesi elle girdi ve doğruladı.",
}

# OSM'de adı farklı yazıldığı için elle eşlenen eserler (osm_camiler.py çıktısındaki 'yakında' listesinden)
ELLE_ESLENEN = {"simkes-sirmakes-camii", "veled-i-sarayi-mescidi", "veled-i-veziri-camii", "zagferanlik-mescidi"}


def oku(yol):
    return json.loads((KOK / yol).read_text(encoding="utf-8"))


def kitap(eser, **ek):
    env = eser.get("envanter", {})
    return {"kaynak": "kitap", "kaynak_id": env.get("kaynak_id"), "sayfa": env.get("sayfa"), **ek}


def konum_bilgisi(eser):
    k = eser.get("konum")
    if not k:
        return None
    yontem = k.get("yontem")
    if k.get("dogrulandi"):
        kaynak = "ekip"
    elif yontem == "osm":
        kaynak = "osm_elle_eslesme" if eser["id"] in ELLE_ESLENEN else "osm"
    elif yontem == "geocoding":
        kaynak = "geocoding"
    else:  # "elle" ama doğrulanmamış: Claude'un girdiği yaklaşık nokta
        kaynak = "claude"
    hassasiyet = k.get("hassasiyet") or ("yaklasik" if kaynak == "claude" else "eser")
    aciklama = {
        "eser": "Yapının kendisini gösterir.",
        "adres": "Sokak adresini gösterir, yapıya yakındır.",
        "mahalle": "Yalnız mahalle merkezini gösterir; aynı mahalledeki eserler üst üste düşer.",
        "ilce": "Yalnız ilçe merkezini gösterir.",
        "yaklasik": "Claude'un genel bilgiyle girdiği yaklaşık nokta.",
    }[hassasiyet]
    return {
        "enlem": k["enlem"], "boylam": k["boylam"], "kaynak": kaynak, "hassasiyet": hassasiyet,
        "dogrulandi": bool(k.get("dogrulandi")), "aciklama": aciklama,
    }


def eser_kaydi(eser, il, turler, vakiflar):
    kitapli = bool(eser.get("tarihce") or eser.get("adres"))  # kitabın metin bölümünden gelen eser
    kayit = {
        "id": eser["id"],
        "il": {"id": il["id"], "ad": il["ad"]["tr"]},
        "taslak": bool(eser.get("taslak")),
        "ad": {**eser["ad"], **(kitap(eser) if kitapli or eser.get("envanter") else {"kaynak": "claude"})},
        "tur": {"id": eser["tur"], "ad": turler.get(eser["tur"]), "kaynak": "claude",
                "not": "Eserin adından sınıflandırıldı."},
        "ilce": {"deger": eser.get("ilce"), **({"kaynak": "kitap", "not": "Kitaptaki adresten."} if eser.get("adres") else {"kaynak": "claude"})},
        "konum": konum_bilgisi(eser),
    }
    if eser.get("adres"):
        kayit["adres"] = {**eser["adres"], **kitap(eser)}
    for alan in ("banisi", "mimar"):
        if eser.get(alan):
            kayit[alan] = {"deger": eser[alan], **kitap(eser)}
    if eser.get("donem"):
        kayit["donem"] = {**eser["donem"], **kitap(eser)}
    if eser.get("tarihce"):
        kayit["tarihce"] = {**eser["tarihce"], **kitap(eser)}
    if eser.get("mimari"):
        kayit["mimari"] = {**eser["mimari"], **kitap(eser)}
    if eser.get("vakif_id") and eser["vakif_id"] in vakiflar:
        kayit["vakif"] = {"id": eser["vakif_id"], "ad": vakiflar[eser["vakif_id"]]["ad"]["tr"], **kitap(eser)}
    kayit["olgular"] = [
        {"metin": o["metin"], "kategori": o["kategori"],
         "kaynak": "kitap" if o["durum"] == "kaynakli" else "claude" if o["durum"] == "ai_yorumu" else o["durum"],
         "kaynak_id": o.get("kaynak_id"), "sayfa": o.get("sayfa")}
        for o in eser.get("olgular", []) if o["durum"] != "dogrulanacak"
    ]
    if eser.get("gorseller"):
        kayit["gorseller"] = [
            {"dosya": g["dosya"], "kaynak": "kitap", "kaynak_id": g.get("kaynak_id"), "atif": g["atif"], "lisans": g["lisans"],
             "alt": {**g["alt"], "kaynak": "claude", "not": "Fotoğrafa bakılarak yazıldı."}}
            for g in eser["gorseller"]
        ]
    kayit["belge"] = belge(kayit)
    return kayit


def belge(k):
    """Yapay zekâya bağlam olarak verilecek tek paragraf; her cümle kaynağını söyler."""
    p = [f"{k['ad']['tr']} ({k['ad'].get('en', '')}) {k['il']['ad']} ilinin {k['ilce']['deger']} ilçesinde bir {k['tur']['ad'].lower()}."]
    if k.get("taslak"):
        p.append("Bu kayıt taslaktır, bilgileri henüz doğrulanmadı.")
    if k.get("adres"):
        p.append(f"Adresi: {k['adres']['tr']} [kitap, {k['adres']['kaynak_id']}].")
    ko = k.get("konum")
    if ko:
        p.append(f"Koordinatı {ko['enlem']}, {ko['boylam']} [{ko['kaynak']}; {ko['aciklama']} "
                 f"{'Doğrulandı.' if ko['dogrulandi'] else 'Henüz doğrulanmadı.'}]")
    else:
        p.append("Koordinatı henüz yok.")
    for alan, etiket in (("banisi", "Banisi"), ("mimar", "Mimarı")):
        if k.get(alan):
            p.append(f"{etiket}: {k[alan]['deger']} [kitap, s. {k[alan]['sayfa']}].")
    if k.get("donem", {}).get("yapim_yili"):
        p.append(f"Yapım yılı: {k['donem']['yapim_yili']}{' (yaklaşık)' if k['donem'].get('yaklasik') else ''} [kitap].")
    for o in k["olgular"]:
        p.append(f"{o['metin']['tr']} [{o['kaynak']}, {o.get('kaynak_id') or ''} s. {o.get('sayfa') or '?'}]")
    return {"tr": " ".join(p)}


def main():
    ayarlar = oku("veri/ayarlar.json")
    turler = {t["id"]: t["ad"]["tr"] for t in ayarlar["eser_turleri"]}
    vakiflar = {v["id"]: v for v in oku("veri/vakiflar.json")}
    kayitlar = []
    for dosya in sorted((KOK / "veri" / "iller").glob("*.json")):
        veri = json.loads(dosya.read_text(encoding="utf-8"))
        kayitlar += [eser_kaydi(e, veri["il"], turler, vakiflar) for e in veri["eserler"]]

    CIKTI.mkdir(exist_ok=True)
    ust = {"kaynak_kodlari": KAYNAK_KODLARI, "kaynaklar": oku("veri/kaynaklar.json"), "eser_sayisi": len(kayitlar)}
    (CIKTI / "eserler.json").write_text(json.dumps({**ust, "eserler": kayitlar}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (CIKTI / "eserler.jsonl").write_text("".join(json.dumps(k, ensure_ascii=False) + "\n" for k in kayitlar), encoding="utf-8")
    (CIKTI / "belgeler.jsonl").write_text(
        "".join(json.dumps({"id": k["id"], "metin": k["belge"]["tr"]}, ensure_ascii=False) + "\n" for k in kayitlar), encoding="utf-8")

    ozellikler = []
    for k in kayitlar:
        if not k["konum"]:
            continue
        ko = k["konum"]
        ozellikler.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [ko["boylam"], ko["enlem"]]},
            "properties": {
                "id": k["id"], "ad": k["ad"]["tr"], "ad_en": k["ad"].get("en"), "tur": k["tur"]["id"], "il": k["il"]["id"],
                "ilce": k["ilce"]["deger"], "adres": k.get("adres", {}).get("tr"), "taslak": k["taslak"],
                "konum_kaynagi": ko["kaynak"], "hassasiyet": ko["hassasiyet"], "dogrulandi": ko["dogrulandi"],
            },
        })
    (CIKTI / "eserler.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": ozellikler}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    with open(CIKTI / "konumlar.csv", "w", newline="", encoding="utf-8") as f:
        y = csv.writer(f)
        y.writerow(["id", "ad", "il", "ilce", "adres", "enlem", "boylam", "konum_kaynagi", "hassasiyet", "dogrulandi", "taslak"])
        for k in kayitlar:
            ko = k["konum"] or {}
            y.writerow([k["id"], k["ad"]["tr"], k["il"]["id"], k["ilce"]["deger"], k.get("adres", {}).get("tr", ""),
                        ko.get("enlem", ""), ko.get("boylam", ""), ko.get("kaynak", ""), ko.get("hassasiyet", ""),
                        str(ko.get("dogrulandi", "")).lower(), str(k["taslak"]).lower()])

    from collections import Counter
    print(f"{len(kayitlar)} eser, {len(ozellikler)} konumlu → {CIKTI.relative_to(KOK)}/")
    print("konum kaynakları:", dict(Counter(k["konum"]["kaynak"] if k["konum"] else "yok" for k in kayitlar)))


if __name__ == "__main__":
    main()
