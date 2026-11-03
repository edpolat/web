"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { bulutHazir, rotalariEsitle } from "@/lib/bulut";
import { sadelestir } from "@/lib/filtre";
import { g, mesafeKm, mesafeYazisi, yolTarifiAdresi } from "@/lib/gezi";
import { konumSessiz, type Nokta } from "@/lib/konum";
import { metin } from "@/lib/metin";
import {
  PLAN_OLAYI,
  ROTAM_EN_COK,
  gitmekDegistir,
  gitmekListesi,
  rotalarim,
  rotamiKaydet,
  rotamiSil,
  type Rotam,
} from "@/lib/planlar";
import type { CokDilli, Dil } from "@/lib/tipler";

export type PlanEseri = {
  id: string;
  ad: CokDilli;
  tur: string;
  il: string;
  ilce?: string;
  konum?: Nokta;
  yaklasik?: boolean;
};

type Props = {
  dil: Dil;
  eserler: PlanEseri[];
  turAdlari: Record<string, CokDilli>;
  iller: { id: string; ad: CokDilli }[];
  pullar: string[];
  /** Girişli kullanıcının kimliği: varsa rotalar hesapla eşitlenir. */
  uyeId?: string;
};

type Taslak = { id: string | null; ad: string; eserler: string[] };

