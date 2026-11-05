// Sergilerin ortak kuralları (tarayıcı ve sunucu): panel formunun doğrulaması ve Supabase satırı ↔ Sergi dönüşümü.
// Tablo ve aynı sınırların veritabanı tarafı: supabase/017_sergiler.sql.
import { ilAdiBul, ilceBul } from "./il-ilce";
import type { Sergi } from "./tipler";

export class SergiHatasi extends Error {}

/** Supabase "sergiler" tablosunun bir satırı. */
export type SergiSatiri = {
  id: string;
  ad_tr: string;
  ad_en: string | null;
  sehir: string | null;
  ilce?: string | null;
  yer: string | null;
  harita: string | null;
  baslangic: string | null;
  bitis: string | null;
  aciklama_tr: string | null;
  aciklama_en: string | null;
  url: string | null;
  kaynak_id: string | null;
  ekleyen_ad?: string | null;
  olusturuldu?: string;
  guncelleyen_ad?: string | null;
  guncellendi?: string | null;
};

/** Panel formundan gelen, doğrulanmış istek (boş alanlar null). */
export type SergiIstegi = Omit<SergiSatiri, "kaynak_id" | "ekleyen_ad" | "olusturuldu" | "guncelleyen_ad" | "guncellendi">;

export const SINIRLAR = { ad: 150, sehir: 60, ilce: 60, yer: 300, harita: 200, aciklama: 1500, url: 500 } as const;

const bosMu = (x: unknown) => x === undefined || x === null || (typeof x === "string" && x.trim() === "");

function yazi(g: Record<string, unknown>, ad: string, sinir: number, etiket: string): string | null {
  const x = g[ad];
  if (bosMu(x)) return null;
  if (typeof x !== "string") throw new SergiHatasi(`${etiket} metin olmalı.`);
  const t = x.trim().replace(/\s+/g, " ");
  if (t.length > sinir) throw new SergiHatasi(`${etiket} en fazla ${sinir} karakter olabilir.`);
  return t;
}

/** Açıklamada satır sonları korunur, yalnız baştaki/sondaki boşluk atılır. */
function uzunYazi(g: Record<string, unknown>, ad: string, etiket: string): string | null {
  const x = g[ad];
  if (bosMu(x)) return null;
  if (typeof x !== "string") throw new SergiHatasi(`${etiket} metin olmalı.`);
  const t = x.trim();
  if (t.length > SINIRLAR.aciklama) throw new SergiHatasi(`${etiket} en fazla ${SINIRLAR.aciklama} karakter olabilir.`);
  return t;
}

