"use client";
import { useEffect, useRef, useState } from "react";
import { ERISIM_ANAHTARI, VARSAYILAN_ERISIM, erisimUygula, type ErisimTercihi } from "@/lib/erisim";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import Simge from "./Simge";

/** Üst menüdeki "Aa Erişilebilirlik" düğmesi ve açılan panel. Esc ile kapanır, odak düğmeye döner. */
export default function ErisimPaneli({ dil }: { dil: Dil }) {
  const t = s(dil).erisim;
  const [acik, setAcik] = useState(false);
  const [tercih, setTercih] = useState<ErisimTercihi>(VARSAYILAN_ERISIM);
  const dugme = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setTercih({ ...VARSAYILAN_ERISIM, ...JSON.parse(localStorage.getItem(ERISIM_ANAHTARI) ?? "{}") });
    } catch {
      // Depolama kapalıysa varsayılanlar kalır.
    }
  }, []);

  useEffect(() => {
    if (!acik) return;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    function tus(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAcik(false);
        dugme.current?.focus();
      }
    }
    function tik(e: MouseEvent) {
      if (!panel.current?.contains(e.target as Node) && !dugme.current?.contains(e.target as Node)) setAcik(false);
    }
    document.addEventListener("keydown", tus);
    document.addEventListener("mousedown", tik);
    return () => {
      document.removeEventListener("keydown", tus);
      document.removeEventListener("mousedown", tik);
    };
  }, [acik]);

  function degistir(alan: keyof ErisimTercihi) {
    const yeni = { ...tercih, [alan]: !tercih[alan] };
    setTercih(yeni);
    erisimUygula(yeni);
    try {
      localStorage.setItem(ERISIM_ANAHTARI, JSON.stringify(yeni));
    } catch {
      // Hatırlanamasa da bu sayfada uygulanır.
    }
  }

  const secenekler: { alan: keyof ErisimTercihi; ad: string; aciklama?: string }[] = [
    { alan: "buyukYazi", ad: t.buyukYazi },
    { alan: "kontrast", ad: t.kontrast },
    { alan: "altyazi", ad: t.altyazi, aciklama: t.altyaziAciklama },
  ];

  return (
    <div className="erisim">
      <button
        ref={dugme}
        type="button"
        className="erisim-dugme"
        aria-expanded={acik}
        aria-controls="erisim-paneli"
        onClick={() => setAcik(!acik)}
      >
        <Simge ad="erisim" />
        <span>{t.dugme}</span>
      </button>
      {acik && (
        <div ref={panel} id="erisim-paneli" className="erisim-paneli" role="group" aria-labelledby="erisim-baslik">
          <h2 id="erisim-baslik">{t.baslik}</h2>
          <ul>
            {secenekler.map((x) => (
              <li key={x.alan}>
                <span>
                  {x.ad}
                  {x.aciklama && <small id={`erisim-${x.alan}`}>{x.aciklama}</small>}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tercih[x.alan]}
                  aria-label={x.ad}
                  aria-describedby={x.aciklama ? `erisim-${x.alan}` : undefined}
                  className="anahtar"
                  onClick={() => degistir(x.alan)}
                >
                  <span aria-hidden="true">{tercih[x.alan] ? "✓" : ""}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="not">{t.hatirlanir}</p>
          <button type="button" className="dugme ikincil" onClick={() => { setAcik(false); dugme.current?.focus(); }}>
            {t.kapat}
          </button>
        </div>
      )}
    </div>
  );
}
