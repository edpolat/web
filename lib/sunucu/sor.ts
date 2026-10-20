// "Bu esere sor": soruyu yalnız o eserin yayındaki kaynaklı olgularıyla eşleştirir.
// Cevap, olgunun kendi metnidir; bu yüzden her cümle kaynak kimliği ve sayfasıyla gelir ve hiçbir şey uydurulmaz.
// Eşleşme yoksa "Kaynaklarımızda bu bilgi yok" döner. Yapay zekâ katmanı (sor-yz.ts) aynı cevap biçimini kullanır:
// bu dosyadaki kayitlar() ona numaralı bağlamı verir, yzCevabi() modelin çıktısını kaynaklı cümlelere çevirir
// (kayda dayanmayan cümle "ai_yorumu" olur). Saf fonksiyonlar; dosya ve ağ işi yapmaz.
import { sadelestir } from "../filtre";
import { metin } from "../metin";
import type { CokDilli, Dil, Eser, Olgu } from "../tipler";

/** durum "not": kaynağa dayanmayan, sistemin kendi kısa açıklaması ("Kaynaklarda mimarın adı geçmiyor."). */
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
  ["bani", "banis", "yaptir", "insa", "ettir", "kurucu", "yapan", "yapmi", "built", "found", "commi"],
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

/** Eşleştirmenin baktığı tek bilgi: bir olgu ya da tarihçe/mimari metninden bir cümle. */
type Aday = Pick<Olgu, "metin" | "durum" | "kaynak_id" | "sayfa"> & { kategori?: string };

function puan(soru: string, soruKavram: Set<string>, olgu: Aday): number {
  const olguKavram = new Set([...kavramlar(olgu.metin.tr), ...kavramlar(olgu.metin.en ?? "")]);
  let p = 0;
  for (const k of soruKavram) if (olguKavram.has(k)) p += GENEL.has(k) ? 0.25 : 1;
  if (p < 1) return 0;
  if (ZAMAN_SORUSU.test(soru) && YIL.test(olgu.metin.tr)) p += 0.5;
  if (soruKavram.has("#0") && olgu.kategori === "onarim") p += 0.5;
  return p;
}

// "Kim yaptırdı / Mimarı kim / Kimin eseri" soruları. Ziyaretçi için mimar ile yaptıran (bânî) çoğu zaman
// aynı soru; kayıtlarda mimar yoksa yaptıran verilir ve mimarın geçmediği söylenir.
const KIM_SORUSU = /\b(kim|kimin|kimler|kimdir|kimmis|who|whose|whom)\b/;
const MIMAR_SORUSU = /\b(mimar|archit)/;
// Olgu metninde kişi olarak mimar: "Mimar Sinan", "mimarı ...". "mimari özellikleri" eşleşmez.
const MIMAR_KISI = /(^|[^\p{L}])mimar(ı|\s)/iu;
const BANI_KAYDI = /bân[iî]|bani(si|sinin|sini)\b|yaptır|inşa ettir|tarafından[^.]{0,60}(inşa|yapıl|kurul)/iu;
// Yaptıranı değil onarımı ya da kazıyı yapanı anlatan cümleler ("Müze Müdürlüğü tarafından yapılan kazı").
const BASKA_IS = /onar|restor|tamir|kazı|yenile/iu;
const YAPTIRAN_ADIYLA = /tarafından|bân[iî]s[iı] [A-ZÇĞİÖŞÜ]/u;
const NOTLAR = {
  mimarYok: { tr: "Kaynaklarda mimarın adı geçmiyor. Yaptıranla ilgili kayıt:", en: "The sources do not name an architect. On who had it built:" },
};

type SoruEseri = Pick<Eser, "olgular"> &
  Partial<Pick<Eser, "banisi" | "mimar" | "envanter" | "adres" | "ilce" | "tarihce" | "mimari">> & { il?: string };

/** Envanter kitabından gelen alanların (tarihçe, mimari, adres, künye) kaynağı. */
function envanterKaynagi(eser: SoruEseri) {
  return eser.envanter?.kaynak_id
    ? { durum: "kaynakli", kaynak_id: eser.envanter.kaynak_id, sayfa: eser.envanter.sayfa }
    : { durum: "belirsiz" };
}

