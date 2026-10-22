"use client";
import { useEffect, useRef, useState } from "react";
import type { Cevap } from "@/lib/sunucu/sor";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import Simge from "./Simge";

type Mesaj = { soru: string; cevap?: Cevap; hata?: boolean };

/** Devam sorularını anlaması için sunucuya giden son soru-cevaplar. */
function gecmis(mesajlar: Mesaj[]) {
  return mesajlar
    .filter((m) => m.cevap)
    .slice(-4)
    .map((m) => ({ soru: m.soru, cevap: m.cevap!.bulundu ? m.cevap!.cumleler.map((c) => c.metin).join(" ") : "-" }));
}

/** "Bu esere sor" sohbeti. Uygulamayla aynı uç noktayı (POST /api/sor) kullanır. */
export default function SoruPaneli({
  dil,
  eserId,
  durumAdlari,
  ornekler,
}: {
  dil: Dil;
  eserId: string;
  durumAdlari: Record<string, string>;
  /** Bu eserin kayıtlarıyla cevaplanabilen örnek sorular (sunucuda süzülür). */
  ornekler: string[];
}) {
  const t = s(dil);
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [soru, setSoru] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const sonMesaj = useRef<HTMLLIElement>(null);
  const sohbet = useRef<HTMLOListElement>(null);

  // Yeni soru ya da cevap gelince sohbet en alta kayar (sayfa da son balonu gösterir).
  useEffect(() => {
    if (mesajlar.length === 0) return;
    const kutu = sohbet.current;
    if (kutu) kutu.scrollTo({ top: kutu.scrollHeight, behavior: "smooth" });
    sonMesaj.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [mesajlar]);

  async function sor(metin: string) {
    const temiz = metin.trim();
    if (!temiz || bekliyor) return;
    setSoru("");
    setBekliyor(true);
    setMesajlar((m) => [...m, { soru: temiz }]);
    let yeni: Mesaj = { soru: temiz, hata: true };
    try {
      const yanit = await fetch("/api/sor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eser_id: eserId, soru: temiz, dil, gecmis: gecmis(mesajlar) }),
      });
      if (yanit.ok) yeni = { soru: temiz, cevap: (await yanit.json()) as Cevap };
    } catch {
      // Ağ hatası: mesaj hata olarak kalır.
    }
    setMesajlar((m) => [...m.slice(0, -1), yeni]);
    setBekliyor(false);
  }

  return (
    <section className="soru-paneli" aria-labelledby="sor-baslik">
      <h2 id="sor-baslik">
        <Simge ad="sor" /> {t.sor.baslik}
      </h2>
      <p className="not">{t.sor.aciklama}</p>

      <ol className="sohbet" ref={sohbet} aria-live="polite">
        {mesajlar.map((m, i) => (
          <li key={i} ref={i === mesajlar.length - 1 ? sonMesaj : undefined}>
            <p className="balon-soru">
              <span className="gizli">{t.sor.soru}: </span>
              {m.soru}
            </p>
            <div className="balon-cevap">
              <span className="gizli">{t.sor.cevap}: </span>
              {!m.cevap && !m.hata && <p className="not">{t.sor.bekle}</p>}
              {m.hata && <p>{t.sor.hata}</p>}
              {m.cevap && !m.cevap.bulundu && (
                <p>
                  {t.sor.yok}{" "}
                  <span className="etiket etiket-belirsiz">
                    {t.durumIsareti.belirsiz} {durumAdlari.belirsiz}
                  </span>
                </p>
              )}
              {m.cevap?.cumleler.map((c, j) => (
                <p key={j}>
                  {c.metin}{" "}
                  {c.kaynak_id ? (
                    <a
                      href={c.adres ?? `#kaynak-${c.kaynak_id}`}
                      className={`etiket etiket-${c.durum}`}
                      {...(c.adres ? { target: "_blank", rel: "noopener" } : {})}
                    >
                      {t.durumIsareti[c.durum]} {durumAdlari[c.durum]}
                      {c.sayfa ? ` · ${t.sayfaKisa(c.sayfa)}` : ""}
                    </a>
                  ) : c.durum === "not" ? null : (
                    <span className={`etiket etiket-${c.durum}`}>
                      {t.durumIsareti[c.durum]} {durumAdlari[c.durum]}
                    </span>
                  )}
                </p>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {mesajlar.length === 0 && ornekler.length > 0 && (
        <div className="ornek-sorular">
          <p className="not">{t.sor.ornekBaslik}</p>
          <ul>
            {ornekler.map((o) => (
              <li key={o}>
                <button type="button" className="cip" onClick={() => sor(o)}>
                  {o}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        className="soru-formu"
        onSubmit={(e) => {
          e.preventDefault();
          sor(soru);
        }}
      >
        <label htmlFor="soru" className="gizli">
          {t.sor.etiket}
        </label>
        <input id="soru" value={soru} onChange={(e) => setSoru(e.target.value)} placeholder={t.sor.yer} maxLength={300} autoComplete="off" />
        <button type="submit" disabled={bekliyor || !soru.trim()}>
          {t.sor.gonder}
        </button>
      </form>
    </section>
  );
}
