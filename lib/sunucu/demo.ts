// Sunum için "Demoyu sıfırla": şehir dosyalarının ve onay kuyruğunun bir anlık kaydını alır, istenince ona döner.
// Kayıt veri/demo-kaydi/ altında durur ve depoya girmez (.gitignore).
import "server-only";
import fs from "node:fs";
import path from "node:path";

const VERI = path.join(process.cwd(), "veri");
const KAYIT = path.join(VERI, "demo-kaydi");
const KLASORLER = ["iller", "kuyruk"] as const;
const ZAMAN = path.join(KAYIT, "zaman.txt");

function jsonlar(klasor: string): string[] {
  return fs.existsSync(klasor) ? fs.readdirSync(klasor).filter((d) => d.endsWith(".json")) : [];
}

export function demoKaydiZamani(): string | undefined {
  return fs.existsSync(ZAMAN) ? fs.readFileSync(ZAMAN, "utf-8").trim() : undefined;
}

export function demoKaydet(): string {
  fs.rmSync(KAYIT, { recursive: true, force: true });
  for (const k of KLASORLER) {
    fs.mkdirSync(path.join(KAYIT, k), { recursive: true });
    for (const d of jsonlar(path.join(VERI, k))) fs.copyFileSync(path.join(VERI, k, d), path.join(KAYIT, k, d));
  }
  const zaman = new Date().toISOString();
  fs.writeFileSync(ZAMAN, zaman + "\n");
  return zaman;
}

/** Kayıttan sonra eklenen katkılar silinir, şehir dosyaları ve kuyruk kayıttaki hâline döner. */
export function demoSifirla(): void {
  if (!demoKaydiZamani()) throw new Error("Demo kaydı yok.");
  for (const k of KLASORLER) {
    const hedef = path.join(VERI, k);
    const kaynak = path.join(KAYIT, k);
    fs.mkdirSync(hedef, { recursive: true });
    const kayitta = new Set(jsonlar(kaynak));
    // Şehir dosyası silinmez; yalnız kuyruğa sonradan düşen katkılar kaldırılır.
    if (k === "kuyruk") for (const d of jsonlar(hedef)) if (!kayitta.has(d)) fs.rmSync(path.join(hedef, d));
    for (const d of kayitta) fs.copyFileSync(path.join(kaynak, d), path.join(hedef, d));
  }
}
