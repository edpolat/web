// Kaynak dosyasını açar: süreli Supabase bağlantısına yönlendirir. Panel kullanıcıları her dosyayı,
// ziyaretçiler yalnız doğrulanmış ve herkese açık kaynakların dosyalarını görür; diğerleri 404.
import { dosyaBaglantisi } from "@/lib/sunucu/kaynak-depo";

export async function GET(_istek: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adres = /^[a-z0-9-]{1,80}$/.test(id) ? await dosyaBaglantisi(id) : undefined;
  if (!adres) return new Response("Bulunamadı", { status: 404 });
  return new Response(null, { status: 302, headers: { Location: adres, "Cache-Control": "private, no-store" } });
}
