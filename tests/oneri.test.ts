import { describe, expect, it } from "vitest";
import ayarlarJson from "../veri/ayarlar.json";
import type { Ayarlar, Eser } from "../lib/tipler";
import type { Depo } from "../lib/sunucu/katki";
import { yayinaUygunMu } from "../lib/sunucu/surum";
import { OneriHatasi, mevcutDeger, oneriIstegi, oneriyiUygula } from "../lib/oneri";

const hamza: Eser = { id: "hamzabey-kulliyesi", ad: { tr: "Hamzabey Külliyesi", en: "Hamzabey Complex" }, tur: "kulliye", banisi: "Hamza Bey", olgular: [] };
const yol = "00000000-0000-0000-0000-000000000003/0123456789abcdef0123456789abcdef";

function depo(): Depo {
  return {
    iller: [{ il: { id: "bursa", ad: { tr: "Bursa" }, merkez: { enlem: 40.18, boylam: 29.06, dogrulandi: true } }, eserler: [structuredClone(hamza)] }],
    tanimlar: {
      ayarlar: ayarlarJson as Ayarlar,
      kaynakIdleri: new Set(["vk-bursa-envanter-c1-2", "k-0123456789"]),
      vakifIdleri: new Set(),
      sergiIdleri: new Set(),
      eserIdleri: new Set(["hamzabey-kulliyesi"]),
    },
  };
}
const gecerli = (veri: Eser) => yayinaUygunMu({ eser_id: veri.id, il: "bursa", veri, islem: "duzenle" }, depo());

describe("bilgi önerisi isteği", () => {
  const temel = { eser_id: "hamzabey-kulliyesi", alan: "olgu", onerilen: "  Bir bilgi " };

  it("kaynaksız öneri kabul edilir, konum atılır", () => {
    expect(oneriIstegi({ ...temel, kaynak: "yok", konum: "s. 3" })).toMatchObject({ onerilen: "Bir bilgi", kaynak_id: null, url: null, konum: null });
  });

  it("alan, metin ve kaynak seçimi denetlenir", () => {
    expect(() => oneriIstegi({ ...temel, alan: "uydurma" })).toThrow(OneriHatasi);
    expect(() => oneriIstegi({ ...temel, onerilen: " " })).toThrow("Önerini yaz.");
    expect(() => oneriIstegi({ ...temel, kaynak: "kutuphane" })).toThrow("Listeden bir kaynak seç.");
    expect(() => oneriIstegi({ ...temel, kaynak: "baglanti", url: "javascript:alert(1)" })).toThrow(OneriHatasi);
    expect(oneriIstegi({ ...temel, kaynak: "baglanti", url: "https://a.b/c", konum: "s. 4", kaynak_turu: "arsiv" })).toMatchObject({
      url: "https://a.b/c",
      konum: "s. 4",
      kaynak_turu: "arsiv",
    });
    expect(oneriIstegi({ ...temel, kaynak: "baglanti", url: "https://a.b/c", kaynak_turu: "uydurma" }).kaynak_turu).toBe("diger");
    expect(oneriIstegi({ ...temel, kaynak: "yok", kaynak_turu: "arsiv" }).kaynak_turu).toBeNull();
  });

  it("dosya sunucunun verdiği yolda olmalı ve hak onayı zorunlu", () => {
    expect(() => oneriIstegi({ ...temel, kaynak: "dosya", dosya_yolu: "../x.pdf", hak_onayi: true })).toThrow("Önce dosyayı yükle.");
    expect(() => oneriIstegi({ ...temel, kaynak: "dosya", dosya_yolu: `${yol}.pdf` })).toThrow(/hak/);
    expect(oneriIstegi({ ...temel, kaynak: "dosya", dosya_yolu: `${yol}.pdf`, hak_onayi: true })).toMatchObject({ dosya_yolu: `${yol}.pdf`, hak_onayi: true });
  });
});

describe("öneriyi esere uygulama", () => {
  it("kaynaklı bilgi olgu olarak eklenir ve il şemasına uyar", () => {
    const veri = oneriyiUygula(hamza, "olgu", "Yeni bilgi", { kategori: "tarihce", kaynak_id: "k-0123456789", konum: "112" });
    expect(veri.olgular.at(-1)).toEqual({ metin: { tr: "Yeni bilgi" }, kategori: "tarihce", durum: "kaynakli", kaynak_id: "k-0123456789", sayfa: "112" });
    expect(hamza.olgular).toHaveLength(0);
    expect(() => gecerli(veri)).not.toThrow();
  });

  it("kaynaksız bilgi 'belirsiz' olur", () => {
    const veri = oneriyiUygula(hamza, "olgu", "Söylenti", { kategori: "tarihce" });
    expect(veri.olgular.at(-1)).toEqual({ metin: { tr: "Söylenti" }, kategori: "tarihce", durum: "belirsiz" });
    expect(() => gecerli(veri)).not.toThrow();
  });

  it("alanlar değişir; çok dilli alanda İngilizce korunur", () => {
    expect(oneriyiUygula(hamza, "banisi", "Hamza Bey bin X").banisi).toBe("Hamza Bey bin X");
    expect(oneriyiUygula(hamza, "ad", "Hamza Bey Külliyesi").ad).toEqual({ tr: "Hamza Bey Külliyesi", en: "Hamzabey Complex" });
    const yil = oneriyiUygula(hamza, "yapim_yili", "1415");
    expect(yil.donem?.yapim_yili).toBe(1415);
    expect(() => gecerli(yil)).not.toThrow();
    expect(mevcutDeger(yil, "yapim_yili")).toBe("1415");
    expect(mevcutDeger(hamza, "banisi")).toBe("Hamza Bey");
  });

  it("geçersiz değerler reddedilir", () => {
    expect(() => oneriyiUygula(hamza, "yapim_yili", String(new Date().getFullYear() + 1))).toThrow(OneriHatasi);
    expect(() => oneriyiUygula(hamza, "olgu", "x")).toThrow("kategori");
    expect(() => oneriyiUygula(hamza, "diger", "x")).toThrow("Uygulanacak alanı seç.");
    expect(() => oneriyiUygula(hamza, "banisi", "  ")).toThrow(OneriHatasi);
  });
});
