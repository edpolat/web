// Onay kuyruğunun kuralları: katkıyı denetleyip oluşturur, onaylanınca il dosyasına uygular, eski ve yeni hâli karşılaştırır.
// Dosya okuma/yazma yok; o iş lib/sunucu/kuyruk.ts'de.
import type { CokDilli, Eser, EserDegisikligi, Katki, KatkiTuru, Olgu } from "../tipler";
import { ilDosyasiHatalari, semaHatalari, type Tanimlar } from "./dogrula";
import type { IlDosyasi } from "./konum";

export class KatkiHatasi extends Error {
  constructor(mesaj: string, readonly ayrinti: string[] = []) {
    super(mesaj);
  }
}

export type Depo = { iller: IlDosyasi[]; tanimlar: Tanimlar };

const KIMLIK = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const gecerliKimlik = (s: unknown): s is string => typeof s === "string" && KIMLIK.test(s);

/**
 * Yönetim panelinde düzenlenebilen üst düzey alanlar. id ve gorseller düzenlemeyle değişmez.
 * olgular: yalnız mevcut bilgilerin metni düzeltilir ya da bilgi kaldırılır (olgulariDuzenle); kaynak, sayfa, kategori, durum korunur.
 */
export const DUZENLENEBILIR = [
  "ad", "tur", "ilce", "adres", "konum", "donem", "banisi", "mimar", "tarihce", "mimari", "olgular", "taslak",
] as const satisfies readonly (keyof Eser)[];

const HARFLER: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** "Hacı İvaz Paşa Camii" -> "haci-ivaz-pasa-camii" */
export function kimlikUret(ad: string): string {
  return (
    ad
      .toLocaleLowerCase("tr")
      .replace(/[çğıöşüâîû]/g, (h) => HARFLER[h])
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "eser"
  );
}

function eserBul(depo: Depo, id: string): { dosya: IlDosyasi; eser: Eser } | undefined {
  for (const dosya of depo.iller) {
    const eser = dosya.eserler.find((e) => e.id === id);
    if (eser) return { dosya, eser };
  }
}

/** Anahtar sırasından bağımsız JSON karşılaştırması: formdan gelen nesne dosyadakiyle aynıysa değişiklik sayılmaz. */
function sirali(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(sirali);
  if (typeof x === "object" && x !== null) {
    return Object.fromEntries(Object.keys(x).sort().map((k) => [k, sirali((x as Record<string, unknown>)[k])]));
  }
  return x;
}
export const esit = (a: unknown, b: unknown) => JSON.stringify(sirali(a ?? null)) === JSON.stringify(sirali(b ?? null));
const nesne = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const yazi = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : undefined);

/**
 * Eser formundan gelen bilgi listesi: eserdeki olgularla aynı sırada, her öğe { metin: { tr, en? } } ya da null (kaldır).
 * Yalnız metin değişir; diğer alanlar eserdeki hâlinden alınır. Boşluk farkı değişiklik sayılmaz.
 * İngilizce değiştiyse "YZ çevirisi" işareti düşer.
 */
export function olgulariDuzenle(mevcut: Olgu[], gelen: unknown): Olgu[] {
  if (!Array.isArray(gelen) || gelen.length !== mevcut.length) {
    throw new KatkiHatasi("Bilgi listesi eserin şu anki hâliyle uyuşmuyor; sayfayı yenileyip yeniden dene.");
  }
  const sonuc: Olgu[] = [];
  gelen.forEach((g, i) => {
    if (g === null) return;
    const o = mevcut[i];
    const m = nesne(g) && nesne(g.metin) ? g.metin : {};
    const tr = yazi(m.tr);
    if (!tr) throw new KatkiHatasi(`${i + 1}. bilginin Türkçe metni boş olamaz; bilgiyi silmek için "kaldır"ı işaretle.`);
    const en = yazi(m.en);
    const eskiEn = o.metin.en?.trim();
    const metin: CokDilli = { tr: tr === o.metin.tr.trim() ? o.metin.tr : tr, ...(en ? { en: en === eskiEn ? o.metin.en! : en } : {}) };
    const yeni: Olgu = { ...o, metin };
    if (en !== eskiEn) delete yeni.en_ceviri;
    sonuc.push(yeni);
  });
  return sonuc;
}

