"""Vakfiye veri doğrulayıcı.

Kullanım:  python3 araclar/dogrula.py [vakfiye klasörü]

1. Her dosyayı sema/ altındaki JSON Schema ile doğrular.
2. Çapraz kontrol yapar: tür, durum ve kategori ayarlar.json'da var mı,
   kaynak/vakıf/sergi/külliye kimlikleri gerçekten tanımlı mı, eser id'leri tekil mi.
3. İngilizcesi eksik metinleri uyarı olarak sayar (hata değil).
Hata varsa çıkış kodu 1 olur, böylece CI'da da kullanılabilir.
"""
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

kok = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
sema_dir, veri_dir = kok / "sema", kok / "veri"

hatalar, uyarilar = [], []


def oku(yol):
    with open(yol, encoding="utf-8") as f:
        return json.load(f)


semalar = {p.name: oku(p) for p in sema_dir.glob("*.schema.json")}
registry = Registry().with_resources(
    (ad, Resource.from_contents(s)) for ad, s in semalar.items()
)


def sema_dogrula(yol, sema_adi):
    veri = oku(yol)
    v = Draft202012Validator(semalar[sema_adi], registry=registry)
    for h in sorted(v.iter_errors(veri), key=lambda e: list(e.path)):
        yer = "/".join(str(p) for p in h.path) or "(kök)"
        hatalar.append(f"{yol.relative_to(kok)} → {yer}: {h.message}")
    return veri


ayarlar = oku(veri_dir / "ayarlar.json")
turler = {t["id"] for t in ayarlar["eser_turleri"]}
durumlar = {d["id"] for d in ayarlar["olgu_durumlari"]}
kategoriler = {k["id"] for k in ayarlar["olgu_kategorileri"]}
diller = [d["kod"] for d in ayarlar["diller"]]

kaynaklar = sema_dogrula(veri_dir / "kaynaklar.json", "kaynak.schema.json")
vakiflar = sema_dogrula(veri_dir / "vakiflar.json", "vakif.schema.json")
sergiler = sema_dogrula(veri_dir / "sergiler.json", "sergi.schema.json")
kaynak_ids = {k["id"] for k in kaynaklar}
vakif_ids = {v["id"] for v in vakiflar}
sergi_ids = {s["id"] for s in sergiler}

eserler = {}  # id -> (dosya, eser)
eksik_ceviri = 0


def ceviri_say(dugum):
    """İç içe her cokDilli nesnesinde eksik dilleri sayar."""
    global eksik_ceviri
    if isinstance(dugum, dict):
        if "tr" in dugum and all(isinstance(x, str) for x in dugum.values()):
            eksik_ceviri += sum(1 for d in diller if d not in dugum)
        else:
            for x in dugum.values():
                ceviri_say(x)
    elif isinstance(dugum, list):
        for x in dugum:
            ceviri_say(x)


for il_yolu in sorted((veri_dir / "iller").glob("*.json")):
    il = sema_dogrula(il_yolu, "il.schema.json")
    ad = il_yolu.relative_to(kok)
    if il.get("il", {}).get("id") != il_yolu.stem:
        hatalar.append(f"{ad}: il.id dosya adıyla aynı olmalı ({il_yolu.stem})")
    for eser in il.get("eserler", []):
        eid = eser.get("id")
        if eid in eserler:
            hatalar.append(f"{ad}: '{eid}' id'si {eserler[eid][0]} dosyasında da var")
            continue
        eserler[eid] = (ad, eser)
        ceviri_say(eser)

eser_ids = set(eserler)


def kontrol(kosul, mesaj):
    if not kosul:
        hatalar.append(mesaj)


rotalar = sema_dogrula(veri_dir / "rotalar.json", "rota.schema.json") if (veri_dir / "rotalar.json").exists() else []
for r in rotalar:
    for d in r["duraklar"]:
        kontrol(d["eser_id"] in eser_ids, f"rotalar.json → {r['il']}: durak '{d['eser_id']}' tanımlı değil")

