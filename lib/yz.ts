// Yönetim panelindeki yapay zekâ katmanının ortak, saf kuralları (sunucu ve testler): kişisel veri maskeleme,
// uzun belgede ilgili sayfaları seçme, YZ'nin verdiği alıntının belgede gerçekten geçip geçmediği, çıktı şemaları.
// LLM çağrısı lib/sunucu/yz-servis.ts'de, akış lib/sunucu/yz-analiz.ts'de. Tablolar: supabase/006_yz.sql
import Ajv from "ajv";

export type Sayfa = { sayfa: number; metin: string };

// --- Kişisel veri maskeleme ---

export type MaskeAyari = {
  /** Bilinen kişi adları (öneren, hesap adı): metnin her yerinde [AD] olur. */
  adlar?: (string | null | undefined)[];
  /** Ev/iş adresi kalıpları maskelensin mi. Eserin adresini öneren metinde ve tarihî belgelerde kapalı tutulur. */
  adres?: boolean;
};

const BUYUK = "A-ZÇĞİÖŞÜÂÎÛ";
const KUCUK = "a-zçğıöşüâîû";
const KELIME = `[${BUYUK}][${KUCUK}${BUYUK}'’-]+`;

const kacis = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Halktan gelen metindeki kişisel verileri (e-posta, IBAN, TC kimlik no, telefon, adres, ad-soyad) LLM'e gitmeden önce
 * yer tutucuyla değiştirir. Ad-soyad için genel bir tanıma yapılmaz: bilinen adlar ve "adım ...", "ben ..." gibi
 * kendini tanıtma kalıpları maskelenir (tarihî kişi adları bilgi önerisinin konusu olduğu için korunur).
 */
