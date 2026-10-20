// Yönetim: demo başlangıcını kaydet ya da demoyu sıfırla.
import { revalidatePath } from "next/cache";
import { demoKaydet, demoSifirla } from "@/lib/sunucu/demo";
import { yetkili } from "@/lib/sunucu/oturum";

export async function POST(istek: Request) {
  if (!(await yetkili("eser.onayla"))) return Response.json({ hata: "Yönetim girişi gerekli." }, { status: 401 });
  let govde: { islem?: unknown };
  try {
    govde = await istek.json();
  } catch {
    return Response.json({ hata: "Geçersiz JSON." }, { status: 400 });
  }
  if (govde.islem === "kaydet") return Response.json({ zaman: demoKaydet() });
  if (govde.islem === "sifirla") {
    try {
      demoSifirla();
    } catch (hata) {
      return Response.json({ hata: (hata as Error).message }, { status: 409 });
    }
    revalidatePath("/[dil]", "layout");
    return Response.json({ tamam: true });
  }
  return Response.json({ hata: "islem: kaydet ya da sifirla" }, { status: 400 });
}
