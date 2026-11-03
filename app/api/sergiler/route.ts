// Sitedeki sergiler (panelden yönetilen Supabase tablosu; yoksa veri/sergiler.json), mobil uygulama için. Herkese açık.
// Biçim veri/sergiler.json ile aynı: { sergiler: [{ id, ad: { tr, en? }, sehir, yer, harita, baslangic, bitis, aciklama, url }] }.
import { yayindakiSergiler } from "@/lib/sunucu/sergi-depo";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  const sergiler = [...(await yayindakiSergiler()).values()];
  return Response.json({ sergiler }, { headers: { ...CORS, "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
