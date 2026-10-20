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
import { ERISIM_BETIGI } from "@/lib/erisim";
import "leaflet/dist/leaflet.css";
import "../globals.css";

export function generateStaticParams() {
  return DILLER.map((dil) => ({ dil }));
}

export async function generateMetadata({ params }: { params: Promise<{ dil: string }> }): Promise<Metadata> {
  const { dil } = await params;
  if (!gecerliDil(dil)) return {};
  return { title: { default: s(dil).site, template: `%s · ${s(dil).site}` }, description: s(dil).slogan };
}

export default async function Yerlesim({
  children,
  params,
}: {
  children: React.ReactNode;
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
            <ErisimPaneli dil={dil} />
            <Link href={`/${dil}/hesap`} className="sekme-yonetim">
              {t.hesabim}
            </Link>
            <YonetimBaglantisi dil={dil} ad={t.yonetim} />
            <Suspense>
              <DilDegistir dil={dil} etiket={t.dilDegistir} />
            </Suspense>
          </div>
        </header>
        <main id="icerik">{children}</main>
      </body>
    </html>
  );
}
