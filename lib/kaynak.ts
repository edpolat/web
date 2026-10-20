// Kaynak kütüphanesinin ortak kuralları (tarayıcı ve sunucu). Tablo: supabase/003_kaynaklar.sql
import type { Kaynak } from "./tipler";

export const NITELIKLER = ["birincil", "ikincil", "ucuncul"] as const;
export type Nitelik = (typeof NITELIKLER)[number];

export const KAYNAK_TURLERI = ["vakfiye", "arsiv", "envanter_kitabi", "akademik", "kitap", "kurum_sitesi", "web", "haber", "diger"] as const;
export type KaynakTuru = (typeof KAYNAK_TURLERI)[number];

export const KAYNAK_DURUMLARI = ["dogrulanmamis", "dogrulandi", "reddedildi"] as const;
export type KaynakDurumu = (typeof KAYNAK_DURUMLARI)[number];

/** Birincil: vakfiye, arşiv belgesi. İkincil: akademik yayın, kitap. Üçüncül: web, haber. */
export const VARSAYILAN_NITELIK: Record<KaynakTuru, Nitelik> = {
  vakfiye: "birincil",
  arsiv: "birincil",
  envanter_kitabi: "ikincil",
  akademik: "ikincil",
  kitap: "ikincil",
  kurum_sitesi: "ucuncul",
  web: "ucuncul",
  haber: "ucuncul",
  diger: "ucuncul",
};

export const DOSYA_KOVASI = "kaynak-dosyalari";
/** Halkın öneriyle yüklediği dosyanın sınırı. */
export const EN_BUYUK_DOSYA = 10 * 1024 * 1024;
/** Panel kullanıcısının kaynak kütüphanesine yüklediği dosyanın sınırı (envanter kitabı bölümleri büyük). Kova sınırı da bu (008). */
export const EN_BUYUK_KAYNAK_DOSYASI = 50 * 1024 * 1024;
export const DOSYA_TURLERI = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" } as const;
export type DosyaTuru = keyof typeof DOSYA_TURLERI;

/** Dosya türünü uzantıdan değil içeriğin ilk baytlarından bulur; tanınmazsa undefined. */
export function dosyaTuruBul(b: Uint8Array): DosyaTuru | undefined {
  const bas = (...x: number[]) => x.every((v, i) => b[i] === v);
  if (bas(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"; // %PDF-
  if (bas(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (bas(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  return undefined;
}

/** kaynak_kutuphanesi satırı. */
export type KutuphaneKaynagi = {
  id: string;
  baslik: string;
  tur: "dosya" | "baglanti" | "kayit";
  nitelik: Nitelik;
  kaynak_turu: KaynakTuru;
  url: string | null;
  dosya_yolu: string | null;
  dosya_turu: DosyaTuru | null;
  dosya_boyutu: number | null;
  yazar: string | null;
  yayinci: string | null;
  yil: number | null;
  durum: KaynakDurumu;
  herkese_acik: boolean;
  ekleyen_ad: string | null;
  eklendi: string;
  dogrulayan_ad: string | null;
  dogrulama_tarihi: string | null;
  aciklama: string | null;
  ret_gerekcesi: string | null;
};

/** Kütüphane kaydını sitenin kullandığı Kaynak biçimine çevirir. Herkese açık dosyanın adresi sitenin kendi ucudur. */
export function kaynagaCevir(k: KutuphaneKaynagi): Kaynak {
  const url = k.url ?? (k.dosya_yolu && k.herkese_acik ? `/api/kaynak/dosya/${k.id}` : undefined);
  return {
    id: k.id,
    tur: k.kaynak_turu,
    baslik: k.baslik,
    ...(k.yazar ? { yazar: k.yazar } : {}),
    ...(k.yayinci ? { yayinci: k.yayinci } : {}),
    ...(k.yil ? { yil: k.yil } : {}),
    ...(url ? { url } : {}),
    ...(k.aciklama ? { not: k.aciklama } : {}),
  };
}

export class KaynakHatasi extends Error {}

const yazi = (x: unknown, en = 500) => (typeof x === "string" && x.trim() ? x.trim().slice(0, en) : null);

export type KaynakIstegi = {
  baslik: string;
  tur: "dosya" | "baglanti";
  nitelik: Nitelik;
  kaynak_turu: KaynakTuru;
  url: string | null;
  dosya_yolu: string | null;
  yazar: string | null;
  yayinci: string | null;
  yil: number | null;
  aciklama: string | null;
};

/** Kaynak ekleme formunu denetler. Bağlantı http(s) olmalı; dosya önce yüklenmiş olmalı (yol). */
export function kaynakIstegi(g: Record<string, unknown>): KaynakIstegi {
  const baslik = yazi(g.baslik, 300);
  if (!baslik) throw new KaynakHatasi("Başlık gerekli.");
  const tur = g.tur === "dosya" ? "dosya" : g.tur === "baglanti" ? "baglanti" : undefined;
  if (!tur) throw new KaynakHatasi("Tür dosya ya da bağlantı olmalı.");
  const kaynak_turu = KAYNAK_TURLERI.includes(g.kaynak_turu as KaynakTuru) ? (g.kaynak_turu as KaynakTuru) : "diger";
  const nitelik = NITELIKLER.includes(g.nitelik as Nitelik) ? (g.nitelik as Nitelik) : VARSAYILAN_NITELIK[kaynak_turu];
  let url: string | null = null;
  let dosya_yolu: string | null = null;
  if (tur === "baglanti") {
    url = yazi(g.url, 2000);
    try {
      if (!url || !["http:", "https:"].includes(new URL(url).protocol)) throw new Error();
    } catch {
      throw new KaynakHatasi("Geçerli bir http(s) bağlantısı gerekli.");
    }
  } else {
    dosya_yolu = yazi(g.dosya_yolu, 200);
    if (!dosya_yolu || !/^[0-9a-f-]{36}\/[0-9a-f]{32}\.(pdf|jpg|png)$/.test(dosya_yolu)) throw new KaynakHatasi("Önce dosyayı yükle.");
  }
  const yilYazi = String(g.yil ?? "").trim();
  const yil = yilYazi ? Number(yilYazi) : null;
  const buYil = new Date().getFullYear();
  if (yil !== null && !(Number.isInteger(yil) && yil >= 1 && yil <= buYil)) {
    throw new KaynakHatasi(`Yıl 1 ile ${buYil} arasında olmalı.`);
  }
  return {
    baslik,
    tur,
    nitelik,
    kaynak_turu,
    url,
    dosya_yolu,
    yazar: yazi(g.yazar, 200),
    yayinci: yazi(g.yayinci, 200),
    yil,
    aciklama: yazi(g.aciklama, 2000),
  };
}
