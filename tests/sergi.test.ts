import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SergiHatasi, satirdanSergi, sergiDurumu, sergiIstegi, sergiKimligi, sergidenForm, type SergiSatiri } from "../lib/sergi";
import type { Sergi } from "../lib/tipler";

const temel = { ad_tr: "Bir Rüyanın İzinde", yer: "Tayyare Kültür Merkezi", baslangic: "2026-09-17" };

describe("sergi formu doğrulaması", () => {
  it("yeni sergide kimlik addan üretilir, boş alanlar null olur", () => {
    const x = sergiIstegi({ ...temel, ad_en: "  ", url: "" }, true);
    expect(x.id).toBe("bir-ruyanin-izinde");
    expect(x.ad_en).toBeNull();
    expect(x.url).toBeNull();
    expect(x.bitis).toBeNull();
  });

  it("Türkçe harfler kimlikte sadeleşir", () => {
    expect(sergiKimligi("İstanbul'u Gören Rüya: Bursa")).toBe("istanbul-u-goren-ruya-bursa");
    expect(sergiKimligi("AYNA – Anadolu Göğünün İpek Mahyası")).toBe("ayna-anadolu-gogunun-ipek-mahyasi");
  });

  it("düzenlemede kimlik zorunlu ve kalıba uymalı", () => {
    expect(() => sergiIstegi(temel, false)).toThrow(SergiHatasi);
    expect(() => sergiIstegi({ ...temel, id: "Büyük Harf" }, false)).toThrow(/Kimlik/);
    expect(sergiIstegi({ ...temel, id: "ayna" }, false).id).toBe("ayna");
  });

  it("ad zorunlu, uzunluk sınırlı", () => {
    expect(() => sergiIstegi({ ...temel, ad_tr: " " }, true)).toThrow(/Türkçe ad/);
    expect(() => sergiIstegi({ ...temel, yer: "x".repeat(301) }, true)).toThrow(/Yer/);
    expect(() => sergiIstegi({ ...temel, ad_tr: 5 }, true)).toThrow(SergiHatasi);
  });

  it("tarihler geçerli gün olmalı, bitiş başlangıçtan önce olamaz", () => {
    expect(() => sergiIstegi({ ...temel, baslangic: "2026-02-30" }, true)).toThrow(/geçerli/);
    expect(() => sergiIstegi({ ...temel, baslangic: "17.09.2026" }, true)).toThrow(/YYYY/);
    expect(() => sergiIstegi({ ...temel, bitis: "2026-09-01" }, true)).toThrow(/önce/);
    expect(() => sergiIstegi({ ...temel, baslangic: "", bitis: "2026-09-01" }, true)).toThrow(/başlangıç/);
    expect(sergiIstegi({ ...temel, bitis: "2026-09-17" }, true).bitis).toBe("2026-09-17");
  });

  it("haber bağlantısı yalnız http(s)", () => {
    expect(() => sergiIstegi({ ...temel, url: "javascript:alert(1)" }, true)).toThrow(/Haber/);
    expect(() => sergiIstegi({ ...temel, url: "ftp://a.b/c" }, true)).toThrow(/Haber/);
    expect(sergiIstegi({ ...temel, url: "https://ornek.com/haber" }, true).url).toBe("https://ornek.com/haber");
  });
});

describe("satır ↔ sergi", () => {
  it("veri/sergiler.json'daki her sergi tablo satırına ve geri aynı çevrilir", () => {
    const json = JSON.parse(fs.readFileSync(path.join(__dirname, "../veri/sergiler.json"), "utf-8")) as Sergi[];
    for (const x of json) {
      const satir: SergiSatiri = {
        id: x.id, ad_tr: x.ad.tr, ad_en: x.ad.en ?? null, sehir: x.sehir ?? null, yer: x.yer ?? null, harita: x.harita ?? null,
        baslangic: x.baslangic ?? null, bitis: x.bitis ?? null, aciklama_tr: x.aciklama?.tr ?? null, aciklama_en: x.aciklama?.en ?? null,
        url: x.url ?? null, kaynak_id: x.kaynak_id ?? null,
      };
      expect(satirdanSergi(satir)).toEqual(x);
      // Formdan gelen hâli de doğrulamadan geçer.
      expect(() => sergiIstegi(sergidenForm(x), false)).not.toThrow();
    }
  });

  it("017 migration'ı JSON'daki bütün sergileri taşır", () => {
    const sql = fs.readFileSync(path.join(__dirname, "../supabase/017_sergiler.sql"), "utf-8");
    const json = JSON.parse(fs.readFileSync(path.join(__dirname, "../veri/sergiler.json"), "utf-8")) as Sergi[];
    for (const x of json) expect(sql).toContain(`('${x.id}', `);
  });

  it("durum bugüne göre", () => {
    const x: Sergi = { id: "a", ad: { tr: "A" }, baslangic: "2026-09-01", bitis: "2026-09-30" };
    expect(sergiDurumu(x, "2026-08-31")).toBe("yakinda");
    expect(sergiDurumu(x, "2026-09-15")).toBe("acik");
    expect(sergiDurumu(x, "2026-10-01")).toBe("bitti");
  });
});
