import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { cevapla, kayitlar, yzCevabi } from "../lib/sunucu/sor";
import type { Eser } from "../lib/tipler";

const bursa = JSON.parse(fs.readFileSync("veri/iller/bursa.json", "utf-8")) as { eserler: Eser[] };
const sehadet = bursa.eserler.find((e) => e.id === "sehadet-kale-saray-camii")!;

// Demo akışlarındaki sorular (Lise öğrencisi 4-6, Görme güçlüğü 4).
describe("Bu esere sor", () => {
  it("adın nedenini s.421'deki olgudan cevaplar", () => {
    const c = cevapla(sehadet, "Neden Şehadet Camii deniyor?", "tr");
    expect(c.bulundu).toBe(true);
    expect(c.cumleler[0].metin).toContain("son eser");
    expect(c.cumleler[0]).toMatchObject({ durum: "kaynakli", sayfa: "421" });
  });

  it("onarım tarihini s.423'ten verir", () => {
    const c = cevapla(sehadet, "Ne zaman onarıldı?", "tr");
    expect(c.cumleler).toHaveLength(1);
    expect(c.cumleler[0].metin).toContain("1962");
    expect(c.cumleler[0].sayfa).toBe("423");
  });

  it("bugünkü yapının küçüklüğünü s.422'den açıklar", () => {
    const c = cevapla(sehadet, "Bugünkü yapı neden küçük?", "tr");
    expect(c.cumleler[0].metin).toContain("üçte biri");
  });

  it("kayıtlarda olmayanı uydurmaz", () => {
    expect(cevapla(sehadet, "Mimarı kim?", "tr").bulundu).toBe(false);
    expect(cevapla(sehadet, "Who was the architect?", "en").bulundu).toBe(false);
  });

  it("İngilizce soruya kitabın İngilizce metniyle cevap verir", () => {
    const c = cevapla(sehadet, "When was it restored?", "en");
    expect(c.cumleler[0].metin).toContain("1962");
    expect(c.cumleler[0].metin).toMatch(/restoration/);
  });

  it("yayında olmayan (doğrulanacak) olguyu kullanmaz", () => {
    const eser = { olgular: [{ metin: { tr: "Cami 1500 yılında onarıldı." }, kategori: "onarim", durum: "dogrulanacak" }] };
    expect(cevapla(eser, "Ne zaman onarıldı?", "tr").bulundu).toBe(false);
  });
});

describe("Bu esere sor: yapay zekâ bağlamı", () => {
  const liste = kayitlar(sehadet);

  it("yayındaki olguları, tarihçe paragraflarını ve künyeyi numaralar", () => {
    expect(liste.map((k) => k.no)).toEqual(liste.map((_, i) => i + 1));
    expect(liste.filter((k) => k.tur === "olgu").length).toBe(sehadet.olgular.filter((o) => o.durum !== "dogrulanacak").length);
    expect(liste.some((k) => k.tur === "tarihce" && k.kaynak_id === sehadet.envanter?.kaynak_id)).toBe(true);
    const kunye = liste.find((k) => k.tur === "kunye")!;
    expect(kunye.metin.tr).toContain("Sultan I. Murad");
  });

  it("model cümlesini dayandığı kaydın kaynağı ve sayfasıyla eşler", () => {
    const olgu = liste.find((k) => k.tur === "olgu" && k.sayfa === "423")!;
    const c = yzCevabi({ bulundu: true, cumleler: [{ metin: " 1962'de onarıldı. ", kayitlar: [olgu.no] }] }, liste);
    expect(c).toMatchObject({ bulundu: true, yontem: "yapay_zeka" });
    expect(c.cumleler[0]).toEqual({ metin: "1962'de onarıldı.", durum: "kaynakli", kaynak_id: olgu.kaynak_id, sayfa: "423" });
  });

  it("dayanağı olmayan ya da uydurma numaralı cümleyi AI yorumu yapar", () => {
    const olgu = liste[0];
    const c = yzCevabi(
      {
        bulundu: true,
        cumleler: [
          { metin: "Kaynaklı cümle.", kayitlar: [olgu.no] },
          { metin: "Bağlaç cümlesi.", kayitlar: [] },
          { metin: "Uydurma numara.", kayitlar: [999] },
        ],
      },
      liste,
    );
    expect(c.cumleler.map((x) => x.durum)).toEqual([olgu.durum, "ai_yorumu", "ai_yorumu"]);
    expect(c.cumleler[2].kaynak_id).toBeUndefined();
  });

  it("yalnız AI yorumundan oluşan cevabı 'bilgi yok' sayar", () => {
    expect(yzCevabi({ bulundu: true, cumleler: [{ metin: "Mimar Sinan yapmıştır.", kayitlar: [] }] }, liste).bulundu).toBe(false);
    expect(yzCevabi({ bulundu: false, cumleler: [] }, liste).bulundu).toBe(false);
  });
});
