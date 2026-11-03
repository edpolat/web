import { describe, expect, it } from "vitest";
import { aramaDerecesi, filtrele } from "../lib/filtre";
import { durumCumlesi, kesikleriDuzelt, kopukBasiAt, mesafeYazisi, oneCikanCumle, yolTarifiAdresi } from "../lib/gezi";
import { rotalariBirlestir } from "../lib/planlar";
import type { IlliEser } from "../lib/tipler";

describe("kesik cümleler", () => {
  it("kopuk başı atlar, ardından gelen tam cümle kalır", () => {
    expect(kopukBasiAt("nemin birçok yapısını yaptırmıştır. Mescit 1958'de onarıldı.")).toBe("Mescit 1958'de onarıldı.");
  });
  it("tam cümle kalmayan kopuk parça boşalır, olgu listeden çıkar", () => {
    expect(kopukBasiAt("ikişer pencere açıklığı eklenmiştir.")).toBe("");
    const o = [{ metin: { tr: "ikişer pencere açıklığı eklenmiştir." } }, { metin: { tr: "Cami 1500'de yapıldı." } }];
    expect(kesikleriDuzelt(o)).toHaveLength(1);
  });
  it("yalnız baş harfi küçük kalanı büyütür", () => {
    expect(kopukBasiAt("bu yapı 1600'de onarıldı.")).toBe("Bu yapı 1600'de onarıldı.");
  });
  it("düzgün cümleye dokunmaz", () => {
    const o = { metin: { tr: "Cami 1500'de yapıldı." } };
    expect(kesikleriDuzelt([o])[0]).toBe(o);
  });
});

describe("ziyaret bilgisi ve öne çıkan cümle", () => {
  it("günümüz bilgisinden durum cümlesini seçer", () => {
    expect(durumCumlesi("Yapı onarılmıştır. Bugün müze olarak kullanılmaktadır.")).toBe("Bugün müze olarak kullanılmaktadır.");
  });
  it("güçlü tarihçe cümlesini bulur, zayıfı almaz", () => {
    const guclu = { kategori: "tarihce", metin: { tr: "Kitâbesine göre H. 649 / M. 1251 yılında inşa edilmiştir." } };
    const zayif = { kategori: "tarihce", metin: { tr: "Yapının inşa kitâbesi bulunmamaktadır, tarihi bilinmemektedir." } };
    expect(oneCikanCumle([zayif, guclu])).toBe(guclu);
    expect(oneCikanCumle([zayif])).toBeUndefined();
  });
});

describe("mesafe ve yol tarifi", () => {
  it("mesafeyi yazar", () => {
    expect(mesafeYazisi(0.234)).toBe("230 m");
    expect(mesafeYazisi(1.24)).toBe("1,2 km");
    expect(mesafeYazisi(1.24, "en")).toBe("1.2 km");
    expect(mesafeYazisi(240.4)).toBe("240 km");
  });
  it("son durak hedef, öncekiler ara durak", () => {
    const a = yolTarifiAdresi([{ enlem: 1, boylam: 2 }, { enlem: 3, boylam: 4 }])!;
    expect(a).toContain("destination=3%2C4");
    expect(a).toContain("waypoints=1%2C2");
    expect(yolTarifiAdresi([])).toBeNull();
  });
});

describe("hoşgörülü arama", () => {
  const e = (id: string, il: string, tur: string, ad: string): IlliEser => ({ id, il, tur, ad: { tr: ad }, olgular: [] });
  const l = [e("a", "konya", "cami", "Ulu Camii"), e("b", "bursa", "cami", "Emir Sultan Camii"), e("c", "konya", "han", "(Başarakavak) Zazadin Hanı")];
  it("bitişik yazımı ve birden çok sözcüğü bulur, il ve türü de tarar", () => {
    expect(filtrele(l, { ara: "ulucami" }, "tr").map((x) => x.id)).toEqual(["a"]);
    expect(filtrele(l, { ara: "konya cami" }, "tr").map((x) => x.id)).toEqual(["a"]);
    expect(filtrele(l, { ara: "zazadin" }, "tr").map((x) => x.id)).toEqual(["c"]);
  });
  it("adı aranan sözle başlayan önce gelir (baştaki parantez yok sayılır)", () => {
    expect(aramaDerecesi(l[2], "zaza", "tr")).toBe(0);
    expect(aramaDerecesi(l[1], "sultan", "tr")).toBe(1);
  });
});

describe("Rotalarım birleştirme", () => {
  const t = (s: number) => new Date(Date.UTC(2026, 10, 3, 0, 0, s)).toISOString();
  it("daha yeni kopya kalır, yereldeki yenisi gönderilir", () => {
    const sonuc = rotalariBirlestir(
      [{ id: "r1", ad: "Yerel", eserler: ["a"], guncelleme: t(10) }],
      [],
      [
        { id: "r1", ad: "Eski", eserler: [], silindi: false, guncelleme: t(5) },
        { id: "r2", ad: "Bulut", eserler: ["b"], silindi: false, guncelleme: t(1) },
      ],
    );
    expect(sonuc.rotalar.map((r) => r.ad)).toEqual(["Yerel", "Bulut"]);
    expect(sonuc.gonderilecek.map((r) => r.id)).toEqual(["r1"]);
  });
  it("silinen rota başka cihazdan geri gelmez", () => {
    const sonuc = rotalariBirlestir([], [{ id: "r1", guncelleme: t(9) }], [{ id: "r1", ad: "X", eserler: [], silindi: false, guncelleme: t(3) }]);
    expect(sonuc.rotalar).toEqual([]);
    expect(sonuc.gonderilecek[0]).toMatchObject({ id: "r1", silindi: true });
  });
  it("artık olmayan eserleri rotadan düşer", () => {
    const sonuc = rotalariBirlestir([{ id: "r1", ad: "Y", eserler: ["a", "yok"], guncelleme: t(1) }], [], [], (id) => id !== "yok");
    expect(sonuc.rotalar[0].eserler).toEqual(["a"]);
  });
});
