"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { konumEksik } from "@/lib/filtre";
import { s } from "@/lib/sozluk";
import type { Dil, Konum } from "@/lib/tipler";

export type DuzenlenecekEser = { id: string; il: string; ad: string; ilce?: string; adres?: string; konum?: Konum };
type IlBilgisi = { id: string; ad: string; merkez: { enlem: number; boylam: number }; yakinlastirma: number };
export type Nokta = { enlem: number; boylam: number };

const KonumHarita = dynamic(() => import("./KonumHarita"), {
  ssr: false,
  loading: () => <div className="harita-yer" aria-hidden="true" />,
});

type Props = { dil: Dil; iller: IlBilgisi[]; eserler: DuzenlenecekEser[] };

export default function KonumDuzenle({ dil, iller, eserler: ilk }: Props) {
  const t = s(dil);
  const [eserler, setEserler] = useState(ilk);
  const [il, setIl] = useState(iller[0]?.id ?? "");
  const [yalnizEksik, setYalnizEksik] = useState(true);
  const [seciliId, setSeciliId] = useState<string>();
  const [yeni, setYeni] = useState<Nokta>();
  const [durum, setDurum] = useState<{ tur: "tamam" | "hata"; metin: string }>();
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const ilBilgisi = iller.find((i) => i.id === il) ?? iller[0];
  const ilEserleri = eserler.filter((e) => e.il === il);
  const liste = ilEserleri.filter((e) => !yalnizEksik || konumEksik(e.konum) || e.id === seciliId);
  const secili = eserler.find((e) => e.id === seciliId);
  const kalan = ilEserleri.filter((e) => konumEksik(e.konum)).length;
  const odak = useMemo<Nokta | undefined>(() => (secili?.konum ? { enlem: secili.konum.enlem, boylam: secili.konum.boylam } : undefined), [secili]);

  function sec(id: string) {
    setSeciliId(id);
    setYeni(undefined);
    setDurum(undefined);
  }

  async function kaydet() {
    if (!secili || !yeni) return;
    setKaydediliyor(true);
    setDurum(undefined);
    try {
      const yanit = await fetch("/api/konum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: secili.id, ...yeni }),
      });
      const veri = (await yanit.json()) as { konum?: Konum; hata?: string };
      if (!yanit.ok || !veri.konum) throw new Error(veri.hata ?? String(yanit.status));
      setEserler((onceki) => onceki.map((e) => (e.id === secili.id ? { ...e, konum: veri.konum } : e)));
      setYeni(undefined);
      setDurum({ tur: "tamam", metin: t.konumKaydedildi });
      const sonraki = ilEserleri.find((e) => e.id !== secili.id && konumEksik(e.konum));
      if (sonraki) setSeciliId(sonraki.id);
    } catch (hata) {
      setDurum({ tur: "hata", metin: `${t.konumKaydedilemedi} ${hata instanceof Error ? hata.message : ""}` });
    } finally {
      setKaydediliyor(false);
    }
  }

  function durumYazisi(k?: Konum) {
    if (!k) return t.konumYok;
    if (k.dogrulandi && !konumEksik(k)) return t.konumTamam;
    return k.hassasiyet === "mahalle" || k.hassasiyet === "ilce" ? t.konumMahalleDuzeyi : t.konumDogrulanmamis;
  }

  return (
    <div className="kesif">
      <div>
        <KonumHarita
          eserler={ilEserleri}
          seciliId={seciliId}
          yeni={yeni}
          merkez={ilBilgisi.merkez}
          yakinlastirma={ilBilgisi.yakinlastirma}
          odak={odak}
          onTikla={(n) => secili && setYeni(n)}
          onSec={sec}
        />
        <div className="konum-panel" aria-live="polite">
          {secili ? (
            <>
              <p>
                <strong>{secili.ad}</strong> <Link href={`/${dil}/eser/${secili.id}`}>{t.eseriAc}</Link>
                {secili.adres && <small> · {secili.adres}</small>}
              </p>
              <p className="not">{yeni ? `${yeni.enlem.toFixed(6)}, ${yeni.boylam.toFixed(6)}` : t.haritayaTikla}</p>
              <div className="dugmeler">
                <button type="button" onClick={kaydet} disabled={!yeni || kaydediliyor}>
                  {kaydediliyor ? t.kaydediliyor : t.konumuKaydet}
                </button>
                {secili.konum && !yeni && (
                  <button type="button" onClick={() => setYeni({ enlem: secili.konum!.enlem, boylam: secili.konum!.boylam })}>
                    {t.mevcutKonumuSec}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="not">{t.eserSec}</p>
          )}
          {durum && <p className={durum.tur === "hata" ? "uyari" : "not"}>{durum.metin}</p>}
        </div>
      </div>
      <div>
        <div className="filtre konum-filtre">
          <label>
            {t.il}
            <select value={il} onChange={(e) => { setIl(e.target.value); setSeciliId(undefined); setYeni(undefined); }}>
              {iller.map((i) => (
                <option key={i.id} value={i.id}>{i.ad}</option>
              ))}
            </select>
          </label>
          <label className="secim">
            <input type="checkbox" checked={yalnizEksik} onChange={(e) => setYalnizEksik(e.target.checked)} />
            {t.yalnizEksik}
          </label>
        </div>
        <p className="sonuc-sayisi">{t.konumKalan(kalan, ilEserleri.length)}</p>
        <ul className="eser-listesi">
          {liste.map((e) => (
            <li key={e.id}>
              <button type="button" className="konum-oge" aria-pressed={e.id === seciliId} onClick={() => sec(e.id)}>
                <span>{e.ad}</span>
                <small>{e.ilce ? `${e.ilce} · ` : ""}{durumYazisi(e.konum)}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
