// Mobil uygulamadan gelen eser talebine karar (eser.onayla): kabul (isteğe bağlı not) ya da ret (gerekçe zorunlu).
// Yalnız web paneli çağırır (çerez); izin Supabase'deki talep_karar fonksiyonunda da denetlenir.
import { yetkili } from "@/lib/sunucu/oturum";
import { TalepHatasi, talepKarar } from "@/lib/sunucu/talep-depo";

const metin = (x: unknown) => (typeof x === "string" ? x.trim() : "");

export async function POST(istek: Request) {
  let g: Record<string, unknown>;
  try {
    const govde: unknown = await istek.json();
    if (typeof govde !== "object" || govde === null) return Response.json({ hata: "Geçersiz istek." }, { status: 400 });
    g = govde as Record<string, unknown>;
  } catch {
    return Response.json({ hata: "Geçersiz JSON." }, { status: 400 });
  }
  if (!(await yetkili("eser.onayla"))) return Response.json({ hata: "Onaylama izni gerekli." }, { status: 403 });
  if (g.islem !== "kabul" && g.islem !== "reddet") return Response.json({ hata: "Bilinmeyen işlem." }, { status: 400 });
  try {
    await talepKarar(metin(g.id), g.islem === "kabul", metin(g.gerekce).slice(0, 2000));
    return Response.json({ tamam: true });
  } catch (hata) {
    if (hata instanceof TalepHatasi) return Response.json({ hata: hata.message }, { status: 400 });
    throw hata;
  }
}
