import { notFound } from "next/navigation";
import Hesap from "@/components/Hesap";
import { gecerliDil } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import { konumEksik } from "@/lib/filtre";
import { ayarlar, rotalar, yayindakiEserler, yayindakiIller } from "@/lib/veri";

export async function generateMetadata({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  return gecerliDil(dil) ? { title: s(dil).hesabim } : {};
}

export default async function HesapSayfasi({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  // Gitmek istediklerim ve Rotalarım kartları için tür, il, ilçe ve konum da gerekir.
  const eserler = (await yayindakiEserler()).map((e) => ({
    id: e.id,
    ad: e.ad,
    tur: e.tur,
    il: e.il,
    ilce: e.ilce,
    konum: e.konum ? { enlem: e.konum.enlem, boylam: e.konum.boylam } : undefined,
    yaklasik: konumEksik(e.konum),
  }));
  return (
    <div className="dar-sayfa">
      <Hesap
        dil={dil as Dil}
        eserler={eserler}
        rotalar={rotalar()}
        iller={(await yayindakiIller()).map(({ il }) => ({ id: il.id, ad: il.ad }))}
        turAdlari={Object.fromEntries(ayarlar().eser_turleri.map((t) => [t.id, t.ad]))}
      />
    </div>
  );
}
