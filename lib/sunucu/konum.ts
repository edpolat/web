// Konum düzenleme sayfasının kaydettiği konumu il dosyasına işler.
import type { Eser, Il, Konum } from "../tipler";

export type IlDosyasi = { il: Il; eserler: Eser[] };

/** Türkiye'yi kabaca çevreleyen kutu; yanlışlıkla okyanusa tıklanırsa kaydı reddeder. */
const SINIR = { enlem: [35.5, 42.5], boylam: [25.5, 45] } as const;

export class KonumHatasi extends Error {}

export function konumDenetle(enlem: unknown, boylam: unknown): { enlem: number; boylam: number } {
  if (typeof enlem !== "number" || typeof boylam !== "number" || !Number.isFinite(enlem) || !Number.isFinite(boylam)) {
    throw new KonumHatasi("Enlem ve boylam sayı olmalı.");
  }
  if (enlem < SINIR.enlem[0] || enlem > SINIR.enlem[1] || boylam < SINIR.boylam[0] || boylam > SINIR.boylam[1]) {
    throw new KonumHatasi("Konum Türkiye sınırları dışında.");
  }
  return { enlem: Math.round(enlem * 1e6) / 1e6, boylam: Math.round(boylam * 1e6) / 1e6 };
}

/** Eseri bulursa konumunu elle doğrulanmış olarak değiştirir ve yeni konumu döner, bulamazsa undefined. */
export function konumuYaz(dosya: IlDosyasi, id: string, enlem: number, boylam: number): Konum | undefined {
  const eser = dosya.eserler.find((e) => e.id === id);
  if (!eser) return undefined;
  eser.konum = { ...konumDenetle(enlem, boylam), dogrulandi: true, yontem: "elle", hassasiyet: "eser" };
  return eser.konum;
}
