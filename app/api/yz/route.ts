// Panelin YZ işlemleri (eser.onayla gerekli): "Yeniden analiz et" (kaynak analizi ya da ön eleme) ve YZ etiketini elle düzeltme.
// YZ yalnız bilgi verir; bu uç hiçbir kaydı onaylamaz, reddetmez, silmez ya da değiştirmez.
import { hesapIstemcisi } from "@/lib/sunucu/kimlik";
import { yetkili } from "@/lib/sunucu/oturum";
import { elemeAnalizi, kaynakAnalizi } from "@/lib/sunucu/yz-analiz";
import { etiketDuzelt, sonAnalizler, type HedefTuru } from "@/lib/sunucu/yz-depo";
import { yzAcik } from "@/lib/sunucu/yz-servis";
import { ETIKETLER, ONCELIKLER } from "@/lib/yz";

export const maxDuration = 60;

const hata = (mesaj: string, durum = 400) => Response.json({ hata: mesaj }, { status: durum });

export async function POST(istek: Request) {
  const g = (await istek.json().catch(() => null)) as Record<string, unknown> | null;
  if (!g) return hata("Geçersiz istek.");
  if (!(await yetkili("eser.onayla"))) return hata("Onaylama izni gerekli.", 403);
  const id = typeof g.id === "number" && Number.isInteger(g.id) ? g.id : NaN;
  if (!Number.isFinite(id)) return hata("Geçersiz istek.");
  const vt = await hesapIstemcisi();
  if (!vt) return hata("Bu işlem için hesabınla giriş yapmalısın.");

  if (g.islem === "etiket_duzelt") {
    // Elle düzeltme YZ kapalıyken de çalışır.
    const etiketler = Array.isArray(g.etiketler) ? [...new Set(g.etiketler.filter((e) => ETIKETLER.some((x) => x === e)))] : null;
    const oncelik = ONCELIKLER.find((x) => x === g.oncelik);
    if (!etiketler || !oncelik) return hata("Geçersiz etiket.");
    const analiz = typeof g.analiz === "number" && Number.isInteger(g.analiz) ? g.analiz : null;
    const sorun = await etiketDuzelt(vt, id, analiz, etiketler as string[], oncelik);
    return sorun ? hata(`Etiket kaydedilemedi: ${sorun}`) : Response.json({ tamam: true });
  }

  if (!yzAcik()) return hata("YZ kapalı.");
  const tur = (["oneri", "surum"] as const).find((x) => x === g.hedef_tur) as HedefTuru | undefined;
  if (!tur) return hata("Geçersiz istek.");
  if (g.islem === "kaynak") await kaynakAnalizi(vt, tur, id, true);
  else if (g.islem === "eleme" && tur === "oneri") await elemeAnalizi(vt, id, true);
  else return hata("Bilinmeyen işlem.");
  const son = (await sonAnalizler(vt, g.islem, tur, [id])).get(id);
  return Response.json({ analiz: son ?? null });
}
