// Mobil uygulamadan gelen eser talepleri (eser_talepleri, fotoğraflar "talep-foto" deposunda).
// Uygulama misafir ya da üye olarak doğrudan Supabase'e yazar; panel kendi oturumuyla okur ve karar verir
// (supabase/010_eser_talepleri.sql). Fotoğraflar süreli imzalı bağlantıyla gösterilir.
import "server-only";
import { talepSatiri, type TalepSatiri } from "../talep";
import { hesapIstemcisi } from "./kimlik";

export const TALEP_KOVASI = "talep-foto";

export class TalepHatasi extends Error {}

async function vt() {
  const istemci = await hesapIstemcisi();
  if (!istemci) throw new TalepHatasi("Giriş yapmalısın.");
  return istemci;
}

function denetle(error: { message: string; code?: string } | null): void {
  if (!error) return;
  if (error.code === "42501") throw new TalepHatasi("Bu işlem için yetkin yok.");
  throw new TalepHatasi(error.message);
}

/** Bekleyen talepler, eskiden yeniye (en çok 300). fotolu=false: imzalı bağlantı üretilmez (pano sayısı için). */
export async function talepler(fotolu = true): Promise<TalepSatiri[]> {
  const istemci = await vt();
  const { data, error } = await istemci.from("eser_talepleri").select("*").eq("durum", "bekliyor").limit(300);
  denetle(error);
  const satirlar = (data ?? []).map((x) => talepSatiri(x as Record<string, unknown>));
  satirlar.sort((a, b) => Date.parse(a.olusturuldu) - Date.parse(b.olusturuldu));
  const yollar = satirlar.flatMap((x) => x.foto_yollari);
  const baglantilar = new Map<string, string>();
  if (fotolu && yollar.length) {
    const { data: imzali } = await istemci.storage.from(TALEP_KOVASI).createSignedUrls(yollar, 600);
    for (const b of imzali ?? []) if (b.path && b.signedUrl) baglantilar.set(b.path, b.signedUrl);
  }
  return satirlar.map((x) => ({ ...x, fotolar: x.foto_yollari.map((y) => baglantilar.get(y)).filter((y): y is string => Boolean(y)) }));
}

/** Kabul (değerlendirildi; isteğe bağlı not) ya da ret (gerekçe zorunlu). İzin Supabase'de de denetlenir. */
export async function talepKarar(id: string, onay: boolean, gerekce: string): Promise<void> {
  if (!id) throw new TalepHatasi("Talep bulunamadı.");
  if (!onay && !gerekce.trim()) throw new TalepHatasi("Reddetmek için gerekçe yazmalısın.");
  denetle((await (await vt()).rpc("talep_karar", { p_id: id, p_onay: onay, p_gerekce: gerekce.trim() || null })).error);
}
