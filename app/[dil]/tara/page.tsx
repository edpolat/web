import { notFound } from "next/navigation";
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
      <Tara
        dil={dil as Dil}
        rotalar={rotalar()}
        iller={(await yayindakiIller()).map(({ il }) => ({ id: il.id, ad: il.ad }))}
        eserler={(await yayindakiEserler()).map((e) => ({ id: e.id, ad: e.ad }))}
      />
    </div>
  );
}