for eid, (ad, e) in eserler.items():
    on = f"{ad} → {eid}"
    kontrol(e.get("tur") in turler, f"{on}: tür '{e.get('tur')}' ayarlar.json'da yok")
    if "vakif_id" in e:
        kontrol(e["vakif_id"] in vakif_ids, f"{on}: vakif_id '{e['vakif_id']}' vakiflar.json'da yok")
    if "kulliye_id" in e:
        kontrol(e["kulliye_id"] in eser_ids, f"{on}: kulliye_id '{e['kulliye_id']}' tanımlı değil")
    for s in e.get("sergi_idleri", []):
        kontrol(s in sergi_ids, f"{on}: sergi '{s}' sergiler.json'da yok")
    kullanilan = [o.get("kaynak_id") for o in e.get("olgular", [])]
    kullanilan += [g.get("kaynak_id") for g in e.get("gorseller", [])]
    kullanilan += [e.get("envanter", {}).get("kaynak_id")]
    for k in filter(None, kullanilan):
        kontrol(k in kaynak_ids, f"{on}: kaynak '{k}' kaynaklar.json'da yok")
    for i, o in enumerate(e.get("olgular", [])):
        kontrol(o.get("durum") in durumlar, f"{on}: olgu {i} durumu '{o.get('durum')}' tanımsız")
        kontrol(o.get("kategori") in kategoriler, f"{on}: olgu {i} kategorisi '{o.get('kategori')}' tanımsız")
    if "konum" not in e:
        uyarilar.append(f"{on}: konum yok, haritada görünmez")
    elif not e["konum"]["dogrulandi"]:
        uyarilar.append(f"{on}: konum elle doğrulanmadı")

for v in vakiflar:
    for k in v.get("kaynak_idleri", []):
        kontrol(k in kaynak_ids, f"vakiflar.json → {v['id']}: kaynak '{k}' yok")
    for a in v.get("akislar", []):
        kontrol(a["kaynak_id"] in kaynak_ids, f"vakiflar.json → {v['id']}: kaynak '{a['kaynak_id']}' yok")
        for alan in (a["dugum"].get("eser_id"), a.get("hedef_eser_id")):
            if alan:
                kontrol(alan in eser_ids, f"vakiflar.json → {v['id']}: eser '{alan}' tanımlı değil")

# Onay kuyruğu (veri/kuyruk/*.json): şema + bağlı olduğu il ve kaynak tanımlı mı
kuyruk = sorted((veri_dir / "kuyruk").glob("*.json"))
il_ids = {p.stem for p in (veri_dir / "iller").glob("*.json")}
for k_yolu in kuyruk:
    k = sema_dogrula(k_yolu, "katki.schema.json")
    on = k_yolu.relative_to(kok)
    kontrol(k.get("il") in il_ids, f"{on}: il '{k.get('il')}' yok")
    kontrol(k.get("kaynak_id") in kaynak_ids, f"{on}: kaynak '{k.get('kaynak_id')}' yok")
    if k.get("durum") == "onaylandi":
        kontrol(k.get("eser_id") in eser_ids, f"{on}: onaylanmış ama eser '{k.get('eser_id')}' veride yok")

taslak = sum(1 for _, e in eserler.values() if e.get("taslak"))
print(f"{len(eserler)} eser ({taslak} taslak), {len(kaynaklar)} kaynak, {len(vakiflar)} vakıf, {len(sergiler)} sergi, {len(kuyruk)} katkı")
print(f"Eksik çeviri: {eksik_ceviri} metin")
for u in uyarilar:
    print("UYARI:", u)
for h in hatalar:
    print("HATA:", h)
print("Sonuç:", "GEÇTİ" if not hatalar else f"{len(hatalar)} hata")
sys.exit(1 if hatalar else 0)
