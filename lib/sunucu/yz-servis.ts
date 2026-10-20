// Yönetim panelindeki bütün LLM çağrıları buradan geçer; model ya da sağlayıcı değişirse yalnız bu dosya değişir.
// Şu an Google Gemini'nin ücretsiz kotası (GEMINI_API_KEY): önce Flash-Lite, yoğunluk (429/5xx) ya da zaman aşımında Flash.
// Ayarlar (.env.local ve Vercel, örnek .env.example):
//   AI_ENABLED=true          YZ özelliklerinin tamamı açık (yoksa ya da başka bir değerse kapalı)
//   YZ_GUNLUK_LIMIT=200      günlük toplam çağrı üst sınırı (sayaç Supabase'de: yz_cagri_hakki)
//   GEMINI_MODEL, GEMINI_YEDEK_MODEL  isteğe bağlı model adları
// YZ kapalıysa, sınır dolduysa ya da cevap gelmezse { tamam: false } döner; çağıran taraf "YZ analizi yapılamadı" gösterir.
import "server-only";
import { semayaUygun, type Sema } from "../yz";

const ANA_MODEL = () => process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const YEDEK_MODEL = () => process.env.GEMINI_YEDEK_MODEL || "gemini-flash-latest";
const GECICI_HATA = new Set([429, 500, 502, 503, 504]);
const ZAMAN_ASIMI = 25_000;

/** YZ özellikleri açık mı: AI_ENABLED=true ve anahtar tanımlı. */
export function yzAcik(): boolean {
  return process.env.AI_ENABLED === "true" && !!process.env.GEMINI_API_KEY;
}

export function gunlukLimit(): number {
  const n = Number(process.env.YZ_GUNLUK_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 200;
}

export type YzSonucu<T> = { tamam: true; veri: T; model: string } | { tamam: false; neden: string; model?: string };

export type YzIstegi = {
  /** Görev tanımı ve kurallar (talimat). */
  sistem: string;
  /** İncelenecek veri: belge, öneri metni. Talimat olarak değil veri olarak gönderilir. */
  veri: string;
  sema: Sema;
};

/** Bizim şemamızı Gemini'nin biçimine (OpenAPI alt kümesi) çevirir. */
export function geminiSemasi(s: Sema): Record<string, unknown> {
  return {
    type: s.type.toUpperCase(),
    ...(s.nullable ? { nullable: true } : {}),
    ...(s.enum ? { enum: [...s.enum] } : {}),
    ...(s.items ? { items: geminiSemasi(s.items) } : {}),
    ...(s.properties
      ? { properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, geminiSemasi(v)])), required: s.required ?? [] }
      : {}),
  };
}

type Ham = { tamam: true; metin: string; model: string } | { tamam: false; neden: string; model?: string };

async function geminiCagir(istek: YzIstegi): Promise<Ham> {
  const anahtar = process.env.GEMINI_API_KEY!;
  const govde = JSON.stringify({
    systemInstruction: { parts: [{ text: istek.sistem }] },
    contents: [{ role: "user", parts: [{ text: istek.veri }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 4000, responseMimeType: "application/json", responseSchema: geminiSemasi(istek.sema) },
  });
  let son: Ham = { tamam: false, neden: "YZ servisine ulaşılamadı." };
  for (const model of [ANA_MODEL(), YEDEK_MODEL()]) {
    let yanit: Response;
    try {
      yanit = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": anahtar },
        body: govde,
        signal: AbortSignal.timeout(ZAMAN_ASIMI),
      });
    } catch (hata) {
      son = { tamam: false, neden: `YZ servisi yanıt vermedi (${hata instanceof Error ? hata.name : "hata"}).`, model };
      continue;
    }
    if (!yanit.ok) {
      son = { tamam: false, neden: yanit.status === 429 ? "YZ ücretsiz kotası doldu (429)." : `YZ servisi hata verdi (${yanit.status}).`, model };
      if (GECICI_HATA.has(yanit.status)) continue;
      return son;
    }
    const veri = (await yanit.json().catch(() => ({}))) as { candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[] };
    const aday = veri.candidates?.[0];
    const metin = aday?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (aday?.finishReason !== "STOP" || !metin) return { tamam: false, neden: `YZ cevabı tamamlanmadı (${aday?.finishReason ?? "aday yok"}).`, model };
    return { tamam: true, metin, model };
  }
  return son;
}

/**
 * JSON cevap isteyen tek giriş noktası. Cevap şemaya uymazsa bir kez yeniden denenir; yine uymazsa "geçersiz yanıt".
 * `hak`: her denemeden önce günlük sınırdan bir çağrı düşer; false dönerse çağrı yapılmaz.
 */
export async function yzJson<T>(istek: YzIstegi, hak: () => Promise<boolean>): Promise<YzSonucu<T>> {
  if (!yzAcik()) return { tamam: false, neden: "YZ kapalı (AI_ENABLED)." };
  let neden = "YZ geçersiz yanıt verdi.";
  let model: string | undefined;
  for (let deneme = 0; deneme < 2; deneme++) {
    if (!(await hak())) return { tamam: false, neden: `Günlük YZ sınırı (${gunlukLimit()}) doldu.` };
    const ham = await geminiCagir(istek);
    model = ham.model;
    if (!ham.tamam) return ham;
    let deger: unknown;
    try {
      deger = JSON.parse(ham.metin);
    } catch {
      neden = "YZ cevabı JSON değil.";
      continue;
    }
    const hata = semayaUygun(istek.sema, deger);
    if (!hata) return { tamam: true, veri: deger as T, model: ham.model };
    neden = `YZ cevabı şemaya uymuyor: ${hata}`.slice(0, 300);
  }
  return { tamam: false, neden, model };
}
