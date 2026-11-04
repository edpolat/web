"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const METIN = {
  tr: { baslik: "Bu sayfa bulunamadı", aciklama: "Aradığın sayfa taşınmış ya da hiç var olmamış olabilir.", don: "Keşfet'e dön" },
  en: { baslik: "Page not found", aciklama: "The page you are looking for may have moved or never existed.", don: "Back to Explore" },
};

export default function Bulunamadi() {
  const dil = usePathname()?.startsWith("/en") ? "en" : "tr";
  const t = METIN[dil];
  return (
    <section className="bulunamadi">
      <p className="bulunamadi-kod" aria-hidden="true">404</p>
      <h1>{t.baslik}</h1>
      <p>{t.aciklama}</p>
      <Link className="dugme" href={`/${dil}`}>
        {t.don}
      </Link>
    </section>
  );
}
