// Bilgi önerisine eklenen dosyayı açar (süreli Supabase bağlantısı). Yalnız panel kullanıcıları ve öneren görür; diğerleri 404.
import { oneriDosyaBaglantisi } from "@/lib/sunucu/oneri-depo";

export async function GET(_istek: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adres = /^\d{1,12}$/.test(id) ? await oneriDosyaBaglantisi(Number(id)).catch(() => undefined) : undefined;
  if (!adres) return new Response("Bulunamadı", { status: 404 });
  return new Response(null, { status: 302, headers: { Location: adres, "Cache-Control": "private, no-store" } });
}
