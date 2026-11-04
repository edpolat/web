import { notFound } from "next/navigation";
import Hesap from "@/components/Hesap";
import { gecerliDil } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import { hesapVerisi } from "@/lib/sunucu/hesap-verisi";

export async function generateMetadata({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  return gecerliDil(dil) ? { title: s(dil).hesabim } : {};
}

// Doğrudan açılınca (yenileme, e-postadaki şifre bağlantısı) tam sayfa. Site içinden "Hesabım"a basınca
// aynı adres @hesap/(.)hesap ile yakalanır ve sağ üstte açılır kart olarak açılır.
export default async function HesapSayfasi({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  return (
    <div className="dar-sayfa">
      <Hesap {...await hesapVerisi(dil as Dil)} />
    </div>
  );
}
