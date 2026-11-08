// Sergiler sayfası: her sergi kartının üst şeridindeki eser fotoğrafını seçer (sunucu tarafı).
import "server-only";
import { adSirala } from "./metin";
import type { Eser, Il } from "./tipler";

/** Önce şehrin simge eseri (Keşfet'teki şehir kartlarıyla aynı, components/Kesif.tsx SEHIR_KAPAKLARI), sonra en çok fotoğraflı eserler. */
const SIMGE: Record<string, string> = {
  bursa: "emir-sultan-kulliyesi",
  hatay: "habib-i-neccar-camii-ve-kulliyesi-hatay",
  konya: "mevlana-turbesi-muze-konya",
};

export type SergiFotografi = { dosya: string; odak?: string; eser: string };

const anahtar = (x: string) => x.toLocaleLowerCase("tr").trim();

/**
 * Sergi kimliği → fotoğraf. Aynı fotoğraf iki kartta tekrar edilmez (kartlar verilen sırayla dağıtılır).
 * Sergi şehrinde fotoğraflı eser yoksa (ör. İstanbul) sergi adında geçen şehir denenir; o da yoksa fotoğraf verilmez.
 */
export function sergiFotograflari(
  sergiler: { id: string; sehir?: string | null; ad: { tr: string } }[],
  iller: { il: Il; eserler: Eser[] }[],
): Map<string, SergiFotografi> {
  const adaykar = new Map<string, Eser[]>();
  for (const { il, eserler } of iller) {
    const fotolu = eserler
      .filter((e) => !e.taslak && e.gorseller?.length)
      .sort(
        (a, b) =>
          Number(b.id === SIMGE[il.id]) - Number(a.id === SIMGE[il.id]) ||
          (b.gorseller?.length ?? 0) - (a.gorseller?.length ?? 0) ||
          adSirala(a.ad.tr, b.ad.tr),
      );
    if (fotolu.length) adaykar.set(anahtar(il.ad.tr), fotolu);
  }
  const kullanilan = new Set<string>();
  const sonuc = new Map<string, SergiFotografi>();
  for (const s of sergiler) {
    let adaylar = s.sehir ? adaykar.get(anahtar(s.sehir)) : undefined;
    if (!adaylar) {
      const ad = anahtar(s.ad.tr);
      adaylar = [...adaykar].find(([sehir]) => ad.includes(sehir))?.[1];
    }
    const eser = adaylar?.find((e) => !kullanilan.has(e.id)) ?? adaylar?.[0];
    const g = eser?.gorseller?.[0];
    if (!eser || !g) continue;
    kullanilan.add(eser.id);
    sonuc.set(s.id, { dosya: g.dosya, odak: g.odak, eser: eser.id });
  }
  return sonuc;
}
