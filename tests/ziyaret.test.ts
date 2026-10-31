import { describe, expect, it } from "vitest";
import { TERIMLER, terimleriBol } from "../lib/mimari-sozluk";
import { kodCoz } from "../lib/yerel-pul";
import { PASAPORT_NO, gununSirasi, namazUyarisi } from "../lib/ziyaret";

describe("mimari sözlük", () => {
  it("terimi ilk geçtiği yerde işaretler, metni bozmaz", () => {
    const yazi = "Mihrabı çinili; mihrap nişi ve minber ahşap.";
    const p = terimleriBol(yazi, "tr");
    expect(p.map((x) => (typeof x === "string" ? x : x.yazi)).join("")).toBe(yazi);
    const terimler = p.filter((x) => typeof x !== "string") as { terim: number; yazi: string }[];
    expect(terimler.map((x) => TERIMLER[x.terim][0])).toEqual(["Mihrap", "Çini", "Minber"]);
  });
  it("kelimenin ortasını yakalamaz", () => {
    expect(terimleriBol("Bu bir dershane.", "tr").every((x) => typeof x === "string")).toBe(true);
  });
  it("İngilizce kalıplar", () => {
    const p = terimleriBol("A pointed arch over the mihrab.", "en");
    expect(p.filter((x) => typeof x !== "string").length).toBe(2);
  });
});

describe("QR kodu", () => {
  it("kâğıt pasaport ve eser durağı", () => {
    expect(kodCoz(`VAKFIYE:${PASAPORT_NO}`, PASAPORT_NO)).toEqual({ tur: "kagit" });
    expect(kodCoz("VAKFIYE:ESER:selcuk-hatun-camii", PASAPORT_NO)).toEqual({ tur: "eser", id: "selcuk-hatun-camii" });
    expect(kodCoz("https://ornek.com", PASAPORT_NO)).toBeNull();
    expect(kodCoz("VAKFIYE:ESER:", PASAPORT_NO)).toBeNull();
  });
});

describe("namaz uyarısı", () => {
  const vakit = { Fajr: "06:10", Dhuhr: "12:50", Asr: "15:40", Maghrib: "18:05", Isha: "19:25" };
  it("vakte 20 dk kala uyarır", () => {
    const r = namazUyarisi(vakit, "tr", new Date(2026, 9, 29, 12, 40)); // Perşembe
    expect(r.uyari).toContain("Öğle namazına 10 dk var");
  });
  it("Cuma öğlesinde 45 dk önceden uyarır", () => {
    const r = namazUyarisi(vakit, "tr", new Date(2026, 9, 30, 12, 15)); // Cuma
    expect(r.uyari).toContain("Cuma namazı");
  });
  it("uyarı yoksa sıradaki vakit", () => {
    const r = namazUyarisi(vakit, "en", new Date(2026, 9, 29, 9, 0));
    expect(r.uyari).toBeNull();
    expect(r.siradaki).toBe("Next prayer: Noon 12:50");
  });
});

it("günün sırası listeyi aşmaz", () => {
  expect(gununSirasi(0)).toBe(0);
  expect(gununSirasi(7, 86400000 * 10)).toBe(3);
});
