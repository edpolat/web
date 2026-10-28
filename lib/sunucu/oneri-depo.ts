// Bilgi önerilerinin Supabase katmanı (bilgi_onerileri). Gönderen ve karar veren kendi oturumuyla çalışır;
// izinler Supabase fonksiyonlarında da denetlenir.
import "server-only";
import crypto from "node:crypto";
import { dilFarklari, dilUyarisiGerekli } from "../dil-uyumu";
import { DOSYA_KOVASI, type KaynakTuru, type Nitelik } from "../kaynak";
import { GUNLUK_ONERI, OneriHatasi, oneriyiUygula, type OneriIstegi, type OneriSatiri } from "../oneri";
import { hesapIstemcisi, kimlik } from "./kimlik";
import { kaynaklariYenile } from "./kaynak-depo";
import { yayindakiDepo, yayindakiHal } from "./panel";
import { alanFarklari, yayinaUygunMu } from "./surum";
import { yayiniYenile } from "./surum-depo";

async function vt() {
  const istemci = await hesapIstemcisi();
  if (!istemci) throw new OneriHatasi("Öneri göndermek için giriş yapmalısın.");
  return istemci;
}

function denetle(error: { message: string; code?: string; hint?: string } | null): void {
  if (!error) return;
  if (error.code === "42501") throw new OneriHatasi("Bu işlem için yetkin yok.");
  if (error.hint === "gunluk_sinir") throw new OneriHatasi(`Bugünkü öneri hakkın doldu (günde ${GUNLUK_ONERI}). Yarın tekrar deneyebilirsin.`);
  throw new OneriHatasi(error.message);
}

export async function oneriGonder(o: OneriIstegi, dosya?: { tur: string; boyut: number }): Promise<number> {
  const { data, error } = await (await vt()).rpc("oneri_gonder", {
    p_eser: o.eser_id,
    p_alan: o.alan,
    p_onerilen: o.onerilen,
    p_kaynak: o.kaynak_id,
    p_konum: o.konum,
    p_url: o.url,
    p_dosya_yolu: o.dosya_yolu,
    p_dosya_turu: dosya?.tur ?? null,
    p_dosya_boyutu: dosya?.boyut ?? null,
    p_hak_onayi: o.hak_onayi,
    p_kaynak_turu: o.kaynak_turu,
    // Dil ve uyum işareti yalnız varsayılandan farklıysa gider (009 çalıştırılmadan da Türkçe öneri gönderilebilsin).
    ...(o.dil !== "tr" || o.dil_uyumu ? { p_dil: o.dil, p_dil_uyumu: o.dil_uyumu } : {}),
  });
  if (error && (o.dil !== "tr" || o.dil_uyumu) && /p_dil|function/i.test(error.message)) {
    throw new OneriHatasi("İngilizce öneri ya da uyum işareti henüz kaydedilemiyor (Supabase'de supabase/009_dil_uyumu.sql çalıştırılmalı).");
  }
  denetle(error);
  return data as number;
}

/** Öneriler: panel kullanıcısı hepsini, öneren yalnız kendisininkileri görür (Supabase kuralı). */
export async function oneriler(suzgec: { durum?: OneriSatiri["durum"]; eser_id?: string; benim?: boolean } = {}): Promise<OneriSatiri[]> {
  let sorgu = (await vt()).from("bilgi_onerileri").select("*").order("olusturuldu", { ascending: true }).limit(500);
  if (suzgec.durum) sorgu = sorgu.eq("durum", suzgec.durum);
  if (suzgec.eser_id) sorgu = sorgu.eq("eser_id", suzgec.eser_id);
  if (suzgec.benim) {
    const ben = await kimlik();
    if (!ben) return [];
    sorgu = sorgu.eq("kullanici", ben.id);
  }
  const { data, error } = await sorgu;
  denetle(error);
  return (data ?? []) as OneriSatiri[];
}

