// Yayındaki eserler (veri dosyaları + panelde onaylanmış sürümler), mobil uygulama için. ?il=bursa ile tek şehir.
// Görsel yolları sitenin köküne göredir (/gorseller/...). Herkese açık; panelde onaylanan düzenleme birkaç dakika içinde görünür.
import { yayindakiEserler } from "@/lib/veri";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(istek: Request) {
  const il = new URL(istek.url).searchParams.get("il");
  const eserler = (await yayindakiEserler()).filter((e) => !e.taslak && (!il || e.il === il));
  return Response.json({ eserler }, { headers: { ...CORS, "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