/** Metni cümlelere böler; İngilizce cümle sayısı tutmazsa yalnız Türkçe kalır. */
function cumlelereBol(m: CokDilli): CokDilli[] {
  // "Muhammed b. Hamza" gibi kısaltmalarda bölmemek için noktadan önce en az iki harf ya da rakam aranır.
  const bol = (t: string) => t.split(/\n+|(?<=[a-zçğıöşüâîû0-9)”"]{2}[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9“"])/u).map((x) => x.trim()).filter((x) => x.length > 15);
  const tr = bol(m.tr);
  const en = m.en ? bol(m.en) : [];
  return tr.map((c, i) => ({ tr: c, ...(en.length === tr.length ? { en: en[i] } : {}) }));
}

/**
 * Olguların yanında eser sayfasında görünen öteki bilgiler: tarihçe ve mimari metninin cümleleri, onarımlar.
 * Olgular kitabın seçilmiş cümleleri olduğu için önce onlar denenir; bunlar yalnız eşleşme yoksa ya da daha iyiyse çıkar.
 */
function ekAdaylar(eser: SoruEseri): Aday[] {
  const env = envanterKaynagi(eser);
  const liste: Aday[] = [];
  for (const m of [eser.tarihce, eser.mimari?.metin]) if (m) for (const c of cumlelereBol(m)) liste.push({ metin: c, ...env });
  for (const o of eser.mimari?.onarimlar ?? []) {
    if (o.aciklama) liste.push({ metin: { tr: `${o.yil}: ${o.aciklama.tr}`, en: o.aciklama.en && `${o.yil}: ${o.aciklama.en}` }, kategori: "onarim", ...env });
  }
  return liste;
}

const KONUM_SORUSU = /\b(nerede|neresi|nereye|nasil gidil|adres|konum|hangi (ilce|mahalle|sehir|semt)|where|address|located|location)/;

function cumle(o: Aday, dil: Dil): CevapCumlesi {
  return { metin: metin(o.metin, dil), durum: o.durum, kaynak_id: o.kaynak_id, sayfa: o.sayfa };
}

/** Kim yaptı sorusunun cevabı; soru bu türden değilse ya da kayıt yoksa null. */
function yapanCevabi(eser: SoruEseri, sade: string, soruKavram: Set<string>, dil: Dil): Cevap | null {
  const mimarSoruldu = MIMAR_SORUSU.test(sade);
  const yapimSoruldu = soruKavram.has("#3") || /\b(yap|eser)/.test(sade);
  if (!KIM_SORUSU.test(sade) || !(mimarSoruldu || yapimSoruldu)) return null;
  const yayinda = eser.olgular.filter((o) => YAYINDA.has(o.durum));
  const env = envanterKaynagi(eser);
  const kunye = (tr: string, en: string, ad: string) => ({ metin: { tr: `${tr}: ${ad}`, en: `${en}: ${ad}` }, ...env });

  if (mimarSoruldu) {
    const mimarlar = [
      ...(eser.mimar ? [kunye("Mimarı", "Architect", eser.mimar)] : []),
      ...yayinda.filter((o) => MIMAR_KISI.test(o.metin.tr)),
    ].slice(0, 2);
    if (mimarlar.length) return { bulundu: true, yontem: "eslesme", cumleler: mimarlar.map((o) => cumle(o, dil)) };
  }
  // Önce "... tarafından yaptırılmıştır" gibi yaptıranı adıyla veren cümleler, sonra "banisi bilinmemektedir".
  const banilar = yayinda
    .filter((o) => BANI_KAYDI.test(o.metin.tr) && !(BASKA_IS.test(o.metin.tr) && !/bân[iî]|bani|yaptır/iu.test(o.metin.tr)))
    .sort((a, b) => Number(YAPTIRAN_ADIYLA.test(b.metin.tr)) - Number(YAPTIRAN_ADIYLA.test(a.metin.tr)));
  // Künyedeki banisi, onu adıyla anan bir olgu varsa tekrar edilmez.
  const banisiGecen = eser.banisi && banilar.some((o) => sadelestir(o.metin.tr).includes(sadelestir(eser.banisi!)));
  const secilen = [...(eser.banisi && !banisiGecen ? [kunye("Banisi", "Founder", eser.banisi)] : []), ...banilar].slice(0, 2);
  if (!secilen.length) return mimarSoruldu ? { bulundu: false, cumleler: [], yontem: "eslesme" } : null;
  return {
    bulundu: true,
    yontem: "eslesme",
    cumleler: [...(mimarSoruldu ? [{ metin: metin(NOTLAR.mimarYok, dil), durum: "not" }] : []), ...secilen.map((o) => cumle(o, dil))],
  };
}

