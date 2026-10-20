"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { bulutHazir, dosyaYukle, erisimJetonu, kayitliOturum, type BulutOturumu } from "@/lib/bulut";
import { DOSYA_TURLERI, EN_BUYUK_DOSYA, KAYNAK_TURLERI } from "@/lib/kaynak";
import { GUNLUK_ONERI, KAYNAK_SECIMLERI, ONERI_ALANLARI, type KaynakSecimi, type OneriAlani, type OneriSatiri } from "@/lib/oneri";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";

type Props = {
  dil: Dil;
  eserId: string;
  /** Alanların sitedeki şu anki değeri (öneren neyi düzelttiğini görsün). */
  mevcut: Partial<Record<OneriAlani, string>>;
  kaynaklar: { id: string; ad: string }[];
};

async function istek(jeton: string, govde: Record<string, unknown>): Promise<Record<string, unknown>> {
  const yanit = await fetch("/api/oneri", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
    body: JSON.stringify(govde),
  });
  const veri = (await yanit.json().catch(() => ({}))) as Record<string, unknown>;
  if (!yanit.ok) throw new Error(String(veri.hata ?? yanit.status));
  return veri;
}

const tarih = (iso: string, dil: Dil) => new Date(iso).toLocaleDateString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium" });

/** Ziyaretçinin bilgi önerisi: giriş zorunlu; kaynak seçimi, dosya için hak onayı ve kendi önerilerinin sonucu. */
export default function OneriFormu({ dil, eserId, mevcut, kaynaklar }: Props) {
  const t = s(dil).oneri;
  const [ben, setBen] = useState<BulutOturumu | null | undefined>(undefined);
  const [alan, setAlan] = useState<OneriAlani>("olgu");
  const [kaynak, setKaynak] = useState<KaynakSecimi>("kutuphane");
  const [durum, setDurum] = useState<{ tamam: boolean; metin: string }>();
  const [bekle, setBekle] = useState(false);
  const [benimkiler, setBenimkiler] = useState<OneriSatiri[]>([]);

  const listele = useCallback(async () => {
    const jeton = await erisimJetonu();
    if (!jeton) return;
    const yanit = await fetch(`/api/oneri?eser=${encodeURIComponent(eserId)}`, { headers: { Authorization: `Bearer ${jeton}` } });
    const veri = (await yanit.json().catch(() => ({}))) as { oneriler?: OneriSatiri[] };
    setBenimkiler([...(veri.oneriler ?? [])].reverse());
  }, [eserId]);

  useEffect(() => {
    if (!bulutHazir) return setBen(null);
    kayitliOturum()
      .then((o) => {
        setBen(o);
        if (o) listele();
      })
      .catch(() => setBen(null));
  }, [listele]);

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const v = new FormData(form);
    setDurum(undefined);
    setBekle(true);
    try {
      const jeton = await erisimJetonu();
      if (!jeton) throw new Error(t.girisGerekli);
      let dosya_yolu: string | undefined;
      if (kaynak === "dosya") {
        const dosya = v.get("dosya");
        if (!(dosya instanceof File) || !dosya.size) throw new Error(t.dosya);
        if (!(dosya.type in DOSYA_TURLERI)) throw new Error(s(dil).kutuphane.dosyaTuruYanlis);
        if (dosya.size > EN_BUYUK_DOSYA) throw new Error(s(dil).kutuphane.dosyaBuyuk);
        const { yol, jeton: yukleme } = (await istek(jeton, { islem: "yukleme_adresi", tur: dosya.type, boyut: dosya.size })) as { yol: string; jeton: string };
        await dosyaYukle(yol, yukleme, dosya);
        dosya_yolu = yol;
      }
      await istek(jeton, {
        islem: "gonder",
        eser_id: eserId,
        alan,
        onerilen: v.get("onerilen"),
        kaynak,
        kaynak_id: v.get("kaynak_id"),
        konum: v.get("konum"),
        url: v.get("url"),
        kaynak_turu: v.get("kaynak_turu"),
        dosya_yolu,
        hak_onayi: v.get("hak_onayi") === "on",
      });
      form.reset();
      setDurum({ tamam: true, metin: t.gonderildi });
      listele();
    } catch (h) {
      setDurum({ tamam: false, metin: h instanceof Error ? h.message : String(h) });
    } finally {
      setBekle(false);
    }
  }

  if (ben === undefined) return null;
  if (!ben) {
    return (
      <p className="uyari">
        {t.girisGerekli} <Link href={`/${dil}/hesap`}>{t.girisYap} →</Link>
      </p>
    );
  }

  return (
    <>
      <form className="form" onSubmit={gonder}>
        <label>
          {t.alan}
          <select value={alan} onChange={(e) => setAlan(e.target.value as OneriAlani)}>
            {ONERI_ALANLARI.map((a) => (
              <option key={a} value={a}>
                {t.alanlar[a]}
              </option>
            ))}
          </select>
        </label>
        {mevcut[alan] && (
          <p className="not">
            {t.mevcut}: {mevcut[alan]}
          </p>
        )}
        <label>
          {t.onerilen}
          <textarea name="onerilen" rows={4} required maxLength={2000} />
        </label>
        <fieldset>
          <legend>{t.kaynak}</legend>
          {KAYNAK_SECIMLERI.map((k) => (
            <label key={k} className="secim">
              <input type="radio" name="kaynak" checked={kaynak === k} onChange={() => setKaynak(k)} /> {t.kaynakSecimleri[k]}
            </label>
          ))}
          {kaynak === "kutuphane" && (
            <label>
              {t.kaynakSec}
              <select name="kaynak_id" required defaultValue="">
                <option value="" disabled>
                  …
                </option>
                {kaynaklar.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.ad}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kaynak === "baglanti" && (
            <label>
              {t.url}
              <input name="url" type="url" required maxLength={2000} placeholder="https://" />
            </label>
          )}
          {kaynak === "dosya" && (
            <>
              <label>
                {t.dosya}
                <input name="dosya" type="file" required accept="application/pdf,image/jpeg,image/png" />
              </label>
              <label className="secim">
                <input name="hak_onayi" type="checkbox" required /> {t.hakOnayi}
              </label>
            </>
          )}
          {(kaynak === "baglanti" || kaynak === "dosya") && (
            <label>
              {s(dil).kutuphane.kaynakTuru}
              <select name="kaynak_turu" defaultValue="diger">
                {KAYNAK_TURLERI.map((k) => (
                  <option key={k} value={k}>
                    {s(dil).kutuphane.kaynakTurleri[k]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kaynak !== "yok" ? (
            <label>
              {t.konum}
              <input name="konum" maxLength={100} />
            </label>
          ) : (
            <p className="not">{t.kaynaksizUyari}</p>
          )}
        </fieldset>
        <p className="not">{t.sinir(GUNLUK_ONERI)}</p>
        <div className="dugmeler">
          <button type="submit" disabled={bekle}>
            {bekle ? t.gonderiliyor : t.gonder}
          </button>
        </div>
        <p role="status" className={durum && !durum.tamam ? "uyari" : undefined}>
          {durum?.metin}
        </p>
      </form>
      {benimkiler.length > 0 && (
        <>
          <h2>{t.benimkiler}</h2>
          {benimkiler.map((o) => (
            <article key={o.id} className="katki">
              <p className="katki-ust">
                <span className={`etiket etiket-oneri-${o.durum}`}>{t.durumlar[o.durum]}</span>
                <span>{t.alanlar[o.alan]}</span>
                <span>· {tarih(o.olusturuldu, dil)}</span>
                {o.kaynaksiz && <span className="etiket etiket-kaynaksiz">{t.kaynaksiz}</span>}
              </p>
              <p>{o.onerilen}</p>
              {o.ret_gerekcesi && (
                <p className="not">
                  <strong>{t.gerekce}:</strong> {o.ret_gerekcesi}
                </p>
              )}
            </article>
          ))}
        </>
      )}
    </>
  );
}
