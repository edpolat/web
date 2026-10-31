"use client";
import { useEffect, useState } from "react";
import { hikayeKartiCiz } from "@/lib/hikaye-karti";
import type { Dil, Rota } from "@/lib/tipler";
import { z } from "@/lib/ziyaret";

/** Rota tamamlanınca paylaşılabilir hikâye kartı: önizleme, Paylaş (destekleyen tarayıcıda) ve İndir. */
export default function HikayeKarti({ dil, sehir, rota, ad }: { dil: Dil; sehir: string; rota: Rota; ad?: string }) {
  const t = z(dil).hikaye;
  const [kart, setKart] = useState<{ url: string; dosya: File; paylasilir: boolean }>();

  useEffect(() => () => kart && URL.revokeObjectURL(kart.url), [kart]);

  async function olustur() {
    const blob = await hikayeKartiCiz({
      sehir,
      duraklar: rota.duraklar,
      ad,
      en: dil === "en",
      metin: { pasaport: t.pasaport, tamamladim: t.tamamladim, pul: t.pul },
      adres: window.location.host,
    });
    if (!blob) return;
    const dosya = new File([blob], `vakfiye-${rota.il}-rotasi.png`, { type: "image/png" });
    setKart({ url: URL.createObjectURL(blob), dosya, paylasilir: Boolean(navigator.canShare?.({ files: [dosya] })) });
  }

  async function paylas() {
    if (!kart) return;
    try {
      await navigator.share({ files: [kart.dosya], title: "Vakfiye", text: `${sehir} · Vakfiye` });
    } catch {}
  }

  return (
    <>
      <button type="button" className="dugme" onClick={olustur}>
        {t.olustur}
      </button>
      {kart && (
        <div className="katman" role="dialog" aria-modal="true" aria-label={t.baslik} onClick={(e) => e.target === e.currentTarget && setKart(undefined)}>
          <div className="katman-kutu hikaye-kutu">
            <div className="katman-ust">
              <b>{t.baslik}</b>
              <button type="button" className="katman-kapat" onClick={() => setKart(undefined)} aria-label={t.kapat}>
                ✕
              </button>
            </div>
            <img className="hikaye-onizleme" src={kart.url} alt={t.alt} width={270} height={480} />
            <div className="dugmeler">
              {kart.paylasilir && (
                <button type="button" onClick={paylas}>
                  {t.paylas}
                </button>
              )}
              <a className="dugme ikincil" href={kart.url} download={kart.dosya.name}>
                {t.indir}
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
