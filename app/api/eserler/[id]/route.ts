// Tek eserin yayındaki hâli (mobil uygulama için). Bulunamazsa 404.
import { yayindakiEser } from "@/lib/veri";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(_istek: Request, { params }: { params: Promise<{ id: string }> }) {
  const eser = await yayindakiEser((await params).id);
  if (!eser || eser.taslak) return Response.json({ hata: "Eser bulunamadı." }, { status: 404, headers: CORS });
  return Response.json({ eser }, { headers: { ...CORS, "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
