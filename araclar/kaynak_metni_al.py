#!/usr/bin/env python3
"""Envanter kitabının bölüm PDF'lerinden YZ kaynak analizi için sayfa sayfa metin çıkarır.

Çıktı: veri/kaynak-metinleri/<kaynak_id>.json  { kaynak_id, aciklama, sayfalar: [{ sayfa, pdf_sayfa, metin }] }
sayfa kitabın kendi numarasıdır (her sayfanın altındaki numara); pdf_sayfa o sayfanın PDF'teki sırasıdır.
Birden çok PDF verilirse pdf_sayfa, PDF'ler bu sırayla birleştirilmiş gibi sayılır (pdfunite ile aynı sıra).
Gerekli: pdftotext (poppler). Kullanım:

  python3 araclar/kaynak_metni_al.py vk-bursa-envanter-c3 "2-Gemlik.pdf" "3-Gürsu.pdf"
"""
import json
import re
import subprocess
import sys
from pathlib import Path

NUMARA = re.compile(r"^(?:.*\S\s)?(\d{3})$")


def sayfalar(pdf: str, kayma: int) -> tuple[dict[int, str], dict[int, int], int]:
    """Kitap sayfası -> metin, kitap sayfası -> PDF sayfası (kayma eklenmiş) ve PDF'in sayfa sayısı."""
    metin = subprocess.run(["pdftotext", "-raw", pdf, "-"], check=True, capture_output=True, text=True).stdout
    sonuc: dict[int, str] = {}
    pdf_sayfasi: dict[int, int] = {}
    birikim: list[str] = []
    parcalar = metin.split("\f")
    if parcalar and not parcalar[-1].strip():
        parcalar.pop()
    satirlar = [(i + 1, satir) for i, parca in enumerate(parcalar) for satir in parca.splitlines()]
    for sira, satir in satirlar:
        s = satir.strip()
        m = NUMARA.match(s)
        # Sayfa altı numarası: tek başına sayı ya da "Bölüm adı / Section 325" satırı. Birikmiş metin o sayfanındır.
        if m and (s.isdigit() or "/" in s) and 100 <= int(m.group(1)) <= 999:
            no = int(m.group(1))
            yazi = "\n".join(x for x in birikim if x).strip()
            if yazi:
                sonuc[no] = (sonuc.get(no, "") + "\n" + yazi).strip()
                pdf_sayfasi.setdefault(no, kayma + sira)
            birikim = []
        else:
            birikim.append(s)
    return sonuc, pdf_sayfasi, len(parcalar)


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    kaynak_id, pdfler = sys.argv[1], sys.argv[2:]
    tumu: dict[int, str] = {}
    pdf_sayfasi: dict[int, int] = {}
    kayma = 0
    for pdf in pdfler:
        metinler, sayfa_no, adet = sayfalar(pdf, kayma)
        for no, yazi in metinler.items():
            tumu[no] = (tumu.get(no, "") + "\n" + yazi).strip()
            pdf_sayfasi.setdefault(no, sayfa_no[no])
        kayma += adet
    hedef = Path(__file__).resolve().parent.parent / "veri" / "kaynak-metinleri" / f"{kaynak_id}.json"
    hedef.parent.mkdir(parents=True, exist_ok=True)
    veri = {
        "kaynak_id": kaynak_id,
        "aciklama": "Kitabın web sürümü bölüm PDF'lerinden çıkarıldı: " + ", ".join(Path(p).name for p in pdfler),
        "sayfalar": [{"sayfa": no, "pdf_sayfa": pdf_sayfasi[no], "metin": tumu[no]} for no in sorted(tumu)],
    }
    hedef.write_text(json.dumps(veri, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{hedef.name}: {len(veri['sayfalar'])} sayfa ({min(tumu)}-{max(tumu)}), {sum(len(x) for x in tumu.values())} harf")


if __name__ == "__main__":
    main()
