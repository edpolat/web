// YZ sonuçlarının Supabase katmanı (supabase/006_yz.sql): yz_analizleri, kaynak_metinleri/kaynak_sayfalari, günlük sayaç.
// Yazma yalnız fonksiyonlarla; panel kullanıcısının oturumuyla ya da sunucunun service_role anahtarıyla.
// Buradaki her hata yutulur: YZ katmanı bozulsa da panel ve onay akışı çalışmaya devam eder.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Sayfa } from "../yz";
import type { CikanMetin } from "./kaynak-metni";
import { gunlukLimit } from "./yz-servis";

export type AnalizTuru = "kaynak" | "eleme";
export type HedefTuru = "oneri" | "surum";

/** yz_analizleri satırı. */
export type AnalizSatiri = {
  id: number;
  tur: AnalizTuru;
  hedef_tur: HedefTuru;
  hedef_id: number;
  eser_id: string | null;
  ozet: string;
  durum: "bekliyor" | "tamam" | "hata";
  sonuc: unknown;
  hata: string | null;
  model: string | null;
  isteyen_ad: string | null;
  olusturuldu: string;
  bitti: string | null;
};

/**
 * Sunucunun kendi istemcisi (SUPABASE_SERVICE_ROLE_KEY tanımlıysa): öneri gönderildiği anda, editör paneli açmadan
 * arka planda analiz yapabilmek için. Anahtar yalnız sunucuda durur; tanımlı değilse analiz editör paneli açınca yapılır.
 */