type Secenekler = { yonetici: boolean; simdi: Date; ek: string };

/**
 * Gelen isteği kuyruk kaydına çevirir. Kaynaksız, şemaya uymayan ya da onaylansa il dosyasını
 * bozacak katkıyı KatkiHatasi ile reddeder. Yönetici olmayan yalnız "olgu" gönderebilir.
 */
export function katkiOlustur(istek: unknown, depo: Depo, { yonetici, simdi, ek }: Secenekler): Katki {
  if (!nesne(istek)) throw new KatkiHatasi("Geçersiz istek.");
  const tur = istek.tur as KatkiTuru;
  if (tur !== "olgu" && tur !== "eser_ekle" && tur !== "eser_duzenle") throw new KatkiHatasi("Bilinmeyen katkı türü.");
  if (tur !== "olgu" && !yonetici) throw new KatkiHatasi("Eser ekleme ve düzenleme için yönetim girişi gerekir.");

  const kaynak_id = yazi(istek.kaynak_id);
  if (!kaynak_id) throw new KatkiHatasi("Kaynak seçilmeden gönderilemez.");
  if (!depo.tanimlar.kaynakIdleri.has(kaynak_id)) throw new KatkiHatasi(`Kaynak '${kaynak_id}' tanımlı değil.`);
  const ekleyen = yazi(istek.ekleyen);
  if (!ekleyen) throw new KatkiHatasi("Ekleyenin adı gerekli.");

  const katki: Katki = {
    id: `${simdi.toISOString().slice(0, 10).replaceAll("-", "")}-${ek}`,
    tur,
    eser_id: "",
    il: "",
    nereden: istek.nereden === "uygulama" ? "uygulama" : "web",
    ekleyen,
    kaynak_id,
    durum: "bekliyor",
    gonderildi: simdi.toISOString(),
  };
  const sayfa = yazi(istek.sayfa);
  if (sayfa) katki.sayfa = sayfa;
  const not = yazi(istek.not);
  if (not) katki.not = not;

  if (tur === "olgu" || tur === "eser_duzenle") {
    const bulunan = gecerliKimlik(istek.eser_id) ? eserBul(depo, istek.eser_id) : undefined;
    if (!bulunan) throw new KatkiHatasi("Eser bulunamadı.");
    katki.eser_id = bulunan.eser.id;
    katki.il = bulunan.dosya.il.id;
    if (tur === "olgu") {
      const o = nesne(istek.olgu) ? istek.olgu : {};
      katki.olgu = { metin: o.metin as CokDilli, kategori: o.kategori as string };
    } else {
      if (!nesne(istek.degisiklik)) throw new KatkiHatasi("Değişiklik eksik.");
      const degisiklik: Record<string, unknown> = {};
      const onceki: Record<string, unknown> = {};
      const mevcut = bulunan.eser as Record<string, unknown>;
      for (const alan of DUZENLENEBILIR) {
        if (!(alan in istek.degisiklik)) continue;
        const yeni = alan === "olgular" ? olgulariDuzenle(bulunan.eser.olgular ?? [], istek.degisiklik[alan]) : istek.degisiklik[alan];
        if (esit(yeni, mevcut[alan])) continue;
        degisiklik[alan] = yeni ?? null;
        onceki[alan] = mevcut[alan] ?? null;
      }
      if (!Object.keys(degisiklik).length) throw new KatkiHatasi("Değişen alan yok.");
      katki.degisiklik = degisiklik as EserDegisikligi;
      katki.onceki = onceki as EserDegisikligi;
    }
  } else {
    const dosya = depo.iller.find((d) => d.il.id === istek.il);
    if (!dosya) throw new KatkiHatasi("Şehir bulunamadı.");
    const yeni = nesne(istek.degisiklik) ? istek.degisiklik : {};
    const ad = nesne(yeni.ad) ? yazi(yeni.ad.tr) : undefined;
    if (!ad) throw new KatkiHatasi("Eserin Türkçe adı gerekli.");
    let id = kimlikUret(ad);
    for (let n = 2; eserBul(depo, id); n++) id = `${kimlikUret(ad)}-${n}`;
    const eser: Record<string, unknown> = { id };
    for (const alan of DUZENLENEBILIR) if (alan !== "olgular" && yeni[alan] !== undefined && yeni[alan] !== null) eser[alan] = yeni[alan];
    eser.olgular = [];
    eser.envanter = { kaynak_id, ...(sayfa ? { sayfa } : {}) };
    katki.eser_id = id;
    katki.il = dosya.il.id;
    katki.degisiklik = eser as EserDegisikligi;
  }

  const semaHata = semaHatalari("katki", katki);
  if (semaHata.length) throw new KatkiHatasi("Katkı şemaya uymuyor.", semaHata);
  if (katki.olgu && !depo.tanimlar.ayarlar.olgu_kategorileri.some((k) => k.id === katki.olgu!.kategori)) {
    throw new KatkiHatasi(`Kategori '${katki.olgu.kategori}' tanımlı değil.`);
  }
  // Onaylansaydı il dosyası geçerli kalır mıydı? Bozacaksa şimdiden reddet.
  denetleVeUygula(kopya(depo.iller.find((d) => d.il.id === katki.il)!), katki, depo.tanimlar);
  return katki;
}