/** Hesabım: "Gitmek istediklerim" ve "Rotalarım" kartları (mobil uygulamanın Pasaport sekmesindeki gibi). */
export default function Planlarim({ dil, eserler, turAdlari, iller, pullar, uyeId }: Props) {
  const t = g(dil);
  const r = t.rota;
  const harita = useMemo(() => new Map(eserler.map((e) => [e.id, e])), [eserler]);
  const [gitmek, setGitmek] = useState<string[]>([]);
  const [rotalar, setRotalar] = useState<Rotam[]>([]);
  const [konum, setKonum] = useState<Nokta | null>(null);
  const [acik, setAcik] = useState<string>();
  const [taslak, setTaslak] = useState<Taslak>();
  const [arama, setArama] = useState({ sehir: "", metin: "" });
  const [hata, setHata] = useState<string>();
  const [hesapta, setHesapta] = useState(false);
  const plan = useRef<HTMLDialogElement>(null);
  const duzen = useRef<HTMLDialogElement>(null);

  const ad = (id: string) => metin(harita.get(id)?.ad, dil) || id;
  const ilAdi = (id: string) => metin(iller.find((i) => i.id === id)?.ad, dil) || id;
  const turAdi = (id: string) => metin(turAdlari[id], dil) || id;

  useEffect(() => {
    const yenile = () => {
      setGitmek(gitmekListesi().filter((id) => harita.has(id)));
      setRotalar(rotalarim());
    };
    yenile();
    window.addEventListener(PLAN_OLAYI, yenile);
    window.addEventListener("storage", yenile);
    konumSessiz().then(setKonum);
    // Eser sayfasındaki "Rotama ekle > Yeni rota" buraya ?yeniRota=<eser> ile gelir.
    const ilk = new URLSearchParams(window.location.search).get("yeniRota");
    if (ilk && harita.has(ilk)) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
      olusturucuyuAc(null, ilk);
    }
    return () => {
      window.removeEventListener(PLAN_OLAYI, yenile);
      window.removeEventListener("storage", yenile);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [harita]);

  // Girişliyse açılışta, sekmeye dönünce ve her değişiklikten sonra hesapla eşitle (hata olursa yerelde kalır).
  useEffect(() => {
    if (!uyeId || !bulutHazir) return;
    let zaman: ReturnType<typeof setTimeout> | undefined;
    const esitle = () =>
      rotalariEsitle((id) => harita.has(id))
        .then((oldu) => setHesapta(oldu))
        .catch(() => setHesapta(false));
    const sonra = () => {
      clearTimeout(zaman);
      zaman = setTimeout(esitle, 800);
    };
    const gorunur = () => document.visibilityState === "visible" && esitle();
    esitle();
    window.addEventListener(PLAN_OLAYI, sonra);
    document.addEventListener("visibilitychange", gorunur);
    return () => {
      clearTimeout(zaman);
      window.removeEventListener(PLAN_OLAYI, sonra);
      document.removeEventListener("visibilitychange", gorunur);
    };
  }, [uyeId, harita]);

  function olusturucuyuAc(rota: Rotam | null, ilkEser?: string) {
    const ilk = ilkEser ? harita.get(ilkEser) : rota ? harita.get(rota.eserler[0]) : undefined;
    setTaslak(rota ? { id: rota.id, ad: rota.ad, eserler: [...rota.eserler] } : { id: null, ad: "", eserler: ilkEser ? [ilkEser] : [] });
    setArama({ sehir: ilk?.il ?? "", metin: "" });
    setHata(undefined);
    plan.current?.close();
    // dialog DOM'da hazır olsun diye bir sonraki karede aç
    requestAnimationFrame(() => duzen.current?.showModal());
  }

  function kaydet() {
    if (!taslak) return;
    if (!taslak.ad.trim()) return setHata(r.adVer);
    if (taslak.eserler.length < 2) return setHata(r.enAz);
    const rota = rotamiKaydet(taslak);
    duzen.current?.close();
    setTaslak(undefined);
    setAcik(rota.id);
    requestAnimationFrame(() => plan.current?.showModal());
  }

  function durakDegistir(id: string) {
    if (!taslak) return;
    const s = taslak.eserler;
    if (s.includes(id)) setTaslak({ ...taslak, eserler: s.filter((x) => x !== id) });
    else if (s.length >= ROTAM_EN_COK) setHata(r.enCok(ROTAM_EN_COK));
    else (setTaslak({ ...taslak, eserler: [...s, id] }), setHata(undefined));
  }

  function tasi(i: number, yon: -1 | 1) {
    if (!taslak) return;
    const s = [...taslak.eserler];
    [s[i], s[i + yon]] = [s[i + yon], s[i]];
    setTaslak({ ...taslak, eserler: s });
  }

  const sonuclar = useMemo(() => {
    const sozcukler = sadelestir(arama.metin).replace(/[()\-–—.,'’"“”/]/g, " ").split(/\s+/).filter(Boolean);
    return eserler
      .filter((e) => !arama.sehir || e.il === arama.sehir)
      .filter((e) => {
        if (!sozcukler.length) return true;
        const m = sadelestir(`${metin(e.ad, dil)} ${e.ad.tr} ${e.ilce ?? ""} ${turAdi(e.tur)}`).replace(/[()\-–—.,'’"“”/]/g, " ");
        return sozcukler.every((s) => m.includes(s) || m.replace(/\s/g, "").includes(s));
      })
      .sort((a, b) => metin(a.ad, dil).replace(/^\s*\([^)]*\)\s*/, "").localeCompare(metin(b.ad, dil).replace(/^\s*\([^)]*\)\s*/, ""), dil, { numeric: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eserler, arama, dil]);

  const acikRota = rotalar.find((x) => x.id === acik);
  const acikNoktalar = acikRota ? acikRota.eserler.map((id) => harita.get(id)).filter((e): e is PlanEseri => !!e) : [];
  const tarif = yolTarifiAdresi(acikNoktalar.filter((e) => e.konum).map((e) => e.konum!));

  return (
    <>
      <div className="pasaport-kart" id="gitmek">
        <span className="kart-baslik">{t.gitmek.baslik}</span>
        {gitmek.length === 0 ? (
          <p className="not">{t.gitmek.bos}</p>
        ) : (
          <ul className="plan-listesi">
            {gitmek.map((id) => {
              const e = harita.get(id)!;
              const km = konum && e.konum ? mesafeKm(konum.enlem, konum.boylam, e.konum.enlem, e.konum.boylam) : undefined;
              return (
                <li key={id}>
                  <Link href={`/${dil}/eser/${id}`}>
                    <b>{ad(id)}</b>
                    <small>
                      {km !== undefined && (
                        <span className="mesafe">
                          {e.yaklasik ? "~" : ""}
                          {mesafeYazisi(km, dil)}
                        </span>
                      )}
                      {km !== undefined ? " · " : ""}
                      {turAdi(e.tur)} · {ilAdi(e.il)}
                    </small>
                  </Link>
                  <button type="button" className="plan-cikar" aria-label={`${t.gitmek.cikar}: ${ad(id)}`} onClick={() => gitmekDegistir(id)}>
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <small className="not">{t.gitmek.cihazda}</small>
      </div>

      <div className="pasaport-kart" id="rotalarim">
        <span className="kart-baslik">{r.baslik}</span>
        {rotalar.length === 0 ? (
          <p className="not">{r.bos}</p>
        ) : (
          <ul className="plan-listesi">
            {rotalar.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => (setAcik(x.id), plan.current?.showModal())}>
                  <b>{x.ad}</b>
                  <small>{r.durak(x.eserler.length)}</small>
                </button>
                <span className="plan-ok" aria-hidden="true">
                  ›
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="dugmeler">
          <button type="button" onClick={() => olusturucuyuAc(null)}>
            ＋ {r.olustur}
          </button>
        </div>
        <small className="not">{uyeId && hesapta ? r.hesapta : r.cihazda}</small>
      </div>

      {/* Rotanın planı */}
      <dialog ref={plan} className="rota-pencere" aria-labelledby="rotam-baslik" onClick={(e) => e.target === e.currentTarget && plan.current?.close()}>
        {acikRota && (
          <>
            <span className="kart-baslik">{r.rotam}</span>
            <h2 id="rotam-baslik">{acikRota.ad}</h2>
            <ol className="rota-plan">
              {acikNoktalar.map((e, i) => (
                <li key={e.id}>
                  <Link href={`/${dil}/eser/${e.id}`}>
                    <i>{i + 1}</i>
                    <span>
                      <b>{ad(e.id)}</b>
                      <small>
                        {turAdi(e.tur)} · {e.ilce || ilAdi(e.il)}
                      </small>
                    </span>
                    {pullar.includes(e.id) && (
                      <em className="rota-pullu" title={r.pulAlindi} aria-label={r.pulAlindi}>
                        ✓
                      </em>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
            {tarif && (
              <a className="dugme" href={tarif} target="_blank" rel="noopener">
                {r.yolTarifi} ↗
              </a>
            )}
            {acikNoktalar.some((e) => e.yaklasik) && <p className="not">{r.yaklasik}</p>}
            <div className="dugmeler">
              <button type="button" className="ikincil" onClick={() => olusturucuyuAc(acikRota)}>
                {r.duzenle}
              </button>
              <button
                type="button"
                className="ikincil tehlike"
                onClick={() => {
                  if (window.confirm(r.silinsinMi(acikRota.ad))) {
                    rotamiSil(acikRota.id);
                    plan.current?.close();
                  }
                }}
              >
                {r.sil}
              </button>
              <button type="button" onClick={() => plan.current?.close()}>
                {r.kapat}
              </button>
            </div>
          </>
        )}
      </dialog>

      {/* Rota oluştur / düzenle */}
      <dialog ref={duzen} className="rota-pencere rota-duzen" aria-labelledby="rota-duzen-baslik" onClose={() => setTaslak(undefined)}>
        {taslak && (
          <>
            <h2 id="rota-duzen-baslik" className="kart-baslik">
              {taslak.id ? r.duzenleBaslik : r.yeni}
            </h2>
            <label className="gizli" htmlFor="rota-adi">
              {r.ad}
            </label>
            <input id="rota-adi" maxLength={40} placeholder={r.adYer} value={taslak.ad} onChange={(e) => setTaslak({ ...taslak, ad: e.target.value })} />
            {taslak.eserler.length === 0 ? (
              <p className="not">{r.durakYok}</p>
            ) : (
              <>
                <ol className="rota-plan duzenle">
                  {taslak.eserler.map((id, i) => (
                    <li key={id}>
                      <span className="rota-durak">
                        <i>{i + 1}</i>
                        <span>
                          <b>{ad(id)}</b>
                          <small>{ilAdi(harita.get(id)?.il ?? "")}</small>
                        </span>
                      </span>
                      <span className="rota-sira">
                        <button type="button" aria-label={r.yukari} disabled={i === 0} onClick={() => tasi(i, -1)}>
                          ↑
                        </button>
                        <button type="button" aria-label={r.asagi} disabled={i === taslak.eserler.length - 1} onClick={() => tasi(i, 1)}>
                          ↓
                        </button>
                        <button type="button" aria-label={r.cikar} onClick={() => durakDegistir(id)}>
                          ✕
                        </button>
                      </span>
                    </li>
                  ))}
                </ol>
                <small className="not">{r.durakSiniri(taslak.eserler.length, ROTAM_EN_COK)}</small>
              </>
            )}
            <span className="kart-baslik">{r.eserEkle}</span>
            <div className="rota-secici" role="group" aria-label={r.eserEkle}>
              <button type="button" aria-pressed={arama.sehir === ""} onClick={() => setArama({ ...arama, sehir: "" })}>
                {r.tumu}
              </button>
              {iller.map((i) => (
                <button key={i.id} type="button" aria-pressed={arama.sehir === i.id} onClick={() => setArama({ ...arama, sehir: i.id })}>
                  {metin(i.ad, dil)}
                </button>
              ))}
            </div>
            <input type="search" placeholder={r.ara} aria-label={r.ara} value={arama.metin} onChange={(e) => setArama({ ...arama, metin: e.target.value })} />
            <ul className="rota-sonuclar">
              {sonuclar.slice(0, 40).map((e) => {
                const secili = taslak.eserler.includes(e.id);
                return (
                  <li key={e.id}>
                    <button type="button" aria-pressed={secili} onClick={() => durakDegistir(e.id)}>
                      <span>
                        <b>{ad(e.id)}</b>
                        <small>
                          {turAdi(e.tur)} · {e.ilce || ilAdi(e.il)}
                        </small>
                      </span>
                      <span className="rota-arti" aria-hidden="true">
                        {secili ? "✓" : "＋"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {sonuclar.length > 40 ? <p className="not">{r.daralt}</p> : sonuclar.length === 0 ? <p className="not">{r.bulunamadi}</p> : null}
            <p role="alert" className="hata">
              {hata}
            </p>
            <div className="dugmeler">
              <button type="button" className="ikincil" onClick={() => duzen.current?.close()}>
                {r.vazgec}
              </button>
              <button type="button" onClick={kaydet}>
                {r.kaydet}
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
