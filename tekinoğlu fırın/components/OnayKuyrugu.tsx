"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/sozluk";
import type { Dil, Katki } from "@/lib/tipler";

export type GosterilenKatki = Pick<Katki, "id" | "tur" | "durum" | "nereden" | "ekleyen" | "gonderildi" | "not" | "karar"> & {
  eser: string;
  eserAdresi?: string;
  il: string;
  kaynak: string;
  farklar: { alan: string; eski: string; yeni: string; araDegisti?: boolean }[];
};

const tarih = (iso: string, dil: Dil) =>
  new Date(iso).toLocaleString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

/** Uzun metinler (tarihçe) katlanır; kısa değerler doğrudan görünür. */
function Deger({ metin }: { metin: string }) {
  if (metin.length < 400) return <>{metin}</>;
  return (
    <details>
      <summary>{metin.slice(0, 160)}…</summary>
      {metin}
    </details>
  );
}

function KatkiKarti({ dil, k }: { dil: Dil; k: GosterilenKatki }) {
  const t = s(dil);
  const router = useRouter();
  const [not, setNot] = useState("");
  const [hata, setHata] = useState<string>();
  const [bekle, setBekle] = useState(false);
  const baslikId = `katki-${k.id}`;

  async function karar(karar: "onayla" | "reddet") {
    setBekle(true);
    setHata(undefined);
    const yanit = await fetch("/api/onay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: k.id, karar, not }),
    });
    // Başarılıysa düğmeler sayfa yenilenene kadar kapalı kalır; iki kez tıklanınca ikinci karar gitmez.
    if (yanit.ok) return router.refresh();
    setBekle(false);
    const veri = (await yanit.json()) as { hata?: string; ayrinti?: string[] };
    setHata([veri.hata, ...(veri.ayrinti ?? [])].filter(Boolean).join(" "));
  }

  return (
    <article className="katki" aria-labelledby={baslikId}>
      <p className="katki-ust">
        <span className={`etiket etiket-${k.durum}`}>{t.katkiDurumu[k.durum]}</span>
        <span>{t.katkiTuru[k.tur]}</span>
        <span>· {t.nereden[k.nereden]}</span>
        <span>· {k.ekleyen}</span>
        <span>· {tarih(k.gonderildi, dil)}</span>
      </p>
      <h3 id={baslikId}>
        {k.eserAdresi ? <Link href={k.eserAdresi}>{k.eser}</Link> : k.eser} <small className="not">{k.il}</small>
      </h3>
      <p>
        {t.kaynak}: {k.kaynak}
      </p>
      {k.not && <p className="not">“{k.not}”</p>}
      <table className="fark">
        <thead>
          <tr>
            <th scope="col">{t.alan}</th>
            <th scope="col">{t.eskiDeger}</th>
            <th scope="col">{t.yeniDeger}</th>
          </tr>
        </thead>
        <tbody>
          {k.farklar.map((f) => (
            <tr key={f.alan}>
              <th scope="row">{f.alan}</th>
              <td className="eski" data-baslik={t.eskiDeger}>
                <Deger metin={f.eski} />
                {f.araDegisti && <p className="uyari">{t.araDegisti}</p>}
              </td>
              <td data-baslik={t.yeniDeger}>
                <Deger metin={f.yeni} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {k.durum === "bekliyor" ? (
        <div className="form">
          <label>
            {t.redNotu}
            <input value={not} onChange={(e) => setNot(e.target.value)} maxLength={2000} />
          </label>
          <div className="dugmeler">
            <button type="button" disabled={bekle} onClick={() => karar("onayla")}>
              {t.onayla}
            </button>
            <button type="button" className="ikincil" disabled={bekle} onClick={() => karar("reddet")}>
              {t.reddet}
            </button>
          </div>
          <p role="alert">{hata}</p>
        </div>
      ) : (
        k.karar && (
          <p className="not">
            {tarih(k.karar.tarih, dil)}
            {k.karar.not ? `: ${k.karar.not}` : ""}
          </p>
        )
      )}
    </article>
  );
}

export default function OnayKuyrugu({ dil, katkilar }: { dil: Dil; katkilar: GosterilenKatki[] }) {
  const t = s(dil);
  const bekleyen = katkilar.filter((k) => k.durum === "bekliyor");
  const verilen = katkilar.filter((k) => k.durum !== "bekliyor");
  return (
    <>
      <h2>{t.bekleyen(bekleyen.length)}</h2>
      {bekleyen.length === 0 && <p>{t.kuyrukBos}</p>}
      {bekleyen.map((k) => (
        <KatkiKarti key={k.id} dil={dil} k={k} />
      ))}
      {verilen.length > 0 && (
        <details>
          <summary>
            <h2 className="satir-ici">{t.gecmis} ({verilen.length})</h2>
          </summary>
          {verilen.map((k) => (
            <KatkiKarti key={k.id} dil={dil} k={k} />
          ))}
        </details>
      )}
    </>
  );
}
