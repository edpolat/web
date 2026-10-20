"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";

export type GosterilenSurum = {
  id: number;
  eserId: string;
  eser: string;
  il: string;
  durum: "taslak" | "incelemede" | "yayinda" | "reddedildi" | "arsivlendi";
  islem: "ekle" | "duzenle" | "geri_al" | "arsivle" | "arsivden_cikar";
  ekleyen: string;
  olusturuldu: string;
  inceleyen?: string;
  karar_tarihi?: string;
  ret_gerekcesi?: string;
  aciklama?: string;
  kaynak?: string;
  farklar: { alan: string; eski: string; yeni: string }[];
  araDegisti?: boolean;
  guncel?: boolean;
  /** Bu sürüme dönülebilir mi (geçmiş sayfası). Veri dosyasındaki ilk hâl için hedef null. */
  donulebilir?: boolean;
  hedef?: number | null;
};

type Eylem = "karar" | "incelemeye" | "geriAl";

const tarih = (iso: string, dil: Dil) =>
  new Date(iso).toLocaleString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

function Deger({ metin }: { metin: string }) {
  if (metin.length < 400) return <>{metin}</>;
  return (
    <details>
      <summary>{metin.slice(0, 160)}…</summary>
      {metin}
    </details>
  );
}

async function gonder(govde: Record<string, unknown>): Promise<string | undefined> {
  const yanit = await fetch("/api/surum", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde) });
  if (yanit.ok) return undefined;
  const veri = (await yanit.json().catch(() => ({}))) as { hata?: string; ayrinti?: string[] };
  return [veri.hata ?? String(yanit.status), ...(veri.ayrinti ?? [])].join(" ");
}

