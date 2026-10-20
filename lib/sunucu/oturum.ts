import "server-only";
import { cookies } from "next/headers";
import { ROL_IZINLERI, izinli, paneldeMi, type Izin, type Kimlik } from "../yetki";
import { kimlik } from "./kimlik";
import { CEREZ, jetonGecerli } from "./yonetim";

/** Geliştirmedeki tek şifreli giriş (yayında kapalı). Kullanıcı yönetimi gerçek hesap ister. */
const YEREL: Kimlik = {
  id: "yerel",
  eposta: "",
  ad: "Yerel yönetici",
  rol: "super_admin",
  izinler: ROL_IZINLERI.super_admin.filter((i) => i !== "kullanici.yonet"),
};

/** Panelde işlem yapan kişi: Supabase hesabı ya da geliştirmede şifreli giriş. */
export async function panelKimligi(): Promise<Kimlik | null> {
  if (jetonGecerli((await cookies()).get(CEREZ)?.value)) return YEREL;
  return kimlik();
}

/** İsteği yapanın bu izni var mı (sayfa ve API uçlarında). */
export async function yetkili(izin: Izin): Promise<boolean> {
  return izinli(await panelKimligi(), izin);
}

/** İsteği yapan yönetim paneline giriş yapmış mı: rolü olan hesap (görüntüleyici dahil). */
export async function yoneticiMi(): Promise<boolean> {
  return paneldeMi(await panelKimligi());
}
