"use client";
import { useState } from "react";
import { TERIMLER, terimleriBol } from "@/lib/mimari-sozluk";
import type { Dil } from "@/lib/tipler";
import { z } from "@/lib/ziyaret";

/** Mimari sözlük: metindeki terimlerin altı noktalı çizilir, dokununca açıklaması açılır (mobil uygulamadaki gibi). */
export default function TerimliMetin({ metin, dil }: { metin: string; dil: Dil }) {
  const t = z(dil).terim;
  const [acik, setAcik] = useState<number>();
  const parcalar = terimleriBol(metin, dil);
  const terim = acik !== undefined ? TERIMLER[acik] : undefined;
  return (
    <>
      {parcalar.map((p, i) =>
        typeof p === "string" ? (
          p
        ) : (
          <button key={i} type="button" className="terim" onClick={() => setAcik(p.terim)} aria-haspopup="dialog">
            {p.yazi}
          </button>
        ),
      )}
      {terim && (
        <span className="katman" role="dialog" aria-modal="true" aria-labelledby={`terim-${acik}`} onClick={(e) => e.target === e.currentTarget && setAcik(undefined)}>
          <span className="katman-kutu">
            <span className="katman-ust">
              <b id={`terim-${acik}`}>{terim[0]}</b>
              <button type="button" className="katman-kapat" onClick={() => setAcik(undefined)} aria-label={t.kapat} autoFocus>
                ✕
              </button>
            </span>
            <span className="kart-baslik">{t.etiket}</span>
            <span className="terim-aciklama">{dil === "en" ? terim[4] : terim[3]}</span>
          </span>
        </span>
      )}
    </>
  );
}
