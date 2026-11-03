// Panelden eklenen illerin kuralları: onaylanmış il kayıtları Supabase'de (il_surumleri) durur ve veri/iller/*.json'un yanına konur.
// Veritabanı erişimi yok; okuma/yazma lib/sunucu/il-depo.ts'de. Tablo: supabase/012_il_surumleri.sql
import { ilAdiBul } from "../il-ilce";
import type { Il } from "../tipler";
import { semaHatalari } from "./dogrula";
import { KatkiHatasi, kimlikUret } from "./katki";
import type { IlDosyasi } from "./konum";

export type IlSurumDurumu = "incelemede" | "yayinda" | "reddedildi";

/** il_surumleri tablosundaki satır. */
export type IlSurumSatiri = {
  id: number;
  il_id: string;
  veri: Il;
  durum: IlSurumDurumu;
  islem: "ekle" | "duzenle" | "arsivle";
  /** Kaldırılan il (supabase/013_il_kaldir.sql; öncesinde sütun yok). */
  arsivlendi?: boolean;
  aciklama: string | null;
  ekleyen: string | null;
  ekleyen_ad: string | null;
  olusturuldu: string;
  inceleyen: string | null;
  inceleyen_ad: string | null;
  karar_tarihi: string | null;
  ret_gerekcesi: string | null;
};

export type YayindakiIl = Pick<IlSurumSatiri, "id" | "il_id" | "veri" | "karar_tarihi" | "arsivlendi">;

/** Her ilin en son onaylanan kaydı. */
export function sonYayindakiIller<T extends YayindakiIl>(satirlar: T[]): Map<string, T> {
  const son = new Map<string, T>();
  for (const s of satirlar) {
    const onceki = son.get(s.il_id);
    if (!onceki || (s.karar_tarihi ?? "") > (onceki.karar_tarihi ?? "") || ((s.karar_tarihi ?? "") === (onceki.karar_tarihi ?? "") && s.id > onceki.id)) {
      son.set(s.il_id, s);
    }
  }
  return son;
}

/**
 * JSON il dosyalarına panelde onaylanan illeri ekler. JSON'da olan ilin yalnız bilgileri (ad, merkez…) değişir, eserleri kalır;
 * yeni il eserleri olmadan eklenir (eserleri eser sürümleriyle gelir); kaldırılan (arşivlenen) il eklenmez.
 * Sıra: JSON illeri, sonra yeni iller ada göre.
 */
export function ilKatmanla(iller: IlDosyasi[], yayindakiler: Map<string, YayindakiIl>): IlDosyasi[] {
  if (!yayindakiler.size) return iller;
  const mevcut = new Set(iller.map((d) => d.il.id));
  const guncel = iller.map((d) => {
    const s = yayindakiler.get(d.il.id);
    return s && !s.arsivlendi ? { ...d, il: { ...s.veri, id: d.il.id } } : d;
  });
  const yeniler = [...yayindakiler.values()]
    .filter((s) => !mevcut.has(s.il_id) && !s.arsivlendi)
    .map((s) => ({ il: { ...s.veri, id: s.il_id }, eserler: [] }))
    .sort((a, b) => a.il.ad.tr.localeCompare(b.il.ad.tr, "tr"));
  return [...guncel, ...yeniler];
}

const metin = (x: unknown) => (typeof x === "string" ? x.trim() : "");
/** Formdan gelen sayı: boşsa undefined, sayı değilse NaN. */
const sayi = (x: unknown) => {
  if (typeof x === "number") return x;
  const m = metin(x).replace(",", ".");
  return m === "" ? undefined : Number(m);
};

export type HazirIl = { il_id: string; veri: Il; islem: "ekle" | "duzenle"; aciklama?: string };

/**
 * Paneldeki il formunu denetleyip il kaydına çevirir. Yeni ilin kimliği Türkçe addan üretilir (Kütahya → kutahya).
 * mevcut: yayındaki iller; kaynakIdleri: envanter kitabı seçildiyse tanımlı olmalı.
 */
export function ilHazirla(istek: unknown, mevcut: IlDosyasi[], kaynakIdleri: Set<string>): HazirIl {
  const g = (typeof istek === "object" && istek !== null ? istek : {}) as Record<string, unknown>;
  const yazilan = metin(g.ad_tr);
  // İl adı serbest değil: Türkiye'nin 81 ilinden biri olmalı (veri/il-ilce.json), resmî yazımıyla kaydedilir.
  const adTr = ilAdiBul(yazilan) ?? yazilan;
  const adEn = metin(g.ad_en);
  if (adTr.length < 2 || adTr.length > 60) throw new KatkiHatasi("İl adı 2-60 harf olmalı.");
  if (!ilAdiBul(adTr)) throw new KatkiHatasi(`'${adTr}' Türkiye'nin 81 ilinden biri değil; listeden seçin.`);
  if (adEn.length > 60) throw new KatkiHatasi("İngilizce ad en çok 60 harf olabilir.");

  const duzenle = metin(g.il_id) !== "";
  const il_id = duzenle ? metin(g.il_id) : kimlikUret(adTr);
  const var_ = mevcut.some((d) => d.il.id === il_id);
  if (duzenle && !var_) throw new KatkiHatasi("Düzenlenecek il bulunamadı.");
  if (!duzenle && var_) throw new KatkiHatasi(`'${adTr}' zaten sitede var.`);

  const enlem = sayi(g.enlem);
  const boylam = sayi(g.boylam);
  if (enlem === undefined || boylam === undefined || !Number.isFinite(enlem) || !Number.isFinite(boylam)) {
    throw new KatkiHatasi("Harita merkezi için enlem ve boylam gerekli (ör. 39.42, 29.98).");
  }
  if (enlem < 35 || enlem > 43 || boylam < 25 || boylam > 45) throw new KatkiHatasi("Merkez Türkiye sınırları içinde olmalı.");

  const veri: Il = {
    id: il_id,
    ad: adEn ? { tr: adTr, en: adEn } : { tr: adTr },
    merkez: { enlem: Math.round(enlem * 1e5) / 1e5, boylam: Math.round(boylam * 1e5) / 1e5, dogrulandi: true, yontem: "elle" },
  };
  const yakinlastirma = sayi(g.yakinlastirma);
  if (yakinlastirma !== undefined) veri.yakinlastirma = yakinlastirma;
  const kitap = metin(g.envanter_kaynak_id);
  if (kitap) {
    if (!kaynakIdleri.has(kitap)) throw new KatkiHatasi(`Kaynak '${kitap}' tanımsız.`);
    veri.envanter_kaynak_id = kitap;
  }
  const yil = sayi(g.envanter_yili);
  if (yil !== undefined) veri.envanter_yili = yil;
  const toplam = sayi(g.toplam_eser);
  if (toplam !== undefined) veri.toplam_eser = toplam;

  const hatalar = semaHatalari("il", { il: veri, eserler: [] });
  if (hatalar.length) throw new KatkiHatasi("İl bilgisi veri şemasına uymuyor.", hatalar);
  const aciklama = metin(g.not).slice(0, 500);
  return { il_id, veri, islem: duzenle ? "duzenle" : "ekle", ...(aciklama ? { aciklama } : {}) };
}
