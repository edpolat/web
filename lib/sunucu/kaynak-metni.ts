// Kaynaktan metin çıkarma (YZ kaynak analizi için): PDF sayfa sayfa, web sayfası bölüm bölüm.
// Taranmış görüntüden metin çıkmaz (OCR kapsam dışı): o zaman "okunamadi" döner ve editör kaynağı kendisi inceler.
import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extractText, getDocumentProxy } from "unpdf";
import { EN_BUYUK_DOSYA, dosyaTuruBul } from "../kaynak";
import type { Sayfa } from "../yz";

export type CikanMetin = { durum: "tamam"; sayfali: boolean; sayfalar: Sayfa[] } | { durum: "okunamadi"; neden: string };

/** Sayfa başına ortalama bu kadar harften azı varsa metin katmanı yok sayılır (taranmış görüntü). */
const EN_AZ_HARF = 40;

export async function pdfSayfalari(baytlar: Uint8Array): Promise<CikanMetin> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(baytlar));
    const { text } = await extractText(pdf, { mergePages: false });
    const sayfalar = text.map((metin, i) => ({ sayfa: i + 1, metin: metin.replace(/[ \t]+/g, " ").trim() }));
    const harf = sayfalar.reduce((n, s) => n + (s.metin.match(/\p{L}/gu)?.length ?? 0), 0);
    if (harf < EN_AZ_HARF * Math.max(1, Math.min(sayfalar.length, 3))) return { durum: "okunamadi", neden: "PDF'te metin katmanı yok (taranmış görüntü olabilir)." };
    return { durum: "tamam", sayfali: true, sayfalar };
  } catch {
    return { durum: "okunamadi", neden: "PDF açılamadı." };
  }
}

const VARLIK: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** HTML'den görünen metni çıkarır ve ~4000 harflik bölümlere ayırır (web sayfasının sayfa numarası yok). */
export function htmlSayfalari(html: string, bolum = 4000): CikanMetin {
  const metin = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (t, v: string) =>
      v[0] === "#" ? String.fromCodePoint(v[1] === "x" || v[1] === "X" ? parseInt(v.slice(2), 16) : Number(v.slice(1))) : (VARLIK[v.toLowerCase()] ?? t),
    )
    .replace(/[ \t\r\f]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  if ((metin.match(/\p{L}/gu)?.length ?? 0) < EN_AZ_HARF) return { durum: "okunamadi", neden: "Sayfada okunabilir metin yok." };
  const sayfalar: Sayfa[] = [];
  for (let i = 0, n = 1; i < metin.length; n++) {
    let son = Math.min(metin.length, i + bolum);
    if (son < metin.length) {
      const kes = metin.lastIndexOf("\n", son);
      if (kes > i + bolum / 2) son = kes;
    }
    sayfalar.push({ sayfa: n, metin: metin.slice(i, son).trim() });
    i = son;
  }
  return { durum: "tamam", sayfali: false, sayfalar };
}

/** Sunucunun kendi ağına (localhost, iç IP) istek atılmasın: herkesin girebildiği bağlantılar indirilir. */
export function icAdresMi(ip: string): boolean {
  if (isIP(ip) === 6) {
    const k = ip.toLowerCase();
    if (k.startsWith("::ffff:")) return icAdresMi(k.slice(7));
    return k === "::1" || k === "::" || k.startsWith("fc") || k.startsWith("fd") || k.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function adresGuvenli(url: URL): Promise<boolean> {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
  const ad = url.hostname.replace(/^\[|\]$/g, "");
  if (ad === "localhost" || ad.endsWith(".local") || ad.endsWith(".internal")) return false;
  try {
    const adresler = isIP(ad) ? [{ address: ad }] : await lookup(ad, { all: true });
    return adresler.length > 0 && adresler.every((x) => !icAdresMi(x.address));
  } catch {
    return false;
  }
}

/** Bağlantıyı indirir (en çok 3 yönlendirme, 15 sn, 10 MB) ve türüne göre metnini çıkarır. */
export async function baglantiMetni(adres: string): Promise<CikanMetin> {
  let url: URL;
  try {
    url = new URL(adres);
  } catch {
    return { durum: "okunamadi", neden: "Bağlantı geçersiz." };
  }
  for (let yonlendirme = 0; yonlendirme <= 3; yonlendirme++) {
    if (!(await adresGuvenli(url))) return { durum: "okunamadi", neden: "Bu bağlantı açılamaz." };
    let yanit: Response;
    try {
      yanit = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { "user-agent": "Vakfiye/1.0 (kaynak inceleme)" } });
    } catch {
      return { durum: "okunamadi", neden: "Bağlantıya ulaşılamadı." };
    }
    if (yanit.status >= 300 && yanit.status < 400 && yanit.headers.get("location")) {
      url = new URL(yanit.headers.get("location")!, url);
      continue;
    }
    if (!yanit.ok) return { durum: "okunamadi", neden: `Bağlantı açılmadı (${yanit.status}).` };
    const baytlar = await sinirliOku(yanit);
    if (!baytlar) return { durum: "okunamadi", neden: "Sayfa 10 MB'tan büyük." };
    if (dosyaTuruBul(baytlar) === "application/pdf") return pdfSayfalari(baytlar);
    const tur = yanit.headers.get("content-type") ?? "";
    if (!/html|text\/plain|xml/i.test(tur)) return { durum: "okunamadi", neden: "Bağlantı metin ya da PDF değil." };
    const yazi = new TextDecoder().decode(baytlar);
    return /html|xml/i.test(tur) ? htmlSayfalari(yazi) : htmlSayfalari(yazi.replace(/</g, " "));
  }
  return { durum: "okunamadi", neden: "Çok fazla yönlendirme." };
}

async function sinirliOku(yanit: Response): Promise<Uint8Array | null> {
  if (Number(yanit.headers.get("content-length") ?? 0) > EN_BUYUK_DOSYA) return null;
  const okuyucu = yanit.body?.getReader();
  if (!okuyucu) return new Uint8Array();
  const parcalar: Uint8Array[] = [];
  let boyut = 0;
  for (;;) {
    const { done, value } = await okuyucu.read();
    if (done) break;
    boyut += value.length;
    if (boyut > EN_BUYUK_DOSYA) {
      await okuyucu.cancel();
      return null;
    }
    parcalar.push(value);
  }
  const hepsi = new Uint8Array(boyut);
  let i = 0;
  for (const p of parcalar) {
    hepsi.set(p, i);
    i += p.length;
  }
  return hepsi;
}

/** Yüklenen dosyanın metni: PDF ise sayfa sayfa, görsel (JPG/PNG) ise okunamadı. */
export async function dosyaMetni(baytlar: Uint8Array): Promise<CikanMetin> {
  if (dosyaTuruBul(baytlar) === "application/pdf") return pdfSayfalari(baytlar);
  return { durum: "okunamadi", neden: "Dosya bir görsel; metin okunamadı (OCR yok)." };
}
