import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IZINLER, ROLLER, ROL_IZINLERI, izinli, paneldeMi, yetkiCoz, type Kimlik } from "../lib/yetki";

const kisi = (rol: Kimlik["rol"]): Kimlik => ({ id: "x", eposta: "x@y.z", ad: "X", ...yetkiCoz({ rol, izinler: rol ? ROL_IZINLERI[rol] : [] }) });

describe("roller ve izinler", () => {
  it("Supabase'deki rol_izinleri tohumu lib/yetki.ts ile aynı", () => {
    const oku = (dosya: string) => fs.readFileSync(path.join(__dirname, "../supabase", dosya), "utf-8");
    const ciftler = (sql: string) => [...sql.matchAll(/\('(\w+)', '([\w.]+)'\)/g)].map((m) => `${m[1]} ${m[2]}`);
    // 015 tarihçiyi ekler ve kaynak doğrulamayı editörden alır.
    const tarihci = oku("015_tarihci_onayi.sql");
    const silinen = [...tarihci.matchAll(/where rol = '(\w+)' and izin = '([\w.]+)'/g)].map((m) => `${m[1]} ${m[2]}`);
    // 017 sergi.yonet iznini ekler (yalnız dosyanın başındaki izin satırları).
    const sergi = oku("017_sergiler.sql").split("create table")[0];
    // 021 katkici ve goruntuleyici rollerini kaldırır.
    const kaldirilan = [...(oku("021_rolleri_sadelestir.sql").match(/delete from public.rol_izinleri where rol in \(([^)]*)\)/)?.[1] ?? "").matchAll(/'(\w+)'/g)].map((m) => m[1]);
    const satirlar = [...ciftler(oku("001_roller.sql")), ...ciftler(tarihci.split("-- Sürümde tarihçi aşaması")[0]), ...ciftler(sergi)]
      .filter((x) => !silinen.includes(x) && !kaldirilan.includes(x.split(" ")[0]))
      .sort();
    const kod = ROLLER.flatMap((r) => ROL_IZINLERI[r].map((i) => `${r} ${i}`)).sort();
    expect(satirlar).toEqual(kod);
  });

  it("tablodaki yetkiler", () => {
    expect(izinli(kisi("editor"), "eser.onayla")).toBe(true);
    expect(izinli(kisi("editor"), "kullanici.yonet")).toBe(false);
    expect(izinli(kisi("super_admin"), "eser.arsivle")).toBe(true);
    expect(izinli(kisi("tarihci"), "eser.incele")).toBe(true);
    expect(izinli(kisi("tarihci"), "eser.onayla")).toBe(false);
    expect(izinli(kisi("editor"), "eser.incele")).toBe(false);
    expect(izinli(kisi("editor"), "kaynak.dogrula")).toBe(false);
    expect(izinli(kisi("editor"), "sergi.yonet")).toBe(true);
    expect(izinli(kisi("super_admin"), "sergi.yonet")).toBe(true);
    expect(izinli(kisi("tarihci"), "sergi.yonet")).toBe(false);
    expect(IZINLER.some((i) => izinli(kisi(null), i))).toBe(false);
  });

  it("rolü olan panele girer, rolsüz hesap ve girişsiz giremez", () => {
    expect(paneldeMi(kisi("tarihci"))).toBe(true);
    expect(paneldeMi(kisi(null))).toBe(false);
    expect(paneldeMi(null)).toBe(false);
  });

  it("benim_izinlerim yanıtı denetlenir", () => {
    expect(yetkiCoz(null)).toEqual({ rol: null, izinler: [] });
    expect(yetkiCoz({ rol: "kral", izinler: ["eser.onayla"] })).toEqual({ rol: null, izinler: [] });
    expect(yetkiCoz({ rol: "tarihci", izinler: ["eser.incele", "uydurma"] })).toEqual({ rol: "tarihci", izinler: ["eser.incele"] });
    // Kaldırılan roller (021) artık tanınmaz.
    expect(yetkiCoz({ rol: "katkici", izinler: ["eser.ekle"] })).toEqual({ rol: null, izinler: [] });
  });
});
