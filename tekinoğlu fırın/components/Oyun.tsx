"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  acikSecimler,
  AMAC_GIDERI,
  gecerliAyar,
  HEDEF_YIL,
  ilerle,
  karaKadar,
  karar,
  kur,
  MULKLER,
  sermayeToplami,
  VARSAYILAN_AYAR,
  VARSAYILAN_TOHUM,
  type Amac,
  type Ayar,
  type Durum,
  type Mulk,
  type Mutevelli,
  type Secim,
  type Tur,
} from "@/lib/oyun";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";

const SECIMLER: Secim[] = ["fon", "nakit", "kis"];
const FON_ADIMLARI = Array.from({ length: 11 }, (_, i) => i * 5);

export default function Oyun({ dil }: { dil: Dil }) {
  const t = s(dil).oyun;
  const router = useRouter();
  const yol = usePathname();
  const sorgu = useSearchParams();
  const tohumAdres = Number.parseInt(sorgu.get("tohum") ?? "", 10);
  const [tohum, setTohum] = useState(Number.isFinite(tohumAdres) ? tohumAdres : VARSAYILAN_TOHUM);
  const [ayar, setAyar] = useState<Ayar>(VARSAYILAN_AYAR);
  const [durum, setDurum] = useState<Durum | null>(null);
  const tabloSonu = useRef<HTMLTableRowElement>(null);

  const sayi = (n: number) =>
    n.toLocaleString(dil === "tr" ? "tr-TR" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const toplam = sermayeToplami(ayar);
  const gecerli = gecerliAyar(ayar);

  useEffect(() => {
    tabloSonu.current?.scrollIntoView({ block: "nearest" });
  }, [durum?.turlar.length]);

  function sermaye(m: Mulk, deger: string) {
    const n = Math.max(0, Math.min(100, Number.parseInt(deger, 10) || 0));
    setAyar({ ...ayar, sermaye: { ...ayar.sermaye, [m]: n } });
  }

  function baslat() {
    if (!gecerli) return;
    // Tohum adrese yazılır: sunumda prova edilen oyun bir bağlantıyla açılır.
    const yeni = new URLSearchParams(sorgu);
    yeni.set("tohum", String(tohum));
    router.replace(`${yol}?${yeni}`, { scroll: false });
    setDurum(kur(ayar, tohum));
  }

  const son = durum?.turlar.at(-1);
  const bekleyen = durum?.bekleyen;
  const sonuc = durum?.sonuc;
  const acik = durum ? acikSecimler(durum) : null;

  function olayMetni(tur: Tur): string {
    const parcalar: string[] = [];
    if (tur.zimmet) parcalar.push(t.zimmet(sayi(tur.zimmet)));
    if (tur.olay) {
      let m = t.olaylar[tur.olay];
      if (tur.bedel) m += `, ${t.onarim(sayi(tur.bedel))}`;
      if (tur.karar) m += ` · ${t.kararSonucu[tur.karar]}`;
      parcalar.push(m);
    }
    if (tur.sandikBos) parcalar.push(t.sandikBos);
    return parcalar.length ? parcalar.join(". ") : t.olayYok;
  }

  const ihtiyacBaz = AMAC_GIDERI[ayar.amac];

  return (
    <div className="oyun">
      <section className="oyun-kur" aria-labelledby="oyun-kur-baslik">
        <h2 id="oyun-kur-baslik">{t.kurBaslik}</h2>
        <fieldset disabled={!!durum} className="oyun-ayar">
          <fieldset>
            <legend>{t.sermaye}</legend>
            {MULKLER.map((m) => (
              <div key={m} className="oyun-mulk">
                <label htmlFor={`sermaye-${m}`}>{t.mulk[m]}</label>
                <input
                  id={`sermaye-${m}`}
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={ayar.sermaye[m]}
                  onChange={(e) => sermaye(m, e.target.value)}
                  aria-describedby={`sermaye-${m}-not`}
                />
                <small id={`sermaye-${m}-not`}>{t.mulkAciklama[m]}</small>
              </div>
            ))}
            <p className={gecerli ? "oyun-toplam" : "oyun-toplam hatali"} aria-live="polite">
              <strong>{t.toplam(toplam)}</strong>
              {!gecerli && <> · {t.toplamUyari}</>}
            </p>
          </fieldset>
          <label>
            {t.amac}
            <select value={ayar.amac} onChange={(e) => setAyar({ ...ayar, amac: e.target.value as Amac })}>
              {(Object.keys(AMAC_GIDERI) as Amac[]).map((a) => (
                <option key={a} value={a}>
                  {t.amaclar[a]} · {AMAC_GIDERI[a]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.fon}
            <select value={ayar.fon} onChange={(e) => setAyar({ ...ayar, fon: Number(e.target.value) })} aria-describedby="fon-not">
              {FON_ADIMLARI.map((f) => (
                <option key={f} value={f}>
                  %{f}
                </option>
              ))}
            </select>
            <small id="fon-not">{t.fonAciklama}</small>
          </label>
          <fieldset>
            <legend>{t.mutevelli}</legend>
            {(["durust", "becerikli"] as Mutevelli[]).map((m) => (
              <label key={m} className="secim">
                <input
                  type="radio"
                  name="mutevelli"
                  value={m}
                  checked={ayar.mutevelli === m}
                  onChange={() => setAyar({ ...ayar, mutevelli: m })}
                />
                <span>
                  {t.mutevelliler[m]}
                  <small>{t.mutevelliAciklama[m]}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <label>
            {t.tohum}
            <input
              type="number"
              min={1}
              value={tohum}
              onChange={(e) => setTohum(Number.parseInt(e.target.value, 10) || 1)}
              aria-describedby="tohum-not"
            />
            <small id="tohum-not">{t.tohumAciklama}</small>
          </label>
        </fieldset>
        <div className="dugmeler">
          {!durum ? (
            <button type="button" onClick={baslat} disabled={!gecerli}>
              {t.kur}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setDurum(karaKadar(durum))} disabled={!!bekleyen || !!sonuc}>
                {t.karaKadar}
              </button>
              <button type="button" className="ikincil" onClick={() => setDurum(ilerle(durum))} disabled={!!bekleyen || !!sonuc}>
                {t.birTur}
              </button>
              <button type="button" className="ikincil" onClick={() => setDurum(null)}>
                {t.yenidenKur}
              </button>
            </>
          )}
        </div>
      </section>

      <section className="oyun-akis" aria-labelledby="oyun-akis-baslik">
        <div className="oyun-akis-ust">
          <h2 id="oyun-akis-baslik" aria-live="polite">
            {son ? `${t.yil(son.yil)} · ${son.olay ? t.olaylar[son.olay] : t.olayYok}` : t.baslamadi}
          </h2>
          <span className="not">{t.hedef}</span>
        </div>

        {durum && (
          <dl className="oyun-durum">
            {MULKLER.map((m) => (
              <div key={m}>
                <dt>{t.mulk[m]}</dt>
                <dd>{sayi(durum.mulk[m])}</dd>
              </div>
            ))}
            <div className="oyun-fon">
              <dt>{t.yedekFon}</dt>
              <dd>{sayi(durum.fon)}</dd>
            </div>
          </dl>
        )}

        {bekleyen && acik && (
          <div className="oyun-karar" role="group" aria-labelledby="oyun-karar-soru">
            <p id="oyun-karar-soru" aria-live="assertive">
              <strong>{t.olaylar[bekleyen.olay]}!</strong>{" "}
              {t.kararSoru(sayi(bekleyen.bedel), sayi(durum.fon), acik.fon)}
            </p>
            <div className="dugmeler">
              {SECIMLER.map((secim) => (
                <button
                  key={secim}
                  type="button"
                  className={secim === "fon" || (secim === "nakit" && !acik.fon) ? undefined : "ikincil"}
                  disabled={!acik[secim]}
                  onClick={() => setDurum(karar(durum, secim))}
                  aria-describedby={`karar-${secim}`}
                >
                  {t.kararlar[secim]}
                  {!acik[secim] && <span className="gizli"> ({t.kapali})</span>}
                </button>
              ))}
            </div>
            <ul className="oyun-secenekler">
              {SECIMLER.map((secim) => (
                <li key={secim} id={`karar-${secim}`}>
                  <strong>{t.kararlar[secim]}:</strong> {t.kararAciklama[secim]}
                </li>
              ))}
            </ul>
          </div>
        )}

        {sonuc && (
          <div className={sonuc.ayakta ? "oyun-sonuc ayakta" : "oyun-sonuc"} role="status">
            <h3>{sonuc.ayakta ? t.ayakta : t.coktu(sonuc.yil)}</h3>
            <dl className="kunye">
              {sonuc.cokenOlay && (
                <>
                  <dt>{t.cokenOlay}</dt>
                  <dd>{t.olaylar[sonuc.cokenOlay]}</dd>
                </>
              )}
              {sonuc.iyiKarar && (
                <>
                  <dt>{t.iyiKarar}</dt>
                  <dd>
                    {t.iyiKararMetin(
                      sonuc.iyiKarar.yil,
                      t.olaylar[sonuc.iyiKarar.olay],
                      t.kararSonucu[sonuc.iyiKarar.secim],
                    )}
                  </dd>
                </>
              )}
              <dt>{t.ders}</dt>
              <dd>
                <strong>{t.dersler[sonuc.ders]}</strong>
              </dd>
            </dl>
            <p className="not">{t.ozet(sonuc.olaySayisi, sonuc.kararSayisi, sonuc.bosSayisi)}</p>
          </div>
        )}

        {durum && durum.turlar.length > 0 && (
          <>
            <SandikGrafigi turlar={durum.turlar} baslik={t.grafikBaslik} aciklama={t.grafikAciklama} />
            <div className="oyun-tablo">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t.tablo.yil}</th>
                    <th scope="col">{t.tablo.olay}</th>
                    <th scope="col" className="sayi">{t.tablo.gelir}</th>
                    <th scope="col" className="sayi">
                      {t.tablo.kalan} ({t.tablo.ihtiyac} {sayi(son?.ihtiyac ?? ihtiyacBaz)})
                    </th>
                    <th scope="col" className="sayi">{t.tablo.fon}</th>
                  </tr>
                </thead>
                <tbody>
                  {durum.turlar.map((tur, i) => (
                    <tr
                      key={tur.yil}
                      ref={i === durum.turlar.length - 1 ? tabloSonu : undefined}
                      className={tur.olay || tur.zimmet || tur.sandikBos ? "olayli" : undefined}
                    >
                      <td>{tur.yil}</td>
                      <td>{olayMetni(tur)}</td>
                      <td className="sayi">{sayi(tur.gelir)}</td>
                      <td className="sayi">
                        {tur.kalan < tur.ihtiyac ? (
                          <span className="eksik" title={t.acik}>
                            ▼ {sayi(tur.kalan)}
                            <span className="gizli"> ({t.acik})</span>
                          </span>
                        ) : (
                          sayi(tur.kalan)
                        )}
                      </td>
                      <td className="sayi">
                        {sayi(tur.fon)}
                        {tur.fonSonra !== undefined && tur.fonSonra !== tur.fon && <> → {sayi(tur.fonSonra)}</>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="not">
              {t.baglanti}: <code>{`/${dil}/oyun?tohum=${durum.tohum}`}</code>
            </p>
          </>
        )}
      </section>
    </div>
  );
}

/** Her tur için hizmete kalan para (çubuk) ve ihtiyaç (kesikli çizgi). Erişilebilir hâli altındaki tablodur. */
function SandikGrafigi({ turlar, baslik, aciklama }: { turlar: Tur[]; baslik: string; aciklama: string }) {
  const genislik = 600;
  const yukseklik = 120;
  const adim = genislik / (HEDEF_YIL / 10);
  const tavan = Math.max(40, ...turlar.map((t) => Math.max(t.kalan, t.ihtiyac))) * 1.1;
  const y = (n: number) => yukseklik - (Math.max(0, n) / tavan) * yukseklik;
  const ihtiyacYolu = turlar
    .map((t, i) => `${i === 0 ? "M" : "L"}${i * adim} ${y(t.ihtiyac)} h${adim}`)
    .join(" ");
  return (
    <figure className="oyun-grafik">
      <figcaption>
        <strong>{baslik}</strong> <span className="not">{aciklama}</span>
      </figcaption>
      <svg viewBox={`0 -8 ${genislik} ${yukseklik + 10}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <line x1={0} x2={genislik} y1={yukseklik} y2={yukseklik} className="eksen" />
        {turlar.map((t, i) => (
          <rect
            key={t.yil}
            x={i * adim + 1}
            width={adim - 2}
            y={y(t.kalan)}
            height={yukseklik - y(t.kalan)}
            className={t.kalan < t.ihtiyac ? "cubuk eksik" : "cubuk"}
          />
        ))}
        <path d={ihtiyacYolu} className="ihtiyac" />
        {turlar.map((t, i) =>
          t.sandikBos ? <circle key={t.yil} cx={i * adim + adim / 2} cy={-2} r={4} className="bos" /> : null,
        )}
      </svg>
    </figure>
  );
}
