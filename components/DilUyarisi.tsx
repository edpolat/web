"use client";
import { useRef, useState } from "react";
import { dilUyarisiGerekli, karsilastirilacaklar, tekDilli, type CiftSonucu, type DilFarki } from "@/lib/dil-uyumu";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";

type Satir = { f: DilFarki; neden: string };

/** Tek dilde kalan değişikliğin nedeni ("yalnız Türkçe metin değişti" gibi). */
export function tekDilNedeni(dil: Dil, f: DilFarki): string {
  const u = s(dil).dilUyumu;
  if (f.trDegisti) return f.en ? u.yalnizTr : u.enYok;
  return f.tr ? u.yalnizEn : u.trYok;
}

/** Kartın üstünde hep görünen basit uyarı (YZ'siz). Gönderen "uyum için" dediyse yalnız etiket görünür. */
export function DilNotu({ dil, farklar, dilUyumu, alanAdi, yzAcik }: { dil: Dil; farklar: DilFarki[]; dilUyumu: boolean; alanAdi: (f: DilFarki) => string; yzAcik: boolean }) {
  const u = s(dil).dilUyumu;
  if (dilUyumu) {
    return (
      <p className="not">
        <span className="etiket etiket-dil-uyumu">{u.uyumEtiketi}</span> {u.uyumAciklama}
      </p>
    );
  }
  const tek = farklar.filter(tekDilli);
  if (!tek.length) return null;
  return (
    <div className="uyari">
      <p>{u.kartUyari}</p>
      <ul>
        {tek.map((f) => (
          <li key={f.yol}>
            <strong>{alanAdi(f)}</strong>: {tekDilNedeni(dil, f)}
          </li>
        ))}
      </ul>
      {yzAcik && <p className="not">{u.kartYz}</p>}
    </div>
  );
}

/**
 * "Onayla"dan önce iki dil kontrolü. Yalnız bir dil değiştiyse (ya da YZ açıkken iki metin aynı anlamı taşımıyorsa)
 * onay kutusu çıkar; onaylayan "Yine de onayla" derse onayla(true) çağrılır. YZ uyumlu derse ya da sorun yoksa
 * doğrudan onayla(false|true) çağrılır. YZ'nin hatası basit kontrole düşer.
 */
export function useDilDenetimi(dil: Dil, yzAcik: boolean, alanAdi: (f: DilFarki) => string) {
  const u = s(dil).dilUyumu;
  const [uyari, setUyari] = useState<{ satirlar: Satir[]; yzNotu?: string }>();
  const [karsilastiriyor, setKarsilastiriyor] = useState(false);
  const devam = useRef<(dilOnayi: boolean) => void>(undefined);

  async function denetle(farklar: DilFarki[], dilUyumu: boolean, onayla: (dilOnayi: boolean) => void) {
    setUyari(undefined);
    if (dilUyumu) return onayla(false);
    const tek = farklar.filter(tekDilli);
    const ciftler = karsilastirilacaklar(farklar);
    if (!tek.length && (!yzAcik || !ciftler.length)) return onayla(false);
    const basit = tek.map((f) => ({ f, neden: tekDilNedeni(dil, f) }));
    let satirlar = basit;
    let yzNotu: string | undefined;
    if (yzAcik && ciftler.length) {
      setKarsilastiriyor(true);
      const cevap = await fetch("/api/yz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ islem: "dil_uyumu", ciftler }),
      })
        .then((y) => y.json() as Promise<{ tamam?: boolean; sonuclar?: CiftSonucu[]; neden?: string; hata?: string }>)
        .catch(() => ({ tamam: false, neden: "bağlantı hatası" }) as { tamam: false; neden: string; sonuclar?: undefined; hata?: undefined });
      setKarsilastiriyor(false);
      if (cevap.tamam && cevap.sonuclar) {
        // Biri boş olan metin (çeviri hiç yok) YZ'ye sorulmaz, uyarı olarak kalır.
        const sonuc = new Map(farklar.filter((f) => f.tr && f.en).map((f, i) => [f.yol, cevap.sonuclar![i]]));
        satirlar = farklar.flatMap((f) => {
          const c = sonuc.get(f.yol);
          if (!c) return tekDilli(f) ? [{ f, neden: tekDilNedeni(dil, f) }] : [];
          return c.uyumlu ? [] : [{ f, neden: `${tekDilli(f) ? `${tekDilNedeni(dil, f)}; ` : ""}${u.anlamFarkli}${c.aciklama ? `: ${c.aciklama}` : ""}` }];
        });
      } else if (tek.length) {
        yzNotu = u.yzYapilamadi(cevap.neden ?? cevap.hata ?? "?");
      }
    }
    if (!satirlar.length) return onayla(dilUyarisiGerekli(farklar, false));
    devam.current = onayla;
    setUyari({ satirlar, yzNotu });
  }

  const kutu = karsilastiriyor ? (
    <p role="status" className="not">
      {u.karsilastiriliyor}
    </p>
  ) : uyari ? (
    <div className="uyari" role="alertdialog" aria-label={u.uyariBaslik}>
      <p>
        <strong>{u.uyariBaslik}</strong>
      </p>
      <ul>
        {uyari.satirlar.map(({ f, neden }) => (
          <li key={f.yol}>
            <strong>{alanAdi(f)}</strong>: {neden}
          </li>
        ))}
      </ul>
      {uyari.yzNotu && <p className="not">{uyari.yzNotu}</p>}
      <p className="not">{u.uyariAciklama}</p>
      <div className="dugmeler">
        <button
          type="button"
          onClick={() => {
            setUyari(undefined);
            devam.current?.(true);
          }}
        >
          {u.yineDeOnayla}
        </button>
        <button type="button" className="ikincil" onClick={() => setUyari(undefined)}>
          {u.vazgec}
        </button>
      </div>
    </div>
  ) : null;

  return { denetle, kutu, karsilastiriyor };
}
