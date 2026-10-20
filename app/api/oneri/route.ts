// Halktan bilgi önerisi. Göndermek için hesapla giriş (Authorization: Bearer <Supabase jetonu>) yeterli;
// kabul ve ret eser.onayla ister. İzin ve günlük sınır Supabase fonksiyonlarında da denetlenir.
import { KAYNAK_TURLERI, KaynakHatasi, NITELIKLER, type KaynakTuru, type Nitelik } from "@/lib/kaynak";
import { OneriHatasi, oneriIstegi } from "@/lib/oneri";
import { KatkiHatasi } from "@/lib/sunucu/katki";
import { dosyaDenetle, yuklemeAdresi } from "@/lib/sunucu/kaynak-depo";
import { kimlik } from "@/lib/sunucu/kimlik";
import { oneriGonder, oneriKabul, oneriReddet, oneriler } from "@/lib/sunucu/oneri-depo";
import { yetkili } from "@/lib/sunucu/oturum";
import { yayindakiEser } from "@/lib/veri";

const metin = (x: unknown) => (typeof x === "string" ? x.trim() : "");
const sayi = (x: unknown) => (typeof x === "number" && Number.isInteger(x) ? x : NaN);

async function islem(g: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!(await kimlik())) throw new OneriHatasi("Öneri göndermek için giriş yapmalısın.");
  switch (g.islem) {
    case "yukleme_adresi":
      return yuklemeAdresi(g.tur, g.boyut);
    case "gonder": {
      const istek = oneriIstegi(g);
      if (!(await yayindakiEser(istek.eser_id))) throw new OneriHatasi("Eser bulunamadı.");
      const dosya = istek.dosya_yolu ? await dosyaDenetle(istek.dosya_yolu) : undefined;
      return { id: await oneriGonder(istek, dosya) };
    }
    case "kabul":
    case "reddet": {
      if (!(await yetkili("eser.onayla"))) throw new OneriHatasi("Onaylama izni gerekli.");
      const id = sayi(g.id);
      if (g.islem === "reddet") {
        if (!metin(g.gerekce)) throw new OneriHatasi("Reddetmek için gerekçe yazmalısın.");
        await oneriReddet(id, metin(g.gerekce));
        return { tamam: true };
      }
      const k = typeof g.kutuphane === "object" && g.kutuphane !== null ? (g.kutuphane as Record<string, unknown>) : undefined;
      if (k && !(await yetkili("kaynak.dogrula"))) throw new OneriHatasi("Kaynağı kütüphaneye eklemek için kaynak doğrulama izni gerekli.");
      if (k && !metin(k.baslik)) throw new OneriHatasi("Kütüphaneye eklenecek kaynağın başlığını yaz.");
      const kaynak_turu = KAYNAK_TURLERI.find((x) => x === k?.kaynak_turu) ?? "diger";
      const surum = await oneriKabul({
        id,
        alan: metin(g.alan),
        deger: metin(g.deger),
        kategori: metin(g.kategori) || undefined,
        konum: metin(g.konum) || undefined,
        kutuphane: k && {
          baslik: metin(k.baslik).slice(0, 300),
          kaynak_turu: kaynak_turu as KaynakTuru,
          nitelik: (NITELIKLER.find((x) => x === k.nitelik) ?? "ucuncul") as Nitelik,
          herkese_acik: k.herkese_acik === true,
        },
      });
      return { surum };
    }
  }
  throw new OneriHatasi("Bilinmeyen işlem.");
}

/** Kişinin kendi önerileri (durum ve ret gerekçesiyle). */
export async function GET(istek: Request) {
  const eser = new URL(istek.url).searchParams.get("eser") ?? undefined;
  try {
    if (!(await kimlik())) return Response.json({ oneriler: [] });
    return Response.json({ oneriler: await oneriler({ benim: true, eser_id: eser }) });
  } catch (hata) {
    if (hata instanceof OneriHatasi) return Response.json({ hata: hata.message }, { status: 400 });
    throw hata;
  }
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
    if (hata instanceof OneriHatasi || hata instanceof KaynakHatasi) return Response.json({ hata: hata.message }, { status: 400 });
    if (hata instanceof KatkiHatasi) return Response.json({ hata: hata.message, ayrinti: hata.ayrinti }, { status: 400 });
    throw hata;
  }
}
