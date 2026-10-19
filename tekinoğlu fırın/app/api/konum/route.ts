// Yalnız geliştirme ortamında: konum düzenleme sayfasının seçtiği konumu veri/iller/<il>.json dosyasına yazar.
import fs from "node:fs";
import path from "node:path";
import { KonumHatasi, konumuYaz, type IlDosyasi } from "@/lib/sunucu/konum";

const ILLER = path.join(process.cwd(), "veri", "iller");

export async function POST(istek: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ hata: "Bu uç yalnız geliştirme ortamında açık." }, { status: 404 });
  }
  let govde: { id?: unknown; enlem?: unknown; boylam?: unknown };
  try {
    govde = await istek.json();
  } catch {
    return Response.json({ hata: "Geçersiz JSON." }, { status: 400 });
  }
  if (typeof govde.id !== "string") {
    return Response.json({ hata: "Eser kimliği eksik." }, { status: 400 });
  }
  for (const ad of fs.readdirSync(ILLER).filter((d) => d.endsWith(".json")).sort()) {
    const yol = path.join(ILLER, ad);
    const dosya = JSON.parse(fs.readFileSync(yol, "utf-8")) as IlDosyasi;
    try {
      const konum = konumuYaz(dosya, govde.id, govde.enlem as number, govde.boylam as number);
      if (!konum) continue;
      fs.writeFileSync(yol, JSON.stringify(dosya, null, 2) + "\n", "utf-8");
      return Response.json({ id: govde.id, konum });
    } catch (hata) {
      if (hata instanceof KonumHatasi) return Response.json({ hata: hata.message }, { status: 400 });
      throw hata;
    }
  }
  return Response.json({ hata: "Eser bulunamadı." }, { status: 404 });
}
