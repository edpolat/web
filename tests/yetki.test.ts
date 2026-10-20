import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IZINLER, ROLLER, ROL_IZINLERI, izinli, paneldeMi, yetkiCoz, type Kimlik } from "../lib/yetki";

const kisi = (rol: Kimlik["rol"]): Kimlik => ({ id: "x", eposta: "x@y.z", ad: "X", ...yetkiCoz({ rol, izinler: rol ? ROL_IZINLERI[rol] : [] }) });

describe("roller ve izinler", () => {
  it("Supabase'deki rol_izinleri tohumu lib/yetki.ts ile aynı", () => {
    const sql = fs.readFileSync(path.join(__dirname, "../supabase/001_roller.sql"), "utf-8");
    const satirlar = [...sql.matchAll(/\('(\w+)', '([\w.]+)'\)/g)].map((m) => `${m[1]} ${m[2]}`).sort();
    const kod = ROLLER.flatMap((r) => ROL_IZINLERI[r].map((i) => `${r} ${i}`)).sort();
    expect(satirlar).toEqual(kod);
  });

  it("tablodaki yetkiler", () => {
    expect(izinli(kisi("editor"), "eser.onayla")).toBe(true);
    expect(izinli(kisi("editor"), "kullanici.yonet")).toBe(false);
    expect(izinli(kisi("katkici"), "eser.duzenle")).toBe(true);
    expect(izinli(kisi("katkici"), "eser.onayla")).toBe(false);
    expect(izinli(kisi("super_admin"), "eser.arsivle")).toBe(true);
    expect(IZINLER.some((i) => izinli(kisi("goruntuleyici"), i))).toBe(false);
  });

  it("görüntüleyici panele girer, rolsüz hesap ve girişsiz giremez", () => {
    expect(paneldeMi(kisi("goruntuleyici"))).toBe(true);
    expect(paneldeMi(kisi(null))).toBe(false);
    expect(paneldeMi(null)).toBe(false);
  });

  it("benim_izinlerim yanıtı denetlenir", () => {
    expect(yetkiCoz(null)).toEqual({ rol: null, izinler: [] });
    expect(yetkiCoz({ rol: "kral", izinler: ["eser.onayla"] })).toEqual({ rol: null, izinler: [] });
    expect(yetkiCoz({ rol: "katkici", izinler: ["eser.ekle", "uydurma"] })).toEqual({ rol: "katkici", izinler: ["eser.ekle"] });
  });
});
