"use client";
import { useEffect, useState } from "react";
import type { Dil } from "@/lib/tipler";
import { z } from "@/lib/ziyaret";

type YuklemeIstegi = Event & { prompt: () => Promise<void> };

/** "Ana ekrana ekle" (mobil uygulamadaki yükleme yardımı): Android'de tarayıcının yükle penceresi, iPhone'da adım adım anlatım. */
export default function AnaEkranaEkle({ dil }: { dil: Dil }) {
  const t = z(dil).yukle;
  const [istek, setIstek] = useState<YuklemeIstegi>();
  const [acik, setAcik] = useState(false);
  const [gizli, setGizli] = useState(true);
  const [iphone, setIphone] = useState(false);

  useEffect(() => {
    const uygulamada =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    setGizli(uygulamada);
    setIphone(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const yakala = (e: Event) => (e.preventDefault(), setIstek(e as YuklemeIstegi));
    window.addEventListener("beforeinstallprompt", yakala);
    return () => window.removeEventListener("beforeinstallprompt", yakala);
  }, []);

  if (gizli) return null;
  return (
    <>
      <p>
        <button type="button" className="dugme ikincil" onClick={() => (istek ? void istek.prompt() : setAcik(true))}>
          {t.dugme}
        </button>
      </p>
      {acik && (
        <div className="katman" role="dialog" aria-modal="true" aria-labelledby="yukle-baslik" onClick={(e) => e.target === e.currentTarget && setAcik(false)}>
          <div className="katman-kutu">
            <div className="katman-ust">
              <b id="yukle-baslik">{t.baslik}</b>
              <button type="button" className="katman-kapat" onClick={() => setAcik(false)} aria-label={t.kapat}>
                ✕
              </button>
            </div>
            <ol>
              {(iphone ? t.iphone : t.android).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
