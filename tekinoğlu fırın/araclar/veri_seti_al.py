"""Mobil uygulamanın veri setinden (veri_seti/eserler.json biçimi) şehir dosyalarına aktarır.

Mobil uygulama (Feyza) veri setini araclar/veri_seti.py çıktısı biçiminde tutuyor ve yeni şehirleri
oraya ekliyor. Bu komut o dosyadaki şehirleri veri/iller/<il>.json biçimine çevirir, fotoğrafları
public/gorseller/<il>/<eser-id>/ altına webp olarak yazar.

Kullanım:
  python3 araclar/veri_seti_al.py <uygulama>/veri/eserler.json --iller konya,hatay \
      [--konumlar <uygulama>/araclar/konumlar.json] [--foto <uygulama>/foto]

- Yalnız --iller ile verilen şehirler yazılır; o şehirlerin dosyası baştan üretilir.
- konumlar.json, uygulamanın konum_bul.py ile adresten bulduğu noktalardır; ilçe merkezinden iyiyse kullanılır.
- Çevirisi Türkçesiyle aynı olan metinlerde "en" yazılmaz (arayüz "çeviri eksik" der).
- Kaynakları veri/kaynaklar.json'a eklenir (varsa dokunulmaz).
"""
import argparse
import json
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent

IL_BILGISI = {
    "konya": {"ad": {"tr": "Konya", "en": "Konya"}, "merkez": {"enlem": 37.8714, "boylam": 32.4846},
              "envanter_kaynak_id": "vk-konya-envanter-c1", "envanter_yili": 2024, "toplam_eser": 289,
              "atif": "Vakıf Katılım, Konya Vakıf Eserleri Envanteri"},
    "hatay": {"ad": {"tr": "Hatay", "en": "Hatay"}, "merkez": {"enlem": 36.2025, "boylam": 36.1605},
              "envanter_kaynak_id": "vk-hatay-envanter", "envanter_yili": 2022, "toplam_eser": 117,
              "atif": "Vakıf Katılım, Hatay İli Vakıf Eserleri"},
}
LISANS = "Tüm hakları saklıdır (kullanım şartı organizatöre sorulacak)"
HASSASIYET = {"eser": "eser", "sokak": "adres", "adres": "adres", "mahalle": "mahalle", "ilce": "ilce"}
KAYNAK_ALANLARI = {"kaynak", "kaynak_id", "sayfa", "not"}


def cok_dilli(m):
    """{tr, en, kaynak...} → {tr, en}; en, tr ile aynıysa çevrilmemiş sayılır."""
    sonuc = {"tr": m["tr"].strip()}
    en = (m.get("en") or "").strip()
    if en and en != sonuc["tr"]:
        sonuc["en"] = en
    return sonuc


def konum(e, bulunan):
    if bulunan and bulunan.get("hassasiyet") in HASSASIYET:
        k, yontem = bulunan, "geocoding"
    else:
        k = e["konum"]
        yontem = {"osm": "osm", "osm_elle_eslesme": "osm", "ekip": "elle", "claude": "elle"}.get(k.get("kaynak"), "geocoding")
    return {"enlem": k["enlem"], "boylam": k["boylam"], "dogrulandi": bool(k.get("dogrulandi")),
            "yontem": yontem, "hassasiyet": HASSASIYET.get(k.get("hassasiyet"), "ilce")}


def gorseller(e, il, foto_kok):
    if not foto_kok:
        return []
    from PIL import Image

    kaynak = foto_kok / e["id"]
    if not kaynak.is_dir():
        return []
    hedef = KOK / "public" / "gorseller" / il / e["id"]
    hedef.mkdir(parents=True, exist_ok=True)
    liste = []
    for n, jpg in enumerate(sorted(p for p in kaynak.glob("*.jpg") if p.stem != "kucuk"), 1):
        no = f"{n:02d}"
        with Image.open(jpg) as im:
            im = im.convert("RGB")
            buyuk = im.copy()
            buyuk.thumbnail((1600, 1600))
            buyuk.save(hedef / f"{no}.webp", "WEBP", quality=80)
            im.thumbnail((480, 480))
            im.save(hedef / f"{no}_kucuk.webp", "WEBP", quality=75)
        ad = cok_dilli(e["ad"])
        liste.append({
            "dosya": f"/gorseller/{il}/{e['id']}/{no}.webp",
            "alt": {"tr": f"{ad['tr']}, fotoğraf {n}", "en": f"{ad.get('en', ad['tr'])}, photo {n}"},
            "lisans": LISANS,
            "atif": IL_BILGISI[il]["atif"],
            "kaynak_id": e["ad"].get("kaynak_id") or IL_BILGISI[il]["envanter_kaynak_id"],
        })
    return liste


