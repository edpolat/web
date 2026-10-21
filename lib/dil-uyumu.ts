// İki dil uyumu (tarayıcı ve sunucu): bir düzenleme ya da öneri çok dilli bir metnin yalnız Türkçesini ya da yalnız
// İngilizcesini değiştirdiyse onaylayan kişi uyarılır ve "Yine de onayla" demek zorunda kalır. Basit kontrol kotaya
// takılmaz, hep çalışır. YZ açıksa ek olarak iki metnin aynı anlamı taşıyıp taşımadığına bakılır (lib/sunucu/yz-dil.ts);
// YZ yalnız bilgi verir, kararı insan verir.

export type DilFarki = {
  /** Metnin eserdeki yeri, ör. "ad", "olgular.3.metin". */
  yol: string;
  /** Üst düzey alan (ekrandaki ad için). */
  alan: string;
  /** Dizideki sıra (olgular gibi), yoksa null. */
  sira: number | null;
  tr: string;
  en: string;
  eskiTr: string;
  eskiEn: string;
  trDegisti: boolean;
  enDegisti: boolean;
};

const DILLER = new Set(["tr", "en"]);

/** { tr, en? } biçiminde çok dilli metin mi. */
function metinMi(x: unknown): x is { tr?: string; en?: string } {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  const anahtarlar = Object.keys(x);
  return anahtarlar.length > 0 && anahtarlar.every((k) => DILLER.has(k) && (typeof (x as Record<string, unknown>)[k] === "string" || (x as Record<string, unknown>)[k] === undefined));
}

const temiz = (x: unknown) => (typeof x === "string" ? x.trim() : "");

/** Tek bir çok dilli metnin değişimi; değişmediyse null. */
export function metinFarki(yol: string, eski: { tr?: string; en?: string } | null | undefined, yeni: { tr?: string; en?: string }): DilFarki | null {
  const [alan, ikinci] = yol.split(".");
  const f: DilFarki = {
    yol,
    alan,
    sira: ikinci !== undefined && /^\d+$/.test(ikinci) ? Number(ikinci) : null,
    tr: temiz(yeni.tr),
    en: temiz(yeni.en),
    eskiTr: temiz(eski?.tr),
    eskiEn: temiz(eski?.en),
    trDegisti: false,
    enDegisti: false,
  };
  f.trDegisti = f.tr !== f.eskiTr;
  f.enDegisti = f.en !== f.eskiEn;
  return f.trDegisti || f.enDegisti ? f : null;
}

/**
 * Eserin iki hâli arasında değişen çok dilli metinler. Yalnız yeni hâlde bulunan metinlere bakılır
 * (silinen metin iki dilden birden gider). eski yoksa yeni eserdir.
 */
export function dilFarklari(eski: unknown, yeni: unknown): DilFarki[] {
  const sonuc: DilFarki[] = [];
  const gez = (a: unknown, b: unknown, yol: string[]) => {
    if (metinMi(b)) {
      const f = metinFarki(yol.join("."), metinMi(a) ? a : undefined, b);
      if (f) sonuc.push(f);
      return;
    }
    if (Array.isArray(b)) {
      b.forEach((x, i) => gez(Array.isArray(a) ? a[i] : undefined, x, [...yol, String(i)]));
      return;
    }
    if (typeof b === "object" && b !== null) {
      const ea = typeof a === "object" && a !== null && !Array.isArray(a) ? (a as Record<string, unknown>) : {};
      for (const [k, v] of Object.entries(b)) if (k !== "id") gez(ea[k], v, [...yol, k]);
    }
  };
  gez(eski, yeni, []);
  return sonuc;
}

/** Yalnız bir dili değişen metin (diğer dil eski hâliyle ya da hiç yok). */
export const tekDilli = (f: DilFarki) => f.trDegisti !== f.enDegisti;

/** Onaylarken uyarı gerekir mi (YZ'siz basit kontrol). Gönderen "diğer dile uyum için" dediyse gerekmez. */
export function dilUyarisiGerekli(farklar: DilFarki[], dilUyumu: boolean): boolean {
  return !dilUyumu && farklar.some(tekDilli);
}

/** YZ'ye sorulacak çiftler: değişen her metnin yeni Türkçesi ve İngilizcesi (biri boşsa sormaya gerek yok). */
export function karsilastirilacaklar(farklar: DilFarki[]): { tr: string; en: string }[] {
  return farklar.filter((f) => f.tr && f.en).map((f) => ({ tr: f.tr, en: f.en }));
}

export const EN_FAZLA_CIFT = 12;
export const EN_UZUN_METIN = 6000;

/** YZ'nin bir çift için cevabı. */
export type CiftSonucu = { uyumlu: boolean; aciklama: string };
