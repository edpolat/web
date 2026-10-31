"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { bulutHazir, kayitliOturum, pullariEkle, pullariGetir } from "@/lib/bulut";
import { metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import type { CokDilli, Dil, Rota } from "@/lib/tipler";
import { PASAPORT_NO, z } from "@/lib/ziyaret";
import { kagidiBagla, kagitBagliMi, kodCoz, yerelPulEkle, yerelPullar } from "@/lib/yerel-pul";

// Kamerayla QR okutma (mobil uygulamadaki Tara sekmesi). html5-qrcode uygulamadaki sürümüyle, ilk kullanımda yüklenir.
const KUTUPHANE = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
type Okuyucu = { start: (...a: unknown[]) => Promise<void>; stop: () => Promise<void>; clear: () => void };
declare global {
  interface Window {
    Html5Qrcode?: new (alan: string) => Okuyucu;
  }
}

function kutuphaneYukle(): Promise<void> {
  if (window.Html5Qrcode) return Promise.resolve();
  return new Promise((coz, reddet) => {
    const b = document.createElement("script");
    b.src = KUTUPHANE;
    b.onload = () => coz();
    b.onerror = () => reddet(new Error("kutuphane"));
    document.head.appendChild(b);
  });
}

export default function Tara({
  dil,
  rotalar,
  iller,
  eserler,
}: {
  dil: Dil;
  rotalar: Rota[];
  iller: { id: string; ad: CokDilli }[];
  eserler: { id: string; ad: CokDilli }[];
}) {
  const t = z(dil).tara;
  const u = s(dil).uyelik;
  const router = useRouter();
  const okuyucu = useRef<Okuyucu | null>(null);
  const [kameraAcik, setKameraAcik] = useState(false);
  const [not, setNot] = useState<string>();
  const [bildirim, setBildirim] = useState<string>();
  const [pullar, setPullar] = useState<string[]>([]);
  const [kagit, setKagit] = useState(false);
  const [uyeId, setUyeId] = useState<string | null>();
  const [rotaIl, setRotaIl] = useState(rotalar[0]?.il);

  const eserAdi = (id: string) => metin(eserler.find((e) => e.id === id)?.ad, dil) || id;
  const ilAdi = (il: string) => metin(iller.find((i) => i.id === il)?.ad, dil) || il;
  const rotaBul = (id: string) => rotalar.find((r) => r.duraklar.some((d) => d.eser_id === id));

  useEffect(() => {
    setKagit(kagitBagliMi());
    const yerel = yerelPullar();
    setPullar(yerel);
    if (!bulutHazir) return setUyeId(null);
    kayitliOturum()
      .then(async (o) => {
        setUyeId(o?.id ?? null);
        if (o) setPullar([...new Set([...yerel, ...(await pullariGetir())])]);
      })
      .catch(() => setUyeId(null));
    return () => kameraKapat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goster(m: string) {
    setBildirim(m);
    window.setTimeout(() => setBildirim((o) => (o === m ? undefined : o)), 3500);
  }

  async function pulAl(id: string) {
    const rota = rotaBul(id);
    if (!rota) return;
    yerelPulEkle(id);
    const yeni = pullar.includes(id) ? pullar : [...pullar, id];
    setPullar(yeni);
    setRotaIl(rota.il);
    if (uyeId) await pullariEkle(uyeId, [id]).catch(() => {});
    const sayi = rota.duraklar.filter((d) => yeni.includes(d.eser_id)).length;
    const yari = Math.ceil(rota.duraklar.length / 2);
    goster(sayi === rota.duraklar.length ? t.rozetTamam(u.rota(ilAdi(rota.il))) : sayi === yari ? t.rozetYari : t.pulBildirim(eserAdi(id)));
  }

  function kagitBagla() {
    kagidiBagla();
    setKagit(true);
    goster(t.kagitBildirim);
  }

  function kodOkundu(yazi: string) {
    if (!okuyucu.current) return; // aynı kod art arda okunmasın
    kameraKapat();
    const kod = kodCoz(yazi, PASAPORT_NO);
    if (kod?.tur === "kagit") return kagitBagla();
    if (kod?.tur === "eser") {
      if (rotaBul(kod.id)) return void pulAl(kod.id);
      if (eserler.some((e) => e.id === kod.id)) {
        goster(t.rotaDisi);
        return router.push(`/${dil}/eser/${kod.id}`);
      }
    }
    goster(t.yabanci);
  }

  async function kameraAc() {
    setNot(undefined);
    try {
      await kutuphaneYukle();
    } catch {
      return setNot(t.kutuphaneYok);
    }
    setKameraAcik(true);
    try {
      const o = new window.Html5Qrcode!("okuyucu");
      okuyucu.current = o;
      await o.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 } }, kodOkundu, () => {});
    } catch {
      okuyucu.current = null;
      setKameraAcik(false);
      setNot(t.kameraYok);
    }
  }

  function kameraKapat() {
    const eski = okuyucu.current;
    okuyucu.current = null;
    setKameraAcik(false);
    if (eski) eski.stop().then(() => eski.clear()).catch(() => {});
  }

  const rota = rotalar.find((r) => r.il === rotaIl);

  return (
    <section className="tara" aria-labelledby="tara-baslik">
      <h1 id="tara-baslik">{t.baslik}</h1>
      <p>{t.alt}</p>
      <div className="kamera">
        <div id="okuyucu" />
        {kameraAcik ? (
          <button type="button" className="dugme ikincil" onClick={kameraKapat}>
            {t.kameraKapat}
          </button>
        ) : (
          <button type="button" className="dugme" onClick={kameraAc}>
            {t.kameraAc}
          </button>
        )}
      </div>
      {not && <p className="hata" role="alert">{not}</p>}
      <p role="status" aria-live="polite" className={bildirim ? "tara-bildirim" : "gizli"}>
        {bildirim}
        {bildirim && (
          <>
            {" "}
            <Link href={`/${dil}/hesap`}>{t.pasaportaGit}</Link>
          </>
        )}
      </p>
      {uyeId === null && <p className="not">{t.misafir}</p>}

      <p className="not">{t.listeden}</p>
      <div className="rota-secici" role="group" aria-label={t.rotaSec}>
        {rotalar.map((r) => (
          <button key={r.il} type="button" aria-pressed={r.il === rotaIl} onClick={() => setRotaIl(r.il)}>
            {ilAdi(r.il)}
          </button>
        ))}
      </div>
      <ul className="tara-liste">
        <li>
          <button type="button" onClick={kagitBagla}>
            <b>{t.kagit}</b>
            <small>{t.kagitAlt(kagit)}</small>
          </button>
        </li>
        {rota?.duraklar.map((d) => (
          <li key={d.eser_id}>
            <button type="button" onClick={() => void pulAl(d.eser_id)}>
              <b>{eserAdi(d.eser_id)}</b>
              <small>
                {u.rota(ilAdi(rota.il))}
                {pullar.includes(d.eser_id) ? t.pulAlindi : ""}
              </small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
