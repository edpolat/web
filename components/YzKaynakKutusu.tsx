"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import { sayfaAdresi, type KaynakAnalizi } from "@/lib/yz";

/** Ekrana gelen analiz satırı (yz_analizleri). */
export type GosterilenAnaliz = { id: number; durum: "bekliyor" | "tamam" | "hata"; sonuc: KaynakAnalizi | null; hata: string | null; model: string | null };

type Props = {
  dil: Dil;
  hedefTur: "oneri" | "surum";
  hedefId: number;
  analiz?: GosterilenAnaliz;
  /** YZ açık mı (AI_ENABLED). Kapalıyken yalnız "YZ analizi yapılamadı" yazar. */
  acik: boolean;
  /** Sayfa açılınca analiz arka planda başlatıldı (sonuç birazdan gelir). */
  basladi?: boolean;
  /** "Yeniden analiz et" gösterilsin mi (eser.onayla). */
  yenilenebilir: boolean;
};

const ISARET = { destekliyor: "✓", celisiyor: "✗", bulunamadi: "–" } as const;

/** Onay bekleyenlerdeki "YZ kaynak analizi" kutusu. Yalnız bilgi verir; karar düğmeleri kartın kendisindedir. */
export default function YzKaynakKutusu({ dil, hedefTur, hedefId, analiz, acik, basladi, yenilenebilir }: Props) {
  const t = s(dil).yz;
  const router = useRouter();
  const [bekle, setBekle] = useState(false);
  const [hata, setHata] = useState<string>();
  const tazeleme = useRef(0);
  // Arka plandaki analiz bitince sonuç görünsün: en çok 8 kez (yaklaşık 1 dakika) sayfayı tazeler.
  const suruyor = acik && (analiz?.durum === "bekliyor" || (!analiz && basladi)) && tazeleme.current < 8;

  useEffect(() => {
    if (!suruyor) return;
    const zaman = setTimeout(() => {
      tazeleme.current += 1;
      router.refresh();
    }, 8000);
    return () => clearTimeout(zaman);
  }, [suruyor, router]);

  async function yeniden() {
    setBekle(true);
    setHata(undefined);
    const yanit = await fetch("/api/yz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ islem: "kaynak", hedef_tur: hedefTur, id: hedefId }),
    }).catch(() => null);
    setBekle(false);
    if (yanit?.ok) return router.refresh();
    const veri = (await yanit?.json().catch(() => ({}))) as { hata?: string } | undefined;
    setHata(veri?.hata ?? t.yapilamadi);
  }

  const a = analiz?.durum === "tamam" ? analiz.sonuc : null;
  const sinif = a?.metin === "tamam" && a.pasaj_dogrulandi ? `yz-${a.sonuc}` : "";
  const adres = a ? sayfaAdresi(a) : null;
  const sayfa = a?.metin === "tamam" ? (a.bulunan_sayfa ?? a.sayfa) : null;

  return (
    <section className={`yz-kutu ${sinif}`} aria-label={t.kaynakBaslik}>
      <h4>{t.kaynakBaslik}</h4>
      {!acik ? (
        <p>
          {t.yapilamadi} <small>({t.kapali})</small>
        </p>
      ) : suruyor ? (
        <p aria-live="polite">{t.suruyor}</p>
      ) : !a ? (
        <p>
          {t.yapilamadi}
          {analiz?.hata && <small> ({analiz.hata})</small>}
        </p>
      ) : a.metin !== "tamam" ? (
        <p>
          <span className="etiket etiket-yz-bulunamadi">{t.okunamadi}</span> <small>{a.aciklama}</small>
        </p>
      ) : (
        <>
          <p>
            <span className={`etiket etiket-yz-${a.sonuc}`}>
              {ISARET[a.sonuc]} {t.sonuclar[a.sonuc]}
            </span>{" "}
            {!a.pasaj_dogrulandi && <span className="etiket etiket-yz-uyari">⚠ {t.dogrulanamadi.split(":")[0]}</span>}{" "}
            <small>
              {t.guven[a.guven]}
              {sayfa ? ` · ${a.sayfali ? t.sayfa : t.bolum} ${sayfa}` : ""}
            </small>
          </p>
          {!a.pasaj_dogrulandi && (
            <p className="uyari" role="note">
              {t.dogrulanamadi}
            </p>
          )}
          {a.pasaj && <blockquote>{a.pasaj}</blockquote>}
          {a.sonuc === "celisiyor" && a.kaynaktaki_deger && (
            <p>
              <strong>{t.kaynaktakiDeger}:</strong> {a.kaynaktaki_deger}
            </p>
          )}
          {a.aciklama && <p>{a.aciklama}</p>}
          {a.incelenen_sayfalar.length > 0 && a.sayfali && (
            <p className="yz-not">
              {t.incelenen}: {a.incelenen_sayfalar.join(", ")}
            </p>
          )}
        </>
      )}
      <div className="dugmeler">
        {adres && (
          <a className="dugme ikincil" href={adres} target="_blank" rel="noopener noreferrer">
            {sayfa && a?.metin === "tamam" && a.sayfali ? t.sayfayiAc : t.kaynagiAc} ↗
          </a>
        )}
        {acik && yenilenebilir && !suruyor && (
          <button type="button" className="ikincil" disabled={bekle} onClick={yeniden}>
            {bekle ? t.bekle : t.yeniden}
          </button>
        )}
      </div>
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
