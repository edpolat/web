// Sunucu tarafında veri/ klasörünü okur. Şehirler veri/iller/*.json dosyalarından keşfedilir;
// yeni şehir eklemek için kod değiştirmek gerekmez.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Ayarlar, Eser, Il, IlliEser, KesifEseri, Kaynak, Rota, Sergi, Vakif } from "./tipler";

const VERI = path.join(process.cwd(), "veri");

function oku<T>(dosya: string): T {
  return JSON.parse(fs.readFileSync(path.join(VERI, dosya), "utf-8")) as T;
}

/** Taslak eserler geliştirme ortamında görünür, yayında gizlenir. */
const taslakGoster = process.env.NODE_ENV !== "production" || process.env.VAKFIYE_TASLAK === "1";

export function ayarlar(): Ayarlar {
  return oku<Ayarlar>("ayarlar.json");
}

export function iller(): { il: Il; eserler: Eser[] }[] {
  return fs
    .readdirSync(path.join(VERI, "iller"))
    .filter((d) => d.endsWith(".json"))
    .sort()
    .map((d) => oku<{ il: Il; eserler: Eser[] }>(path.join("iller", d)));
}

export function tumEserler(): IlliEser[] {
  return iller().flatMap(({ il, eserler }) =>
    eserler.filter((e) => taslakGoster || !e.taslak).map((e) => ({ ...e, il: il.id })),
  );
}

/** Keşfet sayfasının kartları: fotoğraflı eserler önce, sonra ada göre. */
export function kesifEserleri(): KesifEseri[] {
  return tumEserler()
    .map((e) => ({
      id: e.id,
      il: e.il,
      ad: e.ad,
      tur: e.tur,
      ilce: e.ilce,
      banisi: e.banisi,
      konum: e.konum,
      yil: e.donem?.yapim_yili,
      gorsel: e.gorseller?.[0] && { dosya: e.gorseller[0].dosya, alt: e.gorseller[0].alt },
      gorselSayisi: e.gorseller?.length ?? 0,
      kaynakliSayisi: e.olgular.filter((o) => o.durum === "kaynakli").length,
    }))
    .sort((a, b) => Number(!!b.gorsel) - Number(!!a.gorsel) || a.ad.tr.localeCompare(b.ad.tr, "tr"));
}

export function eserBul(id: string): IlliEser | undefined {
  return tumEserler().find((e) => e.id === id);
}

export function kaynaklar(): Map<string, Kaynak> {
  return new Map(oku<Kaynak[]>("kaynaklar.json").map((k) => [k.id, k]));
}

export function sergiler(): Map<string, Sergi> {
  return new Map(oku<Sergi[]>("sergiler.json").map((s) => [s.id, s]));
}

export function vakiflar(): Map<string, Vakif> {
  return new Map(oku<Vakif[]>("vakiflar.json").map((v) => [v.id, v]));
}

export function rotalar(): Rota[] {
  return fs.existsSync(path.join(VERI, "rotalar.json")) ? oku<Rota[]>("rotalar.json") : [];
}
