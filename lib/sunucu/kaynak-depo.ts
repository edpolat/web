// Kaynak kütüphanesinin Supabase katmanı: kaynak_kutuphanesi, bilgi_kaynaklari ve "kaynak-dosyalari" kovası.
// Site doğrulanmış kaynakları anonim anahtarla okur (önbellekli); panel işlemleri giriş yapan kişinin adına çalışır.
import "server-only";
import crypto from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { DOSYA_KOVASI, DOSYA_TURLERI, EN_BUYUK_DOSYA, KaynakHatasi, dosyaTuruBul, type DosyaTuru, type KaynakIstegi, type KutuphaneKaynagi } from "../kaynak";
import { hesapIstemcisi, kimlik } from "./kimlik";

const ADRES = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANAHTAR = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const KAYNAK_ETIKETI = "kaynak-kutuphanesi";

const herkese = (onbellek = true) =>
  createClient(ADRES, ANAHTAR, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: onbellek ? { fetch: (a, s) => fetch(a, { ...s, next: { revalidate: 300, tags: [KAYNAK_ETIKETI] } }) } : {},
  });

/** Doğrulanmış kaynaklar (sitede gösterilir, eser formunda seçilir). Hata olursa boş. */
export async function dogrulanmisKaynaklar(): Promise<KutuphaneKaynagi[]> {
  if (!ADRES || !ANAHTAR) return [];
  try {
    const { data, error } = await herkese().from("kaynak_kutuphanesi").select("*").eq("durum", "dogrulandi").order("baslik");
    return error ? [] : ((data ?? []) as KutuphaneKaynagi[]);
  } catch {
    return [];
  }
}

export function kaynaklariYenile() {
  revalidateTag(KAYNAK_ETIKETI, "max");
  revalidatePath("/[dil]", "layout");
}

async function vt() {
  const istemci = await hesapIstemcisi();
  if (!istemci) throw new KaynakHatasi("Giriş gerekli.");
  return istemci;
}

function denetle(error: { message: string; code?: string } | null): void {
  if (error) throw new KaynakHatasi(error.code === "42501" ? "Bu işlem için yetkin yok." : error.message);
}

export async function kaynakListesi(suzgec: { durum?: string; nitelik?: string } = {}): Promise<KutuphaneKaynagi[]> {
  let sorgu = (await vt()).from("kaynak_kutuphanesi").select("*").order("eklendi", { ascending: false }).limit(1000);
  if (suzgec.durum) sorgu = sorgu.eq("durum", suzgec.durum);
  if (suzgec.nitelik) sorgu = sorgu.eq("nitelik", suzgec.nitelik);
  const { data, error } = await sorgu;
  denetle(error);
  return (data ?? []) as KutuphaneKaynagi[];
}

export async function kaynakOku(id: string): Promise<KutuphaneKaynagi | undefined> {
  const { data, error } = await (await vt()).from("kaynak_kutuphanesi").select("*").eq("id", id).maybeSingle();
  denetle(error);
  return (data ?? undefined) as KutuphaneKaynagi | undefined;
}

export type BilgiKaynagi = {
  id: number;
  eser_id: string;
  alan: string;
  deger: string | null;
  kaynak_id: string;
  konum: string | null;
  surum_id: number | null;
  ekleyen_ad: string | null;
  eklendi: string;
};

export async function bilgiKaynaklari(suzgec: { eser_id?: string; kaynak_id?: string }): Promise<BilgiKaynagi[]> {
  let sorgu = (await vt()).from("bilgi_kaynaklari").select("*").order("id", { ascending: false }).limit(500);
  if (suzgec.eser_id) sorgu = sorgu.eq("eser_id", suzgec.eser_id);
  if (suzgec.kaynak_id) sorgu = sorgu.eq("kaynak_id", suzgec.kaynak_id);
  const { data, error } = await sorgu;
  denetle(error);
  return (data ?? []) as BilgiKaynagi[];
}

/**
 * Tek kullanımlık yükleme adresi. Dosya tarayıcıdan doğrudan Supabase'e gider (Vercel istek sınırı ~4,5 MB);
 * adı sunucuda rastgele verilir: <kullanıcı kimliği>/<rastgele>.<uzantı>.
 */
