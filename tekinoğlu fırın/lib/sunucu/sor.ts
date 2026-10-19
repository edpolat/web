// "Bu esere sor": soruyu yalnız o eserin yayındaki kaynaklı olgularıyla eşleştirir.
// Cevap, olgunun kendi metnidir; bu yüzden her cümle kaynak kimliği ve sayfasıyla gelir ve hiçbir şey uydurulmaz.
// Eşleşme yoksa "Kaynaklarımızda bu bilgi yok" döner. Yapay zekâ katmanı (sor-yz.ts) aynı cevap biçimini kullanır:
// bu dosyadaki kayitlar() ona numaralı bağlamı verir, yzCevabi() modelin çıktısını kaynaklı cümlelere çevirir
// (kayda dayanmayan cümle "ai_yorumu" olur). Saf fonksiyonlar; dosya ve ağ işi yapmaz.
import { sadelestir } from "../filtre";
import { metin } from "../metin";
import type { CokDilli, Dil, Eser, Olgu } from "../tipler";

export type CevapCumlesi = { metin: string; durum: string; kaynak_id?: string; sayfa?: string };
export type Cevap = { bulundu: boolean; cumleler: CevapCumlesi[]; yontem: "eslesme" | "yapay_zeka" };

const YAYINDA = new Set(["kaynakli", "ai_yorumu", "belirsiz"]);

// Anlamı soruyu taşımayan sözcükler.
const DOLGU = new Set(
  (
    "ne neden nasil nicin niye kim kimin kac hangi mi mu midir mudur bu su o bir ve ile da de icin olan oldu " +
    "nedir var yok mi bana anlat soyle what why how who whom whose which when where is was were are the a an " +
    "of to in on for did does do this that it its about tell me"
  ).split(" "),
);
// Her yerde geçen, tek başına eşleşme saymayan sözcükler.
const GENEL = new Set(["cami", "camii", "mosqu", "yapi", "yapin", "build", "eser", "eseri"]);

// Aynı kavramın Türkçe ve İngilizce kökleri (ilk 5 harf). Soru ve olgu aynı gruba düşerse eşleşir.
const KAVRAMLAR: string[][] = [
  ["onari", "onarl", "onarm", "onarim", "resto", "tamir", "repai", "renov", "yenil"],
  ["isim", "ismi", "adi", "adini", "denir", "deniy", "denil", "deniyo", "verilm", "anili", "named", "name", "calle", "known"],
  ["mimar", "archi"],
  ["bani", "banis", "yaptir", "insa", "ettir", "built", "found", "commi"],
  ["deprem", "earth", "yikil", "yikim", "destr", "colla"],
  ["kucuk", "ucte", "oran", "aslin", "small", "third", "origi"],
  ["bugun", "gunum", "today", "prese"],
  ["vakif", "vakfi", "endow", "chart"],
  ["kitab", "inscr"],
  ["cephe", "facad", "pence", "windo", "kemer", "arch", "gotik", "gothi"],
  ["ibade", "worsh", "acil", "acild", "reope"],
];
const KOK_BOYU = 5;

function kok(sozcuk: string): string {
  return sozcuk.slice(0, KOK_BOYU);
}

function sozcukler(s: string): string[] {
  return sadelestir(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !DOLGU.has(w));
}

/** Bir sözcüğün kavram numarası; grupta yoksa kendi kökü. */
function kavram(sozcuk: string): string {
  const k = kok(sozcuk);
  const i = KAVRAMLAR.findIndex((grup) => grup.some((g) => k.startsWith(kok(g)) || kok(g).startsWith(k)));
  return i >= 0 ? `#${i}` : k;
}

function kavramlar(s: string): Set<string> {
  return new Set(sozcukler(s).map(kavram));
}

const ZAMAN_SORUSU = /\b(ne zaman|hangi yil|kac yil|kacinci|when|what year|which year)\b/;
const YIL = /\b(1[0-9]{3}|20[0-9]{2})\b/;

function puan(soru: string, soruKavram: Set<string>, olgu: Olgu): number {
  const olguKavram = new Set([...kavramlar(olgu.metin.tr), ...kavramlar(olgu.metin.en ?? "")]);
  let p = 0;
  for (const k of soruKavram) if (olguKavram.has(k)) p += GENEL.has(k) ? 0.25 : 1;
  if (p < 1) return 0;
  if (ZAMAN_SORUSU.test(soru) && YIL.test(olgu.metin.tr)) p += 0.5;
  if (soruKavram.has("#0") && olgu.kategori === "onarim") p += 0.5;
  return p;
}

