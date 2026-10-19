import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Oyun from "@/components/Oyun";
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
      <section className="giris">
        <h1>{t.baslik}</h1>
        <p>{t.giris}</p>
      </section>
      <Suspense>
        <Oyun dil={dil} />
      </Suspense>
    </>
  );
}
