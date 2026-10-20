import { notFound } from "next/navigation";
import { Suspense } from "react";
import { gecerliDil } from "@/lib/metin";
import { ayarlar, iller, yayindakiKesifEserleri } from "@/lib/veri";
import { s } from "@/lib/sozluk";
import Kesif from "@/components/Kesif";
import Muhur from "@/components/Muhur";

export default async function AnaSayfa({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const t = s(dil);
  const eserler = await yayindakiKesifEserleri();
  const kullanilanTurler = new Set(eserler.map((e) => e.tur));
  const sehirler = iller().map(({ il }) => il);
  const sayilar = [
    { deger: eserler.length, ad: t.sayac.eser },
    { deger: sehirler.length, ad: t.sayac.sehir },
    { deger: eserler.reduce((n, e) => n + e.gorselSayisi, 0), ad: t.sayac.fotograf },
    { deger: eserler.reduce((n, e) => n + e.kaynakliSayisi, 0), ad: t.sayac.kaynakli },
  ];
  return (
    <>
      <section className="kapak">
        <div className="kapak-metin">
          <p className="ust-baslik">{t.kapakUst}</p>
          <h1>{t.site}</h1>
          <p className="kapak-slogan">{t.slogan}</p>
          <dl className="sayaclar">
            {sayilar.map((x) => (
              <div key={x.ad}>
                <dt>{x.ad}</dt>
                <dd>{x.deger.toLocaleString(dil === "tr" ? "tr-TR" : "en-GB")}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Muhur boyut={180} className="kapak-muhur" />
      </section>
      <Suspense>
        <Kesif
          dil={dil}
          eserler={eserler}
          iller={sehirler}
          turler={ayarlar().eser_turleri.filter((tr) => kullanilanTurler.has(tr.id))}
        />
      </Suspense>
    </>
  );
}
