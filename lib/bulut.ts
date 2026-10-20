// Ziyaretçi hesabı: mobil uygulamayla aynı Supabase projesi (auth + "profiller" ve "pullar" tabloları).
// Adres ve herkese açık anahtar .env.local içinde: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.
// Verileri Supabase'deki satır güvenliği kuralları korur. Uygulamadaki karşılığı: bulut_kur.py.
// Tablolar: profiller(id, ad), pullar(kullanici, eser_id).

const ADRES = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANAHTAR = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const OTURUM = "vakfiye:bulut-oturum";

export const bulutHazir = Boolean(ADRES && ANAHTAR);

export type BulutOturumu = { id: string; eposta: string; ad: string; erisim: string; yenile: string; bitis: number };
export type BulutHataKodu = "ad" | "eposta" | "sifre" | "kayitli" | "hatali" | "zayif" | "cok" | "onay" | "baglanti" | "genel";

export class BulutHatasi extends Error {
  constructor(public kod: BulutHataKodu) {
    super(kod);
  }
}

type SupabaseHatasi = { msg?: string; error_code?: string; code?: string; error?: string; message?: string } | null;

/** Supabase'in hata cevabını formdaki mesaj koduna çevirir (uygulamadaki hataMesaji ile aynı eşleme). */
export function hataKodu(durum: number, govde: SupabaseHatasi): BulutHataKodu {
  const k = `${govde?.error_code ?? govde?.code ?? govde?.error ?? ""} ${govde?.msg ?? govde?.message ?? ""}`;
  if (/already|exists/i.test(k)) return "kayitli";
  if (/invalid_credentials|invalid login/i.test(k)) return "hatali";
  if (/weak_password/i.test(k)) return "zayif";
  if (/email_address_invalid|invalid.*email/i.test(k)) return "eposta";
  if (/rate|429/i.test(k) || durum === 429) return "cok";
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

async function istek<T>(yol: string, ayar: { yontem?: string; govde?: unknown; jeton?: string; tercih?: string } = {}): Promise<T> {
  const basliklar: Record<string, string> = { apikey: ANAHTAR, "Content-Type": "application/json" };
  if (ayar.jeton) basliklar.Authorization = `Bearer ${ayar.jeton}`;
  if (ayar.tercih) basliklar.Prefer = ayar.tercih;
  let yanit: Response;
  try {
    yanit = await fetch(ADRES + yol, {
      method: ayar.yontem ?? "GET",
      headers: basliklar,
      body: ayar.govde === undefined ? undefined : JSON.stringify(ayar.govde),
    });
  } catch {
    throw new BulutHatasi("baglanti");
  }
  const metin = await yanit.text();
  let veri: unknown = null;
  try {
    veri = metin ? JSON.parse(metin) : null;
  } catch {
    veri = { msg: metin };
  }
  if (!yanit.ok) throw new BulutHatasi(hataKodu(yanit.status, veri as SupabaseHatasi));
  return veri as T;
}

type TokenCevabi = {
  access_token?: string;
  refresh_token: string;
  expires_in?: number;
  user: { id: string; email: string; user_metadata?: { ad?: string } };
};

function sakla(o: BulutOturumu): BulutOturumu {
  try {
    localStorage.setItem(OTURUM, JSON.stringify(o));
  } catch {}
  return o;
}

function oturumYap(y: TokenCevabi, ad?: string): BulutOturumu {
  return sakla({
    id: y.user.id,
    eposta: y.user.email,
    ad: ad || y.user.user_metadata?.ad || y.user.email.split("@")[0],
    erisim: y.access_token!,
    yenile: y.refresh_token,
    bitis: Date.now() + (y.expires_in ?? 3600) * 1000,
  });
}

export function kayitliOturum(): BulutOturumu | null {
  try {
    return JSON.parse(localStorage.getItem(OTURUM) ?? "null") as BulutOturumu | null;
  } catch {
    return null;
  }
}

async function tazele(o: BulutOturumu): Promise<BulutOturumu> {
  if (Date.now() < o.bitis - 60_000) return o;
  const y = await istek<TokenCevabi>("/auth/v1/token?grant_type=refresh_token", {
    yontem: "POST",
    govde: { refresh_token: o.yenile },
  });
  return oturumYap(y, o.ad);
}

/** Üye ol. E-posta onayı açıksa oturum gelmez: null döner, kullanıcı onaydan sonra giriş yapar. */
export async function uyeOl(ad: string, eposta: string, sifre: string): Promise<BulutOturumu | null> {
  const y = await istek<TokenCevabi>("/auth/v1/signup", {
    yontem: "POST",
    govde: { email: eposta, password: sifre, data: { ad } },
  });
  if (!y.access_token) return null;
  const o = oturumYap(y, ad);
  await istek("/rest/v1/profiller", {
    yontem: "POST",
    jeton: o.erisim,
    tercih: "resolution=merge-duplicates,return=minimal",
    govde: { id: o.id, ad },
  });
  return o;
}

export async function girisYap(eposta: string, sifre: string): Promise<BulutOturumu> {
  const o = oturumYap(
    await istek<TokenCevabi>("/auth/v1/token?grant_type=password", { yontem: "POST", govde: { email: eposta, password: sifre } }),
  );
  try {
    const profil = await istek<{ ad: string }[]>(`/rest/v1/profiller?id=eq.${o.id}&select=ad`, { jeton: o.erisim });
    if (profil[0]?.ad) return sakla({ ...o, ad: profil[0].ad });
  } catch {}
  return o;
}

export async function pullariGetir(o: BulutOturumu): Promise<string[]> {
  const g = await tazele(o);
  const satirlar = await istek<{ eser_id: string }[]>("/rest/v1/pullar?select=eser_id", { jeton: g.erisim });
  return satirlar.map((p) => p.eser_id);
}

export async function cikisYap(o: BulutOturumu | null): Promise<void> {
  try {
    localStorage.removeItem(OTURUM);
  } catch {}
  if (o) await istek("/auth/v1/logout", { yontem: "POST", jeton: o.erisim }).catch(() => {});
}
