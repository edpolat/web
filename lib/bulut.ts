// Ziyaretçi hesabı: mobil uygulamayla aynı Supabase projesi (auth + "profiller" ve "pullar" tabloları).
// Adres ve herkese açık (publishable) anahtar .env.local içinde: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.
// Secret anahtar asla koda girmez; verileri Supabase'deki satır güvenliği kuralları korur.
// Tablolar: profiller(id, ad), pullar(kullanici, eser_id, tarih). Oturumu supabase-js tarayıcıda kendisi saklar ve yeniler.
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const ADRES = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANAHTAR = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const bulutHazir = Boolean(ADRES && ANAHTAR);

let istemci: SupabaseClient | undefined;
function vt(): SupabaseClient {
  return (istemci ??= createClient(ADRES, ANAHTAR));
}

export type BulutOturumu = { id: string; eposta: string; ad: string };
export type BulutHataKodu = "ad" | "eposta" | "sifre" | "kayitli" | "hatali" | "zayif" | "cok" | "onay" | "baglanti" | "genel";

export class BulutHatasi extends Error {
  constructor(public kod: BulutHataKodu) {
    super(kod);
  }
}

type SupabaseHatasi = { status?: number; code?: string; message?: string; name?: string } | null;

/** Supabase'in hatasını formdaki mesaj koduna çevirir (uygulamadaki hataMesaji ile aynı eşleme). */
export function hataKodu(h: SupabaseHatasi): BulutHataKodu {
  const k = `${h?.code ?? ""} ${h?.message ?? ""}`;
  if (h?.name === "AuthRetryableFetchError" || /failed to fetch|network/i.test(k)) return "baglanti";
  if (/already|exists/i.test(k)) return "kayitli";
  if (/invalid_credentials|invalid login/i.test(k)) return "hatali";
  if (/weak_password/i.test(k)) return "zayif";
  if (/email_address_invalid|invalid.*email/i.test(k)) return "eposta";
  if (/rate|429/i.test(k) || h?.status === 429) return "cok";
  if (/not_confirmed/i.test(k)) return "onay";
  return "genel";
}

/** Form kuralları, uygulamadakiyle aynı: ad en az 2, geçerli e-posta, şifre en az 6 karakter. */
export function formDenetle(f: { ad?: string; eposta: string; sifre: string }, uyeOluyor: boolean): BulutHataKodu | undefined {
  if (uyeOluyor && (f.ad ?? "").trim().length < 2) return "ad";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.eposta.trim())) return "eposta";
  if (f.sifre.length < 6) return "sifre";
  return undefined;
}

function denetle(error: SupabaseHatasi) {
  if (error) throw new BulutHatasi(hataKodu(error));
}

/** Kullanıcının adı profiller tablosundan; yoksa üyelikte verilen ad ya da e-postanın başı. */
async function oturum(user: User, ad?: string): Promise<BulutOturumu> {
  const eposta = user.email ?? "";
  if (!ad) {
    const { data: profil } = await vt().from("profiller").select("ad").eq("id", user.id).maybeSingle();
    ad = profil?.ad || (user.user_metadata?.ad as string | undefined) || eposta.split("@")[0];
  }
  return { id: user.id, eposta, ad: ad! };
}

/** Üye ol. E-posta onayı açıksa oturum gelmez: null döner, kullanıcı onaydan sonra giriş yapar. */
export async function uyeOl(ad: string, eposta: string, sifre: string): Promise<BulutOturumu | null> {
  const { data, error } = await vt().auth.signUp({ email: eposta, password: sifre, options: { data: { ad } } });
  denetle(error);
  if (!data.user || !data.session) return null;
  denetle((await vt().from("profiller").upsert({ id: data.user.id, ad })).error);
  return oturum(data.user, ad);
}

export async function girisYap(eposta: string, sifre: string): Promise<BulutOturumu> {
  const { data, error } = await vt().auth.signInWithPassword({ email: eposta, password: sifre });
  denetle(error);
  return oturum(data.user!);
}

/** Tarayıcıda açık bir oturum varsa giriş yapan kullanıcı. */
export async function kayitliOturum(): Promise<BulutOturumu | null> {
  const { data } = await vt().auth.getSession();
  if (!data.session) return null;
  const { data: u, error } = await vt().auth.getUser();
  if (error || !u.user) return null;
  return oturum(u.user);
}

export async function pullariGetir(): Promise<string[]> {
  const { data, error } = await vt().from("pullar").select("eser_id, tarih").order("tarih");
  denetle(error);
  return (data ?? []).map((p) => p.eser_id as string);
}

export async function cikisYap(): Promise<void> {
  await vt().auth.signOut().catch(() => {});
}

/** Oturum her değiştiğinde (açılış, giriş, yenileme, çıkış) güncel erişim jetonunu bildirir; aboneliği bırakan fonksiyonu döner. */
export function oturumIzle(bildir: (jeton: string | null) => void): () => void {
  // Supabase, olay içinde başka Supabase çağrısı beklemeyi önermiyor; bildirim bir sonraki adımda yapılır.
  const { data } = vt().auth.onAuthStateChange((_olay, oturum) => {
    setTimeout(() => bildir(oturum?.access_token ?? null), 0);
  });
  return () => data.subscription.unsubscribe();
}

/** Sunucunun verdiği tek kullanımlık adrese kaynak dosyasını yükler (Supabase Storage, "kaynak-dosyalari"). */
export async function dosyaYukle(yol: string, jeton: string, dosya: File): Promise<void> {
  const { error } = await vt().storage.from("kaynak-dosyalari").uploadToSignedUrl(yol, jeton, dosya, { contentType: dosya.type });
  if (error) throw new Error(error.message);
}

/** Açık oturumun erişim jetonu (API isteklerinde "Authorization: Bearer"); oturum yoksa null. */
export async function erisimJetonu(): Promise<string | null> {
  const { data } = await vt().auth.getSession();
  return data.session?.access_token ?? null;
}
