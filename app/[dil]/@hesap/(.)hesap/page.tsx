import { notFound } from "next/navigation";
import Hesap from "@/components/Hesap";
import HesapCekmecesi from "@/components/HesapCekmecesi";
import { gecerliDil } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import { hesapVerisi } from "@/lib/sunucu/hesap-verisi";

/** Site içinden /<dil>/hesap'a gidilince sayfa değişmez; Hesabım sağ üstte açılır kart olarak açılır. */
export default async function HesapPaneli({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const t = s(dil);
  return (
    <HesapCekmecesi baslik={t.hesabim} kapat={t.erisim.kapat}>
      <Hesap {...await hesapVerisi(dil as Dil)} />
    </HesapCekmecesi>
  );
}
