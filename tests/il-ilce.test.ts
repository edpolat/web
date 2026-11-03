import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { adAnahtari, ilceBul, ilinIlceleri, tumIller } from "../lib/il-ilce";

type IlDosyasi = { il: { id: string; ad: { tr: string } }; eserler: { ilce?: string }[] };
const IL_KLASORU = path.join(process.cwd(), "veri", "iller");
const ilDosyalari = fs
  .readdirSync(IL_KLASORU)
  .filter((d) => d.endsWith(".json"))
  .map((d) => JSON.parse(fs.readFileSync(path.join(IL_KLASORU, d), "utf-8")) as IlDosyasi);

describe("il-ilçe listesi", () => {
  it("81 il ve 973 ilçe içerir", () => {
    expect(tumIller()).toHaveLength(81);
    expect(tumIller().reduce((t, il) => t + (ilinIlceleri(il)?.length ?? 0), 0)).toBe(973);
  });

  it("il adı büyük/küçük harf ve ı/i farkı gözetmeden bulunur", () => {
    expect(ilinIlceleri("HATAY")).toContain("Defne");
    expect(ilinIlceleri("istanbul")).toContain("Kadıköy");
    expect(ilinIlceleri("Yokil")).toBeUndefined();
    expect(adAnahtari("KIRIKHAN")).toBe(adAnahtari("Kırıkhan"));
  });

  it("ilçeyi doğru yazımına çevirir", () => {
    expect(ilceBul("Konya", "ILGIN")).toBe("Ilgın");
    expect(ilceBul("Konya", "Antakya")).toBeUndefined();
  });

  it("veri/iller'deki eserlerin ilçeleri listede var", () => {
    for (const { il, eserler } of ilDosyalari) {
      const liste = ilinIlceleri(il.ad.tr);
      expect(liste, il.id).toBeDefined();
      for (const e of eserler) if (e.ilce) expect(liste, `${il.id}/${e.ilce}`).toContain(e.ilce);
    }
  });
});
