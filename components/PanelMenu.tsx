"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CikisDugmesi } from "@/components/YonetimGiris";
import type { Dil } from "@/lib/tipler";

export type PanelOgesi = { yol: string; ad: string; ayrica?: string; sayi?: number };
export type PanelGrubu = { anahtar?: string; baslik?: string; ogeler: PanelOgesi[] };

/** Menü simgeleri: yolun son parçasına ya da grup anahtarına göre (16px, çizgi simge, currentColor). */
const YOLLAR: Record<string, string> = {
  pano: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  is: "M4 6h16M4 12h10M4 18h7M17 15l2 2 3-4",
  icerik: "M4 4h12l4 4v12H4zM8 10h8M8 14h8M8 18h5",
  yonetim: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z",
  inceleme: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9",
  katkilarim: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  eserler: "M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6",
  iller: "M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  sergiler: "M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6",
  kaynaklar: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5",
  kullanicilar: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  denetim: "M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
};
export function PanelIkon({ ad, boyut = 18 }: { ad: string; boyut?: number }) {
  const d = YOLLAR[ad];
  if (!d) return null;
  return (
    <svg className="panel-ikon" width={boyut} height={boyut} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const sonParca = (yol: string, kok: string) => (yol === kok ? "pano" : yol.slice(kok.length + 1).split("/")[0]);

const aktiflik = (yol: string, kok: string) => {
  const icinde = (y: string) => yol === y || yol.startsWith(`${y}/`);
  return (o: PanelOgesi) => (o.yol === kok ? yol === kok : icinde(o.yol) || (!!o.ayrica && icinde(o.ayrica)));
};

/** Konum izi: "İçerik › Eserler". Alt sayfadayken (ör. bir eserin geçmişi) bölüm adı listeye dönen bağlantı olur. */
export function PanelIz({ kok, gruplar, sinif = "panel-iz" }: { kok: string; gruplar: PanelGrubu[]; sinif?: string }) {
  const yol = usePathname();
  const aktifMi = aktiflik(yol, kok);
  const grup = gruplar.find((g) => g.ogeler.some(aktifMi));
  const oge = grup?.ogeler.find(aktifMi);
  if (!oge) return null;
  return (
    <p className={sinif}>
      {grup?.baslik && <span>{grup.baslik} › </span>}
      {yol !== oge.yol ? <Link href={oge.yol}>{oge.ad}</Link> : <strong>{oge.ad}</strong>}
    </p>
  );
}

type Yazilar = { menu: string; panelAdi: string; menuAc: string; menuKapat: string; siteyeDon: string; yeniEser: string };

/**
 * Panelin sol kenar menüsü: gruplar (İş kuyruğu, İçerik, Yönetim), bekleyen iş sayaçları, giriş yapan kişi ve çıkış.
 * Dar ekranda üstte bir çubuğa dönüşür; ☰ ile açılır, sayfa değişince kapanır.
 * Bulunulan sayfa aria-current ile işaretlenir; ana sayfa yalnız tam eşleşmede, ayrica alt sayfaları da kapsar.
 */
export default function PanelMenu({
  dil,
  kok,
  gruplar,
  yazilar,
  kisi,
  yeniEser,
}: {
  dil: Dil;
  kok: string;
  gruplar: PanelGrubu[];
  yazilar: Yazilar;
  kisi: { ad: string; eposta?: string; rol: string };
  yeniEser?: string;
}) {
  const yol = usePathname();
  const [acik, setAcik] = useState(false);
  useEffect(() => setAcik(false), [yol]);

  const aktifMi = aktiflik(yol, kok);

  return (
    <aside className="panel-kenar" data-acik={acik || undefined}>
      <div className="panel-kenar-ust">
        <Link href={kok} className="panel-logo">
          Vakfiye<small>{yazilar.panelAdi}</small>
        </Link>
        <Link href={`/${dil}`} className="panel-siteye-don">
          <span aria-hidden="true">←</span> {yazilar.siteyeDon}
        </Link>
        <button type="button" className="panel-menu-dugme" aria-expanded={acik} aria-controls="panel-menu" onClick={() => setAcik(!acik)}>
          <span aria-hidden="true">{acik ? "✕" : "☰"}</span>
          <span className="gizli">{acik ? yazilar.menuKapat : yazilar.menuAc}</span>
        </button>
      </div>
      <PanelIz kok={kok} gruplar={gruplar} sinif="panel-iz panel-iz-mobil" />
      <div className="panel-kenar-govde" id="panel-menu">
        {yeniEser && (
          <Link className="dugme panel-yeni" href={yeniEser}>
            + {yazilar.yeniEser}
          </Link>
        )}
        <nav className="panel-menu" aria-label={yazilar.menu}>
          {gruplar.map((g, i) => {
            const grupAktif = g.ogeler.some(aktifMi);
            // Başlığı olmayan grup (Pano) tek satırlık ana başlık gibi durur.
            if (!g.baslik)
              return (
                <div key={g.anahtar ?? i} className="panel-grup panel-grup-tek" data-grup={g.anahtar}>
                  {g.ogeler.map((o) => (
                    <Link key={o.yol} href={o.yol} className="panel-grup-baslik" aria-current={aktifMi(o) ? "page" : undefined}>
                      <PanelIkon ad={g.anahtar ?? sonParca(o.yol, kok)} />
                      <span>{o.ad}</span>
                    </Link>
                  ))}
                </div>
              );
            return (
              <div key={g.anahtar ?? i} className="panel-grup" data-grup={g.anahtar} data-aktif={grupAktif || undefined}>
                <p className="panel-grup-baslik">
                  {g.anahtar && <PanelIkon ad={g.anahtar} />}
                  <span>{g.baslik}</span>
                </p>
                <ul>
                  {g.ogeler.map((o) => (
                    <li key={o.yol}>
                      <Link href={o.yol} aria-current={aktifMi(o) ? "page" : undefined}>
                        <PanelIkon ad={sonParca(o.yol, kok)} boyut={16} />
                        <span className="panel-oge-ad">{o.ad}</span>
                        {!!o.sayi && <span className="sayac">{o.sayi}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="panel-kisi">
          <strong>{kisi.ad}</strong>
          {kisi.eposta && <small>{kisi.eposta}</small>}
          <span className="rozet">{kisi.rol}</span>
          <CikisDugmesi dil={dil} />
        </div>
      </div>
    </aside>
  );
}