export function cevapla(eser: Pick<Eser, "olgular">, soru: string, dil: Dil): Cevap {
  const sade = sadelestir(soru);
  const soruKavram = kavramlar(soru);
  const adaylar = eser.olgular
    .filter((o) => YAYINDA.has(o.durum))
    .map((o) => ({ o, p: puan(sade, soruKavram, o) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p);
  if (!adaylar.length) return { bulundu: false, cumleler: [], yontem: "eslesme" };
  // En iyi cevap ve ona yakın puan alan en fazla bir olgu daha.
  const secilen = adaylar.filter((x, i) => i === 0 || (i === 1 && x.p >= adaylar[0].p * 0.8));
  return {
    bulundu: true,
    yontem: "eslesme",
    cumleler: secilen.map(({ o }) => ({ metin: metin(o.metin, dil), durum: o.durum, kaynak_id: o.kaynak_id, sayfa: o.sayfa })),
  };
}

// --- Yapay zekâ bağlamı ---

/** Modele verilen numaralı kayıt: bir olgu, tarihçe paragrafı ya da künye bilgisi. */
export type Kayit = { no: number; tur: "olgu" | "tarihce" | "mimari" | "kunye"; metin: CokDilli; durum: string; kaynak_id?: string; sayfa?: string };

/**
 * Eserin yayındaki bütün bilgisini numaralı kayıtlara böler. Olgular kendi kaynağıyla gelir;
 * tarihçe, mimari ve künye envanter kitabından geldiği için envanter kaynağını taşır (yoksa "belirsiz").
 */
export function kayitlar(eser: Eser): Kayit[] {
  const liste: Kayit[] = [];
  const ekle = (k: Omit<Kayit, "no">) => liste.push({ ...k, no: liste.length + 1 });
  for (const o of eser.olgular) {
    if (YAYINDA.has(o.durum)) ekle({ tur: "olgu", metin: o.metin, durum: o.durum, kaynak_id: o.kaynak_id, sayfa: o.sayfa });
  }
  const env = eser.envanter?.kaynak_id
    ? { durum: "kaynakli", kaynak_id: eser.envanter.kaynak_id, sayfa: eser.envanter.sayfa }
    : { durum: "belirsiz" };
  const paragraflar = (m: CokDilli | undefined): CokDilli[] => {
    if (!m) return [];
    const tr = m.tr.split(/\n{2,}/);
    const en = m.en?.split(/\n{2,}/);
    // Çeviri paragraf paragraf örtüşmüyorsa İngilizceyi tek parça bırakmak yerine yalnız Türkçeyi ver.
    return tr.map((p, i) => ({ tr: p, ...(en && en.length === tr.length ? { en: en[i] } : {}) }));
  };
  for (const p of paragraflar(eser.tarihce)) ekle({ tur: "tarihce", metin: p, ...env });
  for (const p of paragraflar(eser.mimari?.metin)) ekle({ tur: "mimari", metin: p, ...env });

  const kunye: string[] = [`Ad: ${eser.ad.tr}${eser.ad.en ? ` (EN: ${eser.ad.en})` : ""}`, `Tür: ${eser.tur}`];
  if (eser.ilce) kunye.push(`İlçe: ${eser.ilce}`);
  if (eser.adres) kunye.push(`Adres: ${eser.adres.tr}`);
  const d = eser.donem;
  if (d?.yapim_yili) kunye.push(`Yapım yılı: ${d.yaklasik ? "yaklaşık " : ""}${d.yapim_yili}${d.yapim_yili_hicri ? ` (H. ${d.yapim_yili_hicri})` : ""}`);
  if (d?.metin) kunye.push(`Dönem: ${d.metin.tr}`);
  if (eser.banisi) kunye.push(`Banisi: ${eser.banisi}`);
  if (eser.mimar) kunye.push(`Mimarı: ${eser.mimar}`);
  const m = eser.mimari;
  if (m?.plan) kunye.push(`Plan: ${m.plan}`);
  if (m?.ust_ortu) kunye.push(`Üst örtü: ${m.ust_ortu}`);
  if (m?.malzeme?.length) kunye.push(`Malzeme: ${m.malzeme.join(", ")}`);
  for (const o of m?.onarimlar ?? []) kunye.push(`Onarım ${o.yil}${o.aciklama ? `: ${o.aciklama.tr}` : ""}`);
  ekle({ tur: "kunye", metin: { tr: kunye.join("\n") }, ...env });
  return liste;
}

/** Modelin yapılandırılmış çıktısı (sor-yz.ts içindeki JSON şeması). */
export type YzCiktisi = { bulundu: boolean; cumleler: { metin: string; kayitlar: number[] }[] };

const DURUM_SIRASI = ["kaynakli", "ai_yorumu", "belirsiz"];

/**
 * Model çıktısını arayüzün cevap biçimine çevirir. Var olmayan kayıt numaraları atılır; dayanağı kalmayan
 * cümle "ai_yorumu" olur. Birden çok kayda dayanan cümle en zayıf kaydın durumunu alır.
 */
export function yzCevabi(cikti: YzCiktisi, liste: Kayit[]): Cevap {
  const numara = new Map(liste.map((k) => [k.no, k]));
  const cumleler: CevapCumlesi[] = cikti.cumleler
    .filter((c) => c.metin.trim())
    .map((c) => {
      const dayanak = [...new Set(c.kayitlar)].map((n) => numara.get(n)).filter((k): k is Kayit => !!k);
      if (!dayanak.length) return { metin: c.metin.trim(), durum: "ai_yorumu" };
      const durum = dayanak.map((k) => k.durum).sort((a, b) => DURUM_SIRASI.indexOf(b) - DURUM_SIRASI.indexOf(a))[0];
      const ilk = dayanak.find((k) => k.kaynak_id) ?? dayanak[0];
      const sayfalar = [...new Set(dayanak.filter((k) => k.kaynak_id === ilk.kaynak_id && k.sayfa).map((k) => k.sayfa))];
      return {
        metin: c.metin.trim(),
        durum,
        ...(ilk.kaynak_id ? { kaynak_id: ilk.kaynak_id } : {}),
        ...(sayfalar.length ? { sayfa: sayfalar.join(", ") } : {}),
      };
    });
  const kaynakli = cumleler.some((c) => c.durum !== "ai_yorumu");
  if (!cikti.bulundu || !kaynakli) return { bulundu: false, cumleler: [], yontem: "yapay_zeka" };
  return { bulundu: true, cumleler, yontem: "yapay_zeka" };
}
