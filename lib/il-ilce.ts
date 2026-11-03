import tablo from "../veri/il-ilce.json";

/**
 * Türkiye il → ilçe listesi (veri/il-ilce.json, 81 il / 973 ilçe; `araclar/il_ilce_uret.py` ile
 * turkiye-il-ilce-mahalle-koy/ klasöründen üretilir). Yönetim panelindeki eser formunda ilçe açılır listesi için.
 */
const ILCELER = tablo as Record<string, string[]>;

/** Karşılaştırma anahtarı: büyük/küçük harf, ı/i ve aksan farkları yok sayılır ("İSKENDERUN" = "iskenderun"). */
export function adAnahtari(ad: string): string {
  return ad
    .trim()
    .replace(/[İIı]/g, "i")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

const ANAHTARLI = new Map(Object.entries(ILCELER).map(([il, ilceler]) => [adAnahtari(il), ilceler]));

/** İlin ilçeleri (alfabetik). İl listede yoksa undefined: form o zaman serbest yazıya döner. */
export function ilinIlceleri(ilAdi: string): string[] | undefined {
  return ANAHTARLI.get(adAnahtari(ilAdi));
}

/** Yazılan ilçe adını listedeki doğru yazımına çevirir ("ANTAKYA" → "Antakya"); listede yoksa undefined. */
export function ilceBul(ilAdi: string, ilce: string): string | undefined {
  const a = adAnahtari(ilce);
  return ilinIlceleri(ilAdi)?.find((x) => adAnahtari(x) === a);
}

/** Yazılan il adını 81 ilden birinin resmî yazımına çevirir ("kutahya" → "Kütahya"); il değilse undefined. */
export function ilAdiBul(ad: string): string | undefined {
  const a = adAnahtari(ad);
  return Object.keys(ILCELER).find((x) => adAnahtari(x) === a);
}

/** Tüm il adları (Türkçe yazımla). */
export const tumIller = (): string[] => Object.keys(ILCELER);
