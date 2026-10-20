// Giriş yapan kişi, rolü ve izinleri (web paneli ve mobil uygulama için). Girişsizse 401.
import { panelKimligi } from "@/lib/sunucu/oturum";

export async function GET() {
  const k = await panelKimligi();
  return k ? Response.json(k) : Response.json({ hata: "Giriş gerekli." }, { status: 401 });
}
