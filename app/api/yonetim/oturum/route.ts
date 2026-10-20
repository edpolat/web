// Panel oturumu: tarayıcıdaki Supabase jetonu httpOnly çereze yazılır (POST) ya da silinir (DELETE),
// böylece sunucu sayfaları ve API uçları panele kimin girdiğini bilir.
import { cookies } from "next/headers";
import { HESAP_CEREZI, jetondanKimlik, jetonOmru } from "@/lib/sunucu/kimlik";

export async function POST(istek: Request) {
  const baslik = istek.headers.get("authorization");
  const jeton = baslik?.startsWith("Bearer ") ? baslik.slice(7) : "";
  if (!jeton || !(await jetondanKimlik(jeton))) return Response.json({ hata: "Oturum geçersiz." }, { status: 401 });
  const cerezler = await cookies();
  const degisti = cerezler.get(HESAP_CEREZI)?.value !== jeton;
  cerezler.set(HESAP_CEREZI, jeton, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: jetonOmru(jeton),
  });
  return Response.json({ degisti });
}

export async function DELETE() {
  const cerezler = await cookies();
  const degisti = cerezler.has(HESAP_CEREZI);
  cerezler.delete(HESAP_CEREZI);
  return Response.json({ degisti });
}