function benzer(a: string, b: string): boolean {
  const ka = new Set(sozcukler(a));
  const kb = new Set(sozcukler(b));
  const ortak = [...ka].filter((w) => kb.has(w)).length;
  return ortak / Math.max(1, Math.min(ka.size, kb.size)) >= 0.6;
}

export function cevapla(eser: SoruEseri, soru: string, dil: Dil): Cevap {
  const sade = sadelestir(soru);
  const soruKavram = kavramlar(soru);
  const yapan = yapanCevabi(eser, sade, soruKavram, dil);
  if (yapan) return yapan;
  // "Kimin eseri?" yaptıran sorusudur; "eser" sözcüğü tek başına eşleşme saymaz.
  if (KIM_SORUSU.test(sade) && /\beser/.test(sade)) soruKavram.add("#3");
  if (KONUM_SORUSU.test(sade) && (eser.adres || eser.ilce)) {
    const il = eser.il ? eser.il.charAt(0).toLocaleUpperCase("tr") + eser.il.slice(1) : "";
    const yer = eser.adres ?? {
      tr: [eser.ilce && `${eser.ilce} ilçesinde`, il && `(${il})`].filter(Boolean).join(" ") + " bulunuyor.",
      en: `It is in ${[eser.ilce, il].filter(Boolean).join(", ")}.`,
    };
    return { bulundu: true, yontem: "eslesme", cumleler: [cumle({ metin: yer, ...envanterKaynagi(eser) }, dil)] };
  }
  // Olgular eşit puanda öne geçsin diye küçük bir üstünlük alır.
  const adaylar = [
    ...eser.olgular.filter((o) => YAYINDA.has(o.durum)).map((o) => ({ o: o as Aday, p: puan(sade, soruKavram, o) + 0.1 })),
    ...ekAdaylar(eser).map((o) => ({ o, p: puan(sade, soruKavram, o) })),
  ]
    .filter((x) => x.p > 0.1)
    .sort((a, b) => b.p - a.p);
  if (!adaylar.length) return { bulundu: false, cumleler: [], yontem: "eslesme" };
  // En iyi cevap ve ona yakın puan alan en fazla bir olgu daha.
  // Olgu ile tarihçede aynı cümle çoğu zaman iki kez geçer; birbirine çok benzeyen ikinci cümle atılır.
  const secilen = adaylar
    .filter((x, i, t) => !t.slice(0, i).some((y) => benzer(y.o.metin.tr, x.o.metin.tr)))
    .filter((x, i) => i === 0 || (i === 1 && x.p >= adaylar[0].p * 0.8));
  return {
    bulundu: true,
    yontem: "eslesme",
    cumleler: secilen.map(({ o }) => cumle(o, dil)),
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

// Model bazen "bânî" yerine "b&acirc;n&icirc;" gibi HTML kodu yazıyor; düz harfe çevrilir.
const HTML_KODLARI: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
  acirc: "â", icirc: "î", ucirc: "û", Acirc: "Â", Icirc: "Î", Ucirc: "Û",
  ccedil: "ç", Ccedil: "Ç", ouml: "ö", Ouml: "Ö", uuml: "ü", Uuml: "Ü",
};
function htmlCoz(t: string): string {
  return t.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (tam, k: string) => {
    if (k[0] === "#") {
      const n = k[1] === "x" || k[1] === "X" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : tam;
    }
    return HTML_KODLARI[k] ?? tam;
  });
}

/**
 * Model çıktısını arayüzün cevap biçimine çevirir. Var olmayan kayıt numaraları atılır; dayanağı kalmayan
 * cümle (modelin genel bilgisi) "ai_yorumu" olur. Birden çok kayda dayanan cümle en zayıf kaydın durumunu alır.
 */
export function yzCevabi(cikti: YzCiktisi, liste: Kayit[]): Cevap {
  const numara = new Map(liste.map((k) => [k.no, k]));
  const cumleler: CevapCumlesi[] = cikti.cumleler
    .map((c) => ({ ...c, metin: htmlCoz(c.metin) }))
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
  // Kayda dayanmayan cümleler de gösterilir; arayüz onları "AI yorumu" etiketiyle ayırır.
  if (!cikti.bulundu || !cumleler.length) return { bulundu: false, cumleler: [], yontem: "yapay_zeka" };
  return { bulundu: true, cumleler, yontem: "yapay_zeka" };
}
