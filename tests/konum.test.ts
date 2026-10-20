import { describe, expect, it } from "vitest";
import { konumEksik } from "../lib/filtre";
import { KonumHatasi, konumDenetle, konumuYaz, type IlDosyasi } from "../lib/sunucu/konum";

function dosya(): IlDosyasi {
  return {
    il: { id: "bursa", ad: { tr: "Bursa" }, merkez: { enlem: 40.18, boylam: 29.06, dogrulandi: true } },
    eserler: [
      { id: "a", ad: { tr: "A" }, tur: "cami", olgular: [], konum: { enlem: 40.1, boylam: 29.1, dogrulandi: false, yontem: "geocoding", hassasiyet: "mahalle" } },
      { id: "b", ad: { tr: "B" }, tur: "cami", olgular: [] },
    ],
  };
}

describe("konumuYaz", () => {
  it("konumu elle doğrulanmış eser düzeyinde yazar", () => {
    const d = dosya();
    expect(konumuYaz(d, "b", 40.1834567891, 29.0612345678)).toEqual({
      enlem: 40.183457, boylam: 29.061235, dogrulandi: true, yontem: "elle", hassasiyet: "eser",
    });
    expect(d.eserler[1].konum?.dogrulandi).toBe(true);
  });
  it("bilinmeyen eserde undefined döner", () => {
    expect(konumuYaz(dosya(), "yok", 40, 29)).toBeUndefined();
  });
  it("Türkiye dışını ve sayı olmayanı reddeder", () => {
    expect(() => konumuYaz(dosya(), "a", 0, 0)).toThrow(KonumHatasi);
    expect(() => konumDenetle("40", 29)).toThrow(KonumHatasi);
  });
});

describe("konumEksik", () => {
  it("yok, doğrulanmamış ve mahalle düzeyindekini eksik sayar", () => {
    expect(konumEksik(undefined)).toBe(true);
    expect(konumEksik(dosya().eserler[0].konum)).toBe(true);
    expect(konumEksik({ enlem: 40, boylam: 29, dogrulandi: true, hassasiyet: "eser" })).toBe(false);
    expect(konumEksik({ enlem: 40, boylam: 29, dogrulandi: true, yontem: "elle" })).toBe(false);
  });
});
