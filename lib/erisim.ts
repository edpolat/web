// Erişilebilirlik tercihleri: <html> üzerinde data-* olarak uygulanır, tarayıcıda hatırlanır.
export type ErisimTercihi = { buyukYazi: boolean; kontrast: boolean; altyazi: boolean };

export const ERISIM_ANAHTARI = "vakfiye-erisim";
export const VARSAYILAN_ERISIM: ErisimTercihi = { buyukYazi: false, kontrast: false, altyazi: true };

export function erisimUygula(t: ErisimTercihi) {
  const kok = document.documentElement;
  kok.dataset.yazi = t.buyukYazi ? "buyuk" : "normal";
  kok.dataset.kontrast = t.kontrast ? "yuksek" : "normal";
  kok.dataset.altyazi = t.altyazi ? "acik" : "kapali";
}

/** Sayfa çizilmeden önce çalışan satır içi betik: tercih yüklenirken yazı boyutu zıplamaz. */
export const ERISIM_BETIGI = `try{var t=JSON.parse(localStorage.getItem("${ERISIM_ANAHTARI}")||"{}"),k=document.documentElement;k.dataset.yazi=t.buyukYazi?"buyuk":"normal";k.dataset.kontrast=t.kontrast?"yuksek":"normal";k.dataset.altyazi=t.altyazi===false?"kapali":"acik"}catch(e){}`;
