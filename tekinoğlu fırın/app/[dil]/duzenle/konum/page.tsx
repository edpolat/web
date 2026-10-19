import type { Metadata } from "next";
import { notFound } from "next/navigation";
import KonumDuzenle, { type DuzenlenecekEser } from "@/components/KonumDuzenle";
import { gecerliDil, metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { iller, tumEserler } from "@/lib/veri";

export const metadata: Metadata = { title: "Konum düzenle · Vakfiye", robots: { index: false } };

// Ekip içi araç: yayında 404 verir; kaydetme ucu (app/api/konum) da yalnız geliştirmede çalışır.
export default async function KonumDuzenleSayfasi({ params }: { params: Promise<{ dil: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const t = s(dil);
  const ilListesi = iller().map(({ il }) => ({
    id: il.id,
    ad: metin(il.ad, dil),
    merkez: { enlem: il.merkez.enlem, boylam: il.merkez.boylam },
    yakinlastirma: il.yakinlastirma ?? 12,
  }));
  const eserler: DuzenlenecekEser[] = tumEserler().map((e) => ({
    id: e.id,
    il: e.il,
    ad: metin(e.ad, dil),
    ilce: e.ilce,
    adres: e.adres ? metin(e.adres, dil) : undefined,
    konum: e.konum,
  }));
  return (
    <section className="konum-duzenle">
      <h1>{t.konumDuzenle}</h1>
      <p className="not">{t.konumDuzenleAciklama}</p>
      <KonumDuzenle dil={dil} iller={ilListesi} eserler={eserler} />
    </section>
  );
}
