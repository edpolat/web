import { describe, expect, it } from "vitest";
import ayarlarJson from "../veri/ayarlar.json";
import type { Ayarlar, Eser, Il } from "../lib/tipler";
import { KatkiHatasi, type Depo } from "../lib/sunucu/katki";
import { ilHazirla, ilKatmanla, sonYayindakiIller, type YayindakiIl } from "../lib/sunucu/il-surum";
import { katmanla, surumHazirla, yayinaUygunMu, type YayindakiSurum } from "../lib/sunucu/surum";
import type { IlDosyasi } from "../lib/sunucu/konum";

const bursa: Il = { id: "bursa", ad: { tr: "Bursa" }, merkez: { enlem: 40.18, boylam: 29.06, dogrulandi: true } };
const hamza: Eser = { id: "hamzabey-kulliyesi", ad: { tr: "Hamzabey Külliyesi" }, tur: "kulliye", olgular: [] };
const json = (): IlDosyasi[] => [{ il: structuredClone(bursa), eserler: [structuredClone(hamza)] }];

const kutahya: Il = { id: "kutahya", ad: { tr: "Kütahya", en: "Kütahya" }, merkez: { enlem: 39.42, boylam: 29.98, dogrulandi: true, yontem: "elle" } };
const ilKaydi = (id: number, veri: Il, karar_tarihi: string): YayindakiIl => ({ id, il_id: veri.id, veri, karar_tarihi });

describe("panelden il ekleme: form", () => {
  const form = { ad_tr: "Kütahya", ad_en: "Kütahya", enlem: "39,42", boylam: "29.98", yakinlastirma: "11", envanter_kaynak_id: "", not: "Demo" };

  it("Türkçe addan kimlik üretir, virgüllü sayıyı okur, merkezi elle doğrulanmış sayar", () => {
    const h = ilHazirla(form, json(), new Set());
    expect(h.il_id).toBe("kutahya");
    expect(h.islem).toBe("ekle");
    expect(h.veri).toEqual({ ...kutahya, yakinlastirma: 11 });
    expect(h.aciklama).toBe("Demo");
  });

  it("sitede zaten olan il yeniden eklenemez", () => {
    expect(() => ilHazirla({ ...form, ad_tr: "Bursa" }, json(), new Set())).toThrow(KatkiHatasi);
  });

  it("merkez zorunlu ve Türkiye içinde olmalı", () => {
    expect(() => ilHazirla({ ...form, enlem: "" }, json(), new Set())).toThrow(/enlem/);
    expect(() => ilHazirla({ ...form, enlem: "abc" }, json(), new Set())).toThrow(KatkiHatasi);
    expect(() => ilHazirla({ ...form, enlem: "51.5", boylam: "-0.1" }, json(), new Set())).toThrow(/Türkiye/);
  });

  it("ad kısa ya da envanter kitabı tanımsızsa reddedilir", () => {
    expect(() => ilHazirla({ ...form, ad_tr: "K" }, json(), new Set())).toThrow(KatkiHatasi);
    expect(() => ilHazirla({ ...form, envanter_kaynak_id: "yok-boyle-kitap" }, json(), new Set())).toThrow(/tanımsız/);
    expect(ilHazirla({ ...form, envanter_kaynak_id: "vk-kutahya" }, json(), new Set(["vk-kutahya"])).veri.envanter_kaynak_id).toBe("vk-kutahya");
  });

  it("şemaya uymayan yakınlaştırma reddedilir", () => {
    expect(() => ilHazirla({ ...form, yakinlastirma: "30" }, json(), new Set())).toThrow(/şemasına/);
  });

  it("var olan ilin bilgisi düzeltilebilir, olmayan il düzeltilemez", () => {
    expect(ilHazirla({ ...form, ad_tr: "Bursa", il_id: "bursa" }, json(), new Set()).islem).toBe("duzenle");
    expect(() => ilHazirla({ ...form, il_id: "kutahya" }, json(), new Set())).toThrow(/bulunamadı/);
  });
});

