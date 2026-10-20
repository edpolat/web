// Web'den ve uygulamadan gelen katkıyı doğrulayıp onay kuyruğuna koyar. Onaylanmadan hiçbir yerde görünmez.
// Herkes esere kaynaklı bilgi (tur: "olgu") gönderebilir; eser ekleme ve düzenleme eser.duzenle izni ister.
import { KatkiHatasi } from "@/lib/sunucu/katki";
import { katkiEkle } from "@/lib/sunucu/kuyruk";
import { yetkili } from "@/lib/sunucu/oturum";

export async function POST(istek: Request) {
  let govde: unknown;
  try {
    govde = await istek.json();
  } catch {
    return Response.json({ hata: "Geçersiz JSON." }, { status: 400 });
  }
  try {
    const katki = katkiEkle(govde, await yetkili("eser.duzenle"));
    return Response.json({ id: katki.id, durum: katki.durum, eser_id: katki.eser_id }, { status: 201 });
  } catch (hata) {
    if (hata instanceof KatkiHatasi) return Response.json({ hata: hata.message, ayrinti: hata.ayrinti }, { status: 400 });
    throw hata;
  }
}
