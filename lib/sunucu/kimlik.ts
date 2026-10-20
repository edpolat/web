// Panele giren kişiyi bulur: Supabase erişim jetonu "Authorization: Bearer" başlığından (uygulama, API)
// ya da tarayıcının httpOnly çerezinden (web paneli, components/PanelGiris.tsx) gelir.
// Jeton her istekte Supabase'e doğrulatılır; izinler benim_izinlerim() fonksiyonundan okunur.
import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { yetkiCoz, type Kimlik } from "../yetki";

export const HESAP_CEREZI = "vakfiye_hesap";

const ADRES = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANAHTAR = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Kullanıcının adına çalışan istemci: Supabase'deki satır güvenliği kuralları bu kişiye göre uygulanır. */
export function kullaniciIstemcisi(jeton: string): SupabaseClient {
  return createClient(ADRES, ANAHTAR, {
    global: { headers: { Authorization: `Bearer ${jeton}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function jetonBul(): Promise<string | undefined> {
  const baslik = (await headers()).get("authorization");
  if (baslik?.startsWith("Bearer ")) return baslik.slice(7);
  return (await cookies()).get(HESAP_CEREZI)?.value;
}

export async function jetondanKimlik(jeton: string): Promise<Kimlik | null> {
  if (!ADRES || !ANAHTAR) return null;
  const vt = kullaniciIstemcisi(jeton);
  const { data, error } = await vt.auth.getUser(jeton);
  if (error || !data.user) return null;
  const [{ data: yetki }, { data: profil }] = await Promise.all([
    vt.rpc("benim_izinlerim"),
    vt.from("profiller").select("ad").eq("id", data.user.id).maybeSingle(),
  ]);
  const eposta = data.user.email ?? "";
  const ad = (profil?.ad as string | undefined) || (data.user.user_metadata?.ad as string | undefined) || eposta.split("@")[0];
  return { id: data.user.id, eposta, ad, ...yetkiCoz(yetki) };
}

/** Bu isteği yapan hesap (istek başına bir kez sorulur). */
export const kimlik = cache(async (): Promise<Kimlik | null> => {
  const jeton = await jetonBul();
  return jeton ? jetondanKimlik(jeton) : null;
});

/** Giriş yapan kişinin adına Supabase istemcisi; girişsizse null. */
export async function hesapIstemcisi(): Promise<SupabaseClient | null> {
  const jeton = await jetonBul();
  return jeton && ADRES && ANAHTAR ? kullaniciIstemcisi(jeton) : null;
}

/** Çerezin ömrü jetonun bitiş zamanı kadar (JWT "exp"); okunamazsa bir saat. */
export function jetonOmru(jeton: string, simdi = Date.now()): number {
  try {
    const { exp } = JSON.parse(Buffer.from(jeton.split(".")[1], "base64url").toString()) as { exp?: number };
    if (typeof exp === "number") return Math.max(0, Math.floor(exp - simdi / 1000));
  } catch {}
  return 3600;
}
