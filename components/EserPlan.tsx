"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { g, mesafeKm, mesafeYazisi } from "@/lib/gezi";
import { konumSessiz } from "@/lib/konum";
import { PLAN_OLAYI, ROTAM_EN_COK, gitmekDegistir, gitmekListesi, rotalarim, rotayaEkle, type Rotam } from "@/lib/planlar";
import type { Dil } from "@/lib/tipler";

type Props = {
  dil: Dil;
  eserId: string;
  eserAdi: string;
  /** Paylaş penceresinde adın yanında görünür, ör. "Konya". */
  sehir?: string;
  konum?: { enlem: number; boylam: number };
  yaklasik?: boolean;
};

const Kalp = ({ dolu }: { dolu: boolean }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill={dolu ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5C19 15.6 12 20 12 20z" />
  </svg>
);
const PaylasIkon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

/** Eser sayfasındaki mesafe: konum izni daha önce verildiyse "1,2 km" (yaklaşık konumda başında "~"). */
export function EserMesafesi({ dil, konum, yaklasik }: Pick<Props, "dil" | "konum" | "yaklasik">) {
  const [km, setKm] = useState<number>();
  useEffect(() => {
    if (!konum) return;
    let iptal = false;
    konumSessiz().then((n) => {
      if (n && !iptal) setKm(mesafeKm(n.enlem, n.boylam, konum.enlem, konum.boylam));
    });
    return () => {
      iptal = true;
    };
  }, [konum?.enlem, konum?.boylam]);
  if (km === undefined) return null;
  return (
    <>
      {" · "}
      <span className="mesafe" title={g(dil).yakin.mesafe}>
        {yaklasik ? "~" : ""}
        {mesafeYazisi(km, dil)}
      </span>
    </>
  );
}

/** Eser sayfası: "Gitmek istiyorum" (kalp), "Paylaş" ve "Rotama ekle" (mobil uygulamadaki gibi). */
export default function EserPlan({ dil, eserId, eserAdi, sehir }: Props) {
  const t = g(dil);
  const [listede, setListede] = useState(false);
  const [rotalar, setRotalar] = useState<Rotam[]>([]);
  const [not, setNot] = useState<string>();
  const pencere = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const yenile = () => {
      setListede(gitmekListesi().includes(eserId));
      setRotalar(rotalarim());
    };
    yenile();
    window.addEventListener(PLAN_OLAYI, yenile);
    window.addEventListener("storage", yenile);
    return () => {
      window.removeEventListener(PLAN_OLAYI, yenile);
      window.removeEventListener("storage", yenile);
    };
  }, [eserId]);

  useEffect(() => {
    if (!not) return;
    const z = setTimeout(() => setNot(undefined), 3000);
    return () => clearTimeout(z);
  }, [not]);

  function gitmek() {
    const var_ = gitmekDegistir(eserId);
    setListede(var_);
    setNot(var_ ? t.gitmek.eklendi : t.gitmek.cikti);
  }

  async function paylas() {
    const adres = window.location.href.split("#")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title: `${eserAdi} · Vakfiye`, text: sehir ? `${eserAdi} (${sehir})` : eserAdi, url: adres });
      } catch {}
      return;
    }
    try {
      await navigator.clipboard.writeText(adres);
      setNot(t.paylas.kopyalandi);
    } catch {
      window.prompt(t.paylas.kopyala, adres);
    }
  }

  function ekle(r: Rotam) {
    if (rotayaEkle(r.id, eserId)) setNot(t.rota.eklendi(r.ad));
    pencere.current?.close();
  }

  const yeniRotaAdresi = `/${dil}/hesap?yeniRota=${encodeURIComponent(eserId)}#rotalarim`;

  return (
    <div className="eser-plan">
      <button type="button" className={listede ? "dugme ikincil gitmek secili" : "dugme ikincil gitmek"} aria-pressed={listede} onClick={gitmek}>
        <Kalp dolu={listede} /> {listede ? t.gitmek.listende : t.gitmek.dugme}
      </button>
      <button type="button" className="dugme ikincil" onClick={paylas}>
        <PaylasIkon /> {t.paylas.dugme}
      </button>
      {rotalar.length === 0 ? (
        <Link className="dugme ikincil" href={yeniRotaAdresi}>
          ＋ {t.rota.rotamaEkle}
        </Link>
      ) : (
        <button type="button" className="dugme ikincil" onClick={() => pencere.current?.showModal()}>
          ＋ {t.rota.rotamaEkle}
        </button>
      )}
      <span className="eser-plan-not" role="status" aria-live="polite">
        {not}
      </span>
      <dialog ref={pencere} className="rota-pencere" aria-labelledby="rotama-ekle-baslik" onClick={(e) => e.target === e.currentTarget && pencere.current?.close()}>
        <h2 id="rotama-ekle-baslik" className="kart-baslik">
          {t.rota.rotamaEkleBaslik}
        </h2>
        <ul className="rota-secim">
          {rotalar.map((r) => {
            const icinde = r.eserler.includes(eserId);
            return (
              <li key={r.id}>
                <button type="button" disabled={icinde || r.eserler.length >= ROTAM_EN_COK} onClick={() => ekle(r)}>
                  <b>{r.ad}</b>
                  <small>{icinde ? t.rota.buRotada : t.rota.durak(r.eserler.length)}</small>
                </button>
              </li>
            );
          })}
          <li>
            <Link href={yeniRotaAdresi}>
              <b>{t.rota.yeniRota}</b>
            </Link>
          </li>
        </ul>
        <div className="dugmeler">
          <button type="button" className="ikincil" onClick={() => pencere.current?.close()}>
            {t.rota.kapat}
          </button>
        </div>
      </dialog>
    </div>
  );
}
