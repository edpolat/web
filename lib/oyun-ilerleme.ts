// Oyunun ilerlemesini (yıldızlar, leveller, albüm...) iki cihaz arasında birleştirme kuralı.
// Oyun ilerlemeyi "vakfiye.ilerleme" anahtarıyla kaydeder (vakfiye-game src/ayarlar.ts, tip Ilerleme).
// Giriş yapmış oyuncunun kaydı Supabase "oyun_kayitlari" tablosunda da durur (supabase/022_oyun_kayitlari.sql);
// web ve mobil uygulama açılışta buluttaki kayıtla cihazdakini bu kurala göre birleştirir.
// Kural "hiçbir şey kaybolmasın": sayılarda büyük olan, listelerde birleşim, levellerde en iyi yıldız,
// son oyun daha çok oyun oynanmış taraftan. Bilinmeyen alanlar korunur (oyun yeni alan eklerse silinmesin).
// Mobil uygulamadaki karşılığı: notlar/feyza/oyun-kaydi-notu.md içindeki ilerlemeleriBirlestir (aynı kural).

export const ILERLEME_ANAHTARI = "vakfiye.ilerleme";

type Kayit = Record<string, unknown>;

const SAYILAR = ["toplamYildiz", "oynananOyun", "enIyiYil", "dogruCevap", "afetDogru"] as const;
const LISTELER = ["album", "okunan", "sorulan", "afetSorulan"] as const;

const nesneMi = (d: unknown): d is Kayit => typeof d === "object" && d !== null && !Array.isArray(d);
const sayi = (d: unknown) => (typeof d === "number" && Number.isFinite(d) ? d : 0);
const liste = (d: unknown) => (Array.isArray(d) ? d.filter((x): x is string => typeof x === "string") : []);

export function ilerlemeleriBirlestir(a: unknown, b: unknown): Kayit {
  const x = nesneMi(a) ? a : {};
  const y = nesneMi(b) ? b : {};
  const sonuc: Kayit = { ...y, ...x };
  for (const k of SAYILAR) if (k in x || k in y) sonuc[k] = Math.max(sayi(x[k]), sayi(y[k]));
  for (const k of LISTELER) if (k in x || k in y) sonuc[k] = [...new Set([...liste(x[k]), ...liste(y[k])])];
  if ("ogreticiBitti" in x || "ogreticiBitti" in y) sonuc.ogreticiBitti = x.ogreticiBitti === true || y.ogreticiBitti === true;
  if ("leveller" in x || "leveller" in y) {
    const lx = nesneMi(x.leveller) ? x.leveller : {};
    const ly = nesneMi(y.leveller) ? y.leveller : {};
    const lv: Record<string, number> = {};
    for (const no of new Set([...Object.keys(lx), ...Object.keys(ly)])) lv[no] = Math.max(sayi(lx[no]), sayi(ly[no]));
    sonuc.leveller = lv;
  }
  if ("sonOyun" in x || "sonOyun" in y) {
    // Daha çok oyun oynanmış tarafın son oyunu daha yenidir; eşitse cihazdaki (a) kalır.
    const yDahaYeni = sayi(y.oynananOyun) > sayi(x.oynananOyun);
    sonuc.sonOyun = (yDahaYeni ? y.sonOyun : x.sonOyun) ?? x.sonOyun ?? y.sonOyun ?? null;
  }
  return sonuc;
}

// Anahtar sırasından bağımsız metin: {a,b} ile {b,a} aynı sayılsın.
function siraliMetin(d: unknown): string {
  if (Array.isArray(d)) return `[${d.map(siraliMetin).join(",")}]`;
  if (nesneMi(d))
    return `{${Object.keys(d)
      .filter((k) => d[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${siraliMetin(d[k])}`)
      .join(",")}}`;
  return JSON.stringify(d ?? null);
}

/** İki kayıt aynı mı (birleştirme sonrası "bir şey değişti mi" sorusu için). */
export function ayniMi(a: unknown, b: unknown): boolean {
  return siraliMetin(a) === siraliMetin(b);
}
