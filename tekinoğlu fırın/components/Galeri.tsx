"use client";
import { useRef, useState } from "react";
import { kucukGorsel } from "@/lib/gorsel";
import { metin } from "@/lib/metin";
import type { Dil, Gorsel } from "@/lib/tipler";

type Props = { dil: Dil; gorseller: Gorsel[]; bosMetin: string };

export default function Galeri({ dil, gorseller, bosMetin }: Props) {
  const [secili, setSecili] = useState(0);
  const pencere = useRef<HTMLDialogElement>(null);
  if (gorseller.length === 0) return <p className="not">{bosMetin}</p>;

  function ac(i: number) {
    setSecili(i);
    pencere.current?.showModal();
  }
  function kaydir(adim: number) {
    setSecili((i) => (i + adim + gorseller.length) % gorseller.length);
  }
  const g = gorseller[secili];

  return (
    <>
      <ul className="galeri">
        {gorseller.map((gr, i) => (
          <li key={gr.dosya}>
            <button type="button" onClick={() => ac(i)}>
              <img src={kucukGorsel(gr.dosya)} alt={metin(gr.alt, dil)} loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={pencere}
        className="buyuk-gorsel"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") kaydir(1);
          if (e.key === "ArrowLeft") kaydir(-1);
        }}
      >
        <figure>
          <img src={g.dosya} alt={metin(g.alt, dil)} />
          <figcaption>
            {g.aciklama ? `${metin(g.aciklama, dil)} · ` : ""}© {g.atif} ({g.lisans})
          </figcaption>
        </figure>
        <div className="galeri-dugmeler">
          <button type="button" onClick={() => kaydir(-1)} aria-label="←">←</button>
          <span>
            {secili + 1} / {gorseller.length}
          </span>
          <button type="button" onClick={() => kaydir(1)} aria-label="→">→</button>
          <button type="button" onClick={() => pencere.current?.close()}>✕</button>
        </div>
      </dialog>
    </>
  );
}
