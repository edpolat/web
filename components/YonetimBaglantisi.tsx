"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { bulutHazir, erisimJetonu, oturumIzle } from "@/lib/bulut";

/**
 * Üst menüdeki "Yönetim" bağlantısı yalnız panelde rolü olana görünür. Rol sunucuya sorulur (/api/yonetim/ben);
 * ziyaretçi için istek bile gitmez. Geliştirmede tek şifreli giriş (çerez) de sayılır.
 */
export default function YonetimBaglantisi({ dil, ad }: { dil: string; ad: string }) {
  const [goster, setGoster] = useState(false);
  const yol = usePathname();
  useEffect(() => {
    let iptal = false;
    async function sor(jeton: string | null) {
      if (!jeton && process.env.NODE_ENV === "production") return setGoster(false);
      const yanit = await fetch("/api/yonetim/ben", jeton ? { headers: { Authorization: `Bearer ${jeton}` } } : undefined).catch(() => null);
      const veri = yanit?.ok ? ((await yanit.json()) as { rol?: string | null }) : null;
      if (!iptal) setGoster(Boolean(veri?.rol));
    }
    if (!bulutHazir) {
      sor(null);
      return;
    }
    erisimJetonu().then(sor);
    const birak = oturumIzle(sor);
    return () => {
      iptal = true;
      birak();
    };
  }, []);
  if (!goster) return null;
  return (
    <Link href={`/${dil}/yonetim`} className="sekme-yonetim" aria-current={yol.startsWith(`/${dil}/yonetim`) ? "page" : undefined}>
      {/* Hesabım düğmesiyle aynı biçim: 20px çizgi simge + yazı (dar ekranda yalnız simge) */}
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
      <span className="sekme-hesap-yazi">{ad}</span>
    </Link>
  );
}
