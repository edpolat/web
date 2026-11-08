"use client";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import { PanelSimge, type SimgeAdi } from "./PanelTablo";

export type PanelSutun = { ad: string; simge: SimgeAdi; sirala?: boolean };
export type PanelSatir = {
  id: string | number;
  hucreler: ReactNode[];
  /** Satır sonundaki yuvarlak düğmeler. */
  eylem?: ReactNode;
  /** Sütun sırasıyla sıralama değerleri (sayı ya da yazı); boşsa o sütun sıralanmaz. */
  sira?: (string | number | null | undefined)[];
  /** İstemci aramasında taranan düz metin. */
  ara?: string;
  /** İstemci hap süzgecinde eşleşen değerler. */
  grup?: string[];
};
/** href'li hap sunucu süzgecine giden bağlantıdır; deger'li hap satırları istemcide süzer ("" = hepsi). */
export type PanelHap = { ad: string; simge: SimgeAdi; deger?: string; href?: string; secili?: boolean; sayi?: number };

type Ozellikler = {
  dil: Dil;
  sutunlar: PanelSutun[];
  satirlar: PanelSatir[];
  haplar?: PanelHap[];
  /** İstemci araması: yer tutucu metin. araForm verilirse arama sunucuya GET ile gider. */
  ara?: string | false;
  araForm?: { ad: string; deger: string; gizli?: Record<string, string | undefined> };
  /** Araç çubuğunun altına gelen ek alan (ör. "Diğer süzgeçler"). */
  ekAlan?: ReactNode;
  /** Alt bilgideki birim ("değişiklik", "eser"…). */
  birim: string;
  /** Alt bilgide toplamın yanına eklenecek bağlantı ya da not. */
  altEk?: ReactNode;
  sayfaBoyu?: number;
  genis?: boolean;
  bos?: ReactNode;
  /** Başlangıç sıralaması: sütun sırası ve yönü. */
  ilkSira?: { sutun: number; yon: 1 | -1 };
};

const karsilastir = (a: string | number | null | undefined, b: string | number | null | undefined) => {
  if (a == null || a === "") return b == null || b === "" ? 0 : 1;
  if (b == null || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "tr", { numeric: true });
};

/**
 * Panelin ortak tablosu: hap süzgeçleri, arama, simgeli ve sıralanabilir başlıklar, ayraçlı geniş satırlar,
 * satır sonu yuvarlak düğmeler, toplam ve sayfalama.
 */
