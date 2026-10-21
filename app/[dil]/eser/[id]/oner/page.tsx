import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import OneriFormu from "@/components/OneriFormu";
import { gecerliDil, metin } from "@/lib/metin";
import { ONERI_ALANLARI, mevcutDeger } from "@/lib/oneri";
import { s } from "@/lib/sozluk";
import { dogrulanmisKaynaklar } from "@/lib/sunucu/kaynak-depo";
import { yayindakiEser } from "@/lib/veri";

export const metadata: Metadata = { robots: { index: false } };

/** Ziyaretçinin bilgi önerisi. Öneri kuyruğa düşer, sitede hiçbir şeyi değiştirmez. */
export default async function OneriSayfasi({ params }: { params: Promise<{ dil: string; id: string }> }) {
  const { dil, id } = await params;
  if (!gecerliDil(dil)) notFound();
  const eser = await yayindakiEser(id);
  if (!eser) notFound();
  const t = s(dil).oneri;
  const kaynaklar = await dogrulanmisKaynaklar();
  return (
    <section className="kart">
      <p>
        <Link href={`/${dil}/eser/${eser.id}`}>← {metin(eser.ad, dil)}</Link>
      </p>
      <h1>{t.baslik}</h1>
      <p className="not">{t.aciklama}</p>
      <OneriFormu
        dil={dil}
        eserId={eser.id}
        mevcut={Object.fromEntries(ONERI_ALANLARI.map((a) => [a, mevcutDeger(eser, a)]))}
        mevcutEn={Object.fromEntries(ONERI_ALANLARI.map((a) => [a, mevcutDeger(eser, a, "en")]))}
        kaynaklar={kaynaklar.map((k) => ({ id: k.id, ad: k.baslik }))}
      />
    </section>
  );
}
