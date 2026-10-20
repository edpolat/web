// Sunucuya yazılacak her kaydı sema/ ile ve araclar/dogrula.py'deki çapraz kontrollerle denetler.
import fs from "node:fs";
import path from "node:path";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";
import type { Ayarlar, Eser } from "../tipler";
import type { IlDosyasi } from "./konum";

let derlenmis: { il: ValidateFunction; katki: ValidateFunction } | undefined;

function semalar() {
  if (derlenmis) return derlenmis;
  const klasor = path.join(process.cwd(), "sema");
  // Tarih biçimleri sunucuda üretilir; biçim denetimi için ek paket gerekmesin.
  const ajv = new Ajv2020({ allErrors: true, validateFormats: false });
  for (const ad of fs.readdirSync(klasor).filter((d) => d.endsWith(".schema.json"))) {
    ajv.addSchema(JSON.parse(fs.readFileSync(path.join(klasor, ad), "utf-8")));
  }
  derlenmis = { il: ajv.getSchema("il.schema.json")!, katki: ajv.getSchema("katki.schema.json")! };
  return derlenmis;
}

function hataMetni(v: ValidateFunction): string[] {
  return (v.errors ?? []).map((h) => `${h.instancePath || "(kök)"}: ${h.message ?? "geçersiz"}`);
}

export function semaHatalari(tur: "il" | "katki", veri: unknown): string[] {
  const v = semalar()[tur];
  return v(veri) ? [] : hataMetni(v);
}

/** Şemanın göremediği bağlar: tür, durum, kategori ve kaynak/vakıf/sergi/külliye kimlikleri tanımlı mı. */
export type Tanimlar = {
  ayarlar: Ayarlar;
  kaynakIdleri: Set<string>;
  vakifIdleri: Set<string>;
  sergiIdleri: Set<string>;
  /** Bütün illerdeki eser kimlikleri (külliye bağı için). */
  eserIdleri: Set<string>;
};

export function eserHatalari(e: Eser, t: Tanimlar): string[] {
  const h: string[] = [];
  const on = e.id;
  if (!t.ayarlar.eser_turleri.some((x) => x.id === e.tur)) h.push(`${on}: tür '${e.tur}' tanımsız`);
  if (e.vakif_id && !t.vakifIdleri.has(e.vakif_id)) h.push(`${on}: vakıf '${e.vakif_id}' tanımsız`);
  if (e.kulliye_id && !t.eserIdleri.has(e.kulliye_id)) h.push(`${on}: külliye '${e.kulliye_id}' tanımsız`);
  for (const s of e.sergi_idleri ?? []) if (!t.sergiIdleri.has(s)) h.push(`${on}: sergi '${s}' tanımsız`);
  const kaynaklar = [
    ...e.olgular.map((o) => o.kaynak_id),
    ...(e.gorseller ?? []).map((g) => g.kaynak_id),
    e.envanter?.kaynak_id,
  ];
  for (const k of kaynaklar) if (k && !t.kaynakIdleri.has(k)) h.push(`${on}: kaynak '${k}' tanımsız`);
  e.olgular.forEach((o, i) => {
    if (!t.ayarlar.olgu_durumlari.some((x) => x.id === o.durum)) h.push(`${on}: olgu ${i} durumu '${o.durum}' tanımsız`);
    if (!t.ayarlar.olgu_kategorileri.some((x) => x.id === o.kategori)) h.push(`${on}: olgu ${i} kategorisi '${o.kategori}' tanımsız`);
  });
  return h;
}

/** İl dosyasının tamamı yazılmaya uygun mu: şema + çapraz kontrol + dosya içinde tekil kimlik. */
export function ilDosyasiHatalari(d: IlDosyasi, t: Tanimlar): string[] {
  const h = semaHatalari("il", d);
  if (h.length) return h;
  const gorulen = new Set<string>();
  for (const e of d.eserler) {
    if (gorulen.has(e.id)) h.push(`${e.id}: kimlik iki kez kullanılmış`);
    gorulen.add(e.id);
    h.push(...eserHatalari(e, t));
  }
  return h;
}
