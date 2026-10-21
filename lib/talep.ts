// Mobil uygulamadan gelen eser talepleri: satır biçimi (sunucu katmanı lib/sunucu/talep-depo.ts).

export type TalepSatiri = {
  id: string;
  eser_id: string;
  eser_adi: string | null;
  bilgi: string | null;
  kullanici: string | null;
  gonderen_ad: string | null;
  foto_yollari: string[];
  kaynak: string | null;
  durum: "bekliyor" | "kabul" | "reddedildi";
  olusturuldu: string;
  /** Fotoğrafların 10 dakikalık bağlantıları (okunamayan atlanır). */
  fotolar: string[];
};

/** Feyza'nın tablosundaki küçük biçim farklarını (jsonb dizi, created_at) tek biçime çevirir. */
export function talepSatiri(x: Record<string, unknown>): Omit<TalepSatiri, "fotolar"> {
  const yazi = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const yollar = Array.isArray(x.foto_yollari) ? x.foto_yollari.filter((y): y is string => typeof y === "string" && y !== "") : [];
  const durum = x.durum === "kabul" || x.durum === "reddedildi" ? x.durum : "bekliyor";
  return {
    id: String(x.id),
    eser_id: String(x.eser_id ?? ""),
    eser_adi: yazi(x.eser_adi),
    bilgi: yazi(x.bilgi),
    kullanici: yazi(x.kullanici),
    gonderen_ad: yazi(x.gonderen_ad),
    foto_yollari: yollar.slice(0, 3),
    kaynak: yazi(x.kaynak),
    durum,
    olusturuldu: String(x.olusturuldu ?? x.created_at ?? new Date(0).toISOString()),
  };
}
