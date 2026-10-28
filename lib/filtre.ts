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

export function filtrele<T extends Suzulen>(eserler: T[], f: Filtre, dil: Dil): T[] {
  const aranan = f.ara ? sadelestir(f.ara.trim()) : "";
  return eserler.filter((e) => {
    if (f.il && e.il !== f.il) return false;
    if (f.tur && e.tur !== f.tur) return false;
    if (aranan) {
      const alanlar = [metin(e.ad, dil), e.ad.tr, e.ilce ?? "", e.banisi ?? ""];
      if (!alanlar.some((a) => sadelestir(a).includes(aranan))) return false;
    }
    return true;
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
