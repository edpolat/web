import type { CokDilli, Dil } from "./tipler";

export const DILLER: Dil[] = ["tr", "en"];

export function gecerliDil(d: string): d is Dil {
  return (DILLER as string[]).includes(d);
}

/** İstenen dildeki metni verir; yoksa Türkçeye düşer. */
export function metin(m: CokDilli | undefined, dil: Dil): string {
  if (!m) return "";
  return m[dil] ?? m.tr;
}

/** Metin istenen dilde yoksa true (arayüz "Türkçe gösteriliyor" notu için). */
export function ceviriEksik(m: CokDilli | undefined, dil: Dil): boolean {
  return !!m && dil !== "tr" && !m[dil];
}

const SIRALAYICI = new Intl.Collator("tr");

/** Eser adlarını alfabetik karşılaştırır; baştaki "(Başarakavak) " gibi parantez yok sayılır. */
export function adSirala(a: string, b: string): number {
  const anahtar = (s: string) => s.replace(/^\s*\([^)]*\)\s*/, "");
  return SIRALAYICI.compare(anahtar(a), anahtar(b)) || SIRALAYICI.compare(a, b);
}