export default function PanelTablo({
  dil,
  sutunlar,
  satirlar,
  haplar,
  ara,
  araForm,
  ekAlan,
  birim,
  altEk,
  sayfaBoyu = 25,
  genis,
  bos,
  ilkSira,
}: Ozellikler) {
  const t = s(dil).tablo;
  const [hap, setHap] = useState(haplar?.find((h) => h.secili && h.deger !== undefined)?.deger ?? "");
  const [sorgu, setSorgu] = useState("");
  const [sira, setSira] = useState<{ sutun: number; yon: 1 | -1 } | null>(ilkSira ?? null);
  const [sayfa, setSayfa] = useState(1);
  const eylemli = satirlar.some((x) => x.eylem);

  const gorunen = useMemo(() => {
    const q = sorgu.trim().toLocaleLowerCase("tr");
    const liste = satirlar.filter((x) => (!hap || x.grup?.includes(hap)) && (!q || (x.ara ?? "").toLocaleLowerCase("tr").includes(q)));
    if (!sira) return liste;
    return [...liste].sort((a, b) => karsilastir(a.sira?.[sira.sutun], b.sira?.[sira.sutun]) * sira.yon);
  }, [satirlar, hap, sorgu, sira]);

  const sayfaSayisi = Math.max(1, Math.ceil(gorunen.length / sayfaBoyu));
  const gecerliSayfa = Math.min(sayfa, sayfaSayisi);
  const parca = gorunen.slice((gecerliSayfa - 1) * sayfaBoyu, gecerliSayfa * sayfaBoyu);

  const aramaKutusu = araForm ? (
    <form className="pt-ara" method="get" role="search">
      <PanelSimge ad="ara" />
      {Object.entries(araForm.gizli ?? {}).map(([ad, deger]) => (deger ? <input key={ad} type="hidden" name={ad} value={deger} /> : null))}
      <input type="search" name={araForm.ad} defaultValue={araForm.deger} placeholder={t.ara} aria-label={t.ara} />
    </form>
  ) : ara !== false && ara !== undefined ? (
    <label className="pt-ara">
      <PanelSimge ad="ara" />
      <input
        type="search"
        value={sorgu}
        placeholder={ara || t.ara}
        aria-label={ara || t.ara}
        onChange={(e) => {
          setSorgu(e.target.value);
          setSayfa(1);
        }}
      />
    </label>
  ) : null;

  return (
    <div className="pt-kart">
      {(haplar?.length || aramaKutusu) && (
        <div className="pt-arac">
          <div className="pt-haplar" role="group" aria-label={t.suz}>
            {haplar?.map((h) =>
              h.href !== undefined ? (
                <Link key={`${h.ad}-${h.href}`} className="pt-hap" href={h.href} aria-current={h.secili ? "page" : undefined}>
                  <PanelSimge ad={h.simge} />
                  {h.ad}
                  {h.sayi !== undefined && <span className="pt-hap-sayi">{h.sayi}</span>}
                </Link>
              ) : (
                <button
                  key={`${h.ad}-${h.deger}`}
                  type="button"
                  className="pt-hap"
                  aria-pressed={hap === (h.deger ?? "")}
                  onClick={() => {
                    setHap(h.deger ?? "");
                    setSayfa(1);
                  }}
                >
                  <PanelSimge ad={h.simge} />
                  {h.ad}
                  {h.sayi !== undefined && <span className="pt-hap-sayi">{h.sayi}</span>}
                </button>
              ),
            )}
          </div>
          {aramaKutusu}
        </div>
      )}
      {ekAlan}
      <div className="pt-kap">
        <table className={`pt-tablo${genis ? " genis" : ""}`}>
          <thead>
            <tr>
              {sutunlar.map((x, i) => {
                const yon = sira?.sutun === i ? sira.yon : undefined;
                return (
                  <th key={x.ad} scope="col" aria-sort={yon ? (yon > 0 ? "ascending" : "descending") : undefined}>
                    <div className="pt-th">
                      <PanelSimge ad={x.simge} boyut={20} />
                      {x.ad}
                      {x.sirala !== false && (
                        <button
                          type="button"
                          className="pt-sirala"
                          data-yon={yon ? (yon > 0 ? "artan" : "azalan") : undefined}
                          aria-label={t.sirala(x.ad)}
                          title={t.sirala(x.ad)}
                          onClick={() => setSira(sira?.sutun === i ? { sutun: i, yon: (sira.yon * -1) as 1 | -1 } : { sutun: i, yon: 1 })}
                        >
                          <PanelSimge ad="sirala" boyut={14} />
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
              {eylemli && (
                <th scope="col">
                  <span className="pt-gorunmez">{t.islemler}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {parca.length ? (
              parca.map((x) => (
                <tr key={x.id}>
                  {x.hucreler.map((h, i) => (
                    <td key={i} className={i < x.hucreler.length - 1 ? "ayrik" : undefined}>
                      {h}
                    </td>
                  ))}
                  {eylemli && <td className="pt-eylem">{x.eylem}</td>}
                </tr>
              ))
            ) : (
              <tr>
                <td className="pt-bos" colSpan={sutunlar.length + (eylemli ? 1 : 0)}>
                  {bos ?? t.bos}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pt-alt">
        <span className="pt-toplam">
          <PanelSimge ad="bilgi" />
          {t.toplam(gorunen.length, birim)}
          {altEk}
        </span>
        {(
          <nav className="pt-sayfa" aria-label={t.sayfalar}>
            <button type="button" disabled={gecerliSayfa === 1} aria-label={t.onceki} onClick={() => setSayfa(gecerliSayfa - 1)}>
              <PanelSimge ad="sol" boyut={16} />
            </button>
            {Array.from({ length: sayfaSayisi }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === sayfaSayisi || Math.abs(n - gecerliSayfa) <= 1)
              .map((n, i, dizi) => (
                <span key={n} className="pt-sayfa-grup">
                  {i > 0 && n - dizi[i - 1] > 1 && <span className="pt-sayfa-bosluk">…</span>}
                  <button type="button" aria-current={n === gecerliSayfa ? "page" : undefined} onClick={() => setSayfa(n)}>
                    {n}
                  </button>
                </span>
              ))}
            <button type="button" disabled={gecerliSayfa === sayfaSayisi} aria-label={t.sonraki} onClick={() => setSayfa(gecerliSayfa + 1)}>
              <PanelSimge ad="sag" boyut={16} />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
