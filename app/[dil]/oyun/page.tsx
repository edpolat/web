import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Muhur from "@/components/Muhur";
import OyunGomulu from "@/components/OyunGomulu";
import { gecerliDil } from "@/lib/metin";
import { s } from "@/lib/sozluk";

export async function generateMetadata({ params }: { params: Promise<{ dil: string }> }): Promise<Metadata> {
  const { dil } = await params;
  if (!gecerliDil(dil)) return {};
  return { title: s(dil).oyun.baslik, description: s(dil).oyun.giris };
}

export default async function OyunSayfasi({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const t = s(dil).oyun;
  return (
    <>
      <section className="kapak oyun-kapak">
        <div className="kapak-metin">
          <p className="ust-baslik">{t.kapakUst}</p>
          <h1>{t.baslik}</h1>
          <p className="kapak-slogan">{t.kapakAciklama}</p>
          <dl className="sayaclar oyun-dongu">
            {t.dongu.map((x) => (
              <div key={x.ad}>
                <dt>{x.aciklama}</dt>
                <dd>{x.ad}</dd>
              </div>
            ))}
          </dl>
          <p className="oyun-kapak-not">{t.pasaportNotu}</p>
        </div>
        <Muhur boyut={180} className="kapak-muhur" />
      </section>
      <OyunGomulu dil={dil} />
    </>
  );
}
