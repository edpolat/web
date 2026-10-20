"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { bulutHazir, erisimJetonu, oturumIzle } from "@/lib/bulut";

/**
 * Üst menüdeki "Yönetim" bağlantısı yalnız panelde rolü olana görünür. Rol sunucuya sorulur (/api/yonetim/ben);
 * ziyaretçi için istek bile gitmez. Geliştirmede tek şifreli giriş (çerez) de sayılır.
 */
export default function YonetimBaglantisi({ dil, ad }: { dil: string; ad: string }) {
  const [goster, setGoster] = useState(false);
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
    <Link href={`/${dil}/yonetim`} className="sekme-yonetim">
      {ad}
    </Link>
  );
}
