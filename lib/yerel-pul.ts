// Misafir ziyaretçinin pulları ve kâğıt pasaport bağı bu tarayıcıda saklanır (uygulamadaki kayitOku/kayitYaz gibi).
// Giriş yapınca Hesap bileşeni yerel pulları hesaba aktarır. Depolama kapalıysa sessizce boş döner.
const PUL = "vakfiye:pullar";
const KAGIT = "vakfiye:kagitBagli";
export const PUL_OLAYI = "vakfiye-pul";

function oku<T>(anahtar: string, varsayilan: T): T {
  try {
    const v = localStorage.getItem(anahtar);
    return v ? (JSON.parse(v) as T) : varsayilan;
  } catch {
    return varsayilan;
  }
}

function yaz(anahtar: string, deger: unknown) {
  try {
    localStorage.setItem(anahtar, JSON.stringify(deger));
  } catch {}
  window.dispatchEvent(new Event(PUL_OLAYI));
}

export function yerelPullar(): string[] {
  const p = oku<unknown>(PUL, []);
  return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
}

export function yerelPulEkle(id: string) {
  const p = yerelPullar();
  if (!p.includes(id)) yaz(PUL, [...p, id]);
}

export function kagitBagliMi(): boolean {
  return oku<boolean>(KAGIT, false) === true;
}

export function kagidiBagla() {
  yaz(KAGIT, true);
}

/** QR metnini çözer: "VAKFIYE:VK-…" kâğıt pasaport, "VAKFIYE:ESER:<id>" eser durağı. */
export function kodCoz(metin: string, pasaportNo: string): { tur: "kagit" } | { tur: "eser"; id: string } | null {
  const k = metin.trim();
  if (k === `VAKFIYE:${pasaportNo}`) return { tur: "kagit" };
  if (k.startsWith("VAKFIYE:ESER:")) {
    const id = k.slice("VAKFIYE:ESER:".length).trim();
    return id ? { tur: "eser", id } : null;
  }
  return null;
}
