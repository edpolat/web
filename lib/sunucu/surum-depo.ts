// Eser sürümlerinin Supabase katmanı (tablo: eser_surumleri, supabase/002_surumler.sql).
// Site yayındaki sürümleri anonim anahtarla okur (beş dakikalık önbellek); panel işlemleri giriş yapan kişinin adına çalışır.
// Supabase ayarlı değilse ya da ulaşılamazsa site JSON dosyalarıyla aynen çalışır.
import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { hesapIstemcisi } from "./kimlik";
import { KatkiHatasi } from "./katki";
import type { Eser } from "../tipler";
import { sonYayindakiler, type AlanFarki, type HazirSurum, type SurumSatiri, type YayindakiSurum } from "./surum";

const ADRES = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANAHTAR = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SURUM_ETIKETI = "eser-surumleri";

const herkese = () =>
  createClient(ADRES, ANAHTAR, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (adres, secenek) => fetch(adres, { ...secenek, next: { revalidate: 300, tags: [SURUM_ETIKETI] } }) },
  });

/** Her eserin en son yayındaki sürümü; hata olursa boş (site JSON'la devam eder). */
export async function yayindakiSurumler(): Promise<Map<string, YayindakiSurum>> {
  if (!ADRES || !ANAHTAR) return new Map();
  try {
    const { data, error } = await herkese()
      .from("eser_surumleri")
      .select("id, eser_id, il, veri, arsivlendi, karar_tarihi")
      .eq("durum", "yayinda")
      .order("karar_tarihi", { ascending: false })
      .limit(5000);
    if (error) return new Map();
    return sonYayindakiler((data ?? []) as YayindakiSurum[]);
  } catch {
    return new Map();
  }
}

/** Onaydan sonra yayındaki hâl bir sonraki ziyarette görünsün. */
export function yayiniYenile() {
  revalidateTag(SURUM_ETIKETI, "max");
  revalidatePath("/[dil]", "layout");
}

async function vt() {
  const istemci = await hesapIstemcisi();
  if (!istemci) throw new KatkiHatasi("Giriş gerekli.");
  return istemci;
}

function denetle(error: { message: string; code?: string } | null): void {
  if (error) throw new KatkiHatasi(error.code === "42501" ? "Bu işlem için yetkin yok." : error.message);
}

/** Panelde görünen sürümler: süzgeç verilmezse en yeniler. Satır güvenliği kişinin görebileceklerini sınırlar. */
export async function surumler(suzgec: { durum?: SurumSatiri["durum"]; eser_id?: string; ekleyen?: string } = {}): Promise<SurumSatiri[]> {
  let sorgu = (await vt()).from("eser_surumleri").select("*").order("id", { ascending: false }).limit(500);
  if (suzgec.durum) sorgu = sorgu.eq("durum", suzgec.durum);
  if (suzgec.eser_id) sorgu = sorgu.eq("eser_id", suzgec.eser_id);
  if (suzgec.ekleyen) sorgu = sorgu.eq("ekleyen", suzgec.ekleyen);
  const { data, error } = await sorgu;
  denetle(error);
  return (data ?? []) as SurumSatiri[];
}

export async function surumOku(id: number): Promise<SurumSatiri | undefined> {
  const { data, error } = await (await vt()).from("eser_surumleri").select("*").eq("id", id).maybeSingle();
  denetle(error);
  return (data ?? undefined) as SurumSatiri | undefined;
}

export type DenetimSatiri = {
  id: number;
  kim_ad: string | null;
  ne_zaman: string;
  islem: string;
  hedef: string | null;
  surum_id: number | null;
  alan: string | null;
  eski: unknown;
  yeni: unknown;
  gerekce: string | null;
};

