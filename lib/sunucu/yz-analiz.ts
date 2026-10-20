// YZ analizlerinin akışı: hedefi (bilgi önerisi ya da eser sürümü) hazırlar, kaynağın metnini çıkarır/önbellekten okur,
// LLM'e sorar ve sonucu yz_analizleri'ne yazar. Hiçbir kayıt değiştirilmez; sonuç yalnız editöre gösterilir.
// Arka plan: Vercel'de kalıcı kuyruk yok. Kaydın hemen ardından Next.js after() ile (yanıt döndükten sonra) çalışır;
// yarıda kalan ya da hiç başlamamış analiz, editör Onay bekleyenler sayfasını açınca yeniden tetiklenir.
import "server-only";
import crypto from "node:crypto";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DOSYA_KOVASI, type KutuphaneKaynagi } from "../kaynak";
import { mevcutDeger, type OneriSatiri } from "../oneri";
import { s } from "../sozluk";
import type { Eser, Kaynak, Olgu } from "../tipler";
import { kaynaklar, yayindakiEser, yayindakiKaynaklar } from "../veri";
import { maskele, type KaynakAnalizi } from "../yz";
import { KAYNAK_TURLERI } from "../kaynak";
import { elemeAnalizEt } from "./yz-eleme";
import { goster } from "./goster";
import { baglantiMetni, dosyaMetni, type CikanMetin } from "./kaynak-metni";
import { yayindakiHal } from "./panel";
import { alanFarklari, type SurumSatiri } from "./surum";
import { analizBaslat, analizBitir, cagriHakki, kaynakMetniKaydet, kaynakMetniOku, sonAnalizler, type AnalizTuru, type HedefTuru } from "./yz-depo";
import { kaynakAnalizEt } from "./yz-kaynak";
import { yzAcik } from "./yz-servis";

/** Analiz biçimi değişince eski sonuçlar "farklı içerik" sayılsın diye özete katılır. */
const SURUM = "6a-1";

type KaynakTanimi = {
  /** kaynak_metinleri anahtarı. */
  anahtar: string;
  getir: () => Promise<CikanMetin>;
  /** "Kaynakta bu sayfayı aç" adresi. */
  adres: string | null;
  /** Halktan gelen belge mi (kişisel veriler maskelenir). */
  halktan: boolean;
};

type Hedef = { eser_id: string; iddia: string; kaynak: KaynakTanimi | null; adlar: (string | null)[] };

const t = s("tr");

function indir(vt: SupabaseClient, yol: string): () => Promise<CikanMetin> {
  return async () => {
    const { data, error } = await vt.storage.from(DOSYA_KOVASI).download(yol);
    if (error || !data) return { durum: "okunamadi", neden: "Dosya indirilemedi." };
    return dosyaMetni(new Uint8Array(await data.arrayBuffer()));
  };
}