export function maskele(metin: string, ayar: MaskeAyari = {}): string {
  let m = metin;
  m = m.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[E-POSTA]");
  m = m.replace(/\bTR\s?\d{2}(?:\s?[0-9]{4}){5}\s?[0-9]{2}\b/gi, "[IBAN]");
  m = m.replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b/g, "[IBAN]");
  m = m.replace(/\b[1-9]\d{10}\b/g, "[TC]");
  m = m.replace(/(?:\+\s?90[\s.-]?\(?|\b0[\s.-]?\(?|\(|\b)[2-5]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g, "[TELEFON]");
  if (ayar.adres) {
    m = m.replace(/\b(?:ev\s+|iş\s+)?(?:adresim|ikametgâhım|ikametgahım)\b\s*(?:şu|şöyle)?\s*[:-]?\s*[^\n.]{3,150}/giu, "[ADRES]");
    m = m.replace(
      new RegExp(
        `(?:${KELIME}\\s+)?(?:Mah\\.|Mahallesi|Mh\\.)[^\\n;]{0,60}?(?:Sok\\.|Sokak|Sokağı|Sk\\.|Cad\\.|Caddesi|Cd\\.|Bulvarı|Blv\\.)[^\\n;]{0,15}?(?:No\\s*[:.]?\\s*\\d+[\\w/-]*)?(?:\\s*(?:D|Daire|Kat)\\s*[:.]?\\s*\\d+)*`,
        "giu",
      ),
      "[ADRES]",
    );
  }
  for (const ad of ayar.adlar ?? []) {
    const parcalar = (ad ?? "").trim().split(/\s+/).filter((p) => p.length >= 2);
    if (!parcalar.length) continue;
    m = m.replace(new RegExp(`(?<![\\p{L}])${parcalar.map(kacis).join("\\s+")}(?![\\p{L}])`, "giu"), "[AD]");
  }
  m = m.replace(new RegExp(`\\b(adım|ismim|benim adım|ben)\\s+(${KELIME}(?:\\s+${KELIME}){0,2})`, "gu"), (_t, on: string) => `${on} [AD]`);
  return m;
}

// --- Karşılaştırma için normalleştirme ---

/** Küçük harf, Türkçe harfler sadeleşir, harf ve rakam dışındaki her şey (boşluk, noktalama, şapka) atılır. */
export function sadelestir(x: string): string {
  return x
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function kelimeler(x: string): string[] {
  return x
    .replace(/İ/g, "i")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * YZ'nin verdiği alıntı belgede geçiyor mu (uydurma kontrolü). Boşluk, noktalama, büyük/küçük harf ve şapka farkı
 * tolere edilir; "..." ile kısaltılmış alıntının her parçası sırayla aranır. Bulunursa geçtiği sayfa döner.
 * Tercih edilen sayfa (YZ'nin söylediği) önce denenir.
 */
export function pasajBul(pasaj: string, sayfalar: Sayfa[], tercih?: number | null): number | null {
  const parcalar = pasaj
    .split(/\.{3,}|…|\[\.\.\.\]/)
    .map(sadelestir)
    .filter((p) => p.length > 0);
  if (!parcalar.length || parcalar.join("").length < 8) return null;
  const sirali = [...sayfalar].sort((a, b) => Number(b.sayfa === tercih) - Number(a.sayfa === tercih));
  for (const s of sirali) {
    const metin = sadelestir(s.metin);
    let yer = 0;
    let tamam = true;
    for (const p of parcalar) {
      const i = metin.indexOf(p, yer);
      if (i < 0) {
        tamam = false;
        break;
      }
      yer = i + p.length;
    }
    if (tamam) return s.sayfa;
  }
  return null;
}

// --- Uzun belgede ilgili sayfaları seçme ---

const DURAK = new Set(
  "ve ile bir bu su o da de ki mi icin olarak olan gibi kadar daha cok en ama veya ya hem ise yani sonra once ilk yeni eski adli adi the and of in on at to for with from by is was are camii cami".split(" "),
);

/** Belgeyle iddiayı karşılaştırırken kullanılan kelime kökleri (Türkçe ekler için ilk 5 harf). */
export function anahtarKelimeler(iddia: string): string[] {
  const kok = (k: string) => (/^\d+$/.test(k) ? k : k.slice(0, 5));
  return [...new Set(kelimeler(iddia).filter((k) => (/^\d+$/.test(k) ? k.length >= 3 : k.length >= 3 && !DURAK.has(k))).map(kok))];
}

/**
 * İddiayla ilgili olabilecek sayfaları seçer: sayfa, iddiadaki kelimelerden (kök eşleşmesiyle) ne kadar çoğunu içeriyorsa
 * o kadar önde. Kısa belgede tüm sayfalar gider. Sonuç sayfa sırasındadır; toplam metin `enFazlaKarakter`i aşmaz.
 */
export function sayfaSec(iddia: string, sayfalar: Sayfa[], ayar: { enFazlaSayfa?: number; enFazlaKarakter?: number } = {}): Sayfa[] {
  const enFazlaSayfa = ayar.enFazlaSayfa ?? 5;
  const enFazlaKarakter = ayar.enFazlaKarakter ?? 30_000;
  const dolu = sayfalar.filter((s) => s.metin.trim());
  const sigdir = (liste: Sayfa[]) => {
    const pay = Math.floor(enFazlaKarakter / Math.max(1, liste.length));
    return liste.map((s) => (s.metin.length > pay ? { ...s, metin: s.metin.slice(0, pay) } : s));
  };
  const toplam = dolu.reduce((n, s) => n + s.metin.length, 0);
  if (dolu.length <= enFazlaSayfa && toplam <= enFazlaKarakter) return dolu;

  const anahtar = anahtarKelimeler(iddia);
  // Az sayfada geçen kelime daha ayırt edicidir (idf benzeri ağırlık).
  const sayfaKokleri = dolu.map((s) => new Set(kelimeler(s.metin).map((k) => (/^\d+$/.test(k) ? k : k.slice(0, 5)))));
  const agirlik = new Map(anahtar.map((k) => [k, Math.log(1 + dolu.length / (1 + sayfaKokleri.filter((x) => x.has(k)).length))]));
  const ifade = sadelestir(iddia.split("\n").pop() ?? "");
  const puanli = dolu.map((s, i) => {
    let puan = anahtar.reduce((n, k) => n + (sayfaKokleri[i].has(k) ? agirlik.get(k)! : 0), 0);
    if (ifade.length >= 6 && sadelestir(s.metin).includes(ifade)) puan += 10;
    return { s, puan };
  });
  const secilen = puanli
    .filter((x) => x.puan > 0)
    .sort((a, b) => b.puan - a.puan || a.s.sayfa - b.s.sayfa)
    .slice(0, enFazlaSayfa)
    .map((x) => x.s);
  const sonuc = secilen.length ? secilen : dolu.slice(0, Math.min(3, enFazlaSayfa));
  return sigdir(sonuc.sort((a, b) => a.sayfa - b.sayfa));
}

/** Belge metnini LLM'e veri olarak koyarken etiketin dışına çıkmasın (</belge> yazıp talimat eklemeye karşı). */
export function belgeGuvenli(x: string): string {
  return x.replace(/<\/?\s*(belge|sayfa|iddia|oneri|eser)\b[^>]*>/gi, (t) => t.replace(/</g, "‹").replace(/>/g, "›"));
}

// --- Çıktı şemaları ---

export const KAYNAK_SONUCLARI = ["destekliyor", "celisiyor", "bulunamadi"] as const;
export const GUVENLER = ["yuksek", "orta", "dusuk"] as const;

/** 6A: LLM'in kaynak–bilgi eşleştirme cevabı. */
export type KaynakCevabi = {
  sonuc: (typeof KAYNAK_SONUCLARI)[number];
  sayfa: number | null;
  pasaj: string;
  kaynaktaki_deger: string;
  aciklama: string;
  guven: (typeof GUVENLER)[number];
};

/** JSON Schema (alt küme: object, string, integer, enum, nullable). yz-servis bunu sağlayıcının biçimine çevirir. */
export type Sema = {
  type: "object" | "array" | "string" | "integer" | "boolean";
  properties?: Record<string, Sema>;
  required?: string[];
  items?: Sema;
  enum?: readonly string[];
  nullable?: boolean;
  maxLength?: number;
  maxItems?: number;
};

export const KAYNAK_SEMASI: Sema = {
  type: "object",
  properties: {
    sonuc: { type: "string", enum: KAYNAK_SONUCLARI },
    sayfa: { type: "integer", nullable: true },
    pasaj: { type: "string", maxLength: 2000 },
    kaynaktaki_deger: { type: "string", maxLength: 1000 },
    aciklama: { type: "string", maxLength: 1000 },
    guven: { type: "string", enum: GUVENLER },
  },
  required: ["sonuc", "sayfa", "pasaj", "kaynaktaki_deger", "aciklama", "guven"],
};

/** Bizim şemamızı ajv'nin anlayacağı JSON Schema'ya çevirir (nullable → type dizisi, ek alan yok). */
function ajvSemasi(s: Sema): Record<string, unknown> {
  const tip = s.nullable ? [s.type, "null"] : s.type;
  const enumlar = s.enum ? (s.nullable ? [...s.enum, null] : [...s.enum]) : undefined;
  return {
    type: tip,
    ...(enumlar ? { enum: enumlar } : {}),
    ...(s.maxLength ? { maxLength: s.maxLength } : {}),
    ...(s.maxItems ? { maxItems: s.maxItems } : {}),
    ...(s.items ? { items: ajvSemasi(s.items) } : {}),
    ...(s.properties
      ? {
          properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, ajvSemasi(v)])),
          required: s.required ?? [],
          additionalProperties: false,
        }
      : {}),
  };
}

const ajv = new Ajv({ allErrors: true, strict: false });
const derlenmis = new WeakMap<Sema, ReturnType<typeof ajv.compile>>();

/** Değer şemaya uyuyor mu; uymuyorsa hata metni. */
export function semayaUygun(s: Sema, deger: unknown): string | null {
  let d = derlenmis.get(s);
  if (!d) derlenmis.set(s, (d = ajv.compile(ajvSemasi(s))));
  return d(deger) ? null : ajv.errorsText(d.errors);
}

// --- Saklanan sonuç ---

/** Metin çıkarma sonucu: belge okunamadıysa YZ çağrılmaz. */
export type MetinDurumu = "tamam" | "okunamadi" | "kaynak_yok";

/** yz_analizleri.sonuc (tur = 'kaynak'). Ekranda gösterilen her şey burada. */
export type KaynakAnalizi =
  | { metin: "okunamadi" | "kaynak_yok"; aciklama: string }
  | (KaynakCevabi & {
      metin: "tamam";
      /** Alıntı belgenin çıkarılan metninde bulundu mu (kod kontrol eder). Bulunmadıysa "doğrulanamadı". */
      pasaj_dogrulandi: boolean;
      /** Alıntının gerçekten geçtiği sayfa (YZ yanlış sayfa söylediyse düzeltilmiş hâli). */
      bulunan_sayfa: number | null;
      /** Belgenin sayfa numarası var mı (PDF) yoksa web sayfası mı. */
      sayfali: boolean;
      /** "Kaynakta bu sayfayı aç" düğmesinin adresi (sayfa numarası eklenmeden). */
      kaynak_adresi: string | null;
      incelenen_sayfalar: number[];
    });

/** LLM cevabını alıntı kontrolünden geçirip saklanacak sonuca çevirir. */
export function kaynakSonucu(
  cevap: KaynakCevabi,
  sayfalar: Sayfa[],
  ek: { sayfali: boolean; kaynak_adresi: string | null; incelenen: number[] },
): KaynakAnalizi {
  const bulunan = cevap.pasaj.trim() ? pasajBul(cevap.pasaj, sayfalar, cevap.sayfa) : null;
  // "bulunamadi" sonucunda alıntı beklenmez; diğerlerinde alıntı belgede yoksa sonuç doğrulanamadı sayılır.
  const dogrulandi = cevap.sonuc === "bulunamadi" ? !cevap.pasaj.trim() || bulunan !== null : bulunan !== null;
  return {
    ...cevap,
    metin: "tamam",
    pasaj_dogrulandi: dogrulandi,
    bulunan_sayfa: bulunan,
    sayfali: ek.sayfali,
    kaynak_adresi: ek.kaynak_adresi,
    incelenen_sayfalar: ek.incelenen,
  };
}

/** "Kaynakta bu sayfayı aç" adresi: PDF ise #page=N eklenir (tarayıcının PDF görüntüleyicisi o sayfada açar). */
export function sayfaAdresi(a: KaynakAnalizi): string | null {
  if (a.metin !== "tamam" || !a.kaynak_adresi) return null;
  const sayfa = a.bulunan_sayfa ?? a.sayfa;
  return a.sayfali && sayfa ? `${a.kaynak_adresi}#page=${sayfa}` : a.kaynak_adresi;
}

// --- 6B: öneri kuyruğunda ön eleme ---

export const ETIKETLER = ["spam", "anlamsiz", "kaynaksiz", "kaynak_alakasiz", "mevcut_bilgiyle_ayni", "mevcut_bilgiyle_celisiyor", "degerli"] as const;
export type Etiket = (typeof ETIKETLER)[number];
export const ONCELIKLER = ["yuksek", "normal", "dusuk"] as const;
export type Oncelik = (typeof ONCELIKLER)[number];

/** LLM'in ön eleme cevabı; yz_analizleri.sonuc (tur = 'eleme') olarak da saklanır. */
export type ElemeCevabi = { etiketler: Etiket[]; oncelik: Oncelik; gerekce: string };

export const ELEME_SEMASI: Sema = {
  type: "object",
  properties: {
    etiketler: { type: "array", items: { type: "string", enum: ETIKETLER }, maxItems: 7 },
    oncelik: { type: "string", enum: ONCELIKLER },
    gerekce: { type: "string", maxLength: 1000 },
  },
  required: ["etiketler", "oncelik", "gerekce"],
};

/** Aynı etiket iki kez gelmesin; kaynaksız öneriye "kaynaksiz" etiketini kod ekler (YZ'ye bırakılmaz). */
export function etiketleriDuzenle(c: ElemeCevabi, kaynaksiz: boolean): ElemeCevabi {
  const etiketler = [...new Set(c.etiketler)].filter((e) => kaynaksiz || e !== "kaynaksiz");
  if (kaynaksiz && !etiketler.includes("kaynaksiz")) etiketler.push("kaynaksiz");
  return { ...c, etiketler };
}

/**
 * Tekrar tespiti (LLM'siz): aynı eser ve aynı alan için bekleyen başka öneriler. Her öneri için benzerlerinin kimlikleri.
 */
export function benzerOneriler(liste: { id: number; eser_id: string; alan: string }[]): Map<number, number[]> {
  const gruplar = new Map<string, number[]>();
  for (const o of liste) {
    const anahtar = `${o.eser_id}\u0000${o.alan}`;
    gruplar.set(anahtar, [...(gruplar.get(anahtar) ?? []), o.id]);
  }
  const sonuc = new Map<number, number[]>();
  for (const o of liste) sonuc.set(o.id, (gruplar.get(`${o.eser_id}\u0000${o.alan}`) ?? []).filter((x) => x !== o.id));
  return sonuc;
}

/** Ekranda geçerli etiket: editör düzelttiyse onunki, yoksa YZ'ninki. */
export type GecerliEtiket = { etiketler: Etiket[]; oncelik: Oncelik; kaynak: "yz" | "editor" };

/** Liste sırası: spam hep en sonda; önceliğe göre sıralamada yüksek > normal (ya da etiketsiz) > düşük. */
export function siraPuani(e: GecerliEtiket | undefined, oncelikle: boolean): number {
  if (e?.etiketler.includes("spam")) return 9;
  if (!oncelikle) return 0;
  return e ? { yuksek: 0, normal: 1, dusuk: 2 }[e.oncelik] : 1;
}
