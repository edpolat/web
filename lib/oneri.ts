// Halktan bilgi önerisinin ortak kuralları (tarayıcı ve sunucu). Tablo: supabase/005_oneriler.sql
import { KAYNAK_TURLERI, type KaynakTuru } from "./kaynak";
import type { Eser } from "./tipler";

/** Önerilebilen bilgiler. "diger"i kabul eden kişi uygulanacak alanı seçer. */
export const ONERI_ALANLARI = ["olgu", "banisi", "mimar", "yapim_yili", "adres", "ad", "diger"] as const;
export type OneriAlani = (typeof ONERI_ALANLARI)[number];
export const UYGULANABILIR = ONERI_ALANLARI.filter((a) => a !== "diger") as Exclude<OneriAlani, "diger">[];
export type UygulanacakAlan = (typeof UYGULANABILIR)[number];

/** Kişi başına günlük öneri sınırı (veritabanında da zorlanır; panelde rolü olanlara sınır yok). */
export const GUNLUK_ONERI = 20;

export const KAYNAK_SECIMLERI = ["kutuphane", "baglanti", "dosya", "yok"] as const;
export type KaynakSecimi = (typeof KAYNAK_SECIMLERI)[number];

export const DOSYA_YOLU = /^[0-9a-f-]{36}\/[0-9a-f]{32}\.(pdf|jpg|png)$/;

export class OneriHatasi extends Error {}

/** bilgi_onerileri satırı. */
export type OneriSatiri = {
  id: number;
  eser_id: string;
  alan: OneriAlani;
  onerilen: string;
  kaynak_id: string | null;
  konum: string | null;
  url: string | null;
  kaynak_turu: KaynakTuru | null;
  dosya_yolu: string | null;
  dosya_turu: string | null;
  dosya_boyutu: number | null;
  kaynaksiz: boolean;
  kullanici_ad: string | null;
  olusturuldu: string;
  durum: "bekliyor" | "kabul" | "reddedildi";
  inceleyen_ad: string | null;
  karar_tarihi: string | null;
  ret_gerekcesi: string | null;
  surum_id: number | null;
  eklenen_kaynak_id: string | null;
};

const yazi = (x: unknown, en: number) => (typeof x === "string" && x.trim() ? x.trim().slice(0, en) : null);

export type OneriIstegi = {
  eser_id: string;
  alan: OneriAlani;
  onerilen: string;
  kaynak_id: string | null;
  konum: string | null;
  url: string | null;
  /** Bağlantı ya da dosyanın türü (öneren söyler); nitelik buna göre önerilir. */
  kaynak_turu: KaynakTuru | null;
  dosya_yolu: string | null;
  hak_onayi: boolean;
};

/** Öneri formunu denetler. Kaynak: doğrulanmış kaynak, kendi bağlantısı, kendi dosyası ya da yok (kaynaksız). */
export function oneriIstegi(g: Record<string, unknown>): OneriIstegi {
  const eser_id = yazi(g.eser_id, 200);
  if (!eser_id) throw new OneriHatasi("Eser bulunamadı.");
  const alan = ONERI_ALANLARI.find((a) => a === g.alan);
  if (!alan) throw new OneriHatasi("Hangi bilgiyi önerdiğini seç.");
  const onerilen = yazi(g.onerilen, 2000);
  if (!onerilen) throw new OneriHatasi("Önerini yaz.");
  const secim = KAYNAK_SECIMLERI.find((k) => k === g.kaynak) ?? "yok";
  const istek: OneriIstegi = { eser_id, alan, onerilen, kaynak_id: null, konum: null, url: null, kaynak_turu: null, dosya_yolu: null, hak_onayi: g.hak_onayi === true };
  if (secim === "kutuphane") {
    istek.kaynak_id = yazi(g.kaynak_id, 100);
    if (!istek.kaynak_id) throw new OneriHatasi("Listeden bir kaynak seç.");
  } else if (secim === "baglanti") {
    istek.url = yazi(g.url, 2000);
    try {
      if (!istek.url || !["http:", "https:"].includes(new URL(istek.url).protocol)) throw new Error();
    } catch {
      throw new OneriHatasi("Geçerli bir http(s) bağlantısı gerekli.");
    }
  } else if (secim === "dosya") {
    istek.dosya_yolu = yazi(g.dosya_yolu, 200);
    if (!istek.dosya_yolu || !DOSYA_YOLU.test(istek.dosya_yolu)) throw new OneriHatasi("Önce dosyayı yükle.");
    if (!istek.hak_onayi) throw new OneriHatasi("Dosya için paylaşma hakkı onayını işaretlemelisin.");
  }
  if (secim === "baglanti" || secim === "dosya") istek.kaynak_turu = KAYNAK_TURLERI.find((k) => k === g.kaynak_turu) ?? "diger";
  if (secim !== "yok") istek.konum = yazi(g.konum, 100);
  return istek;
}

/** Eserin şu anki değeri (onay ekranında önerinin yanında gösterilir). */
export function mevcutDeger(eser: Eser | undefined, alan: OneriAlani): string {
  if (!eser) return "";
  switch (alan) {
    case "banisi":
    case "mimar":
      return eser[alan] ?? "";
    case "yapim_yili":
      return eser.donem?.yapim_yili ? String(eser.donem.yapim_yili) : "";
    case "adres":
    case "ad":
      return eser[alan]?.tr ?? "";
    default:
      return "";
  }
}

/**
 * Kabul edilen öneriyi eserin bir kopyasına uygular. olgu: yeni bilgi eklenir (kaynak varsa "kaynakli", yoksa "belirsiz").
 * Diğer alanlarda değer değişir; çok dilli alanlarda Türkçe değişir, İngilizce olduğu gibi kalır.
 */
export function oneriyiUygula(
  eser: Eser,
  alan: string,
  deger: string,
  ek: { kategori?: string; kaynak_id?: string | null; konum?: string | null } = {},
): Eser {
  const yeni = structuredClone(eser);
  const d = deger.trim();
  if (!d) throw new OneriHatasi("Uygulanacak değer boş olamaz.");
  switch (alan) {
    case "olgu":
      if (!ek.kategori) throw new OneriHatasi("Bilginin kategorisini seç.");
      yeni.olgular = [
        ...yeni.olgular,
        {
          metin: { tr: d },
          kategori: ek.kategori,
          durum: ek.kaynak_id ? "kaynakli" : "belirsiz",
          ...(ek.kaynak_id ? { kaynak_id: ek.kaynak_id } : {}),
          ...(ek.kaynak_id && ek.konum ? { sayfa: ek.konum } : {}),
        },
      ];
      return yeni;
    case "banisi":
    case "mimar":
      yeni[alan] = d;
      return yeni;
    case "yapim_yili": {
      const yil = Number(d);
      if (!Number.isInteger(yil) || yil < 1 || yil > new Date().getFullYear()) throw new OneriHatasi(`Yapım yılı 1 ile ${new Date().getFullYear()} arasında bir sayı olmalı.`);
      yeni.donem = { ...yeni.donem, yapim_yili: yil };
      return yeni;
    }
    case "adres":
    case "ad":
      yeni[alan] = { ...yeni[alan], tr: d };
      return yeni;
  }
  throw new OneriHatasi("Uygulanacak alanı seç.");
}
