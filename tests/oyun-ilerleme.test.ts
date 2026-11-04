import { describe, expect, it } from "vitest";
import { ayniMi, ilerlemeleriBirlestir } from "../lib/oyun-ilerleme";

const bos = { toplamYildiz: 0, oynananOyun: 0, enIyiYil: 0, ogreticiBitti: false, sonOyun: null, album: [], okunan: [], sorulan: [], dogruCevap: 0, afetSorulan: [], afetDogru: 0, leveller: {} };

describe("ilerlemeleriBirlestir", () => {
  it("sayılarda büyüğü, listelerde birleşimi, levellerde en iyi yıldızı alır", () => {
    const telefon = { ...bos, toplamYildiz: 9, oynananOyun: 4, album: ["a", "b"], leveller: { "1": 3, "2": 1 }, ogreticiBitti: true };
    const web = { ...bos, toplamYildiz: 5, oynananOyun: 6, enIyiYil: 120, album: ["b", "c"], leveller: { "2": 2, "3": 1 } };
    const s = ilerlemeleriBirlestir(web, telefon);
    expect(s.toplamYildiz).toBe(9);
    expect(s.oynananOyun).toBe(6);
    expect(s.enIyiYil).toBe(120);
    expect([...(s.album as string[])].sort()).toEqual(["a", "b", "c"]);
    expect(s.leveller).toEqual({ "1": 3, "2": 2, "3": 1 });
    expect(s.ogreticiBitti).toBe(true);
  });

  it("son oyunu daha çok oyun oynanmış taraftan alır", () => {
    const a = { ...bos, oynananOyun: 2, sonOyun: { yil: 50, ayakta: true, yildiz: 1 } };
    const b = { ...bos, oynananOyun: 5, sonOyun: { yil: 90, ayakta: false, yildiz: 2 } };
    expect(ilerlemeleriBirlestir(a, b).sonOyun).toEqual(b.sonOyun);
    expect(ilerlemeleriBirlestir(b, a).sonOyun).toEqual(b.sonOyun);
  });

  it("boş ya da bozuk kayıtta öbürünü korur, bilinmeyen alanları silmez", () => {
    const a = { ...bos, toplamYildiz: 3, yeniAlan: "x" };
    expect(ilerlemeleriBirlestir(a, null)).toEqual(a);
    expect(ilerlemeleriBirlestir(undefined, a)).toEqual(a);
    expect(ilerlemeleriBirlestir({ album: "bozuk" }, { album: ["a"] }).album).toEqual(["a"]);
  });

  it("aynı kayıtla birleşince değişmez", () => {
    const a = { ...bos, toplamYildiz: 4, album: ["a"], leveller: { "1": 2 } };
    expect(ayniMi(ilerlemeleriBirlestir(a, a), a)).toBe(true);
    expect(ayniMi(ilerlemeleriBirlestir(a, bos), a)).toBe(true);
  });
});
