// Halktan bilgi önerisi. Göndermek için hesapla giriş (Authorization: Bearer <Supabase jetonu>) yeterli;
// kabul ve ret eser.onayla ister. İzin ve günlük sınır Supabase fonksiyonlarında da denetlenir.
import { KAYNAK_TURLERI, KaynakHatasi, NITELIKLER, type KaynakTuru, type Nitelik } from "@/lib/kaynak";
import { OneriHatasi, oneriIstegi } from "@/lib/oneri";
import { KatkiHatasi } from "@/lib/sunucu/katki";
import { dosyaDenetle, yuklemeAdresi } from "@/lib/sunucu/kaynak-depo";
import { hesapIstemcisi, kimlik } from "@/lib/sunucu/kimlik";
import { oneriGonder, oneriKabul, oneriReddet, oneriler } from "@/lib/sunucu/oneri-depo";
import { yetkili } from "@/lib/sunucu/oturum";
import { arkaPlanda, oneriIsleri } from "@/lib/sunucu/yz-analiz";
import { sunucuIstemcisi, yzKararKaydet } from "@/lib/sunucu/yz-depo";
import { yayindakiEser } from "@/lib/veri";

// Mobil uygulama (başka alan adı) da çağırır. Kimlik çerezle değil Bearer jetonla geldiği için her kaynağa açık.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};
const json = (veri: unknown, durum = 200) => Response.json(veri, { status: durum, headers: CORS });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

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
      const id = await oneriGonder(istek, dosya);
      // YZ kaynak analizi (kaynaklıysa) ve ön eleme yanıt döndükten sonra arka planda (sunucu anahtarı varsa; yoksa editör paneli açınca).
      arkaPlanda(sunucuIstemcisi(), oneriIsleri(id, Boolean(istek.kaynak_id || istek.url || istek.dosya_yolu)));
      return { id };
    }
    case "kabul":
    case "reddet": {
      if (!(await yetkili("eser.onayla"))) throw new OneriHatasi("Onaylama izni gerekli.");
      const id = sayi(g.id);
      if (g.islem === "reddet") {
        if (!metin(g.gerekce)) throw new OneriHatasi("Reddetmek için gerekçe yazmalısın.");
        await oneriReddet(id, metin(g.gerekce));
        await yzKararKaydet(await hesapIstemcisi(), g.yz_analizleri, "reddetti");
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
        en: metin(g.deger_en) || undefined,
        dil_onayi: g.dil_onayi === true,
        kutuphane: k && {
          baslik: metin(k.baslik).slice(0, 300),
          kaynak_turu: kaynak_turu as KaynakTuru,
          nitelik: (NITELIKLER.find((x) => x === k.nitelik) ?? "ucuncul") as Nitelik,
          herkese_acik: k.herkese_acik === true,
        },
      });
      await yzKararKaydet(await hesapIstemcisi(), g.yz_analizleri, "onayladi");
      return { surum };
    }
  }
  throw new OneriHatasi("Bilinmeyen işlem.");
}

/** Kişinin kendi önerileri (durum ve ret gerekçesiyle). */
export async function GET(istek: Request) {
  const eser = new URL(istek.url).searchParams.get("eser") ?? undefined;
  try {
    if (!(await kimlik())) return json({ oneriler: [] });
    return json({ oneriler: await oneriler({ benim: true, eser_id: eser }) });
  } catch (hata) {
    if (hata instanceof OneriHatasi) return json({ hata: hata.message }, 400);
    throw hata;
  }
}

export async function POST(istek: Request) {
  let govde: unknown;
  try {
    govde = await istek.json();
  } catch {
    return json({ hata: "Geçersiz JSON." }, 400);
  }
  if (typeof govde !== "object" || govde === null) return json({ hata: "Geçersiz istek." }, 400);
  try {
    return json(await islem(govde as Record<string, unknown>));
  } catch (hata) {
    if (hata instanceof OneriHatasi || hata instanceof KaynakHatasi) return json({ hata: hata.message }, 400);
    if (hata instanceof KatkiHatasi) return json({ hata: hata.message, ayrinti: hata.ayrinti }, 400);
    throw hata;
  }
}
