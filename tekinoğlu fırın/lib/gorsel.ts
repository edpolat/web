/** Önizleme dosyası: "01.webp" → "01_kucuk.webp". Yoksa aynı dosya kullanılır. */
export function kucukGorsel(dosya: string): string {
  return dosya.endsWith(".webp") ? dosya.replace(/\.webp$/, "_kucuk.webp") : dosya;
}
