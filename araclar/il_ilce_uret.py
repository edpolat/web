"""turkiye-il-ilce-mahalle-koy/ klasöründen veri/il-ilce.json üretir (il -> ilçe adları, Türkçe yazımla).

Güncel ilçe listesi turkiye-il-ilce-mahalle-koy.json'dan (81 il, 2012 sonrası ilçeler dahil) alınır; ancak oradaki
adlarda ı/i harfleri bozuk (ör. "Kirikhan"). Doğru yazım turkiye-il-ilce-mahalle.json'daki BÜYÜK harfli addan
Türkçe kurallarla üretilir; orada olmayan yeni ilçelerde koy dosyasındaki ad kullanılır.
Çalıştırma: python3 araclar/il_ilce_uret.py
"""
import json
import unicodedata
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
KAYNAK = KOK / "turkiye-il-ilce-mahalle-koy"
HEDEF = KOK / "veri" / "il-ilce.json"


def temiz(s: str) -> str:
    """Birleşik nokta (U+0307) gibi artıkları atar."""
    return unicodedata.normalize("NFC", s.replace("̇", "")).strip()


def anahtar(s: str) -> str:
    """Eşleştirme anahtarı: harf büyüklüğü ve ı/i, ş/s gibi farklar yok sayılır."""
    s = temiz(s).replace("İ", "i").replace("I", "i").replace("ı", "i").lower()
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


def baslik(s: str) -> str:
    """Türkçe baş harf büyük yazım: ÇELTİK -> Çeltik, ILGIN -> Ilgın, KIRIKHAN -> Kırıkhan."""
    def kucuk(x: str) -> str:
        return x.replace("I", "ı").replace("İ", "i").lower()

    def buyuk(x: str) -> str:
        return x.replace("i", "İ").replace("ı", "I").upper()

    sozcukler = temiz(s).split(" ")
    return " ".join(buyuk(w[:1]) + kucuk(w[1:]) for w in sozcukler if w)


# Eski listede olmayan ilçelerde koy dosyası "ı" yerine "i" yazıyor; bunlar elle düzeltilir.
DUZELT = {
    "Bakirköy": "Bakırköy", "Kadiköy": "Kadıköy", "Sariyer": "Sarıyer", "Kağithane": "Kağıthane",
    "Avcilar": "Avcılar", "Bağcilar": "Bağcılar", "Altieylül": "Altıeylül", "Altinordu": "Altınordu",
    "19 Mayis": "19 Mayıs", "Kapakli": "Kapaklı", "Sultanhani": "Sultanhanı",
}


def main() -> None:
    koy = json.loads((KAYNAK / "turkiye-il-ilce-mahalle-koy.json").read_text("utf-8"))
    eski = json.loads((KAYNAK / "turkiye-il-ilce-mahalle.json").read_text("utf-8"))
    eski_il = {anahtar(il): il for il in eski}
    sonuc: dict[str, list[str]] = {}
    tahmin = []
    for il, ilceler in koy.items():
        dogru_il = eski_il.get(anahtar(il))
        il_ad = baslik(dogru_il) if dogru_il else baslik(il)
        dogru = {anahtar(x): x for x in (eski.get(dogru_il, {}) if dogru_il else {})}
        adlar = []
        for ilce in ilceler:
            d = dogru.get(anahtar(ilce))
            if d:
                adlar.append(baslik(d))
            else:
                adlar.append(DUZELT.get(baslik(ilce), baslik(ilce)))
                tahmin.append(f"{il_ad}/{baslik(ilce)}")
        sonuc[il_ad] = sorted(set(adlar), key=lambda x: anahtar(x))
    sonuc = dict(sorted(sonuc.items(), key=lambda kv: anahtar(kv[0])))
    HEDEF.write_text(json.dumps(sonuc, ensure_ascii=False, indent=0) + "\n", "utf-8")
    print(f"{len(sonuc)} il, {sum(map(len, sonuc.values()))} ilçe -> {HEDEF}")
    print("Eski listede olmayan (yazımı koy dosyasından):", ", ".join(tahmin))


if __name__ == "__main__":
    main()
