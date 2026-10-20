// "Bu esere sor": web ve uygulama aynı ucu kullanır. Cevap yalnız eserin yayındaki kayıtlarından gelir.
// ANTHROPIC_API_KEY tanımlıysa Claude soruyu anlayıp kaynak göstererek cevaplar; yoksa ya da hata olursa eşleştirme.
import { gecerliDil } from "@/lib/metin";
import { cevapla } from "@/lib/sunucu/sor";
import { sonCikti, yapayZekaAcik, yapayZekaDurumu, yapayZekaylaCevapla, type GecmisMesaj } from "@/lib/sunucu/sor-yz";
import { eserBul } from "@/lib/veri";

const GECMIS_SINIRI = 4;

// Mobil uygulama (GitHub Pages'teki statik site) bu ucu başka bir adresten çağırır; tarayıcı izin ister.
// Anahtar sunucuda kaldığı için herkese açık olması sorun değil.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

/**
 * Tarayıcıda /api/sor açılınca yapay zekânın durumunu gösterir: hangi sağlayıcı, deneme sorusu
 * yapay zekâdan mı eşleştirmeden mi cevaplandı, başarısızsa neden. Anahtarı göstermez.
 */
export async function GET(istek: Request) {
  const adres = new URL(istek.url).searchParams;
  const eser = eserBul(adres.get("eser") ?? "molla-fenari-camii");
  const soru = (adres.get("soru") ?? "Bu cami nerede ve kim yaptırmış?").slice(0, 300);
  const deneme = eser ? await yapayZekaylaCevapla(eser, soru, "tr") : null;
  return Response.json(
    {
      ...yapayZekaDurumu(),
      soru,
      deneme_cevabi: deneme ? (deneme.bulundu ? "yapay zekâ cevap verdi" : "yapay zekâ 'bilgi yok' dedi") : "yapay zekâ cevap vermedi, eşleştirme kullanılır",
      model_ciktisi: deneme ? sonCikti : null,
      eslestirme: eser ? cevapla(eser, soru, "tr") : null,
    },
    { headers: CORS },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function gecmisOku(g: unknown): GecmisMesaj[] {
  if (!Array.isArray(g)) return [];
  return g
    .filter((m): m is GecmisMesaj => typeof m?.soru === "string" && typeof m?.cevap === "string")
    .slice(-GECMIS_SINIRI)
    .map((m) => ({ soru: m.soru.slice(0, 300), cevap: m.cevap.slice(0, 800) }));
}

export async function POST(istek: Request) {
  let govde: { eser_id?: unknown; soru?: unknown; dil?: unknown; gecmis?: unknown };
  try {
    govde = await istek.json();
  } catch {
    return Response.json({ hata: "Geçersiz JSON." }, { status: 400, headers: CORS });
  }
  const { eser_id, soru } = govde;
  if (typeof eser_id !== "string" || typeof soru !== "string" || !soru.trim() || soru.length > 300) {
    return Response.json({ hata: "eser_id ve 1-300 karakterlik soru gerekli." }, { status: 400, headers: CORS });
  }
  const eser = eserBul(eser_id);
  if (!eser) return Response.json({ hata: "Eser bulunamadı." }, { status: 404, headers: CORS });
  const dil = typeof govde.dil === "string" && gecerliDil(govde.dil) ? govde.dil : "tr";
  const yz = await yapayZekaylaCevapla(eser, soru.trim(), dil, gecmisOku(govde.gecmis));
  // Yapay zekâ açıksa cevabı her zaman o verir: sayfadaki bilgi kaynaklı, sayfada olmayan "AI yorumu".
  // Ulaşılamazsa (yoğunluk, zaman aşımı) eşleştirmeye düşülmez, ziyaretçiye "tekrar dene" denir;
  // iki farklı yöntemin karışık cevapları kafa karıştırıyordu. Eşleştirme yalnız anahtar hiç yoksa çalışır.
  if (yz) return Response.json(yz, { headers: CORS });
  if (yapayZekaAcik()) return Response.json({ hata: "Yapay zekâ şu an cevap veremedi." }, { status: 503, headers: CORS });
  return Response.json(cevapla(eser, soru, dil), { headers: CORS });
}
