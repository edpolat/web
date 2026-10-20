// Katkının durumu: uygulama, gönderdiği katkının onaylandığını ya da hangi notla reddedildiğini buradan öğrenir.
import { katkiOku } from "@/lib/sunucu/kuyruk";

export async function GET(_istek: Request, { params }: { params: Promise<{ id: string }> }) {
  const katki = katkiOku((await params).id);
  if (!katki) return Response.json({ hata: "Katkı bulunamadı." }, { status: 404 });
  return Response.json({ id: katki.id, tur: katki.tur, eser_id: katki.eser_id, durum: katki.durum, karar: katki.karar });
}
