import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { KaynakHatasi, dosyaTuruBul, kaynagaCevir, kaynakIstegi, type KutuphaneKaynagi } from "../lib/kaynak";

const bayt = (...x: number[]) => new Uint8Array([...x, 0, 0, 0, 0]);
const yol = "00000000-0000-0000-0000-000000000001/" + "a".repeat(32);

describe("dosya türü içerikten bulunur", () => {
  it("PDF, JPG, PNG tanınır; uzantısı değiştirilmiş başka dosya tanınmaz", () => {
    expect(dosyaTuruBul(new TextEncoder().encode("%PDF-1.7\n"))).toBe("application/pdf");
    expect(dosyaTuruBul(bayt(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(dosyaTuruBul(bayt(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(dosyaTuruBul(new TextEncoder().encode("<html><script>"))).toBeUndefined();
    expect(dosyaTuruBul(bayt(0x50, 0x4b, 0x03, 0x04))).toBeUndefined(); // zip / docx
    expect(dosyaTuruBul(new Uint8Array())).toBeUndefined();
  });
});

describe("kaynakIstegi", () => {
  it("bağlantı yalnız http(s) olabilir", () => {
    expect(kaynakIstegi({ baslik: "UNESCO", tur: "baglanti", url: "https://whc.unesco.org", kaynak_turu: "kurum_sitesi" })).toMatchObject({
      url: "https://whc.unesco.org",
      nitelik: "ucuncul",
      dosya_yolu: null,
    });
    expect(() => kaynakIstegi({ baslik: "x", tur: "baglanti", url: "javascript:alert(1)" })).toThrow(KaynakHatasi);
    expect(() => kaynakIstegi({ baslik: "x", tur: "baglanti", url: "ftp://a.b" })).toThrow(KaynakHatasi);
  });

  it("dosya yolu sunucunun verdiği biçimde olmalı", () => {
    expect(kaynakIstegi({ baslik: "Vakfiye", tur: "dosya", dosya_yolu: `${yol}.pdf`, kaynak_turu: "vakfiye" })).toMatchObject({ nitelik: "birincil" });
    expect(() => kaynakIstegi({ baslik: "x", tur: "dosya", dosya_yolu: "../baskasi/dosya.pdf" })).toThrow("Önce dosyayı yükle.");
    expect(() => kaynakIstegi({ baslik: "x", tur: "dosya", dosya_yolu: `${yol}.html` })).toThrow(KaynakHatasi);
  });

  it("başlık zorunlu, bilinmeyen tür 'diger', yıl sayıya çevrilir", () => {
    expect(() => kaynakIstegi({ tur: "baglanti", url: "https://a.b" })).toThrow("Başlık gerekli.");
    expect(kaynakIstegi({ baslik: "x", tur: "baglanti", url: "https://a.b", kaynak_turu: "uydurma", yil: "1923" })).toMatchObject({
      kaynak_turu: "diger",
      yil: 1923,
    });
  });

  it("gelecek ya da geçersiz yıl reddedilir, boş yıl serbest", () => {
    const buYil = new Date().getFullYear();
    const k = { baslik: "x", tur: "baglanti", url: "https://a.b" };
    expect(() => kaynakIstegi({ ...k, yil: String(buYil + 2) })).toThrow(KaynakHatasi);
    expect(() => kaynakIstegi({ ...k, yil: "0" })).toThrow(KaynakHatasi);
    expect(() => kaynakIstegi({ ...k, yil: "19a3" })).toThrow(KaynakHatasi);
    expect(kaynakIstegi({ ...k, yil: buYil })).toMatchObject({ yil: buYil });
    expect(kaynakIstegi({ ...k, yil: "" })).toMatchObject({ yil: null });
  });
});

describe("kaynagaCevir", () => {
  const k = { id: "k-1", baslik: "B", tur: "dosya", kaynak_turu: "arsiv", url: null, dosya_yolu: `${yol}.pdf`, yazar: null, yayinci: null, yil: null, aciklama: null } as unknown as KutuphaneKaynagi;
  it("herkese açık dosya sitenin kendi ucundan, kapalı dosya bağlantısız", () => {
    expect(kaynagaCevir({ ...k, herkese_acik: true }).url).toBe("/api/kaynak/dosya/k-1");
    expect(kaynagaCevir({ ...k, herkese_acik: false }).url).toBeUndefined();
  });
});

describe("003_kaynaklar.sql", () => {
  it("veri/kaynaklar.json'daki her kaynak tohumlanır", () => {
    const sql = fs.readFileSync(path.join(__dirname, "../supabase/003_kaynaklar.sql"), "utf-8");
    const json = JSON.parse(fs.readFileSync(path.join(__dirname, "../veri/kaynaklar.json"), "utf-8")) as { id: string }[];
    for (const k of json) expect(sql).toContain(`('${k.id}',`);
  });
});
