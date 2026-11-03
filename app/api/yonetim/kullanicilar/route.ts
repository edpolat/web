// Kullanıcı yönetimi (yalnız kullanici.yonet). GET hesapları ve rolleri listeler, POST rol verir ya da geri alır.
// Asıl kontrol Supabase'deki kullanicilari_listele() ve rol_ata() fonksiyonlarında da yapılır.
// Birini sistem yöneticisi (super_admin) yapmak için işlemi yapan kendi şifresini yeniden girer: şifre burada
// Supabase Auth'a doğrulatılır ve rol, o yeni girişin jetonuyla atanır (016_rol_sifre_onayi.sql bunu veritabanında da arar).
import { createClient } from "@supabase/supabase-js";
import { hesapIstemcisi, kimlik, kullaniciIstemcisi } from "@/lib/sunucu/kimlik";
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
  let govde: { kullanici?: unknown; rol?: unknown; sifre?: unknown };
  try {
    govde = await istek.json();
  } catch {
    return Response.json({ hata: "Geçersiz JSON." }, { status: 400 });
  }
  if (typeof govde.kullanici !== "string" || (govde.rol !== null && !rolMu(govde.rol))) {
    return Response.json({ hata: "kullanici ve rol (ya da null) gerekli." }, { status: 400 });
  }
  let istemci = vt;
  let tazeGiris: ReturnType<typeof createClient> | null = null;
  if (govde.rol === "super_admin") {
    const ben = await kimlik();
    if (typeof govde.sifre !== "string" || !govde.sifre || !ben?.eposta) {
      return Response.json({ hata: "Sistem yöneticisi atamak için şifreni girmelisin.", sifreGerekli: true }, { status: 401 });
    }
    tazeGiris = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await tazeGiris.auth.signInWithPassword({ email: ben.eposta, password: govde.sifre });
    if (error || !data.session || data.user?.id !== ben.id) {
      return Response.json({ hata: "Şifre yanlış. Rol değiştirilmedi.", sifreGerekli: true }, { status: 401 });
    }
    istemci = kullaniciIstemcisi(data.session.access_token);
  }
  const { error } = await istemci.rpc("rol_ata", { hedef: govde.kullanici, yeni_rol: govde.rol });
  // Doğrulama için açılan oturum yalnız bu işlem içindi: kapatılır (kişinin asıl oturumu açık kalır).
  if (tazeGiris) await tazeGiris.auth.signOut({ scope: "local" }).catch(() => {});
  if (error) return Response.json({ hata: error.message }, { status: error.code === "42501" ? 403 : 400 });
  return Response.json({ tamam: true });
}
