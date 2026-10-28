import { describe, expect, it } from "vitest";
import { taslakAdresi, taslakHazirla } from "../lib/sunucu/taslak";

describe("taslakHazirla", () => {
  it("yalnız formun alanlarını alır, boşları atar, başlığı üretir", () => {
    const t = taslakHazirla({ tur: "il", veri: { ad_tr: " Kütahya ", enlem: "39.42", boylam: "", baska: "x" } });
    expect(t).toEqual({ tur: "il", hedef: null, baslik: "Kütahya", veri: { ad_tr: "Kütahya", enlem: "39.42" } });
  });
  it("kimlik verilirse güncelleme olur", () => {
    expect(taslakHazirla({ id: 7, tur: "kaynak", veri: { yazar: "Ayşe" } })).toMatchObject({ id: 7, baslik: "Adsız kaynak" });
  });
  it("bilinmeyen tür, boş taslak ve hedefsiz bilgi taslağını reddeder", () => {
    expect(() => taslakHazirla({ tur: "eser", veri: { ad: "x" } })).toThrow(/tür/);
    expect(() => taslakHazirla({ tur: "il", veri: { ad_tr: "  " } })).toThrow(/Boş taslak/);
    expect(() => taslakHazirla({ tur: "bilgi", veri: { deger: "1248" } })).toThrow(/esere/);
  });
  it("bilgi taslağı eseri hedef olarak taşır", () => {
    const t = taslakHazirla({ tur: "bilgi", hedef: "ulu-camii", veri: { alan: "donem", deger: "1399" } });
    expect(t).toMatchObject({ hedef: "ulu-camii", baslik: "ulu-camii · donem" });
  });
  it("çok uzun alanı reddeder", () => {
    expect(() => taslakHazirla({ tur: "kaynak", veri: { aciklama: "a".repeat(2001) } })).toThrow(/uzun/);
  });
});

describe("taslakAdresi", () => {
  it("taslağın formuna götürür", () => {
    expect(taslakAdresi("tr", { id: 3, tur: "il", hedef: null })).toBe("/tr/yonetim/iller?taslak=3#il-formu");
    expect(taslakAdresi("en", { id: 4, tur: "bilgi", hedef: "ulu-camii" })).toBe("/en/yonetim/eser/ulu-camii/gecmis?taslak=4#bilgi-formu");
  });
});
