import { describe, expect, it } from "vitest";
import { KatkiHatasi, olgulariDuzenle } from "../lib/sunucu/katki";
import type { Olgu } from "../lib/tipler";

const mevcut: Olgu[] = [
  { metin: { tr: "Cami 1450'de yapıldı. ", en: "Built in 1450." }, kategori: "tarihce", durum: "kaynakli", kaynak_id: "k1", sayfa: "12" },
  { metin: { tr: "Kubbesi kurşun kaplıdır.", en: "Lead dome." }, kategori: "mimari", durum: "kaynakli", kaynak_id: "k1", en_ceviri: "yz" },
];

describe("olgulariDuzenle", () => {
  it("değişmeyen metin (boşluk farkıyla) aynen kalır", () => {
    const sonuc = olgulariDuzenle(mevcut, mevcut.map((o) => ({ metin: { tr: o.metin.tr.trim(), en: o.metin.en } })));
    expect(sonuc).toEqual(mevcut);
  });
  it("yalnız metin değişir; kaynak, sayfa, kategori korunur, istekteki başka alanlar yok sayılır", () => {
    const sonuc = olgulariDuzenle(mevcut, [{ metin: { tr: "Cami 1451'de yapıldı.", en: "Built in 1450." }, kaynak_id: "baska", durum: "x" }, null]);
    expect(sonuc).toEqual([{ ...mevcut[0], metin: { tr: "Cami 1451'de yapıldı.", en: "Built in 1450." } }]);
  });
  it("İngilizce değişince YZ çevirisi işareti düşer", () => {
    const sonuc = olgulariDuzenle(mevcut, [{ metin: { tr: mevcut[0].metin.tr } }, { metin: { tr: mevcut[1].metin.tr, en: "Its dome is lead-covered." } }]);
    expect(sonuc[1].en_ceviri).toBeUndefined();
    expect(sonuc[0].metin.en).toBeUndefined();
  });
  it("boş Türkçe metin ve uyuşmayan liste reddedilir", () => {
    expect(() => olgulariDuzenle(mevcut, [{ metin: { tr: " " } }, null])).toThrow(KatkiHatasi);
    expect(() => olgulariDuzenle(mevcut, [null])).toThrow(KatkiHatasi);
  });
});
