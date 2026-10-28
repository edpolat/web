// Panel form taslakları (hesapla giriş gerekli): kaydet ya da sil. Taslak hiçbir onaya ve yayına gitmez.
import { KatkiHatasi } from "@/lib/sunucu/katki";
import { kimlik } from "@/lib/sunucu/kimlik";
import { yetkili } from "@/lib/sunucu/oturum";
import { taslakHazirla } from "@/lib/sunucu/taslak";
import { formTaslagiKaydet, formTaslagiSil } from "@/lib/sunucu/taslak-depo";

async function islem(g: Record<string, unknown>): Promise<Record<string, unknown>> {
  const ben = await kimlik();
  if (!ben?.rol) throw new KatkiHatasi("Panel için hesabınla giriş yapmalısın.");
  switch (g.islem) {
    case "kaydet": {
      if (!(await yetkili("eser.ekle")) && !(await yetkili("eser.duzenle"))) throw new KatkiHatasi("Bu işlem için yetkin yok.");
      return { id: await formTaslagiKaydet(taslakHazirla(g)) };
    }
    case "sil": {
      const id = typeof g.id === "number" && Number.isInteger(g.id) ? g.id : NaN;
      if (!(id > 0)) throw new KatkiHatasi("Geçersiz taslak.");
      await formTaslagiSil(id);
      return { tamam: true };
    }
  }
  throw new KatkiHatasi("Bilinmeyen işlem.");
}

export async function POST(istek: Request) {
  let govde: unknown;
  try {
    govde = await istek.json();
  } catch {
    return Response.json({ hata: "Geçersiz JSON." }, { status: 400 });
  }
  if (typeof govde !== "object" || govde === null) return Response.json({ hata: "Geçersiz istek." }, { status: 400 });
  try {
    return Response.json(await islem(govde as Record<string, unknown>));
  } catch (hata) {
    if (hata instanceof KatkiHatasi) return Response.json({ hata: hata.message, ayrinti: hata.ayrinti }, { status: 400 });
    throw hata;
  }
}
