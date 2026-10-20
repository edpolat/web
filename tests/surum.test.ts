import { describe, expect, it } from "vitest";
import ayarlarJson from "../veri/ayarlar.json";
import type { Ayarlar, Eser } from "../lib/tipler";
import { KatkiHatasi, type Depo } from "../lib/sunucu/katki";
import { alanFarklari, katmanla, sonYayindakiler, surumHazirla, yayinaUygunMu, type YayindakiSurum } from "../lib/sunucu/surum";

const hamza: Eser = { id: "hamzabey-kulliyesi", ad: { tr: "Hamzabey Külliyesi" }, tur: "kulliye", banisi: "Hamza Bey", olgular: [] };

function depo(): Depo {
  return {
    iller: [{ il: { id: "bursa", ad: { tr: "Bursa" }, merkez: { enlem: 40.18, boylam: 29.06, dogrulandi: true } }, eserler: [structuredClone(hamza)] }],
    tanimlar: {
      ayarlar: ayarlarJson as Ayarlar,
      kaynakIdleri: new Set(["vk-bursa-envanter-c1-2"]),
      vakifIdleri: new Set(),
      sergiIdleri: new Set(),
      eserIdleri: new Set(["hamzabey-kulliyesi"]),
    },
  };
}

const surum = (id: number, eser_id: string, veri: Partial<Eser>, karar_tarihi: string, arsivlendi = false): YayindakiSurum => ({
  id,
  eser_id,
  il: "bursa",
  veri: { ...hamza, ...veri, id: eser_id } as Eser,
  arsivlendi,
  karar_tarihi,
});

describe("yayındaki sürümler", () => {
  it("her eserin en son onaylanan sürümü seçilir", () => {
    const son = sonYayindakiler([
      surum(1, "hamzabey-kulliyesi", { banisi: "A" }, "2026-10-20T10:00:00Z"),
      surum(3, "hamzabey-kulliyesi", { banisi: "C" }, "2026-10-20T12:00:00Z"),
      surum(2, "hamzabey-kulliyesi", { banisi: "B" }, "2026-10-20T11:00:00Z"),
    ]);
    expect(son.get("hamzabey-kulliyesi")?.veri.banisi).toBe("C");
  });

  it("JSON'un üstüne konur: düzenlenen değişir, yeni eklenir, arşivlenen çıkar", () => {
    const [bursa] = depo().iller;
    const duzenli = katmanla([bursa], sonYayindakiler([surum(1, "hamzabey-kulliyesi", { banisi: "Yeni" }, "2026-10-20T10:00:00Z")]));
    expect(duzenli[0].eserler[0].banisi).toBe("Yeni");
    const yeni = katmanla([bursa], sonYayindakiler([surum(2, "yeni-cesme", { ad: { tr: "Yeni Çeşme" } }, "2026-10-20T10:00:00Z")]));
    expect(yeni[0].eserler.map((e) => e.id)).toEqual(["hamzabey-kulliyesi", "yeni-cesme"]);
    const arsiv = katmanla([bursa], sonYayindakiler([surum(3, "hamzabey-kulliyesi", {}, "2026-10-20T10:00:00Z", true)]));
    expect(arsiv[0].eserler).toEqual([]);
    expect(katmanla([bursa], new Map())[0]).toBe(bursa);
  });
});

describe("alanFarklari", () => {
  it("yalnız değişen alanlar, id hariç", () => {
    expect(alanFarklari(hamza, { ...hamza, banisi: "Başka", mimar: "Sinan" })).toEqual([
      { alan: "banisi", eski: "Hamza Bey", yeni: "Başka" },
      { alan: "mimar", eski: null, yeni: "Sinan" },
    ]);
    expect(alanFarklari(hamza, structuredClone(hamza))).toEqual([]);
  });
});

describe("surumHazirla", () => {
  const istek = { tur: "eser_duzenle", eser_id: "hamzabey-kulliyesi", kaynak_id: "vk-bursa-envanter-c1-2", sayfa: "12", degisiklik: { banisi: "Hamza Bey bin Ali" } };

  it("düzenlemeyi tam eser hâline çevirir, gönderen hesaptan gelir", () => {
    const s = surumHazirla(istek, depo(), "Eda");
    expect(s).toMatchObject({ eser_id: "hamzabey-kulliyesi", il: "bursa", islem: "duzenle", kaynak_id: "vk-bursa-envanter-c1-2", sayfa: "12" });
    expect(s.veri.banisi).toBe("Hamza Bey bin Ali");
    expect(s.veri.ad).toEqual(hamza.ad);
  });

  it("kaynaksız, değişmeyen ya da bilinmeyen işlem reddedilir", () => {
    expect(() => surumHazirla({ ...istek, kaynak_id: "" }, depo(), "Eda")).toThrow(KatkiHatasi);
    expect(() => surumHazirla({ ...istek, degisiklik: { banisi: "Hamza Bey" } }, depo(), "Eda")).toThrow("Değişen alan yok.");
    expect(() => surumHazirla({ ...istek, tur: "olgu" }, depo(), "Eda")).toThrow("Bilinmeyen işlem.");
  });

  it("yeni eser kimliği addan üretilir", () => {
    const s = surumHazirla({ tur: "eser_ekle", il: "bursa", kaynak_id: "vk-bursa-envanter-c1-2", degisiklik: { ad: { tr: "Yeşil Çeşme" }, tur: "cesme" } }, depo(), "Eda");
    expect(s).toMatchObject({ eser_id: "yesil-cesme", islem: "ekle" });
  });
});

describe("yayinaUygunMu", () => {
  it("şemaya uyan sürüm geçer, bozuk sürüm ve yayındaki eseri yeniden ekleme reddedilir", () => {
    expect(() => yayinaUygunMu({ eser_id: "hamzabey-kulliyesi", il: "bursa", islem: "duzenle", veri: { ...hamza, banisi: "X" } }, depo())).not.toThrow();
    expect(() => yayinaUygunMu({ eser_id: "hamzabey-kulliyesi", il: "bursa", islem: "duzenle", veri: { ...hamza, tur: "uydurma" } }, depo())).toThrow(KatkiHatasi);
    expect(() => yayinaUygunMu({ eser_id: "hamzabey-kulliyesi", il: "bursa", islem: "ekle", veri: hamza }, depo())).toThrow("zaten yayında");
  });
});

describe("konum düzenleme", () => {
  it("panelden konum değişikliği sürüm olur; sınır dışı konum reddedilir", () => {
    const istek = (konum: unknown) => ({
      tur: "eser_duzenle",
      eser_id: "hamzabey-kulliyesi",
      kaynak_id: "vk-bursa-envanter-c1-2",
      degisiklik: { konum },
    });
    const hazir = surumHazirla(istek({ enlem: 40.19, boylam: 29.07, dogrulandi: true, yontem: "elle", hassasiyet: "eser" }), depo(), "Eda");
    expect(hazir.veri.konum).toEqual({ enlem: 40.19, boylam: 29.07, dogrulandi: true, yontem: "elle", hassasiyet: "eser" });
    expect(() => surumHazirla(istek({ enlem: 10, boylam: 29.07, dogrulandi: true }), depo(), "Eda")).toThrow(KatkiHatasi);
  });
});