export async function yuklemeAdresi(tur: unknown, boyut: unknown): Promise<{ yol: string; jeton: string }> {
  const ben = await kimlik();
  if (!ben) throw new KaynakHatasi("Giriş gerekli.");
  if (typeof tur !== "string" || !(tur in DOSYA_TURLERI)) throw new KaynakHatasi("Yalnız PDF, JPG ve PNG yüklenebilir.");
  if (typeof boyut !== "number" || boyut <= 0 || boyut > EN_BUYUK_DOSYA) throw new KaynakHatasi("Dosya en fazla 10 MB olabilir.");
  const yol = `${ben.id}/${crypto.randomBytes(16).toString("hex")}.${DOSYA_TURLERI[tur as DosyaTuru]}`;
  const { data, error } = await (await vt()).storage.from(DOSYA_KOVASI).createSignedUploadUrl(yol);
  denetle(error);
  return { yol, jeton: data!.token };
}

/** Yüklenen dosyayı içeriğinden denetler: boyut ve gerçek tür (uzantıyla uyuşmalı). Uymazsa siler ve hata verir. */
export async function dosyaDenetle(yol: string): Promise<{ tur: DosyaTuru; boyut: number }> {
  const istemci = await vt();
  const { data, error } = await istemci.storage.from(DOSYA_KOVASI).download(yol);
  if (error || !data) throw new KaynakHatasi("Yüklenen dosya bulunamadı.");
  const baytlar = new Uint8Array(await data.arrayBuffer());
  const tur = dosyaTuruBul(baytlar);
  const uzanti = yol.split(".").pop();
  if (!tur || DOSYA_TURLERI[tur] !== uzanti || baytlar.length > EN_BUYUK_DOSYA) {
    await istemci.storage.from(DOSYA_KOVASI).remove([yol]);
    throw new KaynakHatasi("Dosyanın içeriği PDF, JPG ya da PNG değil (ya da 10 MB'tan büyük); dosya silindi.");
  }
  return { tur, boyut: baytlar.length };
}

export async function kaynakEkle(k: KaynakIstegi, dosya?: { tur: DosyaTuru; boyut: number }): Promise<string> {
  const id = `k-${crypto.randomBytes(5).toString("hex")}`;
  const { error } = await (await vt()).rpc("kaynak_ekle", {
    p_id: id,
    p_baslik: k.baslik,
    p_tur: k.tur,
    p_nitelik: k.nitelik,
    p_kaynak_turu: k.kaynak_turu,
    p_url: k.url,
    p_dosya_yolu: k.dosya_yolu,
    p_dosya_turu: dosya?.tur ?? null,
    p_dosya_boyutu: dosya?.boyut ?? null,
    p_yazar: k.yazar,
    p_yayinci: k.yayinci,
    p_yil: k.yil,
    p_not: k.aciklama,
  });
  denetle(error);
  return id;
}

export async function kaynakDogrula(id: string, durum: string, herkeseAcik: boolean, gerekce: string): Promise<void> {
  denetle((await (await vt()).rpc("kaynak_dogrula", { p_id: id, p_durum: durum, p_herkese_acik: herkeseAcik, p_gerekce: gerekce })).error);
  kaynaklariYenile();
}

export async function bilgiKaynagiEkle(eser_id: string, alan: string, deger: string, kaynak_id: string, konum: string): Promise<void> {
  denetle((await (await vt()).rpc("bilgi_kaynagi_ekle", { p_eser: eser_id, p_alan: alan, p_deger: deger, p_kaynak: kaynak_id, p_konum: konum })).error);
}

/**
 * Kaynak dosyasının süreli (5 dk) bağlantısı. Panel kullanıcısı kendi oturumuyla her dosyayı görür;
 * ziyaretçi yalnız doğrulanmış ve herkese açık kaynağın dosyasını (Supabase kuralı da bunu zorlar).
 */
export async function dosyaBaglantisi(id: string): Promise<string | undefined> {
  const panel = (await kimlik())?.rol ? await hesapIstemcisi() : null;
  const istemci = panel ?? herkese(false);
  const { data: k } = await istemci.from("kaynak_kutuphanesi").select("dosya_yolu, durum, herkese_acik").eq("id", id).maybeSingle();
  if (!k?.dosya_yolu) return undefined;
  if (!panel && !(k.durum === "dogrulandi" && k.herkese_acik)) return undefined;
  const { data } = await istemci.storage.from(DOSYA_KOVASI).createSignedUrl(k.dosya_yolu as string, 300);
  return data?.signedUrl;
}