async function oneriOku(id: number): Promise<OneriSatiri> {
  const { data, error } = await (await vt()).from("bilgi_onerileri").select("*").eq("id", id).maybeSingle();
  denetle(error);
  if (!data) throw new OneriHatasi("Öneri bulunamadı.");
  return data as OneriSatiri;
}

export async function oneriReddet(id: number, gerekce: string): Promise<void> {
  denetle((await (await vt()).rpc("oneri_reddet", { p_id: id, p_gerekce: gerekce })).error);
}

export type KabulIstegi = {
  id: number;
  alan: string;
  deger: string;
  kategori?: string;
  konum?: string;
  /** Çok dilli alanlarda yayına girecek İngilizce metin (boşsa İngilizce olduğu gibi kalır). */
  en?: string;
  /** Onaylayan tek dil uyarısında "Yine de onayla" dedi. */
  dil_onayi?: boolean;
  /** Önerinin kendi bağlantısı/dosyası kütüphaneye doğrulanmış olarak girsin mi. */
  kutuphane?: { baslik: string; kaynak_turu: KaynakTuru; nitelik: Nitelik; herkese_acik: boolean };
};

/**
 * Kabul (tarihçi): yeni hâl burada hazırlanır ve veri şemasına göre denetlenir; sürümü editör onayına gönderme,
 * kaynak ekleme ve öneriyi kapatma Supabase'de tek işlemde yapılır (oneri_kabul, 015'ten beri yayına doğrudan girmez).
 */
export async function oneriKabul(k: KabulIstegi): Promise<number> {
  const o = await oneriOku(k.id);
  if (o.durum !== "bekliyor") throw new OneriHatasi("Bu öneri zaten karara bağlandı.");
  const simdi = await yayindakiHal(o.eser_id);
  if (!simdi.eser || !simdi.il) throw new OneriHatasi("Eser bulunamadı.");
  const yeniKaynak = k.kutuphane ? `k-${crypto.randomBytes(5).toString("hex")}` : undefined;
  const kaynak_id = yeniKaynak ?? o.kaynak_id;
  const konum = k.konum?.trim() || o.konum;
  const veri = oneriyiUygula(simdi.eser, k.alan, k.deger, { kategori: k.kategori, kaynak_id, konum, en: k.en });
  if (dilUyarisiGerekli(dilFarklari(simdi.eser, veri), o.dil_uyumu === true) && !k.dil_onayi) {
    throw new OneriHatasi("Bu değişiklik yalnız bir dilde. Onaylamak için uyarıda \"Yine de onayla\" demelisin ya da diğer dili de doldurmalısın.");
  }
  const depo = await yayindakiDepo();
  if (yeniKaynak) depo.tanimlar.kaynakIdleri.add(yeniKaynak);
  yayinaUygunMu({ eser_id: o.eser_id, il: simdi.il, veri, islem: "duzenle" }, depo);
  const { data, error } = await (await vt()).rpc("oneri_kabul", {
    p_id: o.id,
    p_il: simdi.il,
    p_veri: veri,
    p_temel: simdi.surum,
    p_degisiklikler: alanFarklari(simdi.eser, veri),
    p_alan: k.alan,
    p_deger: k.deger.trim(),
    p_kaynak: kaynak_id,
    p_konum: konum,
    p_kutuphane: k.kutuphane ? { id: yeniKaynak, ...k.kutuphane } : null,
  });
  denetle(error);
  yayiniYenile();
  if (yeniKaynak) kaynaklariYenile();
  return data as number;
}

/** Önerideki dosyanın süreli (5 dk) bağlantısı; yalnız panel kullanıcısı ve öneren (Supabase kuralı). */
export async function oneriDosyaBaglantisi(id: number): Promise<string | undefined> {
  const istemci = await hesapIstemcisi();
  if (!istemci) return undefined;
  const { data: o } = await istemci.from("bilgi_onerileri").select("dosya_yolu").eq("id", id).maybeSingle();
  if (!o?.dosya_yolu) return undefined;
  const { data } = await istemci.storage.from(DOSYA_KOVASI).createSignedUrl(o.dosya_yolu as string, 300);
  return data?.signedUrl;
}
