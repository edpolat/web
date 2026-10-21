import { describe, expect, it } from "vitest";
import { dilFarklari, dilUyarisiGerekli, karsilastirilacaklar, metinFarki, tekDilli } from "../lib/dil-uyumu";
import { oneriIstegi, oneriyiUygula } from "../lib/oneri";
import type { Eser } from "../lib/tipler";

const eser: Eser = {
  id: "hamzabey-kulliyesi",
  ad: { tr: "Hamzabey Külliyesi", en: "Hamzabey Complex" },
  tur: "kulliye",
  tarihce: { tr: "1400'lerde yapıldı.", en: "Built in the 1400s." },
  olgular: [{ metin: { tr: "Bir bilgi", en: "A fact" }, kategori: "tarih", durum: "kaynakli" }],
};

describe("iki dil uyumu", () => {
  it("yalnız Türkçesi değişen metin tek dilli sayılır", () => {
    const yeni = structuredClone(eser);
    yeni.tarihce = { tr: "1419'da yapıldı.", en: "Built in the 1400s." };
    const f = dilFarklari(eser, yeni);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ yol: "tarihce", trDegisti: true, enDegisti: false });
    expect(tekDilli(f[0])).toBe(true);
    expect(dilUyarisiGerekli(f, false)).toBe(true);
    // Gönderen "uyum için" dediyse uyarı yok.
    expect(dilUyarisiGerekli(f, true)).toBe(false);
  });

  it("iki dili birlikte değişen metin uyarı vermez ama YZ'ye sorulur", () => {
    const yeni = structuredClone(eser);
    yeni.ad = { tr: "Hamza Bey Külliyesi", en: "Hamza Bey Complex" };
    const f = dilFarklari(eser, yeni);
    expect(dilUyarisiGerekli(f, false)).toBe(false);
    expect(karsilastirilacaklar(f)).toEqual([{ tr: "Hamza Bey Külliyesi", en: "Hamza Bey Complex" }]);
  });

  it("yeni eklenen yalnız Türkçe bilgi uyarı verir, YZ'ye sorulmaz", () => {
    const yeni = structuredClone(eser);
    yeni.olgular.push({ metin: { tr: "Yeni bilgi" }, kategori: "tarih", durum: "belirsiz" });
    const f = dilFarklari(eser, yeni);
    expect(f).toEqual([expect.objectContaining({ yol: "olgular.1.metin", alan: "olgular", sira: 1, trDegisti: true, enDegisti: false })]);
    expect(dilUyarisiGerekli(f, false)).toBe(true);
    expect(karsilastirilacaklar(f)).toEqual([]);
  });

  it("boşluk farkı değişiklik sayılmaz, değişmeyen eser fark vermez", () => {
    const yeni = structuredClone(eser);
    yeni.ad = { tr: " Hamzabey Külliyesi ", en: "Hamzabey Complex" };
    expect(dilFarklari(eser, yeni)).toEqual([]);
    expect(metinFarki("ad", eser.ad, eser.ad)).toBeNull();
  });

  it("yeni eserde İngilizcesi olmayan metinler tek dilli", () => {
    const f = dilFarklari(undefined, { ...eser, adres: { tr: "Bursa" } });
    expect(f.filter(tekDilli).map((x) => x.yol)).toEqual(["adres"]);
  });
});

describe("öneride dil", () => {
  const temel = { eser_id: "hamzabey-kulliyesi", onerilen: "Hamza Bey Complex", kaynak: "yok" };

  it("iki dilli alanda dil ve uyum işareti okunur", () => {
    expect(oneriIstegi({ ...temel, alan: "ad", dil: "en", dil_uyumu: true })).toMatchObject({ dil: "en", dil_uyumu: true });
  });

  it("tek dilli alanda dil hep tr, yeni bilgide uyum işareti yok", () => {
    expect(oneriIstegi({ ...temel, alan: "banisi", dil: "en", dil_uyumu: true })).toMatchObject({ dil: "tr", dil_uyumu: false });
    expect(oneriIstegi({ ...temel, alan: "olgu", dil: "en", dil_uyumu: true })).toMatchObject({ dil: "en", dil_uyumu: false });
  });

  it("kabulde İngilizce verilirse iki dil birlikte değişir, verilmezse İngilizce kalır", () => {
    expect(oneriyiUygula(eser, "ad", "Hamza Bey Külliyesi", { en: "Hamza Bey Complex" }).ad).toEqual({ tr: "Hamza Bey Külliyesi", en: "Hamza Bey Complex" });
    expect(oneriyiUygula(eser, "ad", "Hamza Bey Külliyesi").ad).toEqual({ tr: "Hamza Bey Külliyesi", en: "Hamzabey Complex" });
    const olgu = oneriyiUygula(eser, "olgu", "Yeni bilgi", { kategori: "tarih", en: "New fact" }).olgular.at(-1);
    expect(olgu?.metin).toEqual({ tr: "Yeni bilgi", en: "New fact" });
  });

  it("öneri kabulünde yalnız Türkçe değişirse uyarı gerekir", () => {
    const yeni = oneriyiUygula(eser, "ad", "Hamza Bey Külliyesi");
    expect(dilUyarisiGerekli(dilFarklari(eser, yeni), false)).toBe(true);
    const ikisi = oneriyiUygula(eser, "ad", "Hamza Bey Külliyesi", { en: "Hamza Bey Complex" });
    expect(dilUyarisiGerekli(dilFarklari(eser, ikisi), false)).toBe(false);
  });
});
