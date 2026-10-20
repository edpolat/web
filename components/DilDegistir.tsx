"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DILLER } from "@/lib/metin";
import type { Dil } from "@/lib/tipler";

const ADLAR: Record<Dil, string> = { tr: "TR", en: "EN" };
const TAM_AD: Record<Dil, string> = { tr: "Türkçe", en: "English" };

/** Mobil uygulamanın açılış ekranındaki gibi iki parçalı dil seçici. */
export default function DilDegistir({ dil, etiket }: { dil: Dil; etiket: string }) {
  const yol = usePathname();
  const sorgu = useSearchParams().toString();
  return (
    <nav aria-label={etiket} className="dil-secici">
      {DILLER.map((d) => (
        <Link
          key={d}
          href={yol.replace(/^\/(tr|en)/, `/${d}`) + (sorgu ? `?${sorgu}` : "")}
          hrefLang={d}
          lang={d}
          aria-current={d === dil ? "true" : undefined}
          title={TAM_AD[d]}
        >
          <span aria-hidden="true">{ADLAR[d]}</span>
          <span className="gizli">{TAM_AD[d]}</span>
        </Link>
      ))}
    </nav>
  );
}