export function sunucuIstemcisi(): SupabaseClient | null {
  const adres = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anahtar = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return adres && anahtar ? createClient(adres, anahtar, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

export async function analizBaslat(
  vt: SupabaseClient,
  h: { tur: AnalizTuru; hedef_tur: HedefTuru; hedef_id: number; eser_id: string; ozet: string },
): Promise<number | null> {
  const { data, error } = await vt.rpc("yz_analiz_baslat", { p_tur: h.tur, p_hedef_tur: h.hedef_tur, p_hedef_id: h.hedef_id, p_eser: h.eser_id, p_ozet: h.ozet });
  if (error) {
    console.warn(`yz: analiz başlatılamadı: ${error.message}`);
    return null;
  }
  return (data as number | null) ?? null;
}

export async function analizBitir(vt: SupabaseClient, id: number, s: { durum: "tamam" | "hata"; sonuc?: unknown; model?: string | null; hata?: string }) {
  const { error } = await vt.rpc("yz_analiz_bitir", { p_id: id, p_durum: s.durum, p_sonuc: s.sonuc ?? null, p_model: s.model ?? null, p_hata: s.hata ?? null });
  if (error) console.warn(`yz: analiz kaydedilemedi: ${error.message}`);
}

/** Günlük sınırdan bir çağrı hakkı düşer. Sayaç okunamazsa çağrı yapılmaz. */
export function cagriHakki(vt: SupabaseClient): () => Promise<boolean> {
  return async () => {
    const { data, error } = await vt.rpc("yz_cagri_hakki", { p_sinir: gunlukLimit() });
    return !error && data === true;
  };
}

/** Her hedefin en son analizi. Tablo yoksa (006 çalıştırılmadıysa) boş. */
export async function sonAnalizler(vt: SupabaseClient, tur: AnalizTuru, hedef_tur: HedefTuru, idler: number[]): Promise<Map<number, AnalizSatiri>> {
  const harita = new Map<number, AnalizSatiri>();
  if (!idler.length) return harita;
  try {
    const { data, error } = await vt
      .from("yz_analizleri")
      .select("*")
      .eq("tur", tur)
      .eq("hedef_tur", hedef_tur)
      .in("hedef_id", idler)
      .order("olusturuldu", { ascending: false })
      .limit(1000);
    if (error) return harita;
    for (const satir of (data ?? []) as AnalizSatiri[]) if (!harita.has(satir.hedef_id)) harita.set(satir.hedef_id, satir);
  } catch {}
  return harita;
}

export async function analizOku(vt: SupabaseClient, id: number): Promise<AnalizSatiri | undefined> {
  const { data } = await vt.from("yz_analizleri").select("*").eq("id", id).maybeSingle();
  return (data ?? undefined) as AnalizSatiri | undefined;
}

/** Daha önce çıkarılmış kaynak metni (yoksa undefined). */
export async function kaynakMetniOku(vt: SupabaseClient, anahtar: string): Promise<CikanMetin | undefined> {
  const { data: m } = await vt.from("kaynak_metinleri").select("*").eq("anahtar", anahtar).maybeSingle();
  if (!m) return undefined;
  if (m.durum !== "tamam") return { durum: "okunamadi", neden: "Metin okunamadı." };
  const { data: sayfalar } = await vt.from("kaynak_sayfalari").select("sayfa, metin").eq("anahtar", anahtar).order("sayfa").limit(5000);
  return { durum: "tamam", sayfali: m.sayfali as boolean, sayfalar: (sayfalar ?? []) as Sayfa[] };
}

export async function kaynakMetniKaydet(vt: SupabaseClient, anahtar: string, c: CikanMetin): Promise<void> {
  const { error } = await vt.rpc("kaynak_metni_kaydet", {
    p_anahtar: anahtar,
    p_durum: c.durum,
    p_sayfali: c.durum === "tamam" ? c.sayfali : true,
    p_sayfalar: c.durum === "tamam" ? c.sayfalar : [],
  });
  if (error) console.warn(`yz: kaynak metni kaydedilemedi: ${error.message}`);
}

/** Editör YZ sonucunu gördükten sonra karar verdi: denetim kaydına "YZ önerisi görüldü, X onayladı/reddetti". Hata kararı bozmaz. */
export async function yzKararKaydet(vt: SupabaseClient | null, analizler: unknown, karar: "onayladi" | "reddetti"): Promise<void> {
  if (!vt || !Array.isArray(analizler)) return;
  for (const id of analizler.filter((x): x is number => Number.isInteger(x)).slice(0, 5)) {
    try {
      const { error } = await vt.rpc("yz_karar_kaydet", { p_analiz: id, p_karar: karar });
      if (error) console.warn(`yz: karar kaydedilemedi: ${error.message}`);
    } catch (hata) {
      console.warn(`yz: karar kaydedilemedi: ${String(hata)}`);
    }
  }
}

/** Editörün YZ etiketi düzeltmesi (yz_etiket_duzeltmeleri, supabase/007_yz_eleme.sql). */
export type EtiketDuzeltmesi = { oneri_id: number; etiketler: string[]; oncelik: "yuksek" | "normal" | "dusuk"; kim_ad: string | null; ne_zaman: string };

/** Her önerinin en son düzeltmesi. Tablo yoksa boş. */
export async function sonDuzeltmeler(vt: SupabaseClient, idler: number[]): Promise<Map<number, EtiketDuzeltmesi>> {
  const harita = new Map<number, EtiketDuzeltmesi>();
  if (!idler.length) return harita;
  try {
    const { data, error } = await vt.from("yz_etiket_duzeltmeleri").select("*").in("oneri_id", idler).order("ne_zaman", { ascending: false }).limit(1000);
    if (error) return harita;
    for (const d of (data ?? []) as EtiketDuzeltmesi[]) if (!harita.has(d.oneri_id)) harita.set(d.oneri_id, d);
  } catch {}
  return harita;
}

export async function etiketDuzelt(vt: SupabaseClient, oneri: number, analiz: number | null, etiketler: string[], oncelik: string): Promise<string | null> {
  const { error } = await vt.rpc("yz_etiket_duzelt", { p_oneri: oneri, p_analiz: analiz, p_etiketler: etiketler, p_oncelik: oncelik });
  return error ? error.message : null;
}
