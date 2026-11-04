"use client";
import { useEffect, useRef, useState } from "react";
import { kucukGorsel } from "@/lib/gorsel";
import { metin } from "@/lib/metin";
import type { Dil, Gorsel } from "@/lib/tipler";

/** Eser sayfası: kapak + şerit tek yerde; tıklayınca büyük görünüm, ← → ile gezinme, Esc ile kapanır. */
export default function KapakGaleri({ dil, gorseller, galeriAdi }: { dil: Dil; gorseller: Gorsel[]; galeriAdi: string }) {
  const [secili, setSecili] = useState(0);
  const pencere = useRef<HTMLDialogElement>(null);
  const n = gorseller.length;
  const kaydir = (adim: number) => setSecili((i) => (i + adim + n) % n);
  function ac(i: number) {
    setSecili(i);
    pencere.current?.showModal();
  }
  useEffect(() => {
    function tus(e: KeyboardEvent) {
      if (!pencere.current?.open) return;
      if (e.key === "ArrowRight") kaydir(1);
      if (e.key === "ArrowLeft") kaydir(-1);
    }
    document.addEventListener("keydown", tus);
    return () => document.removeEventListener("keydown", tus);
  });
  if (!n) return null;
  const kapak = gorseller[0];
  const g = gorseller[secili];
  const serit = gorseller.slice(1, 6);
  const kalan = n - 1 - serit.length;
  return (
    <>
      <figure className="eser-kapak">
        <button type="button" className="kapak-ac" onClick={() => ac(0)} aria-label={`${galeriAdi} (${n})`}>
          <img src={kapak.dosya} alt={metin(kapak.alt, dil)} width={1600} height={900} style={kapak.odak ? { objectPosition: kapak.odak } : undefined} />
        </button>
        {n > 1 && (
          <figcaption>
            <button type="button" onClick={() => ac(0)}>
              {galeriAdi} ({n})
            </button>
          </figcaption>
        )}
      </figure>
      {serit.length > 0 && (
        <ul className="kapak-seridi">
          {serit.map((gr, i) => (
            <li key={gr.dosya}>
              <button type="button" onClick={() => ac(i + 1)}>
                <img src={kucukGorsel(gr.dosya)} alt={metin(gr.alt, dil)} loading="lazy" width={160} height={120} />
                {i === serit.length - 1 && kalan > 0 && <span className="kapak-seridi-kalan">+{kalan}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <dialog ref={pencere} className="isik-kutusu" onClick={(e) => e.target === e.currentTarget && pencere.current?.close()}>
        <button type="button" className="isik-kapat" onClick={() => pencere.current?.close()} aria-label="✕">✕</button>
        <button type="button" className="isik-ok sol" onClick={() => kaydir(-1)} aria-label="←">‹</button>
        <figure>
          <img src={g.dosya} alt={metin(g.alt, dil)} />
          <figcaption>
            <span>{secili + 1} / {n}</span>
            <span>{g.aciklama ? `${metin(g.aciklama, dil)} · ` : ""}© {g.atif}</span>
          </figcaption>
        </figure>
        <button type="button" className="isik-ok sag" onClick={() => kaydir(1)} aria-label="→">›</button>
        <ul className="isik-serit">
          {gorseller.map((gr, i) => (
            <li key={gr.dosya}>
              <button type="button" aria-current={i === secili} onClick={() => setSecili(i)}>
                <img src={kucukGorsel(gr.dosya)} alt="" />
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
