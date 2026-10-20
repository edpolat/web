// Onay kuyruğu (yalnız eser.onayla izniyle). GET bekleyen ve karar verilmiş katkıları, POST kararı işler.
import { revalidatePath } from "next/cache";
import { KatkiHatasi } from "@/lib/sunucu/katki";
import { kararVer, katkilar } from "@/lib/sunucu/kuyruk";
import { yetkili } from "@/lib/sunucu/oturum";

const yetkisiz = () => Response.json({ hata: "Onaylama izni gerekli." }, { status: 401 });

export async function GET() {
  if (!(await yetkili("eser.onayla"))) return yetkisiz();
  return Response.json(katkilar());
}

export async function POST(istek: Request) {
  if (!(await yetkili("eser.onayla"))) return yetkisiz();
  let govde: { id?: unknown; karar?: unknown; not?: unknown };
  try {
    govde = await istek.json();
  } catch {
    return Response.json({ hata: "Geçersiz JSON." }, { status: 400 });
  }
  if (typeof govde.id !== "string" || (govde.karar !== "onayla" && govde.karar !== "reddet")) {
    return Response.json({ hata: "id ve karar (onayla | reddet) gerekli." }, { status: 400 });
  }
  try {
    const katki = kararVer(govde.id, govde.karar === "onayla", typeof govde.not === "string" ? govde.not : undefined);
    // Onaylanan bilgi bir sonraki ziyarette web sayfalarında görünsün.
    if (katki.durum === "onaylandi") revalidatePath("/[dil]", "layout");
    return Response.json(katki);
  } catch (hata) {
    if (hata instanceof KatkiHatasi) return Response.json({ hata: hata.message, ayrinti: hata.ayrinti }, { status: 400 });
    throw hata;
  }
}
