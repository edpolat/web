"use client";
import { useEffect, useState } from "react";
import type { Dil } from "@/lib/tipler";
import { ADAB_TURU, VAKIT_ANAHTARLARI, namazUyarisi, z, type Vakitler } from "@/lib/ziyaret";

function bugun() {
  const s = new Date();
  return `${String(s.getDate()).padStart(2, "0")}-${String(s.getMonth() + 1).padStart(2, "0")}-${s.getFullYear()}`;
}

/** Günün namaz vakitleri (aladhan.com, Diyanet yöntemi, ücretsiz). Aynı gün ve yer için tarayıcıda saklanır. */
async function vakitleriGetir(enlem: number, boylam: number): Promise<Vakitler> {
  const anahtar = `vakfiye:vakit:${bugun()}:${enlem.toFixed(2)},${boylam.toFixed(2)}`;
  try {
    const sakli = localStorage.getItem(anahtar);
    if (sakli) return JSON.parse(sakli) as Vakitler;
  } catch {}
  const yanit = await fetch(`https://api.aladhan.com/v1/timings/${bugun()}?latitude=${enlem}&longitude=${boylam}&method=13`);
  if (!yanit.ok) throw new Error(`HTTP ${yanit.status}`);
  const veri = (await yanit.json()) as { data: { timings: Record<string, string> } };
  const vakit: Vakitler = {};
  for (const k of VAKIT_ANAHTARLARI) {
    const m = String(veri.data.timings[k] ?? "").match(/(\d{1,2}):(\d{2})/);
    if (m) vakit[k] = `${m[1].padStart(2, "0")}:${m[2]}`;
  }
  try {
    localStorage.setItem(anahtar, JSON.stringify(vakit));
  } catch {}
  return vakit;
}

/** Ziyaret adabı kartı (mobil uygulamadaki gibi); cami, mescit ve külliyelerde namaz vakti ve yakınsa uyarı. */
export default function ZiyaretAdabi({ dil, tur, konum }: { dil: Dil; tur: string; konum?: { enlem: number; boylam: number } }) {
  const t = z(dil).adab;
  const adab = ADAB_TURU[tur];
  const [vakit, setVakit] = useState<Vakitler | null>();
  const [, setSaat] = useState(0);

  useEffect(() => {
    if (adab !== "ibadet" || !konum) return;
    vakitleriGetir(konum.enlem, konum.boylam).then(setVakit, () => setVakit(null));
    const zaman = setInterval(() => setSaat((n) => n + 1), 60000); // uyarı dakikada bir güncellenir
    return () => clearInterval(zaman);
  }, [adab, konum?.enlem, konum?.boylam]);

  if (!adab) return null;
  const uyari = vakit ? namazUyarisi(vakit, dil) : null;
  return (
    <section className="adab-karti" aria-labelledby="adab-baslik">
      <h2 id="adab-baslik" className="kart-baslik">
        {t.baslik}
      </h2>
      {adab === "ibadet" && konum && (
        <div className="namaz-kutu">
          {vakit === undefined ? (
            <small className="not">{t.yukleniyor}</small>
          ) : vakit === null ? (
            <small className="not">{t.alinamadi}</small>
          ) : (
            <>
              {uyari?.uyari ? (
                <p className="uyari" role="status">
                  {uyari.uyari}
                </p>
              ) : (
                <p className="namaz-siradaki">{uyari?.siradaki ?? t.bitti}</p>
              )}
              <div className="namaz-vakitler">
                {VAKIT_ANAHTARLARI.filter((k) => vakit[k]).map((k) => (
                  <span key={k}>
                    <small>{t.vakitler[k]}</small>
                    <b>{vakit[k]}</b>
                  </span>
                ))}
              </div>
              <small className="not">{t.kaynak}</small>
            </>
          )}
        </div>
      )}
      <ul>
        {t[adab].map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </section>
  );
}
