// Erişilebilirlik tercihleri: <html> üzerinde data-* olarak uygulanır, tarayıcıda hatırlanır.
export type ErisimTercihi = { buyukYazi: boolean; kontrast: boolean; altyazi: boolean; azHareket: boolean; genisSatir: boolean };

export const ERISIM_ANAHTARI = "vakfiye-erisim";
export const VARSAYILAN_ERISIM: ErisimTercihi = { buyukYazi: false, kontrast: false, altyazi: true, azHareket: false, genisSatir: false };

export function erisimUygula(t: ErisimTercihi) {
  const kok = document.documentElement;
  kok.dataset.yazi = t.buyukYazi ? "buyuk" : "normal";
  kok.dataset.kontrast = t.kontrast ? "yuksek" : "normal";
  kok.dataset.altyazi = t.altyazi ? "acik" : "kapali";
  kok.dataset.hareket = t.azHareket ? "az" : "normal";
  kok.dataset.satir = t.genisSatir ? "genis" : "normal";
}

/** Sayfa çizilmeden önce çalışan satır içi betik: tercih yüklenirken yazı boyutu zıplamaz. */
export const ERISIM_BETIGI = `try{var t=JSON.parse(localStorage.getItem("${ERISIM_ANAHTARI}")||"{}"),k=document.documentElement;k.dataset.yazi=t.buyukYazi?"buyuk":"normal";k.dataset.kontrast=t.kontrast?"yuksek":"normal";k.dataset.altyazi=t.altyazi===false?"kapali":"acik";k.dataset.hareket=t.azHareket?"az":"normal";k.dataset.satir=t.genisSatir?"genis":"normal"}catch(e){}`;
