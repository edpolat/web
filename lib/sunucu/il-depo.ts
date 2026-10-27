// Panelden eklenen illerin Supabase katmanı (tablo: il_surumleri, supabase/012_il_surumleri.sql).
// Site yayındaki illeri anonim anahtarla okur; önbellek eser sürümleriyle aynı etiketi kullanır, yayiniYenile() ikisini de tazeler.
// Supabase ayarlı değilse, ulaşılamazsa ya da 012 çalıştırılmamışsa site yalnız JSON illeriyle çalışır.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { hesapIstemcisi } from "./kimlik";
import { KatkiHatasi } from "./katki";
import { sonYayindakiIller, type HazirIl, type IlSurumSatiri, type YayindakiIl } from "./il-surum";
import { SURUM_ETIKETI } from "./surum-depo";

const ADRES = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANAHTAR = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const herkese = () =>
  createClient(ADRES, ANAHTAR, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (adres, secenek) => fetch(adres, { ...secenek, next: { revalidate: 300, tags: [SURUM_ETIKETI] } }) },
  });

/** Her ilin en son yayındaki kaydı; hata olursa boş. */
export async function yayindakiIlKayitlari(): Promise<Map<string, YayindakiIl>> {
  if (!ADRES || !ANAHTAR) return new Map();
  try {
    const { data, error } = await herkese()
      .from("il_surumleri")
      // "*": arsivlendi sütunu 013'ten önce yok; seçim adla yapılırsa sorgu düşer ve yeni iller kaybolur.
      .select("*")
      .eq("durum", "yayinda")
      .order("karar_tarihi", { ascending: false })
      .limit(500);
    if (error) return new Map();
    return sonYayindakiIller((data ?? []) as YayindakiIl[]);
  } catch {
    return new Map();
  }
}

async function vt() {
  const istemci = await hesapIstemcisi();
  if (!istemci) throw new KatkiHatasi("Giriş gerekli.");
  return istemci;
}

function denetle(error: { message: string; code?: string } | null): void {
  if (!error) return;
  if (error.code === "42501") throw new KatkiHatasi("Bu işlem için yetkin yok.");
  if (/il_surumleri|il_gonder|il_karar|il_kaldir/.test(error.message) && /exist|find|schema cache/i.test(error.message)) {
    throw new KatkiHatasi("İl kayıtları tablosu yok: Supabase'de supabase/012_il_surumleri.sql çalıştırılmalı.");
  }
  throw new KatkiHatasi(error.message);
}

/** Paneldeki il kayıtları, en yeniler önce. */
export async function ilSurumleri(): Promise<IlSurumSatiri[]> {
  const { data, error } = await (await vt()).from("il_surumleri").select("*").order("id", { ascending: false }).limit(200);
  denetle(error);
  return (data ?? []) as IlSurumSatiri[];
}

export async function ilOku(id: number): Promise<IlSurumSatiri | undefined> {
  const { data, error } = await (await vt()).from("il_surumleri").select("*").eq("id", id).maybeSingle();
  denetle(error);
  return (data ?? undefined) as IlSurumSatiri | undefined;
}

export async function ilGonder(h: HazirIl): Promise<number> {
  const { data, error } = await (await vt()).rpc("il_gonder", { p_il: h.il_id, p_veri: h.veri, p_islem: h.islem, p_not: h.aciklama ?? null });
  denetle(error);
  return data as number;
}

/** İli ve yayındaki eserlerini arşivler; arşivlenen eser sayısını döner. */
export async function ilKaldir(il_id: string, gerekce: string): Promise<number> {
  const { data, error } = await (await vt()).rpc("il_kaldir", { p_il: il_id, p_gerekce: gerekce });
  if (error && /il_kaldir/.test(error.message) && /exist|find|schema cache/i.test(error.message)) {
    throw new KatkiHatasi("İli kaldırmak için Supabase'de supabase/013_il_kaldir.sql çalıştırılmalı.");
  }
  denetle(error);
  return data as number;
}

export async function ilKarar(id: number, onay: boolean, gerekce: string): Promise<void> {
  denetle((await (await vt()).rpc("il_karar", { p_id: id, p_onay: onay, p_gerekce: gerekce })).error);
}
