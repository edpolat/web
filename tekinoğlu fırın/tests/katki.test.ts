import { describe, expect, it } from "vitest";
import ayarlarJson from "../veri/ayarlar.json";
import type { Ayarlar, Katki } from "../lib/tipler";
import { KatkiHatasi, denetleVeUygula, farklar, katkiOlustur, kimlikUret, uygula, type Depo } from "../lib/sunucu/katki";
import { jeton, jetonGecerli, sifreDogru } from "../lib/sunucu/yonetim";

function depo(): Depo {
  return {
    iller: [
      {
        il: { id: "bursa", ad: { tr: "Bursa" }, merkez: { enlem: 40.18, boylam: 29.06, dogrulandi: true } },
        eserler: [
          { id: "hamzabey-kulliyesi", ad: { tr: "Hamzabey Külliyesi" }, tur: "kulliye", banisi: "Hamza Bey", olgular: [] },
        ],
      },
    ],
    tanimlar: {
      ayarlar: ayarlarJson as Ayarlar,
      kaynakIdleri: new Set(["vk-bursa-envanter-c1-2"]),
      vakifIdleri: new Set(),
      sergiIdleri: new Set(),
      eserIdleri: new Set(["hamzabey-kulliyesi"]),
    },
  };
}

const secenek = (yonetici = false) => ({ yonetici, simdi: new Date("2026-10-18T10:00:00Z"), ek: "abc123" });

const olguIstegi = {
  tur: "olgu",
  eser_id: "hamzabey-kulliyesi",
  nereden: "uygulama",
  ekleyen: "Saha ekibi",
  kaynak_id: "vk-bursa-envanter-c1-2",
  sayfa: "112",
  olgu: { metin: { tr: "Külliye 15. yüzyılda yapıldı." }, kategori: "tarihce" },
};

describe("kimlikUret", () => {
  it("Türkçe adı kimliğe çevirir", () => {
    expect(kimlikUret("Hacı İvaz Paşa Camii")).toBe("haci-ivaz-pasa-camii");
    expect(kimlikUret("Şehzade Çeşmesi (Üç Kapı)")).toBe("sehzade-cesmesi-uc-kapi");
  });
});

describe("katkiOlustur", () => {
  it("kaynaklı bilgiyi bekleyen katkı olarak kurar", () => {
    const k = katkiOlustur(olguIstegi, depo(), secenek());
    expect(k).toMatchObject({ id: "20261018-abc123", tur: "olgu", il: "bursa", nereden: "uygulama", durum: "bekliyor" });
  });

  it("kaynaksız ya da tanımsız kaynakla göndereni reddeder", () => {
    expect(() => katkiOlustur({ ...olguIstegi, kaynak_id: "" }, depo(), secenek())).toThrow("Kaynak seçilmeden");
    expect(() => katkiOlustur({ ...olguIstegi, kaynak_id: "uydurma" }, depo(), secenek())).toThrow(KatkiHatasi);
  });

  it("tanımsız kategoriyi ve olmayan eseri reddeder", () => {
    expect(() => katkiOlustur({ ...olguIstegi, olgu: { metin: { tr: "x" }, kategori: "yok" } }, depo(), secenek())).toThrow(KatkiHatasi);
    expect(() => katkiOlustur({ ...olguIstegi, eser_id: "yok" }, depo(), secenek())).toThrow("Eser bulunamadı");
  });

  it("eser düzenlemeyi yalnız yöneticiden ve yalnız değişen alanlarla alır", () => {
    const istek = {
      tur: "eser_duzenle",
      eser_id: "hamzabey-kulliyesi",
      ekleyen: "Ofis",
      kaynak_id: "vk-bursa-envanter-c1-2",
      degisiklik: { ad: { tr: "Hamzabey Külliyesi" }, banisi: "Hamza Bey bin Umur", ilce: "Osmangazi" },
    };
    expect(() => katkiOlustur(istek, depo(), secenek(false))).toThrow("yönetim girişi");
    const k = katkiOlustur(istek, depo(), secenek(true));
    expect(k.degisiklik).toEqual({ banisi: "Hamza Bey bin Umur", ilce: "Osmangazi" });
    expect(k.onceki).toEqual({ banisi: "Hamza Bey", ilce: null });
  });

  it("şemayı bozacak düzenlemeyi kuyruğa almaz", () => {
    const istek = { tur: "eser_duzenle", eser_id: "hamzabey-kulliyesi", ekleyen: "Ofis", kaynak_id: "vk-bursa-envanter-c1-2", degisiklik: { tur: "uzay-istasyonu" } };
    expect(() => katkiOlustur(istek, depo(), secenek(true))).toThrow(KatkiHatasi);
  });

  it("yeni esere addan tekil kimlik verir ve envanter kaynağını yazar", () => {
    const istek = {
      tur: "eser_ekle",
      il: "bursa",
      ekleyen: "Ofis",
      kaynak_id: "vk-bursa-envanter-c1-2",
      sayfa: "40",
      degisiklik: { ad: { tr: "Hamzabey Külliyesi" }, tur: "kulliye" },
    };
    const k = katkiOlustur(istek, depo(), secenek(true));
    expect(k.eser_id).toBe("hamzabey-kulliyesi-2");
    expect(k.degisiklik).toMatchObject({ id: "hamzabey-kulliyesi-2", olgular: [], envanter: { kaynak_id: "vk-bursa-envanter-c1-2", sayfa: "40" } });
  });
});

describe("uygula ve farklar", () => {
  it("onaylanan bilgi kaynaklı olgu olarak eklenir", () => {
    const d = depo();
    const k = katkiOlustur(olguIstegi, d, secenek());
    denetleVeUygula(d.iller[0], k, d.tanimlar);
    expect(d.iller[0].eserler[0].olgular).toEqual([
      { metin: { tr: "Külliye 15. yüzyılda yapıldı." }, kategori: "tarihce", durum: "kaynakli", kaynak_id: "vk-bursa-envanter-c1-2", sayfa: "112" },
    ]);
  });

  it("null alanı siler, eski ve yeni değeri yan yana verir", () => {
    const d = depo();
    const k: Katki = {
      id: "k", tur: "eser_duzenle", eser_id: "hamzabey-kulliyesi", il: "bursa", nereden: "web", ekleyen: "x",
      kaynak_id: "vk-bursa-envanter-c1-2", durum: "bekliyor", gonderildi: "",
      degisiklik: { banisi: null, mimar: "Hacı İvaz" }, onceki: { banisi: "Hamza Bey", mimar: null },
    };
    expect(farklar(k, d.iller[0].eserler[0])).toEqual([
      { alan: "banisi", eski: "Hamza Bey", yeni: undefined, araDegisti: false },
      { alan: "mimar", eski: undefined, yeni: "Hacı İvaz", araDegisti: false },
    ]);
    uygula(d.iller[0], k);
    expect(d.iller[0].eserler[0]).not.toHaveProperty("banisi");
    expect(d.iller[0].eserler[0].mimar).toBe("Hacı İvaz");
  });
});

describe("yönetim girişi", () => {
  it("doğru şifreyi ve ondan üretilen çerezi kabul eder", () => {
    expect(sifreDogru("gizli", "gizli")).toBe(true);
    expect(sifreDogru("yanlis", "gizli")).toBe(false);
    expect(jetonGecerli(jeton("gizli"), "gizli")).toBe(true);
    expect(jetonGecerli(jeton("eski"), "gizli")).toBe(false);
    expect(jetonGecerli(undefined, "gizli")).toBe(false);
  });
});
