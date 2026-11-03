// "Bu esere sor" için Vikipedi araması: eserin kendi kayıtlarında cevap yoksa sor-yz.ts buraya bakar.
// Vikipedi'nin herkese açık API'si anahtar ve ücret istemez. Google'ın arama özelliği (Search grounding)
// ücretsiz Gemini anahtarında kapalı olduğu için bu yol seçildi (2 Kas 2026).
// Buradan gelen bilgi doğrulanmış kaynak değildir; arayüzde "Vikipedi" etiketi ve madde bağlantısıyla ayrı gösterilir.
import "server-only";
import type { Dil } from "../tipler";

export type Madde = { baslik: string; adres: string; metin: string };

const MADDE_SAYISI = 2;
const METIN_SINIRI = 5000;
// Wikimedia, API'yi kullananların kendini tanıtan bir User-Agent göndermesini ister.
const BASLIK = { "user-agent": "Vakfiye/1.0 (https://vakfiye.vercel.app; Kok&Kod hackathon)" };

async function api(dil: string, parametreler: Record<string, string>): Promise<unknown> {
  const adres = new URL(`https://${dil}.wikipedia.org/w/api.php`);
  for (const [k, v] of Object.entries({ action: "query", format: "json", formatversion: "2", ...parametreler })) adres.searchParams.set(k, v);
  const yanit = await fetch(adres, { headers: BASLIK, signal: AbortSignal.timeout(8_000) });
  if (!yanit.ok) throw new Error(`Vikipedi ${dil} hata ${yanit.status}`);
  return yanit.json();
}

/** Bir dildeki Vikipedi'de arar; en iyi eşleşen maddelerin düz metnini (kısaltılmış) döndürür. */
async function dildeAra(sorgu: string, dil: string): Promise<Madde[]> {
  const arama = (await api(dil, { list: "search", srsearch: sorgu, srlimit: String(MADDE_SAYISI), srnamespace: "0" })) as {
    query?: { search?: { title: string }[] };
  };
  const basliklar = (arama.query?.search ?? []).map((s) => s.title);
  const maddeler = await Promise.all(
    basliklar.map(async (baslik) => {
      const veri = (await api(dil, { prop: "extracts|info", inprop: "url", explaintext: "1", redirects: "1", titles: baslik })) as {
        query?: { pages?: { title: string; extract?: string; fullurl?: string; missing?: boolean }[] };
      };
      const sayfa = veri.query?.pages?.[0];
      if (!sayfa || sayfa.missing || !sayfa.extract?.trim()) return null;
      return {
        baslik: sayfa.title,
        adres: sayfa.fullurl ?? `https://${dil}.wikipedia.org/wiki/${encodeURIComponent(sayfa.title.replace(/ /g, "_"))}`,
        metin: sayfa.extract.slice(0, METIN_SINIRI),
      };
    }),
  );
  return maddeler.filter((m): m is Madde => m !== null);
}

/** Önce cevap dilindeki Vikipedi'de, bulamazsa ötekinde (tr/en) arar. Hata olursa boş liste. */
export async function vikipediAra(sorgu: string, dil: Dil): Promise<Madde[]> {
  const temiz = sorgu.trim().slice(0, 120);
  if (!temiz) return [];
  for (const d of dil === "en" ? ["en", "tr"] : ["tr", "en"]) {
    try {
      const sonuc = await dildeAra(temiz, d);
      if (sonuc.length) return sonuc;
    } catch (hata) {
      console.warn(`vikipedi: ${String(hata)}`);
    }
  }
  return [];
}
