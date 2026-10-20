// "Bu esere sor": web ve uygulama aynı ucu kullanır. Cevap yalnız eserin yayındaki kayıtlarından gelir.
// ANTHROPIC_API_KEY tanımlıysa Claude soruyu anlayıp kaynak göstererek cevaplar; yoksa ya da hata olursa eşleştirme.
import { gecerliDil } from "@/lib/metin";
import { cevapla } from "@/lib/sunucu/sor";
import { yapayZekaylaCevapla, type GecmisMesaj } from "@/lib/sunucu/sor-yz";
import { eserBul } from "@/lib/veri";

const GECMIS_SINIRI = 4;

// Mobil uygulama (GitHub Pages'teki statik site) bu ucu başka bir adresten çağırır; tarayıcı izin ister.
// Anahtar sunucuda kaldığı için herkese açık olması sorun değil.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

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
  return Response.json(yz ?? cevapla(eser, soru, dil), { headers: CORS });
}
