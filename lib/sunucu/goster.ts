// Panelde bir eser alanının değerini okunacak düz metne çevirir (onay kuyruğu, inceleme, geçmiş).
import "server-only";
import { metin } from "../metin";
import type { Sozluk } from "../sozluk";
import type { CokDilli, Dil, Eser, Il, Kaynak, Olgu } from "../tipler";
import { ayarlar } from "../veri";

const cokDilliMi = (x: unknown): x is CokDilli => typeof x === "object" && x !== null && typeof (x as CokDilli).tr === "string";
const iki = (m: CokDilli) => (m.en ? `TR: ${m.tr}\nEN: ${m.en}` : m.tr);

/** Kuyruktaki bir alan değerini onaylayanın okuyacağı düz metne çevirir. */
export function goster(alan: string, x: unknown, dil: Dil, t: Sozluk, kaynakMap: Map<string, Kaynak>): string {
  if (x === undefined || x === null || x === "") return t.bos;
  const kaynakYazisi = (id?: string, sayfa?: string) =>
    id ? `${kaynakMap.get(id)?.baslik ?? id}${sayfa ? `, ${t.sayfa} ${sayfa}` : ""}` : "";
  const ay = ayarlar();
  // Rol atamasında veritabanı anahtarı (tarihci vb.) yerine ekrandaki rol adı.
  if (alan === "rol") return (t.panel.roller as Record<string, string>)[String(x)] ?? String(x);
  if (alan === "tur") return metin(ay.eser_turleri.find((y) => y.id === x)?.ad, dil) || String(x);
  if (alan === "olgular") {
    // Sürüm karşılaştırmasında alanın tamamı (dizi), eski kuyrukta tek bilgi gelir.
    if (Array.isArray(x)) return x.length ? x.map((y) => goster(alan, y, dil, t, kaynakMap)).join("\n\n") : t.bos;
    const o = x as Olgu;
    if (!cokDilliMi(o.metin)) return JSON.stringify(x, null, 2);
    const kategori = metin(ay.olgu_kategorileri.find((y) => y.id === o.kategori)?.ad, dil);
    return `${iki(o.metin)}\n[${kategori}] ${kaynakYazisi(o.kaynak_id, o.sayfa)}`;
  }
  if (alan === "donem") {
    const d = x as NonNullable<Eser["donem"]>;
    return [d.yapim_yili ? `${d.yaklasik ? `${t.yaklasik} ` : ""}${d.yapim_yili}` : "", d.metin ? iki(d.metin) : ""].filter(Boolean).join("\n");
  }
  if (alan === "mimari") {
    const m = x as NonNullable<Eser["mimari"]>;
    return [m.metin ? iki(m.metin) : "", m.plan ? `${t.plan}: ${m.plan}` : "", m.malzeme?.length ? `${t.malzeme}: ${m.malzeme.join(", ")}` : ""]
      .filter(Boolean)
      .join("\n") || t.bos;
  }
  if (alan === "il" && typeof x === "object" && "merkez" in x) {
    const i = x as Il;
    const u = t.ilPaneli;
    return [
      iki(i.ad),
      `${u.merkez}: ${i.merkez.enlem}, ${i.merkez.boylam}${i.yakinlastirma ? ` (${u.yakinlastirma.split(" (")[0]} ${i.yakinlastirma})` : ""}`,
      i.envanter_kaynak_id ? `${u.kitap.split(" (")[0]}: ${kaynakYazisi(i.envanter_kaynak_id)}` : "",
      i.envanter_yili ? `${u.yil}: ${i.envanter_yili}` : "",
      i.toplam_eser !== undefined ? `${u.toplam}: ${i.toplam_eser}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (alan === "konum") {
    const k = x as NonNullable<Eser["konum"]>;
    return `${k.enlem}, ${k.boylam}${k.hassasiyet ? ` (${t.pano.hassasiyetler[k.hassasiyet] ?? k.hassasiyet})` : ""}`;
  }
  if (alan === "envanter") {
    const e = x as NonNullable<Eser["envanter"]>;
    return kaynakYazisi(e.kaynak_id, e.sayfa) || t.bos;
  }
  if (typeof x === "boolean") return x ? t.evet : t.hayir;
  if (cokDilliMi(x)) return iki(x);
  return typeof x === "string" || typeof x === "number" ? String(x) : JSON.stringify(x, null, 2);
}

