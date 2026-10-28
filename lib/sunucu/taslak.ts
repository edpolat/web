// Panel formlarının taslak kuralları (yeni il, kaynak ekleme, bilgi-kaynak bağlama). Tablo: supabase/014_form_taslaklari.sql
// Taslak formdaki yazıları olduğu gibi saklar; denetim ve kayıt, form gönderildiğinde her zamanki yoldan yapılır.
// Veritabanı erişimi lib/sunucu/taslak-depo.ts'de.
import { KatkiHatasi } from "./katki";

export const TASLAK_TURLERI = ["il", "kaynak", "bilgi"] as const;
export type TaslakTuru = (typeof TASLAK_TURLERI)[number];

/** Her formun taslağa alınan alanları (dosya taslağa girmez). */
export const TASLAK_ALANLARI: Record<TaslakTuru, readonly string[]> = {
  il: ["ad_tr", "ad_en", "enlem", "boylam", "yakinlastirma", "envanter_kaynak_id", "envanter_yili", "toplam_eser", "not"],
  kaynak: ["baslik", "tur", "kaynak_turu", "nitelik", "url", "yazar", "yayinci", "yil", "aciklama"],
  bilgi: ["alan", "deger", "kaynak_id", "konum"],
};

/** form_taslaklari satırı. */
export type FormTaslagi = {
  id: number;
  tur: TaslakTuru;
  hedef: string | null;
  baslik: string;
  veri: Record<string, string>;
  olusturuldu: string;
  guncellendi: string;
};

export type HazirTaslak = { id?: number; tur: TaslakTuru; hedef: string | null; baslik: string; veri: Record<string, string> };

const metin = (x: unknown) => (typeof x === "string" ? x.trim() : "");

/**
 * İstemciden gelen taslağı denetler: tanınan tür, yalnız o formun alanları, kısa yazılar. Boş alanlar atılır.
 * Bilgi taslağı hangi esere ait olduğunu (hedef) taşımalı.
 */
export function taslakHazirla(istek: unknown): HazirTaslak {
  const g = (typeof istek === "object" && istek !== null ? istek : {}) as Record<string, unknown>;
  const tur = TASLAK_TURLERI.find((t) => t === g.tur);
  if (!tur) throw new KatkiHatasi("Bilinmeyen taslak türü.");
  const ham = (typeof g.veri === "object" && g.veri !== null ? g.veri : {}) as Record<string, unknown>;
  const veri: Record<string, string> = {};
  for (const alan of TASLAK_ALANLARI[tur]) {
    const deger = metin(ham[alan]);
    if (!deger) continue;
    if (deger.length > 2000) throw new KatkiHatasi("Taslaktaki bir alan çok uzun (en çok 2000 harf).");
    veri[alan] = deger;
  }
  if (!Object.keys(veri).length) throw new KatkiHatasi("Boş taslak kaydedilmez: en az bir alanı doldur.");

  const hedef = metin(g.hedef) || null;
  if (tur === "bilgi" && !hedef) throw new KatkiHatasi("Bilgi taslağı bir esere ait olmalı.");
  const baslik = (
    tur === "il" ? veri.ad_tr || "Adsız il" : tur === "kaynak" ? veri.baslik || "Adsız kaynak" : `${hedef} · ${veri.alan ?? "bilgi"}`
  ).slice(0, 300);

  const id = typeof g.id === "number" && Number.isInteger(g.id) && g.id > 0 ? g.id : undefined;
  return { ...(id ? { id } : {}), tur, hedef: tur === "bilgi" ? hedef : null, baslik, veri };
}

/** Taslaktan devam edilecek form sayfası. */
export function taslakAdresi(dil: string, t: Pick<FormTaslagi, "id" | "tur" | "hedef">): string {
  if (t.tur === "il") return `/${dil}/yonetim/iller?taslak=${t.id}#il-formu`;
  if (t.tur === "kaynak") return `/${dil}/yonetim/kaynaklar?taslak=${t.id}#kaynak-formu`;
  return `/${dil}/yonetim/eser/${encodeURIComponent(t.hedef ?? "")}/gecmis?taslak=${t.id}#bilgi-formu`;
}