export async function denetimKaydi(hedef?: string, sinir = 200): Promise<DenetimSatiri[]> {
  let sorgu = (await vt()).from("denetim_kaydi").select("*").order("id", { ascending: false }).limit(sinir);
  if (hedef) sorgu = sorgu.eq("hedef", hedef);
  const { data, error } = await sorgu;
  denetle(error);
  return (data ?? []) as DenetimSatiri[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const kimlikMi = (x: string | null | undefined): x is string => !!x && UUID.test(x);

/**
 * Denetim kaydında hedefi kullanıcı olan satırlar için kimlik → ad (020_denetim_kisi_adlari.sql).
 * Fonksiyon kurulmamışsa ya da hata verirse boş döner; tablo kimliği kısaltarak gösterir.
 */
export async function kisiAdlari(kayitlar: DenetimSatiri[]): Promise<Map<string, string>> {
  const kimlikler = [...new Set(kayitlar.map((k) => k.hedef).filter(kimlikMi))];
  const adlar = new Map<string, string>();
  if (!kimlikler.length) return adlar;
  try {
    const { data, error } = await (await vt()).rpc("denetim_kisi_adlari", { kimlikler });
    if (error) return adlar;
    for (const r of (data ?? []) as { id: string; ad: string | null }[]) if (r.ad) adlar.set(r.id, r.ad);
  } catch {}
  return adlar;
}

/** dilUyumu: gönderen "diğer dildeki metne uyum için" dedi. Parametre yalnız işaretliyse gider (009 çalıştırılmadan da gönderme çalışsın). */
export async function surumGonder(s: HazirSurum, temel: number | null, taslak: boolean, dilUyumu = false): Promise<number> {
  const { data, error } = await (await vt()).rpc("surum_gonder", {
    p_eser: s.eser_id,
    p_il: s.il,
    p_veri: s.veri,
    p_islem: s.islem,
    p_temel: temel,
    p_kaynak: s.kaynak_id,
    p_sayfa: s.sayfa ?? null,
    p_not: s.aciklama ?? null,
    p_taslak: taslak,
    ...(dilUyumu ? { p_dil_uyumu: true } : {}),
  });
  if (error && dilUyumu && /p_dil_uyumu|function/i.test(error.message)) {
    throw new KatkiHatasi("\"Uyum için\" işareti kaydedilemedi: Supabase'de supabase/009_dil_uyumu.sql çalıştırılmalı.");
  }
  denetle(error);
  return data as number;
}

export async function surumIncelemeye(id: number): Promise<void> {
  denetle((await (await vt()).rpc("surum_incelemeye", { p_id: id })).error);
}

export async function surumKarar(id: number, onay: boolean, gerekce: string, degisiklikler: AlanFarki[]): Promise<void> {
  denetle((await (await vt()).rpc("surum_karar", { p_id: id, p_onay: onay, p_gerekce: gerekce, p_degisiklikler: degisiklikler })).error);
}

/** Tarihçi kararı: ilerlet (isteğe bağlı düzeltilmiş veriyle) ya da reddet. Fonksiyon yoksa 015 çalıştırılmamıştır. */
export async function surumTarihciKarar(id: number, ilerlet: boolean, veri: Eser | null, not: string, degisiklikler: AlanFarki[] | null): Promise<void> {
  const { error } = await (await vt()).rpc("surum_tarihci_karar", { p_id: id, p_ilerlet: ilerlet, p_veri: veri, p_not: not, p_degisiklikler: degisiklikler });
  if (error && /surum_tarihci_karar/.test(error.message) && /exist|find|schema cache/i.test(error.message)) {
    throw new KatkiHatasi("Akademik danışman onayı için Supabase'de supabase/015_tarihci_onayi.sql çalıştırılmalı.");
  }
  denetle(error);
}

export async function surumYayinla(
  s: Pick<SurumSatiri, "eser_id" | "il" | "veri">,
  islem: "geri_al" | "arsivle" | "arsivden_cikar",
  temel: number | null,
  gerekce: string,
  degisiklikler: AlanFarki[],
): Promise<number> {
  const { data, error } = await (await vt()).rpc("surum_yayinla", {
    p_eser: s.eser_id,
    p_il: s.il,
    p_veri: s.veri,
    p_islem: islem,
    p_temel: temel,
    p_gerekce: gerekce,
    p_degisiklikler: degisiklikler,
  });
  denetle(error);
  return data as number;
}
