import { describe, expect, it } from "vitest";
import { filtrele, sadelestir } from "../lib/filtre";
import { ceviriEksik, metin } from "../lib/metin";
import type { IlliEser } from "../lib/tipler";

const eser = (id: string, il: string, tur: string, ad: string, en?: string): IlliEser => ({
  id, il, tur, ad: { tr: ad, ...(en ? { en } : {}) }, olgular: [],
});

const eserler = [
  eser("yesil-cami", "bursa", "cami", "Yeşil Cami", "Green Mosque"),
  eser("koza-han", "bursa", "han", "Koza Han"),
  eser("mevlana", "konya", "turbe", "Mevlânâ Türbesi"),
];

describe("filtrele", () => {
  it("şehre göre süzer", () => {
    expect(filtrele(eserler, { il: "bursa" }, "tr").map((e) => e.id)).toEqual(["yesil-cami", "koza-han"]);
  });
  it("şehir ve türü birlikte uygular", () => {
    expect(filtrele(eserler, { il: "bursa", tur: "han" }, "tr").map((e) => e.id)).toEqual(["koza-han"]);
  });
  it("Türkçe karakterden bağımsız arar", () => {
    expect(filtrele(eserler, { ara: "yesil" }, "tr")).toHaveLength(1);
    expect(filtrele(eserler, { ara: "MEVLANA" }, "tr")).toHaveLength(1);
  });
  it("İngilizce arayüzde İngilizce adla da bulur", () => {
    expect(filtrele(eserler, { ara: "green" }, "en")).toHaveLength(1);
  });
  it("filtre boşsa hepsini verir", () => {
    expect(filtrele(eserler, {}, "tr")).toHaveLength(3);
  });
});

describe("metin", () => {
  it("İngilizcesi yoksa Türkçeye düşer ve bunu bildirir", () => {
    expect(metin({ tr: "Koza Han" }, "en")).toBe("Koza Han");
    expect(ceviriEksik({ tr: "Koza Han" }, "en")).toBe(true);
    expect(ceviriEksik({ tr: "a", en: "b" }, "en")).toBe(false);
  });
  it("İ ve ı harflerini doğru sadeleştirir", () => {
    expect(sadelestir("İmaret")).toBe("imaret");
    expect(sadelestir("Kılıç")).toBe("kilic");
  });
});

import { kucukGorsel } from "../lib/gorsel";
describe("kucukGorsel", () => {
  it("webp için önizleme dosyasını verir", () => {
    expect(kucukGorsel("/gorseller/bursa/x/01.webp")).toBe("/gorseller/bursa/x/01_kucuk.webp");
    expect(kucukGorsel("/a.jpg")).toBe("/a.jpg");
  });
});