const kopya = <T>(x: T): T => structuredClone(x);

/** Onaylanan olgunun il dosyasına yazılan hâli. */
export function olguYap(k: Katki): Olgu {
  return { metin: k.olgu!.metin, kategori: k.olgu!.kategori, durum: "kaynakli", kaynak_id: k.kaynak_id, ...(k.sayfa ? { sayfa: k.sayfa } : {}) };
}

/** Katkıyı il dosyasına uygular (dosyayı değiştirir). */
export function uygula(dosya: IlDosyasi, k: Katki): void {
  if (dosya.il.id !== k.il) throw new KatkiHatasi("Katkı bu şehre ait değil.");
  if (k.tur === "eser_ekle") {
    if (dosya.eserler.some((e) => e.id === k.eser_id)) throw new KatkiHatasi(`'${k.eser_id}' kimlikli eser zaten var.`);
    dosya.eserler.push(k.degisiklik as Eser);
    return;
  }
  const eser = dosya.eserler.find((e) => e.id === k.eser_id);
  if (!eser) throw new KatkiHatasi("Eser artık yok.");
  if (k.tur === "olgu") {
    eser.olgular.push(olguYap(k));
    return;
  }
  const hedef = eser as Record<string, unknown>;
  for (const [alan, deger] of Object.entries(k.degisiklik ?? {})) {
    if (!(DUZENLENEBILIR as readonly string[]).includes(alan)) continue;
    if (deger === null) delete hedef[alan];
    else hedef[alan] = deger;
  }
}

/** Uygular ve sonucun il şemasına ve çapraz kontrollere uyduğunu doğrular; uymazsa KatkiHatasi. */
export function denetleVeUygula(dosya: IlDosyasi, k: Katki, t: Tanimlar): IlDosyasi {
  uygula(dosya, k);
  const eserIdleri = new Set([...t.eserIdleri, ...dosya.eserler.map((e) => e.id)]);
  const hatalar = ilDosyasiHatalari(dosya, { ...t, eserIdleri });
  if (hatalar.length) throw new KatkiHatasi("Değişiklik veri şemasına uymuyor.", hatalar);
  return dosya;
}

export type Fark = { alan: string; eski: unknown; yeni: unknown; araDegisti?: boolean };

/** Onay ekranı için alan alan eski ve yeni değer. eski, verinin şu anki hâlidir. */
export function farklar(k: Katki, mevcut: Eser | undefined): Fark[] {
  if (k.tur === "olgu") return [{ alan: "olgular", eski: undefined, yeni: olguYap(k) }];
  const simdiki = (mevcut ?? {}) as Record<string, unknown>;
  return Object.entries(k.degisiklik ?? {})
    .filter(([alan]) => alan !== "id" && alan !== "olgular")
    .map(([alan, yeni]) => ({
      alan,
      eski: k.tur === "eser_ekle" ? undefined : simdiki[alan],
      yeni: yeni ?? undefined,
      // Gönderildikten sonra alan başka bir onayla değiştiyse onaylayan uyarılır.
      araDegisti: k.tur === "eser_duzenle" && !esit(k.onceki?.[alan as keyof Eser], simdiki[alan]),
    }));
}
