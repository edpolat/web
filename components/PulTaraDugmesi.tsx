import Link from "next/link";
import Simge from "@/components/Simge";
import type { Dil } from "@/lib/tipler";
import { z } from "@/lib/ziyaret";

/**
 * Hesabım'daki pasaport kartında "Pul tara" düğmesi. Webde ayrı Tara sekmesi yok (masaüstünde kamerayla
 * taranmıyor); tarama sayfası /[dil]/tara buradan ve eser sayfasındaki "Buradaysan tara" bağlantısından açılır.
 */
export default function PulTaraDugmesi({ dil }: { dil: Dil }) {
  return (
    <Link href={`/${dil}/tara`} className="dugme pul-tara">
      <Simge ad="tara" boyut={18} /> {z(dil).tara.pulTara}
    </Link>
  );
}
