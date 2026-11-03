// "Bu esere sor" Vikipedi yedeği. Gemini ve Vikipedi çağrıları taklit edilir; gerçek ağa istek gitmez.
import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { yapayZekaylaCevapla } from "../lib/sunucu/sor-yz";
import type { Eser } from "../lib/tipler";

const bursa = JSON.parse(fs.readFileSync("veri/iller/bursa.json", "utf-8")) as { eserler: Eser[] };
const eser = bursa.eserler.find((e) => e.id === "sehadet-kale-saray-camii")!;

const gemini = (veri: unknown) =>
  new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(veri) }] } }] }));
const json = (veri: unknown) => new Response(JSON.stringify(veri));

const MADDE = "Şeyhülislam, Osmanlı Devleti'nde din işlerinin en yüksek makamıdır.";

/** Sıradaki Gemini cevaplarını verir; Vikipedi isteklerine sabit bir maddeyle cevap verir. */
function taklit(modelCevaplari: unknown[]) {
  const istekler: string[] = [];
  const fetchTaklidi = vi.fn(async (adres: string | URL) => {
    const a = String(adres);
    istekler.push(a);
    if (a.includes("wikipedia.org")) {
      if (a.includes("list=search")) return json({ query: { search: [{ title: "Şeyhülislam" }] } });
      return json({ query: { pages: [{ title: "Şeyhülislam", extract: MADDE, fullurl: "https://tr.wikipedia.org/wiki/%C5%9Eeyh%C3%BClislam" }] } });
    }
    return gemini(modelCevaplari.shift());
  });
  vi.stubGlobal("fetch", fetchTaklidi);
  return istekler;
}

describe("Bu esere sor: Vikipedi yedeği", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "test-anahtari");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("kayıtlarda yoksa Vikipedi'ye bakar, cümleyi madde bağlantısıyla verir", async () => {
    const istekler = taklit([
      { bulundu: true, cumleler: [{ metin: "Şeyhülislam din işlerinin başıdır.", kayitlar: [] }], arama: "Şeyhülislam" },
      { bulundu: true, cumleler: [{ metin: "Şeyhülislam, Osmanlı'da din işlerinin en yüksek makamıdır.", kayitlar: [1] }], arama: "" },
    ]);
    const c = await yapayZekaylaCevapla(eser, "Şeyhülislam ne demek?", "tr");
    expect(c?.yontem).toBe("vikipedi");
    expect(c?.cumleler[0].durum).toBe("not");
    expect(c?.cumleler[1]).toMatchObject({ durum: "vikipedi", baslik: "Şeyhülislam", adres: expect.stringContaining("tr.wikipedia.org") });
    expect(istekler.some((a) => a.includes("tr.wikipedia.org") && a.includes("srsearch=%C5%9Eeyh%C3%BClislam"))).toBe(true);
  });

  it("kayıtlardan cevap varsa Vikipedi'ye hiç gitmez", async () => {
    const istekler = taklit([{ bulundu: true, cumleler: [{ metin: "Sultan I. Murad yaptırmıştır.", kayitlar: [1] }], arama: "Şehadet Camii" }]);
    const c = await yapayZekaylaCevapla(eser, "Kim yaptırdı?", "tr");
    expect(c?.yontem).toBe("yapay_zeka");
    expect(istekler.some((a) => a.includes("wikipedia.org"))).toBe(false);
  });

  it("Vikipedi maddesi soruyu cevaplamıyorsa ilk cevap (AI yorumu) kalır", async () => {
    taklit([
      { bulundu: true, cumleler: [{ metin: "Genel bilgi cümlesi.", kayitlar: [] }], arama: "Şeyhülislam" },
      { bulundu: false, cumleler: [], arama: "" },
    ]);
    const c = await yapayZekaylaCevapla(eser, "Şeyhülislam ne demek?", "tr");
    expect(c?.yontem).toBe("yapay_zeka");
    expect(c?.cumleler[0].durum).toBe("ai_yorumu");
  });

  it("madde numarası vermeyen cümleleri almaz", async () => {
    taklit([
      { bulundu: true, cumleler: [{ metin: "Genel bilgi.", kayitlar: [] }], arama: "Şeyhülislam" },
      { bulundu: true, cumleler: [{ metin: "Uydurma cümle.", kayitlar: [] }, { metin: "Maddeden cümle.", kayitlar: [1] }], arama: "" },
    ]);
    const c = await yapayZekaylaCevapla(eser, "Şeyhülislam ne demek?", "tr");
    expect(c?.cumleler.map((x) => x.metin)).toEqual(["Kaynaklarımızda bu bilgi yok. Vikipedi'de şöyle geçiyor:", "Maddeden cümle."]);
  });
});
