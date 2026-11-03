// Sergilerin Supabase katmanı (tablo: sergiler, supabase/017_sergiler.sql).
// Site sergileri anonim anahtarla okur (önbellekli, panelde değişince hemen tazelenir).
// Supabase ayarlı değilse, ulaşılamazsa ya da 017 çalıştırılmamışsa veri/sergiler.json kullanılır.
import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { SergiHatasi, satirdanSergi, type SergiIstegi, type SergiSatiri } from "../sergi";
import type { Sergi } from "../tipler";
import { sergiler as jsondakiSergiler } from "../veri";
import { hesapIstemcisi } from "./kimlik";

const ADRES = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANAHTAR = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SERGI_ETIKETI = "sergiler";

const herkese = () =>
  createClient(ADRES, ANAHTAR, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (adres, secenek) => fetch(adres, { ...secenek, next: { revalidate: 300, tags: [SERGI_ETIKETI] } }) },
  });

/** Sitede gösterilecek sergiler. Tablo okunabiliyorsa yalnız tablo (silinen sergi görünmez), okunamazsa JSON. */
export async function yayindakiSergiler(): Promise<Map<string, Sergi>> {
  if (!ADRES || !ANAHTAR) return jsondakiSergiler();
  try {
    const { data, error } = await herkese().from("sergiler").select("*").order("baslangic", { ascending: false, nullsFirst: false }).limit(500);
    if (error || !data) return jsondakiSergiler();
    return new Map((data as SergiSatiri[]).map((r) => [r.id, satirdanSergi(r)]));
  } catch {
    return jsondakiSergiler();
  }
}

export function sergileriYenile() {
  revalidateTag(SERGI_ETIKETI, "max");
  revalidatePath("/[dil]/sergiler", "page");
  revalidatePath("/[dil]/eser/[id]", "page");
}

async function vt() {
  const istemci = await hesapIstemcisi();
  if (!istemci) throw new SergiHatasi("Giriş gerekli.");
  return istemci;
}

function denetle(error: { message: string; code?: string } | null): void {
  if (!error) return;
  if (error.code === "42501") throw new SergiHatasi("Bu işlem için yetkin yok.");
  if (error.code === "23505") throw new SergiHatasi("Bu kimlikte bir sergi zaten var; kimliği değiştir.");
  if (/sergiler|sergi_kaydet|sergi_sil/.test(error.message) && /exist|find|schema cache/i.test(error.message)) {
    throw new SergiHatasi("Sergi tablosu yok: Supabase'de supabase/017_sergiler.sql çalıştırılmalı.");
  }
  throw new SergiHatasi(error.message);
}

/** Paneldeki sergi kayıtları (ekleyen ve güncelleyen bilgisiyle). Tablo yoksa hata verir. */
export async function sergiKayitlari(): Promise<SergiSatiri[]> {
  const { data, error } = await (await vt()).from("sergiler").select("*").order("baslangic", { ascending: false, nullsFirst: false }).limit(500);
  denetle(error);
  return (data ?? []) as SergiSatiri[];
}

export async function sergiKaydet(s: SergiIstegi, yeni: boolean): Promise<string> {
  const { data, error } = await (await vt()).rpc("sergi_kaydet", {
    p_id: s.id,
    p_yeni: yeni,
    p_ad_tr: s.ad_tr,
    p_ad_en: s.ad_en,
    p_sehir: s.sehir,
    p_yer: s.yer,
    p_harita: s.harita,
    p_baslangic: s.baslangic,
    p_bitis: s.bitis,
    p_aciklama_tr: s.aciklama_tr,
    p_aciklama_en: s.aciklama_en,
    p_url: s.url,
  });
  denetle(error);
  sergileriYenile();
  return (data as string) ?? s.id;
}

export async function sergiSil(id: string, gerekce: string): Promise<void> {
  denetle((await (await vt()).rpc("sergi_sil", { p_id: id, p_gerekce: gerekce })).error);
  sergileriYenile();
}
