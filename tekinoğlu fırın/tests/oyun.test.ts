import { describe, expect, it } from "vitest";
import {
  acikSecimler,
  ayaktaKalmaOrani,
  gecerliAyar,
  ilerle,
  karaKadar,
  karar,
  kisanOyuncu,
  kur,
  oynat,
  VARSAYILAN_AYAR,
  VARSAYILAN_TOHUM,
  type Ayar,
} from "../lib/oyun";

const ayar = (p: Partial<Ayar>): Ayar => ({ ...VARSAYILAN_AYAR, ...p });
const agirlikli = (m: "hamam" | "han" | "arazi"): Ayar =>
  ayar({ sermaye: { hamam: 10, han: 10, arazi: 10, nakit: 10, [m]: 70 } });

describe("vakıf oyunu motoru", () => {
  it("sermaye toplamı 100 değilse vakıf kurulmaz", () => {
    expect(gecerliAyar(ayar({ sermaye: { hamam: 30, han: 30, arazi: 20, nakit: 10 } }))).toBe(false);
    expect(() => kur(ayar({ sermaye: { hamam: 50, han: 50, arazi: 50, nakit: 0 } }))).toThrow();
  });

  it("aynı tohum aynı oyunu verir", () => {
    expect(oynat(VARSAYILAN_AYAR, 1339)).toEqual(oynat(VARSAYILAN_AYAR, 1339));
    expect(karaKadar(kur(VARSAYILAN_AYAR, 7)).turlar).toEqual(karaKadar(kur(VARSAYILAN_AYAR, 7)).turlar);
  });

  it("deprem ya da yangında oyun durur, karar verilmeden ilerlemez", () => {
    let d = kur(VARSAYILAN_AYAR, 1339);
    d = karaKadar(d);
    expect(d.bekleyen).toBeDefined();
    expect(ilerle(d)).toBe(d);
    expect(acikSecimler(d).kis).toBe(true);
    const sonra = karar(d, "kis");
    expect(sonra.bekleyen).toBeUndefined();
    expect(sonra.turlar.at(-1)?.karar).toBe("kis");
  });

  it("fon yetmiyorsa 'Yedek fonu kullan' kapalıdır", () => {
    let d = kur(ayar({ fon: 0 }), 1339);
    d = karaKadar(d);
    expect(d.bekleyen).toBeDefined();
    expect(acikSecimler(d).fon).toBe(false);
    expect(karar(d, "fon")).toBe(d);
  });

  it("sunum tohumu: varsayılan vakıf ayakta kalır, hamamı 70 yapan 130. yılda çöker", () => {
    expect(oynat(VARSAYILAN_AYAR, VARSAYILAN_TOHUM).ayakta).toBe(true);
    const sonuc = oynat(agirlikli("hamam"), VARSAYILAN_TOHUM);
    expect(sonuc.ayakta).toBe(false);
    expect(sonuc.yil).toBe(130);
    expect(sonuc.ders).toBe("tek_kaynak");
  });

  // Mobil plandaki 300 tohumluk ölçüm. Katsayı değişikliği bir dersi tersine çevirirse bu test kırılır.
  describe("oyunun dört dersi (300 tohum)", () => {
    const dengeli = ayaktaKalmaOrani(VARSAYILAN_AYAR);

    it("yedek fon, iyi niyetten uzun yaşar", () => {
      const fon0 = ayaktaKalmaOrani(ayar({ fon: 0 }));
      const fon40 = ayaktaKalmaOrani(ayar({ fon: 40 }));
      expect(fon0).toBeLessThan(0.15);
      expect(fon0).toBeLessThan(dengeli);
      expect(dengeli).toBeLessThan(fon40);
    });

    it("gelir kaynaklarını dağıt", () => {
      expect(ayaktaKalmaOrani(agirlikli("hamam"))).toBeLessThan(dengeli);
      expect(ayaktaKalmaOrani(agirlikli("han"))).toBeLessThan(dengeli);
      // Arazi yıkılmaz; ağırlıklı vakıf dengeliden belirgin biçimde iyi olmamalı.
      expect(ayaktaKalmaOrani(agirlikli("arazi"))).toBeLessThanOrEqual(dengeli + 0.02);
    });

    it("vakfı mütevellinin dürüstlüğü ayakta tutar", () => {
      expect(ayaktaKalmaOrani(ayar({ mutevelli: "becerikli" }))).toBeLessThan(dengeli - 0.1);
    });

    it("mülkü onar, erteleme", () => {
      expect(ayaktaKalmaOrani(VARSAYILAN_AYAR, 300, kisanOyuncu)).toBeLessThan(dengeli - 0.1);
    });
  });
});
