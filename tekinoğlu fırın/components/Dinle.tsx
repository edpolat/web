"use client";
import { useEffect, useRef, useState } from "react";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import Simge from "./Simge";

/** Okunacak parça: sayfadaki öğenin kimliği ve metni. Okunan öğe sayfada vurgulanır. */
export type OkunacakParca = { id: string; metin: string; lang?: string };

type Durum = "bos" | "okuyor" | "duraklatildi";

const SES_DILI: Record<string, string> = { tr: "tr-TR", en: "en-GB" };
/** Ses motoru yoksa ya da sessizse altyazı cümle uzunluğuna göre ilerler. */
const sure = (metin: string) => Math.max(2500, metin.length * 65);

export default function Dinle({ dil, parcalar }: { dil: Dil; parcalar: OkunacakParca[] }) {
  const t = s(dil).dinle;
  const [durum, setDurum] = useState<Durum>("bos");
  const [sira, setSira] = useState(-1);
  const [sesYok, setSesYok] = useState(false);
  const zamanlayici = useRef<ReturnType<typeof setTimeout>>(undefined);
  const calisiyor = useRef(false);

  function vurgula(i: number) {
    document.querySelectorAll(".okunuyor").forEach((el) => el.classList.remove("okunuyor"));
    const el = i >= 0 ? document.getElementById(parcalar[i]?.id ?? "") : null;
    if (el) {
      el.classList.add("okunuyor");
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function bitir() {
    calisiyor.current = false;
    clearTimeout(zamanlayici.current);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    vurgula(-1);
    setSira(-1);
    setDurum("bos");
  }

  function oku(i: number) {
    if (!calisiyor.current) return;
    if (i >= parcalar.length) return bitir();
    setSira(i);
    vurgula(i);
    const parca = parcalar[i];
    const sonraki = () => {
      clearTimeout(zamanlayici.current);
      if (calisiyor.current) oku(i + 1);
    };
    const motor = "speechSynthesis" in window ? window.speechSynthesis : null;
    const sesler = motor?.getVoices() ?? [];
    const lang = SES_DILI[parca.lang ?? dil] ?? "tr-TR";
    if (!motor || !sesler.some((v) => v.lang.startsWith(lang.slice(0, 2)))) {
      setSesYok(true);
      zamanlayici.current = setTimeout(sonraki, sure(parca.metin));
      return;
    }
    const soz = new SpeechSynthesisUtterance(parca.metin);
    soz.lang = lang;
    soz.voice = sesler.find((v) => v.lang === lang) ?? sesler.find((v) => v.lang.startsWith(lang.slice(0, 2))) ?? null;
    soz.rate = 0.95;
    soz.onend = sonraki;
    soz.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") return;
      // Ses çıkmadı: altyazı cümle uzunluğuna göre ilerlemeye devam eder.
      setSesYok(true);
      clearTimeout(zamanlayici.current);
      zamanlayici.current = setTimeout(sonraki, sure(parca.metin));
    };
    motor.speak(soz);
    // Bazı tarayıcılar sessizken onend göndermez; altyazı yine de ilerlesin.
    zamanlayici.current = setTimeout(sonraki, sure(parca.metin) * 2 + 4000);
  }

  function baslat() {
    calisiyor.current = true;
    setDurum("okuyor");
    // Chrome ses listesini geç yükler; kısa bir süre bekleyip öyle başla.
    const motor = "speechSynthesis" in window ? window.speechSynthesis : null;
    if (motor && motor.getVoices().length === 0) {
      let basladi = false;
      const basla = () => {
        if (basladi) return;
        basladi = true;
        oku(0);
      };
      motor.addEventListener("voiceschanged", basla, { once: true });
      setTimeout(basla, 600);
    } else oku(0);
  }

  function duraklat() {
    if (durum === "okuyor") {
      clearTimeout(zamanlayici.current);
      if ("speechSynthesis" in window) window.speechSynthesis.pause();
      setDurum("duraklatildi");
    } else {
      setDurum("okuyor");
      if ("speechSynthesis" in window && window.speechSynthesis.paused) window.speechSynthesis.resume();
      else oku(sira);
    }
  }

  useEffect(() => bitir, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!parcalar.length) return null;
  const parca = sira >= 0 ? parcalar[sira] : undefined;

  return (
    <>
      {durum === "bos" ? (
        <button type="button" className="dinle-dugme" onClick={baslat}>
          <Simge ad="dinle" /> {t.dinle}
        </button>
      ) : (
        <span className="dinle-kontrol">
          <button type="button" className="dinle-dugme" onClick={duraklat} aria-pressed={durum === "duraklatildi"}>
            <span aria-hidden="true">{durum === "okuyor" ? "❚❚" : "▶"}</span> {durum === "okuyor" ? t.duraklat : t.devam}
          </button>
          <button type="button" className="dugme ikincil" onClick={bitir}>
            {t.durdur}
          </button>
        </span>
      )}
      {parca && (
        <div className="altyazi-seridi" aria-hidden="true" lang={parca.lang}>
          <span className="altyazi-etiket">
            {t.altyazi} · {sira + 1}/{parcalar.length}
          </span>
          <p>“{parca.metin}”</p>
          {sesYok && <small>{t.sesYok}</small>}
        </div>
      )}
    </>
  );
}
