// Ziyaretçinin gezi planları (mobil uygulamadan, 2-3 Kas 2026): "Gitmek istediklerim" listesi ve
// kendi kurduğu "Rotalarım". İkisi de bu tarayıcıda saklanır. Rotalar giriş yapılmışsa Supabase "rotalar"
// tablosuyla eşitlenir (uygulamayla aynı tablo ve aynı birleştirme kuralı; supabase/018_rotalar.sql).

export const PLAN_OLAYI = "vakfiye-plan";
/** Google Haritalar yol tarifi en çok 10 nokta alıyor. */
export const ROTAM_EN_COK = 10;

const GITMEK = "vakfiye:gitmek";
const ROTALAR = "vakfiye:rotalarim";
const SILINEN = "vakfiye:rotalarimSilinen";

export type Rotam = { id: string; ad: string; eserler: string[]; guncelleme?: string };
export type SilinenRota = { id: string; guncelleme?: string };
/** Supabase "rotalar" satırı. */
export type BulutRotasi = { id: string; ad: string; eserler: string[]; silindi: boolean; guncelleme: string };

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
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PLAN_OLAYI));
}

/* ---------- Gitmek istediklerim ---------- */

export function gitmekListesi(): string[] {
  const l = oku<unknown>(GITMEK, []);
  return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string") : [];
}

/** Eseri listeye ekler ya da çıkarır; yeni durumu (listede mi) döndürür. Yeni eklenen başa gelir. */
export function gitmekDegistir(id: string): boolean {
  const l = gitmekListesi();
  const i = l.indexOf(id);
  if (i >= 0) l.splice(i, 1);
  else l.unshift(id);
  yaz(GITMEK, l);
  return i < 0;
}

/* ---------- Rotalarım ---------- */

export function rotalarim(): Rotam[] {
  const l = oku<unknown>(ROTALAR, []);
  return Array.isArray(l) ? (l as Rotam[]).filter((r) => r && typeof r.id === "string" && Array.isArray(r.eserler)) : [];
}
export function silinenRotalar(): SilinenRota[] {
  const l = oku<unknown>(SILINEN, []);
  return Array.isArray(l) ? (l as SilinenRota[]) : [];
}
export function rotalarimiYaz(rotalar: Rotam[], silinenler: SilinenRota[] = silinenRotalar()) {
  try {
    localStorage.setItem(SILINEN, JSON.stringify(silinenler));
  } catch {}
  yaz(ROTALAR, rotalar);
}

const simdi = () => new Date().toISOString();

/** Yeni rota kaydeder ya da var olanı günceller; kaydedilen rotayı döndürür. */
export function rotamiKaydet(taslak: { id?: string | null; ad: string; eserler: string[] }): Rotam {
  const l = rotalarim();
  const eski = taslak.id ? l.find((r) => r.id === taslak.id) : undefined;
  const rota: Rotam = {
    id: eski?.id ?? `r${Date.now().toString(36)}`,
    ad: taslak.ad.trim(),
    eserler: taslak.eserler.slice(0, ROTAM_EN_COK),
    guncelleme: simdi(),
  };
  rotalarimiYaz(eski ? l.map((r) => (r.id === rota.id ? rota : r)) : [...l, rota]);
  return rota;
}

export function rotamiSil(id: string) {
  const silinenler = silinenRotalar().filter((s) => s.id !== id);
  silinenler.push({ id, guncelleme: simdi() });
  rotalarimiYaz(
    rotalarim().filter((r) => r.id !== id),
    silinenler,
  );
}

/** Eseri rotanın sonuna ekler; eklendiyse true. */
export function rotayaEkle(rotaId: string, eserId: string): boolean {
  const l = rotalarim();
  const rota = l.find((r) => r.id === rotaId);
  if (!rota || rota.eserler.includes(eserId) || rota.eserler.length >= ROTAM_EN_COK) return false;
  rota.eserler = [...rota.eserler, eserId];
  rota.guncelleme = simdi();
  rotalarimiYaz(l);
  return true;
}

/**
 * Yereldeki rotalarla hesaptakileri birleştirir (uygulamadaki rotalariEsitle ile aynı kural):
 * aynı rotanın hangi kopyası daha yeni düzenlendiyse o kalır; silinen rota "silindi" işaretiyle tutulur ki
 * başka cihazdan geri gelmesin. Yereldeki sıra korunur, hesaptan yeni gelenler sona eklenir.
 */
export function rotalariBirlestir(
  yerel: Rotam[],
  silinenler: SilinenRota[],
  bulutta: BulutRotasi[],
  eserVarMi: (id: string) => boolean = () => true,
): { rotalar: Rotam[]; silinenler: SilinenRota[]; gonderilecek: BulutRotasi[] } {
  const zaman = (x?: { guncelleme?: string }) => (x?.guncelleme ? Date.parse(x.guncelleme) || 0 : 0);
  const yerelHal = new Map<string, BulutRotasi>();
  for (const r of yerel) yerelHal.set(r.id, { id: r.id, ad: r.ad, eserler: r.eserler, silindi: false, guncelleme: r.guncelleme ?? "" });
  for (const s of silinenler) {
    const y = yerelHal.get(s.id);
    if (!y || zaman(s) > zaman(y)) yerelHal.set(s.id, { id: s.id, ad: "", eserler: [], silindi: true, guncelleme: s.guncelleme ?? "" });
  }
  const sonuc = new Map(yerelHal);
  for (const b of bulutta) {
    const y = sonuc.get(b.id);
    if (!y || zaman(b) > zaman(y)) sonuc.set(b.id, b);
  }
  const gonderilecek: BulutRotasi[] = [];
  for (const y of yerelHal.values()) {
    const b = bulutta.find((x) => x.id === y.id);
    if (!b || zaman(y) > zaman(b)) gonderilecek.push({ ...y, guncelleme: y.guncelleme || simdi() });
  }
  const sira = [...yerel.map((r) => r.id), ...[...sonuc.keys()].filter((id) => !yerel.some((r) => r.id === id))];
  const rotalar = sira
    .map((id) => sonuc.get(id))
    .filter((r): r is BulutRotasi => !!r && !r.silindi)
    .map((r) => ({ id: r.id, ad: r.ad, eserler: (r.eserler ?? []).filter(eserVarMi), guncelleme: r.guncelleme }));
  return {
    rotalar,
    silinenler: [...sonuc.values()].filter((r) => r.silindi).map((r) => ({ id: r.id, guncelleme: r.guncelleme })),
    gonderilecek,
  };
}
