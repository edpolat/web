import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Ayarlar, Kaynak, Sergi, Vakif } from "../lib/tipler";
import { ilDosyasiHatalari, type Tanimlar } from "../lib/sunucu/dogrula";
import type { IlDosyasi } from "../lib/sunucu/konum";

// Onay kuyruğu il dosyasını yazmadan önce bu doğrulayıcıdan geçirir; mevcut veri de geçmeli.
const VERI = path.join(process.cwd(), "veri");
const oku = <T>(ad: string) => JSON.parse(fs.readFileSync(path.join(VERI, ad), "utf-8")) as T;
const iller = fs.readdirSync(path.join(VERI, "iller")).filter((d) => d.endsWith(".json")).map((d) => oku<IlDosyasi>(`iller/${d}`));
const tanimlar: Tanimlar = {
  ayarlar: oku<Ayarlar>("ayarlar.json"),
  kaynakIdleri: new Set(oku<Kaynak[]>("kaynaklar.json").map((k) => k.id)),
  vakifIdleri: new Set(oku<Vakif[]>("vakiflar.json").map((v) => v.id)),
  sergiIdleri: new Set(oku<Sergi[]>("sergiler.json").map((s) => s.id)),
  eserIdleri: new Set(iller.flatMap((d) => d.eserler.map((e) => e.id))),
};

describe("veri/iller", () => {
  it.each(iller.map((d) => [d.il.id, d] as const))("%s şemaya ve çapraz kontrollere uyar", (_ad, dosya) => {
    expect(ilDosyasiHatalari(dosya, tanimlar)).toEqual([]);
  });
});
