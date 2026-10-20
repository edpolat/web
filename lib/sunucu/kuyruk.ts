// Onay kuyruğunun dosya katmanı. Her katkı veri/kuyruk/<id>.json dosyasıdır; onaylanınca veri/iller/<il>.json'a yazılır.
// Kuyruk ilk sürümde sunucudaki JSON dosyalarında durur; gerekirse aynı fonksiyonların arkasında veritabanına taşınır.
import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Ayarlar, Katki, Kaynak, Sergi, Vakif } from "../tipler";
import { KatkiHatasi, denetleVeUygula, gecerliKimlik, katkiOlustur, type Depo } from "./katki";
import type { IlDosyasi } from "./konum";

const VERI = path.join(process.cwd(), "veri");
const KUYRUK = path.join(VERI, "kuyruk");
const ILLER = path.join(VERI, "iller");

const oku = <T>(yol: string): T => JSON.parse(fs.readFileSync(yol, "utf-8")) as T;
const yaz = (yol: string, veri: unknown) => fs.writeFileSync(yol, JSON.stringify(veri, null, 2) + "\n", "utf-8");

export function depoOku(): Depo {
  const iller = fs
    .readdirSync(ILLER)
    .filter((d) => d.endsWith(".json"))
    .sort()
    .map((d) => oku<IlDosyasi>(path.join(ILLER, d)));
  return {
    iller,
    tanimlar: {
      ayarlar: oku<Ayarlar>(path.join(VERI, "ayarlar.json")),
      kaynakIdleri: new Set(oku<Kaynak[]>(path.join(VERI, "kaynaklar.json")).map((k) => k.id)),
      vakifIdleri: new Set(oku<Vakif[]>(path.join(VERI, "vakiflar.json")).map((v) => v.id)),
      sergiIdleri: new Set(oku<Sergi[]>(path.join(VERI, "sergiler.json")).map((s) => s.id)),
      eserIdleri: new Set(iller.flatMap((d) => d.eserler.map((e) => e.id))),
    },
  };
}

export function katkiEkle(istek: unknown, yonetici: boolean): Katki {
  const katki = katkiOlustur(istek, depoOku(), { yonetici, simdi: new Date(), ek: crypto.randomBytes(5).toString("hex") });
  fs.mkdirSync(KUYRUK, { recursive: true });
  yaz(path.join(KUYRUK, `${katki.id}.json`), katki);
  return katki;
}

export function katkiOku(id: string): Katki | undefined {
  if (!gecerliKimlik(id)) return undefined;
  const yol = path.join(KUYRUK, `${id}.json`);
  return fs.existsSync(yol) ? oku<Katki>(yol) : undefined;
}

/** Bekleyenler önce, sonra en yeni karar; her grupta en yeni üstte. */
export function katkilar(): Katki[] {
  if (!fs.existsSync(KUYRUK)) return [];
  return fs
    .readdirSync(KUYRUK)
    .filter((d) => d.endsWith(".json"))
    .map((d) => oku<Katki>(path.join(KUYRUK, d)))
    .sort((a, b) => {
      if ((a.durum === "bekliyor") !== (b.durum === "bekliyor")) return a.durum === "bekliyor" ? -1 : 1;
      const ta = a.karar?.tarih ?? a.gonderildi;
      const tb = b.karar?.tarih ?? b.gonderildi;
      return tb.localeCompare(ta);
    });
}

/** Onaylanan katkı yeniden doğrulanıp il dosyasına yazılır; reddedilen yalnız notuyla işaretlenir. */
export function kararVer(id: string, onay: boolean, not?: string): Katki {
  const katki = katkiOku(id);
  if (!katki) throw new KatkiHatasi("Katkı bulunamadı.");
  if (katki.durum !== "bekliyor") throw new KatkiHatasi("Bu katkı için zaten karar verilmiş.");
  if (onay) {
    const depo = depoOku();
    const dosya = depo.iller.find((d) => d.il.id === katki.il);
    if (!dosya) throw new KatkiHatasi("Şehir dosyası bulunamadı.");
    denetleVeUygula(dosya, katki, depo.tanimlar);
    yaz(path.join(ILLER, `${katki.il}.json`), dosya);
  }
  katki.durum = onay ? "onaylandi" : "reddedildi";
  katki.karar = { tarih: new Date().toISOString(), ...(not?.trim() ? { not: not.trim() } : {}) };
  yaz(path.join(KUYRUK, `${katki.id}.json`), katki);
  return katki;
}
