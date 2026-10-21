// Panelin YZ işlemleri (eser.onayla gerekli): "Yeniden analiz et" (kaynak analizi ya da ön eleme) ve YZ etiketini elle düzeltme.
// YZ yalnız bilgi verir; bu uç hiçbir kaydı onaylamaz, reddetmez, silmez ya da değiştirmez.
import { hesapIstemcisi } from "@/lib/sunucu/kimlik";
import { yetkili } from "@/lib/sunucu/oturum";
import { EN_FAZLA_CIFT, EN_UZUN_METIN } from "@/lib/dil-uyumu";
import { elemeAnalizi, kaynakAnalizi } from "@/lib/sunucu/yz-analiz";
import { cagriHakki, etiketDuzelt, sonAnalizler, type HedefTuru } from "@/lib/sunucu/yz-depo";
import { dilUyumuKarsilastir } from "@/lib/sunucu/yz-dil";
import { yzAcik } from "@/lib/sunucu/yz-servis";
import { ETIKETLER, ONCELIKLER } from "@/lib/yz";

export const maxDuration = 60;

const hata = (mesaj: string, durum = 400) => Response.json({ hata: mesaj }, { status: durum });

export async function POST(istek: Request) {
  const g = (await istek.json().catch(() => null)) as Record<string, unknown> | null;
  if (!g) return hata("Geçersiz istek.");
  if (!(await yetkili("eser.onayla"))) return hata("Onaylama izni gerekli.", 403);

  if (g.islem === "dil_uyumu") {
    // Onaylamadan önce iki dil karşılaştırması. Cevap yalnız uyarıyı belirler; YZ kapalıysa çağıran basit uyarıyı gösterir.
    if (!yzAcik()) return Response.json({ tamam: false, neden: "YZ kapalı." });
    const ciftler = Array.isArray(g.ciftler)
      ? g.ciftler
          .filter((c): c is { tr: string; en: string } => typeof c?.tr === "string" && typeof c?.en === "string" && !!c.tr.trim() && !!c.en.trim())
          .slice(0, EN_FAZLA_CIFT)
          .map((c) => ({ tr: c.tr.trim().slice(0, EN_UZUN_METIN), en: c.en.trim().slice(0, EN_UZUN_METIN) }))
      : [];
    if (!ciftler.length) return hata("Karşılaştırılacak metin yok.");
    const vt = await hesapIstemcisi();
    if (!vt) return hata("Bu işlem için hesabınla giriş yapmalısın.");
    return Response.json(await dilUyumuKarsilastir(ciftler, cagriHakki(vt)));
  }

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
