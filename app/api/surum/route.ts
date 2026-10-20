// Panel sürüm işlemleri (hesapla giriş gerekli): eser formu gönderme, taslağı incelemeye alma,
// onaylama/reddetme, eski sürüme dönme, arşivleme. Kurallar lib/sunucu/panel.ts'de.
import { KatkiHatasi } from "@/lib/sunucu/katki";
import { panelIslemi } from "@/lib/sunucu/panel";

export async function POST(istek: Request) {
  let govde: unknown;
  try {
    govde = await istek.json();
  } catch {
    return Response.json({ hata: "Geçersiz JSON." }, { status: 400 });
  }
  if (typeof govde !== "object" || govde === null) return Response.json({ hata: "Geçersiz istek." }, { status: 400 });
  try {
    return Response.json(await panelIslemi(govde as Record<string, unknown>));
  } catch (hata) {
    if (hata instanceof KatkiHatasi) return Response.json({ hata: hata.message, ayrinti: hata.ayrinti }, { status: 400 });
    throw hata;
  }
}
