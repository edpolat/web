import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DILLER, gecerliDil } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import DilDegistir from "@/components/DilDegistir";
import UstMenu from "@/components/UstMenu";
import YonetimBaglantisi from "@/components/YonetimBaglantisi";
import ErisimPaneli from "@/components/ErisimPaneli";
import Muhur from "@/components/Muhur";
import { ERISIM_BETIGI } from "@/lib/erisim";
import "leaflet/dist/leaflet.css";
import "../globals.css";

export function generateStaticParams() {
  return DILLER.map((dil) => ({ dil }));
}

export async function generateMetadata({ params }: { params: Promise<{ dil: string }> }): Promise<Metadata> {
  const { dil } = await params;
  if (!gecerliDil(dil)) return {};
  return {
    title: { default: s(dil).site, template: `%s · ${s(dil).site}` },
    description: s(dil).slogan,
    icons: { icon: "/ikon/ikon-192.png", apple: "/ikon/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: "Vakfiye", statusBarStyle: "default" },
  };
}

export default async function Yerlesim({
  children,
  hesap,
  params,
}: {
  children: React.ReactNode;
  /** Hesabım açılır kartı (@hesap bölmesi); yalnız site içinden Hesabım'a gidilince dolu. */
  hesap: React.ReactNode;
  params: Promise<{ dil: string }>;
}) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const t = s(dil);
  return (
    <html lang={dil} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ERISIM_BETIGI }} />
      </head>
      {/* Tarayıcı eklentileri (ör. Video Speed Controller) body'ye sınıf ekliyor; bu uyarıyı bastır. */}
      <body suppressHydrationWarning>
        <a className="atla" href="#icerik">
          {t.icerigeGec}
        </a>
        <header className="ust">
          <div className="ust-sol">
            <Link href={`/${dil}`} className="logo">
              <Muhur boyut={34} className="logo-muhur" />
              {t.site}
            </Link>
            <UstMenu
              dil={dil}
              etiket={t.anaMenu}
              sekmeler={[
                { yol: "", ad: t.kesfet, simge: "kesfet" },
                { yol: "/sergiler", ad: t.sergilerSekme, simge: "sergi" },
                { yol: "/oyun", ad: t.oyunSekme, simge: "oyun" },
              ]}
            />
          </div>
          <div className="ust-sag">
            <YonetimBaglantisi dil={dil} ad={t.yonetim} />
            {/* Hesabım, Erişilebilirlik gibi sağ üstte açılan bir kart; bağlantı da bu yüzden sağda. */}
            <Link href={`/${dil}/hesap`} className="sekme-hesap" scroll={false}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
              </svg>
              <span className="sekme-hesap-yazi">{t.hesabim}</span>
            </Link>
            <ErisimPaneli dil={dil} />
            <Suspense>
              <DilDegistir dil={dil} etiket={t.dilDegistir} />
            </Suspense>
          </div>
        </header>
        <main id="icerik">{children}</main>
        {hesap}
      </body>
    </html>
  );
}
