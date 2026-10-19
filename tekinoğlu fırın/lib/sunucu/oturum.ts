import "server-only";
import { cookies } from "next/headers";
import { CEREZ, jetonGecerli } from "./yonetim";

/** İsteği yapan yönetim paneline giriş yapmış mı (sayfa ve API uçlarında). */
export async function yoneticiMi(): Promise<boolean> {
  return jetonGecerli((await cookies()).get(CEREZ)?.value);
}
