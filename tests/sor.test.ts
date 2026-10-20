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
    expect(c.cumleler[0].metin).toContain("1962");
    expect(c.cumleler[0].sayfa).toBe("423");
  });

  it("bugünkü yapının küçüklüğünü s.422'den açıklar", () => {
    const c = cevapla(sehadet, "Bugünkü yapı neden küçük?", "tr");
    expect(c.cumleler[0].metin).toContain("üçte biri");
  });

  it("mimar kayıtlarda yoksa uydurmaz, yaptıranı söyler", () => {
    for (const [soru, dil] of [["Mimarı kim?", "tr"], ["Who was the architect?", "en"]] as const) {
      const c = cevapla(sehadet, soru, dil);
      expect(c.cumleler[0].durum).toBe("not");
      expect(c.cumleler[1].metin).toMatch(/Sultan (I\. )?Murad/);
      expect(c.cumleler[1].kaynak_id).toBeTruthy();
    }
  });

  it("kim yaptırdı sorusunu yaptıranı adıyla veren olgudan cevaplar", () => {
    const eser = {
      olgular: [
        { metin: { tr: "1996'da Müze Müdürlüğü tarafından kazı yapılmıştır." }, kategori: "onarim", durum: "kaynakli" },
        { metin: { tr: "Cami Ahmet Necip Efendi tarafından yaptırılmıştır." }, kategori: "tarihce", durum: "kaynakli", sayfa: "81" },
      ],
    };
    for (const soru of ["Kim yaptırdı?", "Kimin eseri?", "Kim yapmış?", "Mimarı kim?"]) {
      const c = cevapla(eser, soru, "tr");
      expect(c.cumleler.map((x) => x.metin).join(" ")).toContain("Ahmet Necip");
      expect(c.cumleler.some((x) => x.metin.includes("Müze"))).toBe(false);
    }
  });

  it("kayıtlarda olmayanı uydurmaz", () => {
    const eser = { olgular: [{ metin: { tr: "Cami kare planlıdır, mimari özellikleri sadedir." }, kategori: "mimari", durum: "kaynakli" }] };
    expect(cevapla(eser, "Mimarı kim?", "tr").bulundu).toBe(false);
    expect(cevapla(eser, "Who was the architect?", "en").bulundu).toBe(false);
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

describe("Bu esere sor: sayfadaki öteki bilgiler", () => {
  const fenari = bursa.eserler.find((e) => e.id === "molla-fenari-camii")!;

  it("konum sorusunu adresten cevaplar", () => {
    const c = cevapla(fenari, "Nerede?", "tr");
    expect(c.cumleler[0].metin).toContain("Dilek Sokak");
    expect(c.cumleler[0].kaynak_id).toBe(fenari.envanter?.kaynak_id);
  });

  it("olgularda olmayanı tarihçe ve mimari metninden bulur", () => {
    const c = cevapla(fenari, "Minaresi nasıl?", "tr");
    expect(c.bulundu).toBe(true);
    expect(cevapla(fenari, "Neden bu ad verilmiş?", "tr").cumleler[0].metin).toContain("Muhammed b. Hamza");
  });

  it("aynı bilgiyi iki kez vermez", () => {
    const c = cevapla(fenari, "Kim yaptırdı?", "tr");
    expect(c.cumleler.filter((x) => x.metin.includes("Şemseddin"))).toHaveLength(1);
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

  it("modelin yazdığı HTML kodlarını harfe çevirir", () => {
    const c = yzCevabi({ bulundu: true, cumleler: [{ metin: "Caminin b&acirc;n&icirc;si &#39;belli&#39; değil.", kayitlar: [] }] }, liste);
    expect(c.cumleler[0].metin).toBe("Caminin bânîsi 'belli' değil.");
  });

  it("kayda dayanmayan cevabı AI yorumu olarak gösterir", () => {
    const c = yzCevabi({ bulundu: true, cumleler: [{ metin: "Bu dönemde camiler genelde vakıfla kurulurdu.", kayitlar: [] }] }, liste);
    expect(c.bulundu).toBe(true);
    expect(c.cumleler[0]).toEqual({ metin: "Bu dönemde camiler genelde vakıfla kurulurdu.", durum: "ai_yorumu" });
    expect(yzCevabi({ bulundu: false, cumleler: [] }, liste).bulundu).toBe(false);
  });
});
