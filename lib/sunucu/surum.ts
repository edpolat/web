// Eser sürümlerinin kuralları: onaylanmış düzenlemeler Supabase'de (eser_surumleri) durur ve JSON dosyalarının üstüne konur.
// Veritabanı erişimi yok; okuma/yazma lib/sunucu/surum-depo.ts'de. Tablo: supabase/002_surumler.sql
import type { Eser } from "../tipler";
import { ilDosyasiHatalari } from "./dogrula";
import { KatkiHatasi, denetleVeUygula, esit, katkiOlustur, type Depo } from "./katki";
import type { IlDosyasi } from "./konum";

export type SurumDurumu = "taslak" | "incelemede" | "yayinda" | "reddedildi";
export type SurumIslemi = "ekle" | "duzenle" | "geri_al" | "arsivle" | "arsivden_cikar";

/** eser_surumleri tablosundaki satır. */
export type SurumSatiri = {
  id: number;
  eser_id: string;
  il: string;
  veri: Eser;
  durum: SurumDurumu;
  islem: SurumIslemi;
  arsivlendi: boolean;
  temel_surum: number | null;
  kaynak_id: string | null;
  sayfa: string | null;
  aciklama: string | null;
  ekleyen: string | null;
  ekleyen_ad: string | null;
  olusturuldu: string;
  inceleyen: string | null;
  inceleyen_ad: string | null;
  karar_tarihi: string | null;
  ret_gerekcesi: string | null;
};

export type YayindakiSurum = Pick<SurumSatiri, "id" | "eser_id" | "il" | "veri" | "arsivlendi" | "karar_tarihi">;

/** Her eserin en son yayına alınan sürümü. */
export function sonYayindakiler<T extends YayindakiSurum>(satirlar: T[]): Map<string, T> {
  const son = new Map<string, T>();
  for (const s of satirlar) {
    const onceki = son.get(s.eser_id);
    if (!onceki || (s.karar_tarihi ?? "") > (onceki.karar_tarihi ?? "") || ((s.karar_tarihi ?? "") === (onceki.karar_tarihi ?? "") && s.id > onceki.id)) {
      son.set(s.eser_id, s);
    }
  }
  return son;
}

/** JSON şehir dosyalarının üstüne yayındaki sürümleri koyar: düzenlenen eser değişir, yeni eser eklenir, arşivlenen çıkar. */
export function katmanla(iller: IlDosyasi[], yayindakiler: Map<string, YayindakiSurum>): IlDosyasi[] {
  if (!yayindakiler.size) return iller;
  const gorulen = new Set<string>();
  return iller.map((dosya) => {
    const eserler: Eser[] = [];
    for (const e of dosya.eserler) {
      gorulen.add(e.id);
      const s = yayindakiler.get(e.id);
      if (!s) eserler.push(e);
      else if (!s.arsivlendi) eserler.push({ ...s.veri, id: e.id });
    }
    for (const s of yayindakiler.values()) {
      if (s.il === dosya.il.id && !gorulen.has(s.eser_id) && !s.arsivlendi) eserler.push({ ...s.veri, id: s.eser_id });
    }
    return { ...dosya, eserler };
  });
}

export type AlanFarki = { alan: string; eski: unknown; yeni: unknown };

/** İki eser hâli arasında değişen üst düzey alanlar (id hariç). eski yoksa yeni eserdir. */
export function alanFarklari(eski: Eser | undefined, yeni: Eser): AlanFarki[] {
  const a = (eski ?? {}) as Record<string, unknown>;
  const b = yeni as Record<string, unknown>;
  const alanlar = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((x) => x !== "id");
  return alanlar.filter((x) => !esit(a[x], b[x])).map((alan) => ({ alan, eski: a[alan] ?? null, yeni: b[alan] ?? null }));
}

export type HazirSurum = {
  eser_id: string;
  il: string;
  veri: Eser;
  islem: "ekle" | "duzenle";
  kaynak_id: string;
  sayfa?: string;
  aciklama?: string;
};

/**
 * Paneldeki eser formundan gelen isteği tam eser hâline çevirir ve şemaya göre doğrular.
 * Kurallar onay kuyruğuyla aynı (katkiOlustur): kaynak zorunlu, yalnız düzenlenebilir alanlar değişir.
 * depo, yayındaki hâl olmalı (JSON + onaylı sürümler).
 */
export function surumHazirla(istek: unknown, depo: Depo, ekleyen: string): HazirSurum {
  const govde = (typeof istek === "object" && istek !== null ? istek : {}) as Record<string, unknown>;
  if (govde.tur !== "eser_ekle" && govde.tur !== "eser_duzenle") throw new KatkiHatasi("Bilinmeyen işlem.");
  const katki = katkiOlustur({ ...govde, ekleyen, nereden: "web" }, depo, { yonetici: true, simdi: new Date(), ek: "surum" });
  const dosya = denetleVeUygula(structuredClone(depo.iller.find((d) => d.il.id === katki.il)!), katki, depo.tanimlar);
  const veri = dosya.eserler.find((e) => e.id === katki.eser_id)!;
  return {
    eser_id: katki.eser_id,
    il: katki.il,
    veri,
    islem: katki.tur === "eser_ekle" ? "ekle" : "duzenle",
    kaynak_id: katki.kaynak_id,
    ...(katki.sayfa ? { sayfa: katki.sayfa } : {}),
    ...(katki.not ? { aciklama: katki.not } : {}),
  };
}

/** Sürüm yayına alınsa şehir dosyası geçerli kalır mı? Kalmazsa KatkiHatasi. Yeni eser zaten yayındaysa da hata. */
export function yayinaUygunMu(s: Pick<SurumSatiri, "eser_id" | "il" | "veri" | "islem">, depo: Depo): void {
  const dosya = depo.iller.find((d) => d.il.id === s.il);
  if (!dosya) throw new KatkiHatasi("Şehir bulunamadı.");
  const kopya = structuredClone(dosya);
  const yer = kopya.eserler.findIndex((e) => e.id === s.eser_id);
  if (s.islem === "ekle" && yer >= 0) throw new KatkiHatasi(`'${s.eser_id}' kimlikli eser zaten yayında.`);
  const veri = { ...s.veri, id: s.eser_id };
  if (yer >= 0) kopya.eserler[yer] = veri;
  else kopya.eserler.push(veri);
  const eserIdleri = new Set([...depo.tanimlar.eserIdleri, ...kopya.eserler.map((e) => e.id)]);
  const hatalar = ilDosyasiHatalari(kopya, { ...depo.tanimlar, eserIdleri });
  if (hatalar.length) throw new KatkiHatasi("Sürüm veri şemasına uymuyor.", hatalar);
}
