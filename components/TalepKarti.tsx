"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/sozluk";
import type { TalepSatiri } from "@/lib/talep";
import type { Dil } from "@/lib/tipler";

const tarih = (iso: string, dil: Dil) =>
  new Date(iso).toLocaleString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

/** Onay bekleyenler listesindeki mobil uygulama talebi: serbest metin, fotoğraflar, kabul/ret. */
export default function TalepKarti({ dil, talep: x, eserAd, duzenleyebilir }: { dil: Dil; talep: TalepSatiri; eserAd: string; duzenleyebilir: boolean }) {
  const t = s(dil);
  const u = t.talep;
  const router = useRouter();
  const [not, setNot] = useState("");
  const [gerekce, setGerekce] = useState("");
  const [bekle, setBekle] = useState(false);
  const [hata, setHata] = useState<string>();
  const baslikId = `talep-${x.id}`;

  async function yap(islem: "kabul" | "reddet", metin: string) {
    setBekle(true);
    setHata(undefined);
    const yanit = await fetch("/api/talep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ islem, id: x.id, gerekce: metin }),
    });
    if (yanit.ok) return router.refresh();
    const veri = (await yanit.json().catch(() => ({}))) as { hata?: string };
    setBekle(false);
    setHata(veri.hata ?? String(yanit.status));
  }

  return (
    <article className="katki" aria-labelledby={baslikId}>
      <p className="katki-ust">
        <span className="tur-etiketi">{t.surum.onayTuru.talep}</span>
        <span className="etiket etiket-oneri-bekliyor">{t.oneri.durumlar[x.durum]}</span>
        <span>· {x.gonderen_ad ? `${x.gonderen_ad}${x.kullanici ? ` (${u.uye})` : ""}` : u.misafir}</span>
        <span>· {tarih(x.olusturuldu, dil)}</span>
      </p>
      <h3 id={baslikId}>
        <Link href={`/${dil}/eser/${x.eser_id}`}>{eserAd}</Link>
        {duzenleyebilir && (
          <small>
            {" "}
            · <Link href={`/${dil}/yonetim/eser/${x.eser_id}`}>{u.eseriDuzenle} →</Link>
          </small>
        )}
      </h3>
      {x.bilgi && <p style={{ whiteSpace: "pre-wrap" }}>{x.bilgi}</p>}
      {x.foto_yollari.length > 0 &&
        (x.fotolar.length ? (
          <ul className="galeri" aria-label={u.fotolar}>
            {x.fotolar.map((adres, i) => (
              <li key={adres}>
                <a href={adres} target="_blank" rel="noreferrer" aria-label={u.fotoAc(i + 1)}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- süreli Storage bağlantısı */}
                  <img src={adres} alt={u.fotoAc(i + 1)} loading="lazy" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="not">{u.fotoYok}</p>
        ))}
      <p className="not">{u.aciklama}</p>
      <div className="form">
        <label>
          {u.not}
          <input value={not} onChange={(e) => setNot(e.target.value)} maxLength={2000} />
        </label>
        <div className="dugmeler">
          <button type="button" disabled={bekle} onClick={() => yap("kabul", not.trim())}>
            {u.kabulEt}
          </button>
        </div>
      </div>
      <div className="form">
        <label>
          {u.retGerekcesi}
          <input value={gerekce} onChange={(e) => setGerekce(e.target.value)} maxLength={2000} />
        </label>
        <div className="dugmeler">
          <button type="button" className="ikincil" disabled={bekle || !gerekce.trim()} onClick={() => yap("reddet", gerekce.trim())}>
            {u.reddet}
          </button>
        </div>
      </div>
      {hata && <p role="alert">{hata}</p>}
    </article>
  );
}
