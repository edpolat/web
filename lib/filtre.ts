import type { Dil, IlliEser, Konum } from "./tipler";
import { metin } from "./metin";

export type Filtre = { il?: string; tur?: string; ara?: string };

/** Türkçe karakterleri sadeleştirir: "Çelebi" ve "celebi" aynı sonucu verir. */
export function sadelestir(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

type Suzulen = Pick<IlliEser, "il" | "tur" | "ad" | "ilce" | "banisi">;

/** Aramada boşluk, tire, parantez, nokta ve tırnak yok sayılır ("ulucami" = "Ulu Camii"). */
export function aramaSadele(s: string): string {
  return sadelestir(s)
    .replace(/[()\-–—.,'’"“”/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Hoşgörülü arama (mobil uygulamadan, 3 Kas 2026): birden fazla sözcük ayrı ayrı aranır ("konya cami"),
 * ad, ilçe, banisi yanında il ve tür de taranır; sözcükler bitişik yazılsa da bulunur.
 */
export function aramaUyar(e: Suzulen, aranan: string, dil: Dil): boolean {
  const sozcukler = aramaSadele(aranan).split(" ").filter(Boolean);
  if (!sozcukler.length) return true;
  const m = aramaSadele([metin(e.ad, dil), e.ad.tr, e.ilce ?? "", e.banisi ?? "", e.il, e.tur.replace(/-/g, " ")].join(" "));
  const bitisik = m.replace(/ /g, "");
  return sozcukler.every((s) => m.includes(s) || bitisik.includes(s));
}

/** Aramada adı aranan sözle başlayan eserler önce (0), adında geçenler sonra (1), diğerleri en sonda (2). */
export function aramaDerecesi(e: Pick<IlliEser, "ad">, aranan: string, dil: Dil): number {
  const b = aramaSadele(aranan).replace(/ /g, "");
  const ad = aramaSadele(metin(e.ad, dil).replace(/^\s*\([^)]*\)\s*/, "")).replace(/ /g, "");
  return !b ? 2 : ad.startsWith(b) ? 0 : ad.includes(b) ? 1 : 2;
}

export function filtrele<T extends Suzulen>(eserler: T[], f: Filtre, dil: Dil): T[] {
  return eserler.filter((e) => {
    if (f.il && e.il !== f.il) return false;
    if (f.tur && e.tur !== f.tur) return false;
    return !f.ara || aramaUyar(e, f.ara, dil);
  });
}

/** Düzenlenmesi gereken konum: yok, doğrulanmamış ya da yalnız mahalle/ilçe düzeyinde. */
export function konumEksik(konum: Konum | undefined): boolean {
  return !konum || !konum.dogrulandi || konum.hassasiyet === "mahalle" || konum.hassasiyet === "ilce";
}

/**
 * Eserin yapıldığı yüzyıl: önce yapım yılından, yıl yoksa dönem metnindeki ilk "13. yüzyıl" / "XIII. yüzyıl" ifadesinden.
 * Panelin dönem süzgeci kullanır; yüzyıl bulunamazsa undefined.
 */
export function donemYuzyili(donem: IlliEser["donem"]): number | undefined {
  if (donem?.yapim_yili) return Math.floor((donem.yapim_yili - 1) / 100) + 1;
  const m = donem?.metin?.tr.match(/\b(\d{1,2}|[IVX]+)\.\s*yüzyıl/);
  if (!m) return undefined;
  if (/^\d/.test(m[1])) return Number(m[1]);
  const deger: Record<string, number> = { I: 1, V: 5, X: 10 };
  return [...m[1]].reduce((t, c, i, a) => t + (deger[a[i + 1]] > deger[c] ? -deger[c] : deger[c]), 0);
}
