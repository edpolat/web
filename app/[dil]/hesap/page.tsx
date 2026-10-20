import { notFound } from "next/navigation";
import Hesap from "@/components/Hesap";
import { gecerliDil } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import { iller, rotalar, yayindakiEserler } from "@/lib/veri";

export async function generateMetadata({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  return gecerliDil(dil) ? { title: s(dil).hesabim } : {};
}

export default async function HesapSayfasi({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const eserler = (await yayindakiEserler()).map((e) => ({ id: e.id, ad: e.ad }));
  return (
    <div className="dar-sayfa">
      <Hesap
        dil={dil as Dil}
        eserler={eserler}
        rotalar={rotalar()}
        iller={iller().map(({ il }) => ({ id: il.id, ad: il.ad }))}
      />
    </div>
  );
}
