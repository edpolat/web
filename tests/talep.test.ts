import { describe, expect, it } from "vitest";
import { talepSatiri } from "../lib/talep";

describe("talepSatiri", () => {
  it("uygulamanın yazdığı satırı okur", () => {
    const x = talepSatiri({
      id: "a1",
      eser_id: "bursa-001",
      eser_adi: "Ulu Cami",
      bilgi: "Avludaki çeşme sonradan eklendi.",
      kullanici: null,
      gonderen_ad: null,
      foto_yollari: ["a1/1.jpg", "a1/2.jpg"],
      kaynak: "uygulama",
      durum: "bekliyor",
      olusturuldu: "2026-10-21T20:00:00Z",
    });
    expect(x).toMatchObject({ id: "a1", eser_id: "bursa-001", foto_yollari: ["a1/1.jpg", "a1/2.jpg"], durum: "bekliyor", kullanici: null });
  });

  it("created_at, boş metin, fazla ve bozuk fotoğraf yollarını düzeltir", () => {
    const x = talepSatiri({ id: 7, eser_id: "k", bilgi: "  ", foto_yollari: ["1", "", 3, "2", "3", "4"], created_at: "2026-10-01T00:00:00Z", durum: "red" });
    expect(x.id).toBe("7");
    expect(x.bilgi).toBeNull();
    expect(x.foto_yollari).toEqual(["1", "2", "3"]);
    expect(x.olusturuldu).toBe("2026-10-01T00:00:00Z");
    expect(x.durum).toBe("bekliyor");
  });
});
