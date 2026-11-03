// Sunucu tarafında veri/ klasörünü okur. Şehirler veri/iller/*.json dosyalarından keşfedilir;
// yeni şehir eklemek için kod değiştirmek gerekmez.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { kaynagaCevir } from "./kaynak";
import { adSirala } from "./metin";
import { dogrulanmisKaynaklar } from "./sunucu/kaynak-depo";
import type { CevapCumlesi } from "./sunucu/sor";
import { yayindakiIlKayitlari } from "./sunucu/il-depo";
import { ilKatmanla } from "./sunucu/il-surum";
import { katmanla } from "./sunucu/surum";
import { yayindakiSurumler } from "./sunucu/surum-depo";
import type { Ayarlar, Eser, Il, IlliEser, KesifEseri, Kaynak, Rota, Sergi, Vakif } from "./tipler";

const VERI = path.join(process.cwd(), "veri");

function oku<T>(dosya: string): T {
  return JSON.parse(fs.readFileSync(path.join(VERI, dosya), "utf-8")) as T;
}

/** Taslak eserler geliştirme ortamında görünür, yayında gizlenir. */
const taslakGoster = process.env.NODE_ENV !== "production" || process.env.VAKFIYE_TASLAK === "1";

export function ayarlar(): Ayarlar {
  return oku<Ayarlar>("ayarlar.json");
}

export function iller(): { il: Il; eserler: Eser[] }[] {
  return fs
    .readdirSync(path.join(VERI, "iller"))
    .filter((d) => d.endsWith(".json"))
    .sort()
    .map((d) => oku<{ il: Il; eserler: Eser[] }>(path.join("iller", d)));
}

export function tumEserler(kaynak = iller()): IlliEser[] {
  return kaynak.flatMap(({ il, eserler }) =>
    eserler.filter((e) => taslakGoster || !e.taslak).map((e) => ({ ...e, il: il.id })),
  );
}

/** Keşfet sayfasının kartları: fotoğraflı eserler önce, sonra ada göre. */
export function kesifEserleri(eserler = tumEserler()): KesifEseri[] {
  return eserler
    .map((e) => ({
      id: e.id,
      il: e.il,
      ad: e.ad,
      tur: e.tur,
      ilce: e.ilce,
      banisi: e.banisi,
      konum: e.konum,
      yil: e.donem?.yapim_yili,
      gorsel: e.gorseller?.[0] && { dosya: e.gorseller[0].dosya, alt: e.gorseller[0].alt, odak: e.gorseller[0].odak },
      gorselSayisi: e.gorseller?.length ?? 0,
      kaynakliSayisi: e.olgular.filter((o) => o.durum === "kaynakli").length,
    }))
    .sort((a, b) => Number(!!b.gorsel) - Number(!!a.gorsel) || adSirala(a.ad.tr, b.ad.tr));
}

export function eserBul(id: string): IlliEser | undefined {
  return tumEserler().find((e) => e.id === id);
}

// Yayındaki hâl: JSON dosyaları + panelde onaylanmış iller ve eser sürümleri (Supabase). Ziyaretçi sayfaları bunları kullanır.

export async function yayindakiIller(): Promise<{ il: Il; eserler: Eser[] }[]> {
  const [ilKayitlari, surumler] = await Promise.all([yayindakiIlKayitlari(), yayindakiSurumler()]);
  return katmanla(ilKatmanla(iller(), ilKayitlari), surumler);
}

export async function yayindakiEserler(): Promise<IlliEser[]> {
  return tumEserler(await yayindakiIller());
}

export async function yayindakiEser(id: string): Promise<IlliEser | undefined> {
  return (await yayindakiEserler()).find((e) => e.id === id);
}

export async function yayindakiKesifEserleri(): Promise<KesifEseri[]> {
  return kesifEserleri(await yayindakiEserler());
}

/**
 * Varsayılan kaynağın (ör. envanter kitabı) sayfa sayfa metni: veri/kaynak-metinleri/<kaynak_id>.json
 * (araclar/kaynak_metni_al.py üretir). YZ kaynak analizi bunu okur; dosya yoksa undefined.
 */
export function kaynakMetni(kaynak_id: string): { sayfa: number; metin: string; pdf_sayfa?: number }[] | undefined {
  if (!/^[a-z0-9-]{1,80}$/.test(kaynak_id)) return undefined;
  try {
    return oku<{ sayfalar: { sayfa: number; metin: string; pdf_sayfa?: number }[] }>(path.join("kaynak-metinleri", `${kaynak_id}.json`)).sayfalar;
  } catch {
    return undefined;
  }
}

const pdfSayfaHaritalari = new Map<string, Map<number, number>>();

/** Kitap sayfasının PDF'teki sırası (kaynak metninden; envanter PDF'lerinde her PDF sayfası iki kitap sayfasıdır). */
export function pdfSayfasi(kaynak_id: string, sayfa: number): number | undefined {
  let harita = pdfSayfaHaritalari.get(kaynak_id);
  if (!harita) {
    harita = new Map((kaynakMetni(kaynak_id) ?? []).map((s) => [s.sayfa, s.pdf_sayfa ?? s.sayfa]));
    pdfSayfaHaritalari.set(kaynak_id, harita);
  }
  return harita.get(sayfa);
}

/** Kaynağın bağlantısı; PDF ise ve sayfa biliniyorsa "#page=N" ile o sayfada açılır. */
export function kaynakAdresi(k: Kaynak, sayfa?: string): string | undefined {
  if (!k.url) return undefined;
  const no = Number(sayfa?.match(/\d+/)?.[0]);
  const pdf = no && /\.pdf$/i.test(k.url) ? pdfSayfasi(k.id, no) : undefined;
  return pdf ? `${k.url}#page=${pdf}` : k.url;
}

/** "Bu esere sor" cevabındaki kaynaklı cümlelere kaynağın bağlantısını ekler (etiket kitabı o sayfada açar). */
export function cevabaAdresEkle<T extends { cumleler: CevapCumlesi[] }>(cevap: T): T {
  const tumu = kaynaklar();
  for (const c of cevap.cumleler) {
    const k = c.kaynak_id ? tumu.get(c.kaynak_id) : undefined;
    const adres = k && kaynakAdresi(k, c.sayfa);
    if (adres) c.adres = adres;
  }
  return cevap;
}

export function kaynaklar(): Map<string, Kaynak> {
  return new Map(oku<Kaynak[]>("kaynaklar.json").map((k) => [k.id, k]));
}

/** veri/kaynaklar.json + kaynak kütüphanesinin doğrulanmış kayıtları (aynı kimlikte JSON'daki kalır). */
export async function yayindakiKaynaklar(): Promise<Map<string, Kaynak>> {
  const tumu = kaynaklar();
  for (const k of await dogrulanmisKaynaklar()) if (!tumu.has(k.id)) tumu.set(k.id, kaynagaCevir(k));
  return tumu;
}

export function sergiler(): Map<string, Sergi> {
  return new Map(oku<Sergi[]>("sergiler.json").map((s) => [s.id, s]));
}

export function vakiflar(): Map<string, Vakif> {
  return new Map(oku<Vakif[]>("vakiflar.json").map((v) => [v.id, v]));
}

export function rotalar(): Rota[] {
  return fs.existsSync(path.join(VERI, "rotalar.json")) ? oku<Rota[]>("rotalar.json") : [];
}
