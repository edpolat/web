// Kullanıcı yönetimi (yalnız kullanici.yonet). GET hesapları ve rolleri listeler, POST rol verir ya da geri alır.
// Asıl kontrol Supabase'deki kullanicilari_listele() ve rol_ata() fonksiyonlarında da yapılır.
import { hesapIstemcisi } from "@/lib/sunucu/kimlik";
import { yetkili } from "@/lib/sunucu/oturum";
import { rolMu } from "@/lib/yetki";

const yetkisiz = () => Response.json({ hata: "Bu işlem için kullanıcı yönetimi izni gerekli." }, { status: 403 });

export async function GET() {
  const vt = await hesapIstemcisi();
  if (!vt || !(await yetkili("kullanici.yonet"))) return yetkisiz();
  const { data, error } = await vt.rpc("kullanicilari_listele");
  if (error) return Response.json({ hata: error.message }, { status: 502 });
  return Response.json(data);
}

export async function POST(istek: Request) {
  const vt = await hesapIstemcisi();
  if (!vt || !(await yetkili("kullanici.yonet"))) return yetkisiz();
  let govde: { kullanici?: unknown; rol?: unknown };
  try {
    govde = await istek.json();
  } catch {
    return Response.json({ hata: "Geçersiz JSON." }, { status: 400 });
  }
  if (typeof govde.kullanici !== "string" || (govde.rol !== null && !rolMu(govde.rol))) {
    return Response.json({ hata: "kullanici ve rol (ya da null) gerekli." }, { status: 400 });
  }
  const { error } = await vt.rpc("rol_ata", { hedef: govde.kullanici, yeni_rol: govde.rol });
  if (error) return Response.json({ hata: error.message }, { status: error.code === "42501" ? 403 : 400 });
  return Response.json({ tamam: true });
}