function gun(g: Record<string, unknown>, ad: string, etiket: string): string | null {
  const x = g[ad];
  if (bosMu(x)) return null;
  if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x.trim())) throw new SergiHatasi(`${etiket} YYYY-AA-GG biçiminde olmalı.`);
  const t = x.trim();
  const d = new Date(`${t}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) throw new SergiHatasi(`${etiket} geçerli bir gün değil.`);
  const yil = d.getUTCFullYear();
  if (yil < 2000 || yil > 2100) throw new SergiHatasi(`${etiket} 2000 ile 2100 arasında olmalı.`);
  return t;
}

/** Türkçe adı kimliğe çevirir: "Bir Rüyanın İzinde" → "bir-ruyanin-izinde". */
export function sergiKimligi(ad: string): string {
  const harf: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
  return ad
    .toLocaleLowerCase("tr")
    .replace(/[çğıiöşüâîû]/g, (h) => harf[h] ?? h)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

export const KIMLIK_KALIBI = /^[a-z0-9][a-z0-9-]{1,79}$/;

/**
 * Şehir 81 ilden biri, ilçe o ilin ilçelerinden biri olmalı (resmî yazıma çevrilir: "bursa" → "Bursa").
 * Yeni sergide listede olmayan değer reddedilir; düzenlemede eski kayıttan kalan değer olduğu gibi korunur.
 */
function sehirIlce(g: Record<string, unknown>, yeni: boolean): { sehir: string | null; ilce: string | null } {
  const hamSehir = yazi(g, "sehir", SINIRLAR.sehir, "Şehir");
  const hamIlce = yazi(g, "ilce", SINIRLAR.ilce, "İlçe");
  if (hamIlce && !hamSehir) throw new SergiHatasi("İlçe seçildiyse şehir de seçilmeli.");
  if (!hamSehir) return { sehir: null, ilce: null };
  const sehir = ilAdiBul(hamSehir);
  if (!sehir) {
    if (yeni) throw new SergiHatasi("Şehir 81 ilden biri olmalı.");
    return { sehir: hamSehir, ilce: hamIlce };
  }
  if (!hamIlce) return { sehir, ilce: null };
  const ilce = ilceBul(sehir, hamIlce);
  if (!ilce) {
    if (yeni) throw new SergiHatasi(`İlçe ${sehir} ilinin ilçelerinden biri olmalı.`);
    return { sehir, ilce: hamIlce };
  }
  return { sehir, ilce };
}

/** Panel formunu denetler. Yeni sergide kimlik boşsa Türkçe addan üretilir. */
export function sergiIstegi(g: Record<string, unknown>, yeni: boolean): SergiIstegi {
  const ad_tr = yazi(g, "ad_tr", SINIRLAR.ad, "Türkçe ad");
  if (!ad_tr || ad_tr.length < 2) throw new SergiHatasi("Türkçe ad zorunlu (en az 2 karakter).");
  const hamKimlik = typeof g.id === "string" ? g.id.trim() : "";
  const id = hamKimlik || (yeni ? sergiKimligi(ad_tr) : "");
  if (!KIMLIK_KALIBI.test(id)) throw new SergiHatasi("Kimlik yalnız küçük harf, rakam ve tire içerebilir (2-80 karakter).");
  const url = yazi(g, "url", SINIRLAR.url, "Haber bağlantısı");
  if (url) {
    let gecerli = false;
    try {
      const u = new URL(url);
      gecerli = (u.protocol === "https:" || u.protocol === "http:") && !!u.hostname.includes(".");
    } catch {
      gecerli = false;
    }
    if (!gecerli) throw new SergiHatasi("Haber bağlantısı http:// ya da https:// ile başlayan bir adres olmalı.");
  }
  const baslangic = gun(g, "baslangic", "Başlangıç tarihi");
  const bitis = gun(g, "bitis", "Bitiş tarihi");
  if (bitis && !baslangic) throw new SergiHatasi("Bitiş tarihi girildiyse başlangıç tarihi de girilmeli.");
  if (baslangic && bitis && bitis < baslangic) throw new SergiHatasi("Bitiş tarihi başlangıçtan önce olamaz.");
  const { sehir, ilce } = sehirIlce(g, yeni);
  return {
    id,
    ad_tr,
    ad_en: yazi(g, "ad_en", SINIRLAR.ad, "İngilizce ad"),
    sehir,
    ilce,
    yer: yazi(g, "yer", SINIRLAR.yer, "Yer"),
    harita: yazi(g, "harita", SINIRLAR.harita, "Harita araması"),
    baslangic,
    bitis,
    aciklama_tr: uzunYazi(g, "aciklama_tr", "Türkçe açıklama"),
    aciklama_en: uzunYazi(g, "aciklama_en", "İngilizce açıklama"),
    url,
  };
}

const varsa = <T>(x: T | null | undefined) => (x === null || x === undefined || x === "" ? undefined : x);

/** Supabase satırını sitenin Sergi biçimine çevirir (veri/sergiler.json ile aynı). */
export function satirdanSergi(r: SergiSatiri): Sergi {
  const s: Sergi = { id: r.id, ad: { tr: r.ad_tr, ...(varsa(r.ad_en) ? { en: r.ad_en! } : {}) } };
  if (varsa(r.sehir)) s.sehir = r.sehir!;
  if (varsa(r.ilce)) s.ilce = r.ilce!;
  if (varsa(r.yer)) s.yer = r.yer!;
  if (varsa(r.harita)) s.harita = r.harita!;
  if (varsa(r.baslangic)) s.baslangic = r.baslangic!.slice(0, 10);
  if (varsa(r.bitis)) s.bitis = r.bitis!.slice(0, 10);
  if (varsa(r.aciklama_tr)) s.aciklama = { tr: r.aciklama_tr!, ...(varsa(r.aciklama_en) ? { en: r.aciklama_en! } : {}) };
  if (varsa(r.url)) s.url = r.url!;
  if (varsa(r.kaynak_id)) s.kaynak_id = r.kaynak_id!;
  return s;
}

/** Sergi → panel formunun ilk değerleri. */
export function sergidenForm(s: Sergi): Record<string, string> {
  return {
    id: s.id,
    ad_tr: s.ad.tr,
    ad_en: s.ad.en ?? "",
    sehir: s.sehir ?? "",
    ilce: s.ilce ?? "",
    yer: s.yer ?? "",
    harita: s.harita ?? "",
    baslangic: s.baslangic ?? "",
    bitis: s.bitis ?? "",
    aciklama_tr: s.aciklama?.tr ?? "",
    aciklama_en: s.aciklama?.en ?? "",
    url: s.url ?? "",
  };
}

export type SergiDurumu = "acik" | "yakinda" | "bitti";

/** Bugüne göre sergi açık mı, yakında mı, bitti mi (gün: YYYY-AA-GG). */
export function sergiDurumu(sergi: Sergi, bugun: string): SergiDurumu {
  if (sergi.baslangic && bugun < sergi.baslangic) return "yakinda";
  if (sergi.bitis && bugun > sergi.bitis) return "bitti";
  return "acik";
}
