// Geliştirme ortamı için tek şifreli yönetim girişi (VAKFIYE_YONETIM_SIFRESI, yoksa "vakfiye"). Girişte imzalı çerez verilir.
// Yayında kapalıdır: panele herkes kendi hesabıyla girer (lib/sunucu/kimlik.ts, lib/yetki.ts).
import crypto from "node:crypto";

export const CEREZ = "vakfiye_yonetim";

/** Geliştirmede şifre tanımlı değilse "vakfiye" kabul edilir; yayında şifreli giriş kapalıdır. */
export function yonetimSifresi(): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  return process.env.VAKFIYE_YONETIM_SIFRESI || "vakfiye";
}

/** Çerez değeri şifreden türetilir: şifre değişince eski girişler geçersiz olur. */
export function jeton(sifre: string): string {
  return crypto.createHmac("sha256", sifre).update("vakfiye-yonetim").digest("hex");
}

function ayni(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function sifreDogru(girilen: unknown, sifre = yonetimSifresi()): boolean {
  return typeof girilen === "string" && !!sifre && ayni(jeton(girilen), jeton(sifre));
}

export function jetonGecerli(cerez: string | undefined, sifre = yonetimSifresi()): boolean {
  return !!cerez && !!sifre && ayni(cerez, jeton(sifre));
}
