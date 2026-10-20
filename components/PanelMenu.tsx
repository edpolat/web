"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Panel sayfalarının üstündeki menü. Bulunulan sayfa aria-current ile işaretlenir; ana sayfa yalnız tam eşleşmede, ayrica alt sayfaları da kapsar. */
export default function PanelMenu({ etiket, ogeler }: { etiket: string; ogeler: { yol: string; ad: string; ayrica?: string }[] }) {
  const yol = usePathname();
  const kok = ogeler[0]?.yol;
  return (
    <nav className="panel-menu" aria-label={etiket}>
      <ul>
        {ogeler.map((o) => {
          const icinde = (y: string) => yol === y || yol.startsWith(`${y}/`);
          const aktif = o.yol === kok ? yol === kok : icinde(o.yol) || (!!o.ayrica && icinde(o.ayrica));
          return (
            <li key={o.yol}>
              <Link href={o.yol} aria-current={aktif ? "page" : undefined}>
                {o.ad}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