describe("panelden il ekleme: yayındaki hâl", () => {
  it("her ilin en son onaylanan kaydı seçilir", () => {
    const son = sonYayindakiIller([
      ilKaydi(1, kutahya, "2026-10-27T10:00:00Z"),
      ilKaydi(2, { ...kutahya, yakinlastirma: 12 }, "2026-10-27T11:00:00Z"),
    ]);
    expect(son.get("kutahya")?.veri.yakinlastirma).toBe(12);
  });

  it("yeni il eserleri olmadan eklenir, JSON ilinin eserleri korunur", () => {
    const iller = ilKatmanla(json(), sonYayindakiIller([ilKaydi(1, kutahya, "2026-10-27T10:00:00Z"), ilKaydi(2, { ...bursa, yakinlastirma: 13 }, "2026-10-27T10:00:00Z")]));
    expect(iller.map((d) => d.il.id)).toEqual(["bursa", "kutahya"]);
    expect(iller[0].eserler).toHaveLength(1);
    expect(iller[0].il.yakinlastirma).toBe(13);
    expect(iller[1].eserler).toEqual([]);
  });

  it("yeni ile eklenen eser sürümü o ilin altında görünür", () => {
    const iller = ilKatmanla(json(), sonYayindakiIller([ilKaydi(1, kutahya, "2026-10-27T10:00:00Z")]));
    const ulu: Eser = { id: "ulu-camii-kutahya", ad: { tr: "Ulu Camii" }, tur: "cami", olgular: [] };
    const surum: YayindakiSurum = { id: 7, eser_id: ulu.id, il: "kutahya", veri: ulu, arsivlendi: false, karar_tarihi: "2026-10-27T10:05:00Z" };
    const sonuc = katmanla(iller, new Map([[ulu.id, surum]]));
    expect(sonuc.find((d) => d.il.id === "kutahya")?.eserler.map((e) => e.id)).toEqual(["ulu-camii-kutahya"]);
  });

  it("panelde eklenen ile eser formu gönderilebilir ve yayına uygundur", () => {
    const depo: Depo = {
      iller: ilKatmanla(json(), sonYayindakiIller([ilKaydi(1, kutahya, "2026-10-27T10:00:00Z")])),
      tanimlar: {
        ayarlar: ayarlarJson as Ayarlar,
        kaynakIdleri: new Set(["vk-kutahya"]),
        vakifIdleri: new Set(),
        sergiIdleri: new Set(),
        eserIdleri: new Set(["hamzabey-kulliyesi"]),
      },
    };
    const hazir = surumHazirla(
      { tur: "eser_ekle", il: "kutahya", kaynak_id: "vk-kutahya", sayfa: "12", degisiklik: { ad: { tr: "Ulu Camii" }, tur: "cami" } },
      depo,
      "Test",
    );
    expect(hazir.il).toBe("kutahya");
    expect(() => yayinaUygunMu({ ...hazir, eser_id: hazir.eser_id }, depo)).not.toThrow();
  });

  it("kaldırılan il sitede görünmez, yeniden onaylanınca geri gelir", () => {
    const kaldirildi = { ...ilKaydi(2, kutahya, "2026-10-27T12:00:00Z"), arsivlendi: true };
    expect(ilKatmanla(json(), sonYayindakiIller([ilKaydi(1, kutahya, "2026-10-27T10:00:00Z"), kaldirildi])).map((d) => d.il.id)).toEqual(["bursa"]);
    const geri = ilKaydi(3, kutahya, "2026-10-27T13:00:00Z");
    expect(ilKatmanla(json(), sonYayindakiIller([ilKaydi(1, kutahya, "2026-10-27T10:00:00Z"), kaldirildi, geri])).map((d) => d.il.id)).toEqual(["bursa", "kutahya"]);
  });

  it("Supabase'de il kaydı yoksa iller aynen kalır", () => {
    const iller = json();
    expect(ilKatmanla(iller, new Map())).toBe(iller);
  });
});
