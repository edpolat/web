// Form taslaklarının Supabase katmanı (tablo: form_taslaklari, supabase/014_form_taslaklari.sql). Kurallar lib/sunucu/taslak.ts'de.
// Taslak yalnız sahibine görünür (RLS); her istek kişinin kendi jetonuyla yapılır.
import "server-only";
import { hesapIstemcisi } from "./kimlik";
import { KatkiHatasi } from "./katki";
import type { FormTaslagi, HazirTaslak, TaslakTuru } from "./taslak";

async function vt() {
  const istemci = await hesapIstemcisi();
  if (!istemci) throw new KatkiHatasi("Giriş gerekli.");
  return istemci;
}

function denetle(error: { message: string; code?: string } | null): void {
  if (!error) return;
  if (error.code === "42501") throw new KatkiHatasi("Bu işlem için yetkin yok.");
  if (/form_taslaklari/.test(error.message) && /exist|find|schema cache/i.test(error.message)) {
    throw new KatkiHatasi("Taslak tablosu yok: Supabase'de supabase/014_form_taslaklari.sql çalıştırılmalı.");
  }
  throw new KatkiHatasi(error.message);
}

/** Kişinin form taslakları, en son güncellenen önce. Tablo yoksa boş liste (panel 014 olmadan da çalışsın). */
export async function formTaslaklarim(tur?: TaslakTuru): Promise<FormTaslagi[]> {
  try {
    let sorgu = (await vt()).from("form_taslaklari").select("*").order("guncellendi", { ascending: false }).limit(200);
    if (tur) sorgu = sorgu.eq("tur", tur);
    const { data, error } = await sorgu;
    if (error) return [];
    return (data ?? []) as FormTaslagi[];
  } catch {
    return [];
  }
}

export async function formTaslagiOku(id: number, tur: TaslakTuru): Promise<FormTaslagi | undefined> {
  if (!Number.isInteger(id) || id <= 0) return undefined;
  try {
    const { data } = await (await vt()).from("form_taslaklari").select("*").eq("id", id).eq("tur", tur).maybeSingle();
    return (data ?? undefined) as FormTaslagi | undefined;
  } catch {
    return undefined;
  }
}

/** Yeni taslak ya da var olanı günceller; kimliğini döner. */
export async function formTaslagiKaydet(h: HazirTaslak): Promise<number> {
  const db = await vt();
  const satir = { tur: h.tur, hedef: h.hedef, baslik: h.baslik, veri: h.veri, guncellendi: new Date().toISOString() };
  if (h.id) {
    const { data, error } = await db.from("form_taslaklari").update(satir).eq("id", h.id).select("id").maybeSingle();
    denetle(error);
    if (!data) throw new KatkiHatasi("Taslak bulunamadı.");
    return (data as { id: number }).id;
  }
  const { data, error } = await db.from("form_taslaklari").insert(satir).select("id").single();
  denetle(error);
  return (data as { id: number }).id;
}

export async function formTaslagiSil(id: number): Promise<void> {
  denetle((await (await vt()).from("form_taslaklari").delete().eq("id", id)).error);
}
