"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import { ETIKETLER, ONCELIKLER, type ElemeCevabi, type Etiket, type GecerliEtiket, type Oncelik } from "@/lib/yz";

type Props = {
  dil: Dil;
  oneriId: number;
  /** En son ön eleme analizi (yz_analizleri, tur = 'eleme'). */
  analiz?: { id: number; durum: "bekliyor" | "tamam" | "hata"; sonuc: ElemeCevabi | null; hata: string | null; model: string | null };
  /** Ekrandaki geçerli etiket (editör düzelttiyse onunki). */
  gecerli?: GecerliEtiket;
  duzelten?: string | null;
  /** Aynı eser ve alan için bekleyen diğer öneriler (kodla bulunur, YZ gerekmez). */
  benzer: number[];
  acik: boolean;
  basladi?: boolean;
  yetkili: boolean;
};

/** Öneri kartındaki "YZ ön eleme" kutusu: etiketler, öncelik, gerekçe, benzer öneriler ve etiketi elle düzeltme. */
export default function YzElemeKutusu({ dil, oneriId, analiz, gecerli, duzelten, benzer, acik, basladi, yetkili }: Props) {
  const t = s(dil).yz;
  const router = useRouter();
  const [bekle, setBekle] = useState(false);
  const [hata, setHata] = useState<string>();
  const [etiketler, setEtiketler] = useState<Etiket[]>(gecerli?.etiketler ?? []);
  const [oncelik, setOncelik] = useState<Oncelik>(gecerli?.oncelik ?? "normal");
  const tazeleme = useRef(0);
  const suruyor = acik && (analiz?.durum === "bekliyor" || (!analiz && basladi)) && tazeleme.current < 8;

  useEffect(() => {
    if (!suruyor) return;
    const zaman = setTimeout(() => {
      tazeleme.current += 1;
      router.refresh();
    }, 8000);
    return () => clearTimeout(zaman);
  }, [suruyor, router]);

  async function gonder(govde: Record<string, unknown>) {
    setBekle(true);
    setHata(undefined);
    const yanit = await fetch("/api/yz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde) }).catch(() => null);
    setBekle(false);
    if (yanit?.ok) return router.refresh();
    const veri = (await yanit?.json().catch(() => ({}))) as { hata?: string } | undefined;
    setHata(veri?.hata ?? t.yapilamadi);
  }

  const sec = (e: Etiket, acikMi: boolean) => setEtiketler((x) => (acikMi ? [...x, e] : x.filter((y) => y !== e)));

  return (
    <section className="yz-kutu" aria-label={t.elemeBaslik}>
      <h4>{t.elemeBaslik}</h4>
      {gecerli ? (
        <>
          <p className="yz-etiketler">
            <span className={`etiket etiket-oncelik-${gecerli.oncelik}`}>{t.oncelikler[gecerli.oncelik]}</span>
            {gecerli.etiketler.map((e) => (
              <span key={e} className={`etiket etiket-yze-${e}`}>
                {t.etiketler[e]}
              </span>
            ))}
            {!gecerli.etiketler.length && <small>{t.etiketYok}</small>}
          </p>
          {gecerli.kaynak === "editor" && duzelten && <p className="yz-not">{t.editorDuzeltti(duzelten)}</p>}
        </>
      ) : !acik ? (
        <p>
          {t.yapilamadi} <small>({t.kapali})</small>
        </p>
      ) : suruyor ? (
        <p aria-live="polite">{t.suruyor}</p>
      ) : (
        <p>
          {t.yapilamadi}
          {analiz?.hata && <small> ({analiz.hata})</small>}
        </p>
      )}
      {analiz?.durum === "tamam" && analiz.sonuc?.gerekce && (
        <p>
          <strong>{t.gerekce}:</strong> {analiz.sonuc.gerekce}
        </p>
      )}
      {benzer.length > 0 && (
        <p>
          <span className="etiket etiket-yze-benzer">{t.etiketler.benzer}</span>{" "}
          <small>{t.benzerler}: </small>
          {benzer.map((id, i) => (
            <span key={id}>
              {i > 0 && ", "}
              <a href={`#oneri-${id}`}>{t.oneriNo(id)}</a>
            </span>
          ))}
        </p>
      )}
      {yetkili && (
        <details>
          <summary>{t.etiketiDuzelt}</summary>
          <fieldset>
            <legend>{t.etiketSuz}</legend>
            {ETIKETLER.map((e) => (
              <label key={e} className="secim">
                <input type="checkbox" checked={etiketler.includes(e)} onChange={(x) => sec(e, x.target.checked)} /> {t.etiketler[e]}
              </label>
            ))}
            <label>
              {t.oncelik}
              <select value={oncelik} onChange={(x) => setOncelik(x.target.value as Oncelik)}>
                {ONCELIKLER.map((o) => (
                  <option key={o} value={o}>
                    {t.oncelikler[o]}
                  </option>
                ))}
              </select>
            </label>
            <div className="dugmeler">
              <button
                type="button"
                disabled={bekle}
                onClick={() => gonder({ islem: "etiket_duzelt", id: oneriId, analiz: analiz?.durum === "tamam" ? analiz.id : null, etiketler, oncelik })}
              >
                {t.kaydet}
              </button>
            </div>
          </fieldset>
        </details>
      )}
      {acik && yetkili && !suruyor && (
        <div className="dugmeler">
          <button type="button" className="ikincil" disabled={bekle} onClick={() => gonder({ islem: "eleme", hedef_tur: "oneri", id: oneriId })}>
            {bekle ? t.bekle : t.yeniden}
          </button>
        </div>
      )}
      {hata && <p role="alert">{hata}</p>}
      {analiz?.model && (
        <p className="yz-not">
          {t.model}: {analiz.model}
        </p>
      )}
      <p className="yz-not">{t.sabitNot}</p>
    </section>
  );
}
