// Kaynak kütüphanesi işlemleri (hesapla giriş gerekli): yükleme adresi al, kaynak ekle, doğrula, bilgiye bağla.
// İzin hem burada hem Supabase fonksiyonlarında denetlenir.
import { EN_BUYUK_KAYNAK_DOSYASI, KaynakHatasi, KAYNAK_DURUMLARI, kaynakIstegi, type KaynakDurumu } from "@/lib/kaynak";
import { bilgiKaynagiEkle, dosyaDenetle, kaynakDogrula, kaynakEkle, yuklemeAdresi } from "@/lib/sunucu/kaynak-depo";
import { yetkili } from "@/lib/sunucu/oturum";

const metin = (x: unknown) => (typeof x === "string" ? x.trim() : "");

async function islem(g: Record<string, unknown>): Promise<Record<string, unknown>> {
  const ekleyebilir = (await yetkili("eser.ekle")) || (await yetkili("eser.duzenle"));
  switch (g.islem) {
    case "yukleme_adresi":
      if (!ekleyebilir) throw new KaynakHatasi("Bu işlem için yetkin yok.");
      return yuklemeAdresi(g.tur, g.boyut, EN_BUYUK_KAYNAK_DOSYASI);
    case "ekle": {
      if (!ekleyebilir) throw new KaynakHatasi("Bu işlem için yetkin yok.");
      const istek = kaynakIstegi(g);
      const dosya = istek.dosya_yolu ? await dosyaDenetle(istek.dosya_yolu, EN_BUYUK_KAYNAK_DOSYASI) : undefined;
      return { id: await kaynakEkle(istek, dosya) };
    }
    case "dogrula": {
      if (!(await yetkili("kaynak.dogrula"))) throw new KaynakHatasi("Kaynak doğrulama izni gerekli.");
      if (!KAYNAK_DURUMLARI.includes(g.durum as KaynakDurumu)) throw new KaynakHatasi("Geçersiz durum.");
      if (g.durum === "reddedildi" && !metin(g.gerekce)) throw new KaynakHatasi("Reddetmek için gerekçe yazmalısın.");
      await kaynakDogrula(metin(g.id), g.durum as string, g.herkese_acik === true, metin(g.gerekce));
      return { tamam: true };
    }
    case "bilgi_bagla": {
      if (!(await yetkili("eser.duzenle"))) throw new KaynakHatasi("Bu işlem için yetkin yok.");
      const [eser_id, alan, kaynak_id] = [metin(g.eser_id), metin(g.alan), metin(g.kaynak_id)];
      if (!eser_id || !alan || !kaynak_id) throw new KaynakHatasi("Eser, alan ve kaynak gerekli.");
      await bilgiKaynagiEkle(eser_id, alan, metin(g.deger).slice(0, 500), kaynak_id, metin(g.konum).slice(0, 100));
      return { tamam: true };
    }
  }
  throw new KaynakHatasi("Bilinmeyen işlem.");
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
    if (hata instanceof KaynakHatasi) return Response.json({ hata: hata.message }, { status: 400 });
    throw hata;
  }
}
