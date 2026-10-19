"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Simge, { type SimgeAdi } from "./Simge";

export type Sekme = { yol: string; ad: string; simge: SimgeAdi };

// Üst menüdeki sekmeler, mobil uygulamanın alt menüsüyle aynı simgelerle. Bulunulan sekme aria-current ile işaretlenir.
export default function UstMenu({ dil, etiket, sekmeler }: { dil: string; etiket: string; sekmeler: Sekme[] }) {
  const yol = usePathname();
  const kok = `/${dil}`;
  return (
    <nav aria-label={etiket}>
      <ul className="sekmeler">
        {sekmeler.map((sekme) => {
          const hedef = `${kok}${sekme.yol}`;
          const aktif = sekme.yol === "" ? yol === kok || yol.startsWith(`${kok}/eser`) : yol.startsWith(hedef);
          return (
            <li key={sekme.yol}>
              <Link href={hedef} aria-current={aktif ? "page" : undefined}>
                <Simge ad={sekme.simge} />
                {sekme.ad}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