/** Kütüphane kaydı ya da veri dosyasındaki kaynak. Dosyası/bağlantısı olmayan kayıt (ör. basılı kitap künyesi) okunamaz. */
async function kaynakTanimi(vt: SupabaseClient, kaynak_id: string): Promise<KaynakTanimi | null> {
  const { data } = await vt.from("kaynak_kutuphanesi").select("*").eq("id", kaynak_id).maybeSingle();
  const k = data as KutuphaneKaynagi | null;
  if (k?.dosya_yolu) return { anahtar: `kutuphane:${k.id}`, getir: indir(vt, k.dosya_yolu), adres: `/api/kaynak/dosya/${k.id}`, halktan: false };
  const url = k?.url ?? kaynaklar().get(kaynak_id)?.url ?? (await yayindakiKaynaklar()).get(kaynak_id)?.url;
  if (url && /^https?:\/\//.test(url)) return { anahtar: `url:${crypto.createHash("sha256").update(url).digest("hex")}`, getir: () => baglantiMetni(url), adres: url, halktan: false };
  return null;
}

async function oneriHedefi(vt: SupabaseClient, id: number): Promise<Hedef | null> {
  const { data } = await vt.from("bilgi_onerileri").select("*").eq("id", id).maybeSingle();
  const o = data as OneriSatiri | null;
  if (!o || o.durum !== "bekliyor") return null;
  const eser = await yayindakiEser(o.eser_id);
  let kaynak: KaynakTanimi | null = null;
  if (o.dosya_yolu) kaynak = { anahtar: `oneri:${o.id}`, getir: indir(vt, o.dosya_yolu), adres: `/api/oneri/dosya/${o.id}`, halktan: true };
  else if (o.url) {
    const url = o.url;
    kaynak = { anahtar: `oneri:${o.id}`, getir: () => baglantiMetni(url), adres: url, halktan: true };
  } else if (o.kaynak_id) kaynak = await kaynakTanimi(vt, o.kaynak_id);
  const adlar = [o.kullanici_ad];
  // Önerinin metni halktan gelir: kişisel veriler maskelenir. Adres önerisinde adres bilginin kendisidir, maskelenmez.
  const m = (x: string) => maskele(x, { adlar, adres: o.alan !== "adres" });
  const iddia = [
    `Eser: ${eser?.ad.tr ?? o.eser_id}`,
    `Alan: ${t.oneri.alanlar[o.alan] ?? o.alan}`,
    mevcutDeger(eser, o.alan) ? `Sitedeki mevcut değer: ${mevcutDeger(eser, o.alan)}` : "",
    o.konum ? `Önerenin belirttiği yer: ${m(o.konum)}` : "",
    `Önerilen değer: ${m(o.onerilen)}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { eser_id: o.eser_id, iddia, kaynak, adlar };
}

function farkYazisi(alan: string, eski: unknown, yeni: unknown, kaynakMap: Map<string, Kaynak>): string {
  if (alan === "olgular") {
    const onceki = new Set(((eski as Olgu[] | null) ?? []).map((o) => o.metin.tr));
    return ((yeni as Olgu[] | null) ?? [])
      .filter((o) => !onceki.has(o.metin.tr))
      .map((o) => o.metin.tr)
      .join(" | ");
  }
  return goster(alan, yeni, "tr", t, kaynakMap);
}

async function surumHedefi(vt: SupabaseClient, id: number): Promise<Hedef | null> {
  const { data } = await vt.from("eser_surumleri").select("*").eq("id", id).maybeSingle();
  const r = data as SurumSatiri | null;
  if (!r || r.durum !== "incelemede" || !r.kaynak_id) return null;
  const onceki: Eser | undefined = r.islem === "ekle" ? undefined : (await yayindakiHal(r.eser_id)).eser;
  const kaynakMap = await yayindakiKaynaklar();
  const farklar = alanFarklari(onceki, r.veri)
    .filter((f) => !["gorseller", "konum", "kaynaklar", "guncellendi"].includes(f.alan))
    .slice(0, 6)
    .map((f) => `- ${t.alanlar[f.alan] ?? f.alan}: ${farkYazisi(f.alan, f.eski, f.yeni, kaynakMap).slice(0, 800)}`)
    .filter((x) => !x.endsWith(": "));
  if (!farklar.length) return null;
  const iddia = [`Eser: ${r.veri.ad.tr}`, r.sayfa ? `Gönderenin belirttiği sayfa: ${r.sayfa}` : "", "Önerilen değişiklikler:", ...farklar].filter(Boolean).join("\n");
  return { eser_id: r.eser_id, iddia: maskele(iddia), kaynak: await kaynakTanimi(vt, r.kaynak_id), adlar: [] };
}

async function hedefHazirla(vt: SupabaseClient, tur: HedefTuru, id: number): Promise<Hedef | null> {
  return tur === "oneri" ? oneriHedefi(vt, id) : surumHedefi(vt, id);
}

export function kaynakOzeti(h: Hedef): string {
  return crypto.createHash("sha256").update(JSON.stringify([SURUM, h.iddia, h.kaynak?.anahtar ?? null])).digest("hex");
}

async function metinGetir(vt: SupabaseClient, k: KaynakTanimi): Promise<CikanMetin> {
  const onceki = await kaynakMetniOku(vt, k.anahtar).catch(() => undefined);
  if (onceki) return onceki;
  const yeni = await k.getir();
  await kaynakMetniKaydet(vt, k.anahtar, yeni);
  return yeni;
}

/**
 * Bir hedefin kaynak analizini yapar ve kaydeder. `zorla` (Yeniden analiz et) yoksa aynı içerik için daha önce
 * sonuç alındıysa tekrar çağrı yapılmaz. Kaynağı olmayan hedefte analiz yapılmaz. Hiçbir durumda hata fırlatmaz.
 */
export async function kaynakAnalizi(vt: SupabaseClient, tur: HedefTuru, id: number, zorla = false): Promise<void> {
  if (!yzAcik()) return;
  let analizId: number | null = null;
  try {
    const h = await hedefHazirla(vt, tur, id);
    if (!h) return;
    const ozet = kaynakOzeti(h);
    if (!zorla) {
      const son = (await sonAnalizler(vt, "kaynak", tur, [id])).get(id);
      if (son && son.ozet === ozet && son.durum !== "bekliyor") return;
    }
    analizId = await analizBaslat(vt, { tur: "kaynak", hedef_tur: tur, hedef_id: id, eser_id: h.eser_id, ozet });
    if (analizId === null) return;
    if (!h.kaynak) {
      const sonuc: KaynakAnalizi = { metin: "kaynak_yok", aciklama: "Kaynağın dosyası ya da bağlantısı yok; metin okunamadı, manuel inceleme gerekli." };
      return analizBitir(vt, analizId, { durum: "tamam", sonuc });
    }
    const metin = await metinGetir(vt, h.kaynak);
    if (metin.durum === "okunamadi") {
      const sonuc: KaynakAnalizi = { metin: "okunamadi", aciklama: `Metin okunamadı, manuel inceleme gerekli. ${metin.neden}` };
      return analizBitir(vt, analizId, { durum: "tamam", sonuc });
    }
    // Halktan gelen belgede kişisel veriler maskelenir; tarihî belgede yalnız TC, telefon, e-posta, IBAN.
    const sayfalar = metin.sayfalar.map((x) => ({ sayfa: x.sayfa, metin: maskele(x.metin, { adlar: h.kaynak!.halktan ? h.adlar : [] }) }));
    const r = await kaynakAnalizEt({ iddia: h.iddia, sayfalar, sayfali: metin.sayfali, kaynak_adresi: h.kaynak.adres }, cagriHakki(vt));
    if (!r.tamam) return analizBitir(vt, analizId, { durum: "hata", hata: r.neden, model: r.model });
    await analizBitir(vt, analizId, { durum: "tamam", sonuc: r.sonuc, model: r.model });
  } catch (hata) {
    console.warn(`yz: kaynak analizi başarısız (${tur} #${id}): ${String(hata)}`);
    if (analizId !== null) await analizBitir(vt, analizId, { durum: "hata", hata: "Analiz sırasında beklenmeyen hata." }).catch(() => {});
  }
}

// --- 6B: öneri ön eleme ---

const ELEME_SURUMU = "6b-1";

function eserOzeti(eser: Eser | undefined): string {
  if (!eser) return "Eser bulunamadı.";
  const satirlar = [
    `Ad: ${eser.ad.tr}`,
    `Tür: ${eser.tur}`,
    eser.banisi ? `Banisi: ${eser.banisi}` : "",
    eser.mimar ? `Mimarı: ${eser.mimar}` : "",
    eser.donem?.yapim_yili ? `Yapım yılı: ${eser.donem.yaklasik ? "yaklaşık " : ""}${eser.donem.yapim_yili}` : "",
    eser.adres?.tr ? `Adres: ${eser.adres.tr}` : "",
    ...eser.olgular.slice(0, 20).map((o) => `Bilgi (${o.durum}): ${o.metin.tr.slice(0, 300)}`),
  ];
  return satirlar.filter(Boolean).join("\n");
}

/** Önerinin ön elemesini yapar ve kaydeder (kaynak analizi varsa onun sonucu da verilir). Hiçbir durumda hata fırlatmaz. */
export async function elemeAnalizi(vt: SupabaseClient, id: number, zorla = false): Promise<void> {
  if (!yzAcik()) return;
  let analizId: number | null = null;
  try {
    const { data } = await vt.from("bilgi_onerileri").select("*").eq("id", id).maybeSingle();
    const o = data as OneriSatiri | null;
    if (!o || o.durum !== "bekliyor") return;
    const eser = await yayindakiEser(o.eser_id);
    const m = (x: string) => maskele(x, { adlar: [o.kullanici_ad], adres: o.alan !== "adres" });
    const oneri = [`Alan: ${t.oneri.alanlar[o.alan] ?? o.alan}`, o.konum ? `Önerenin belirttiği yer: ${m(o.konum)}` : "", `Önerilen değer: ${m(o.onerilen)}`]
      .filter(Boolean)
      .join("\n");
    let kaynak: string | null = null;
    if (!o.kaynaksiz) {
      const satirlar: string[] = [];
      if (o.kaynak_id) {
        const { data: k } = await vt.from("kaynak_kutuphanesi").select("baslik, kaynak_turu, url, durum").eq("id", o.kaynak_id).maybeSingle();
        satirlar.push(`Kütüphanedeki doğrulanmış kaynak: ${k?.baslik ?? o.kaynak_id}${k?.kaynak_turu ? ` (${k.kaynak_turu})` : ""}`);
      }
      if (o.url) satirlar.push(`Bağlantı: ${o.url}`);
      if (o.dosya_yolu) satirlar.push(`Yüklenen dosya (${o.dosya_turu ?? "?"})`);
      if (o.kaynak_turu && KAYNAK_TURLERI.includes(o.kaynak_turu)) satirlar.push(`Önerenin söylediği kaynak türü: ${o.kaynak_turu}`);
      const ka = (await sonAnalizler(vt, "kaynak", "oneri", [id])).get(id);
      const ks = ka?.durum === "tamam" ? (ka.sonuc as KaynakAnalizi) : null;
      if (ks?.metin === "tamam") satirlar.push(`Kaynak analizi: ${ks.sonuc}${ks.pasaj_dogrulandi ? "" : " (alıntı doğrulanamadı)"}. ${ks.aciklama}`);
      else if (ks) satirlar.push("Kaynak analizi: kaynağın metni okunamadı.");
      kaynak = satirlar.join("\n");
    }
    const girdi = { oneri, eser: eserOzeti(eser), kaynak };
    const ozet = crypto.createHash("sha256").update(JSON.stringify([ELEME_SURUMU, oneri, girdi.eser, o.kaynak_id, o.url, o.dosya_yolu])).digest("hex");
    if (!zorla) {
      const son = (await sonAnalizler(vt, "eleme", "oneri", [id])).get(id);
      if (son && son.ozet === ozet && son.durum !== "bekliyor") return;
    }
    analizId = await analizBaslat(vt, { tur: "eleme", hedef_tur: "oneri", hedef_id: id, eser_id: o.eser_id, ozet });
    if (analizId === null) return;
    const r = await elemeAnalizEt(girdi, cagriHakki(vt));
    if (!r.tamam) return analizBitir(vt, analizId, { durum: "hata", hata: r.neden, model: r.model });
    await analizBitir(vt, analizId, { durum: "tamam", sonuc: r.sonuc, model: r.model });
  } catch (hata) {
    console.warn(`yz: ön eleme başarısız (öneri #${id}): ${String(hata)}`);
    if (analizId !== null) await analizBitir(vt, analizId, { durum: "hata", hata: "Analiz sırasında beklenmeyen hata." }).catch(() => {});
  }
}

export type ArkaPlanIsi = { analiz: AnalizTuru; tur: HedefTuru; id: number };

/** Yeni öneri için yapılacak analizler: önce kaynak analizi (kaynağı varsa), sonra ön eleme (onun sonucunu da kullanır). */
export function oneriIsleri(id: number, kaynakli: boolean): ArkaPlanIsi[] {
  return [...(kaynakli ? [{ analiz: "kaynak" as const, tur: "oneri" as const, id }] : []), { analiz: "eleme", tur: "oneri", id }];
}

/** Yanıt kullanıcıya döndükten sonra analizleri sırayla çalıştırır (Next.js after). İstemci önceden alınmış olmalı. */
export function arkaPlanda(vt: SupabaseClient | null, isler: ArkaPlanIsi[]): void {
  if (!vt || !isler.length || !yzAcik()) return;
  try {
    after(async () => {
      for (const is of isler) await (is.analiz === "eleme" ? elemeAnalizi(vt, is.id) : kaynakAnalizi(vt, is.tur, is.id));
    });
  } catch (hata) {
    console.warn(`yz: arka plan işi başlatılamadı: ${String(hata)}`);
  }
}
