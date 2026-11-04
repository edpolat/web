"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Hesabım kartı: Erişilebilirlik paneli gibi sağ üstteki düğmenin altında açılır.
 * Arka plan kararmaz, sayfa kaydırması kilitlenmez. Dışarı tıklamak, Esc veya Hesabım düğmesine
 * yeniden basmak kapatır; kapatınca tarayıcı geçmişinde bir geri gidilir, altta kalan sayfa değişmez.
 */
export default function HesapCekmecesi({
  baslik,
  kapat,
  children,
}: {
  baslik: string;
  kapat: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const kapaniyor = useRef(false);

  function geri() {
    if (kapaniyor.current) return;
    kapaniyor.current = true;
    router.back();
  }

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button, input")?.focus();
    function tus(e: KeyboardEvent) {
      if (e.key === "Escape") geri();
    }
    function tik(e: MouseEvent) {
      const hedef = e.target as HTMLElement;
      if (!ref.current?.contains(hedef) && !hedef.closest(".sekme-hesap")) geri();
    }
    // Kart açıkken Hesabım düğmesi aç/kapa gibi davranır.
    function dugme(e: MouseEvent) {
      if ((e.target as HTMLElement).closest(".sekme-hesap")) {
        e.preventDefault();
        geri();
      }
    }
    document.addEventListener("keydown", tus);
    document.addEventListener("mousedown", tik);
    document.addEventListener("click", dugme, true);
    return () => {
      document.removeEventListener("keydown", tus);
      document.removeEventListener("mousedown", tik);
      document.removeEventListener("click", dugme, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className="hesap-acilir" role="dialog" aria-labelledby="hesap-acilir-baslik">
      <div className="erisim-ust">
        <h2 id="hesap-acilir-baslik">{baslik}</h2>
        <button type="button" className="erisim-kapat" aria-label={kapat} onClick={geri}>
          ✕
        </button>
      </div>
      <div className="hesap-acilir-govde">{children}</div>
    </div>
  );
}
