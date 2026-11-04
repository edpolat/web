import Link from "next/link";
import { notFound } from "next/navigation";
import { s } from "@/lib/sozluk";
import Tara from "@/components/Tara";
import { gecerliDil } from "@/lib/metin";
import type { Dil } from "@/lib/tipler";
import { rotalar, yayindakiEserler, yayindakiIller } from "@/lib/veri";
import { z } from "@/lib/ziyaret";

export async function generateMetadata({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  return gecerliDil(dil) ? { title: z(dil).tara.sekme } : {};
}

export default async function TaraSayfasi({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  return (
    <div className="dar-sayfa">
      <p className="geri-baglanti">
        <Link href={`/${dil}/hesap`} scroll={false}>← {s(dil as Dil).hesabim}</Link>
      </p>
      <Tara
        dil={dil as Dil}
        rotalar={rotalar()}
        iller={(await yayindakiIller()).map(({ il }) => ({ id: il.id, ad: il.ad }))}
        eserler={(await yayindakiEserler()).map((e) => ({ id: e.id, ad: e.ad }))}
      />
    </div>
  );
}