def eser(e, il, bulunan, foto_kok):
    kayit = {"id": e["id"]}
    if e.get("taslak"):
        kayit["taslak"] = True
    kayit["ad"] = cok_dilli(e["ad"])
    kayit["tur"] = e["tur"]["id"]
    if e.get("ilce") and e["ilce"].get("deger"):
        kayit["ilce"] = e["ilce"]["deger"]
    if (e.get("adres") or {}).get("tr", "").strip():
        kayit["adres"] = cok_dilli(e["adres"])
    kayit["konum"] = konum(e, bulunan)
    if e.get("banisi"):
        kayit["banisi"] = e["banisi"]["deger"]
    if e.get("donem"):
        donem = {k: v for k, v in e["donem"].items() if k not in KAYNAK_ALANLARI}
        if "metin" in donem:
            donem["metin"] = cok_dilli(donem["metin"])
        kayit["donem"] = donem
    if (e.get("tarihce") or {}).get("tr", "").strip():
        kayit["tarihce"] = cok_dilli(e["tarihce"])
    if e["ad"].get("kaynak_id"):
        kayit["envanter"] = {"kaynak_id": e["ad"]["kaynak_id"], **({"sayfa": e["ad"]["sayfa"]} if e["ad"].get("sayfa") else {})}
    kayit["olgular"] = [
        {"metin": cok_dilli(o["metin"]), "kategori": o["kategori"],
         "durum": "kaynakli" if o.get("kaynak") == "kitap" and o.get("kaynak_id") else "dogrulanacak",
         **({"kaynak_id": o["kaynak_id"]} if o.get("kaynak_id") else {}),
         **({"sayfa": o["sayfa"]} if o.get("sayfa") else {})}
        for o in e["olgular"]
    ]
    if not any(o["durum"] == "kaynakli" for o in kayit["olgular"]):
        kayit["taslak"] = True
    g = gorseller(e, il, foto_kok)
    if g:
        kayit["gorseller"] = g
    return kayit


def main():
    p = argparse.ArgumentParser()
    p.add_argument("veri_seti")
    p.add_argument("--iller", required=True)
    p.add_argument("--konumlar")
    p.add_argument("--foto")
    a = p.parse_args()

    veri = json.loads(Path(a.veri_seti).read_text(encoding="utf-8"))
    bulunanlar = json.loads(Path(a.konumlar).read_text(encoding="utf-8")) if a.konumlar else {}
    foto_kok = Path(a.foto) if a.foto else None

    for il in a.iller.split(","):
        bilgi = IL_BILGISI[il]
        eserler = [eser(e, il, bulunanlar.get(e["id"]), foto_kok) for e in veri["eserler"] if e["il"]["id"] == il]
        dosya = {
            "il": {"id": il, "ad": bilgi["ad"], "merkez": {**bilgi["merkez"], "dogrulandi": False, "yontem": "elle"},
                   "yakinlastirma": 13, "envanter_kaynak_id": bilgi["envanter_kaynak_id"],
                   "envanter_yili": bilgi["envanter_yili"], "toplam_eser": bilgi["toplam_eser"]},
            "eserler": eserler,
        }
        (KOK / "veri" / "iller" / f"{il}.json").write_text(json.dumps(dosya, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{il}: {len(eserler)} eser, {sum(1 for e in eserler if e.get('gorseller'))} fotoğraflı, "
              f"{sum(1 for e in eserler if e['konum']['hassasiyet'] != 'ilce')} ilçe merkezinden iyi konumlu")

    yol = KOK / "veri" / "kaynaklar.json"
    kaynaklar = json.loads(yol.read_text(encoding="utf-8"))
    var = {k["id"] for k in kaynaklar}
    for k in veri["kaynaklar"]:
        if k["id"] not in var:
            kaynaklar.append(k)
    yol.write_text(json.dumps(kaynaklar, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
