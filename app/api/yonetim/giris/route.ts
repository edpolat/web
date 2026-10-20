// Yönetim paneli girişi (POST) ve çıkışı (DELETE).
import { cookies } from "next/headers";
import { CEREZ, jeton, sifreDogru, yonetimSifresi } from "@/lib/sunucu/yonetim";

export async function POST(istek: Request) {
  const sifre = yonetimSifresi();
  if (!sifre) return Response.json({ hata: "Yönetim şifresi tanımlı değil (.env.local > VAKFIYE_YONETIM_SIFRESI)." }, { status: 503 });
  let govde: { sifre?: unknown };
  try {
    govde = await istek.json();
  } catch {
    return Response.json({ hata: "Geçersiz JSON." }, { status: 400 });
  }
  if (!sifreDogru(govde.sifre, sifre)) return Response.json({ hata: "Şifre yanlış." }, { status: 401 });
  (await cookies()).set(CEREZ, jeton(sifre), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });
  return Response.json({ tamam: true });
}

export async function DELETE() {
  (await cookies()).delete(CEREZ);
  return Response.json({ tamam: true });
}
