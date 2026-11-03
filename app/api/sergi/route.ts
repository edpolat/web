// Panelden sergi ekleme, düzenleme ve silme (hesapla giriş + sergi.yonet izni gerekli).
// İzin hem burada hem Supabase fonksiyonlarında (supabase/017_sergiler.sql) denetlenir; doğrulama lib/sergi.ts'de.
import { SergiHatasi, sergiIstegi, KIMLIK_KALIBI } from "@/lib/sergi";
import { sergiKaydet, sergiSil } from "@/lib/sunucu/sergi-depo";
import { yetkili } from "@/lib/sunucu/oturum";

const metin = (x: unknown) => (typeof x === "string" ? x.trim() : "");

async function islem(g: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!(await yetkili("sergi.yonet"))) throw new SergiHatasi("Sergileri yönetme iznin yok.");
  switch (g.islem) {
    case "ekle":
    case "duzenle": {
      const yeni = g.islem === "ekle";
      return { id: await sergiKaydet(sergiIstegi(g, yeni), yeni) };
    }
    case "sil": {
      const id = metin(g.id);
      if (!KIMLIK_KALIBI.test(id)) throw new SergiHatasi("Geçersiz sergi kimliği.");
      const gerekce = metin(g.gerekce).slice(0, 500);
      if (!gerekce) throw new SergiHatasi("Silmek için gerekçe yazmalısın.");
      await sergiSil(id, gerekce);
      return { tamam: true };
    }
  }
  throw new SergiHatasi("Bilinmeyen işlem.");
}

export async function POST(istek: Request) {
  let govde: unknown;
  try {
    govde = await istek.json();
  } catch {
    return Response.json({ hata: "Geçersiz JSON." }, { status: 400 });
  }
  if (typeof govde !== "object" || govde === null || Array.isArray(govde)) return Response.json({ hata: "Geçersiz istek." }, { status: 400 });
  try {
    return Response.json(await islem(govde as Record<string, unknown>));
  } catch (hata) {
    if (hata instanceof SergiHatasi) return Response.json({ hata: hata.message }, { status: 400 });
    throw hata;
  }
}