export function SurumKarti({
  dil,
  k,
  eylemler,
  eserAdresi,
  turEtiketi,
}: {
  dil: Dil;
  k: GosterilenSurum;
  eylemler: Eylem[];
  eserAdresi: boolean;
  /** Karışık listelerde (onay bekleyenler) kaydın türü. */
  turEtiketi?: string;
}) {
  const t = s(dil);
  const u = t.surum;
  const router = useRouter();
  const [gerekce, setGerekce] = useState("");
  const [hata, setHata] = useState<string>();
  const [bekle, setBekle] = useState(false);
  const baslikId = `surum-${k.id}`;

  async function yap(govde: Record<string, unknown>) {
    setBekle(true);
    setHata(undefined);
    const h = await gonder(govde);
    // Başarılıysa düğmeler sayfa yenilenene kadar kapalı kalır; iki kez tıklanınca ikinci istek gitmez.
    if (!h) return router.refresh();
    setBekle(false);
    setHata(h);
  }

  return (
    <article className="katki" aria-labelledby={baslikId}>
      <p className="katki-ust">
        {turEtiketi && <span className="tur-etiketi">{turEtiketi}</span>}
        <span className={`etiket etiket-surum-${k.durum}`}>{u.durum[k.durum]}</span>
        {k.guncel && <span className="etiket etiket-onaylandi">{u.guncel}</span>}
        <span>{u.islem[k.islem]}</span>
        {k.ekleyen && <span>· {k.ekleyen}</span>}
        <span>· {tarih(k.olusturuldu, dil)}</span>
      </p>
      <h3 id={baslikId}>
        {eserAdresi ? <Link href={`/${dil}/yonetim/eser/${k.eserId}/gecmis`}>{k.eser}</Link> : k.eser} <small className="not">{k.il}</small>
      </h3>
      {k.kaynak && (
        <p>
          {t.kaynak}: {k.kaynak}
        </p>
      )}
      {k.aciklama && <p className="not">“{k.aciklama}”</p>}
      {k.araDegisti && <p className="uyari">{u.araDegisti}</p>}
      {k.farklar.length > 0 && (
        <table className="fark">
          <thead>
            <tr>
              <th scope="col">{t.alan}</th>
              <th scope="col">{u.onceki}</th>
              <th scope="col">{u.yeni}</th>
            </tr>
          </thead>
          <tbody>
            {k.farklar.map((f) => (
              <tr key={f.alan}>
                <th scope="row">{f.alan}</th>
                <td className="eski" data-baslik={u.onceki}>
                  <Deger metin={f.eski} />
                </td>
                <td className="yeni" data-baslik={u.yeni}>
                  <Deger metin={f.yeni} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(k.inceleyen || k.ret_gerekcesi) && (
        <p className="not">
          {k.inceleyen && `${u.inceleyen}: ${k.inceleyen}`}
          {k.karar_tarihi && ` · ${tarih(k.karar_tarihi, dil)}`}
          {k.ret_gerekcesi && (
            <>
              <br />
              <strong>{u.gerekce}:</strong> {k.ret_gerekcesi}
            </>
          )}
        </p>
      )}
      {eylemler.includes("karar") && k.durum === "incelemede" && (
        <div className="form">
          <label>
            {u.gerekceRet}
            <input value={gerekce} onChange={(e) => setGerekce(e.target.value)} maxLength={2000} />
          </label>
          <div className="dugmeler">
            <button type="button" disabled={bekle} onClick={() => yap({ islem: "onayla", id: k.id, gerekce })}>
              {u.onayla}
            </button>
            <button type="button" className="ikincil" disabled={bekle || !gerekce.trim()} onClick={() => yap({ islem: "reddet", id: k.id, gerekce })}>
              {u.reddet}
            </button>
          </div>
        </div>
      )}
      {eylemler.includes("incelemeye") && k.durum === "taslak" && (
        <div className="dugmeler">
          <button type="button" disabled={bekle} onClick={() => yap({ islem: "incelemeye", id: k.id })}>
            {u.incelemeyeGonder}
          </button>
        </div>
      )}
      {eylemler.includes("geriAl") && k.donulebilir && (
        <details>
          <summary>{u.buSurumeDon}</summary>
          <div className="form">
            <label>
              {u.gerekceZorunlu}
              <input value={gerekce} onChange={(e) => setGerekce(e.target.value)} maxLength={2000} />
            </label>
            <div className="dugmeler">
              <button
                type="button"
                disabled={bekle || !gerekce.trim()}
                onClick={() => yap({ islem: "geri_al", eser_id: k.eserId, hedef: k.hedef ?? null, gerekce })}
              >
                {u.buSurumeDon}
              </button>
            </div>
          </div>
        </details>
      )}
      <p role="alert">{hata}</p>
    </article>
  );
}

/** Sürüm kartları: inceleme kuyruğu (karar), Katkılarım (incelemeye gönder), sürüm geçmişi (geri al). */
export default function SurumListesi({
  dil,
  surumler,
  eylemler = [],
  eserAdresi = true,
  bosMetin,
}: {
  dil: Dil;
  surumler: GosterilenSurum[];
  eylemler?: Eylem[];
  eserAdresi?: boolean;
  bosMetin?: string;
}) {
  if (!surumler.length) return <p>{bosMetin ?? s(dil).surum.hicYok}</p>;
  return (
    <>
      {surumler.map((k) => (
        <SurumKarti key={k.id} dil={dil} k={k} eylemler={eylemler} eserAdresi={eserAdresi} />
      ))}
    </>
  );
}

/** Eseri arşivle ya da arşivden çıkar (eser.arsivle). Gerekçe zorunlu. */
export function ArsivDugmesi({ dil, eserId, arsivde }: { dil: Dil; eserId: string; arsivde: boolean }) {
  const u = s(dil).surum;
  const router = useRouter();
  const [gerekce, setGerekce] = useState("");
  const [hata, setHata] = useState<string>();
  const [bekle, setBekle] = useState(false);
  const islem = arsivde ? "arsivden_cikar" : "arsivle";
  return (
    <details>
      <summary>{arsivde ? u.arsivdenCikar : u.arsivle}</summary>
      <div className="form">
        <label>
          {u.gerekceZorunlu}
          <input value={gerekce} onChange={(e) => setGerekce(e.target.value)} maxLength={2000} />
        </label>
        <div className="dugmeler">
          <button
            type="button"
            className={arsivde ? undefined : "ikincil"}
            disabled={bekle || !gerekce.trim()}
            onClick={async () => {
              setBekle(true);
              const h = await gonder({ islem, eser_id: eserId, gerekce });
              if (!h) return router.refresh();
              setBekle(false);
              setHata(h);
            }}
          >
            {arsivde ? u.arsivdenCikar : u.arsivle}
          </button>
        </div>
        <p role="alert">{hata}</p>
      </div>
    </details>
  );
}
