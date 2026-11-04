"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CikisDugmesi } from "@/components/YonetimGiris";
import type { Dil } from "@/lib/tipler";

export type PanelOgesi = { yol: string; ad: string; ayrica?: string; sayi?: number };
export type PanelGrubu = { baslik?: string; ogeler: PanelOgesi[] };

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
          {gruplar.map((g, i) => (
            <div key={g.baslik ?? i} className="panel-grup">
              {g.baslik && <p className="panel-grup-baslik">{g.baslik}</p>}
              <ul>
                {g.ogeler.map((o) => (
                  <li key={o.yol}>
                    <Link href={o.yol} aria-current={aktifMi(o) ? "page" : undefined}>
                      <span>{o.ad}</span>
                      {!!o.sayi && <span className="sayac">{o.sayi}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
