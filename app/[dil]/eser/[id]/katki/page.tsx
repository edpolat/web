import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BilgiEkle from "@/components/BilgiEkle";
import { gecerliDil, metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { ayarlar, kaynaklar, yayindakiEser } from "@/lib/veri";

type Params = Promise<{ dil: string; id: string }>;

export const metadata: Metadata = { robots: { index: false } };

export default async function BilgiEkleSayfasi({ params }: { params: Params }) {
  const { dil, id } = await params;
  if (!gecerliDil(dil)) notFound();
  const eser = await yayindakiEser(id);
  if (!eser) notFound();
  const t = s(dil);
  return (
    <section className="kart">
      <p>
        <Link href={`/${dil}/eser/${eser.id}`}>← {metin(eser.ad, dil)}</Link>
      </p>
      <h1>{t.bilgiEkle}</h1>
      <p className="not">{t.bilgiEkleAciklama}</p>
      <BilgiEkle
        dil={dil}
        eserId={eser.id}
        kategoriler={ayarlar().olgu_kategorileri.map((k) => ({ id: k.id, ad: metin(k.ad, dil) }))}
        kaynaklar={[...kaynaklar().values()].map((k) => ({ id: k.id, ad: k.baslik }))}
      />
    </section>
  );
}
