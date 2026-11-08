"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DilNotu, useDilDenetimi } from "@/components/DilUyarisi";
import { Bolum, type PanelBasliklari } from "@/components/IncelemeBolum";
import { metinFarki, type DilFarki } from "@/lib/dil-uyumu";
import { KAYNAK_TURLERI, NITELIKLER, VARSAYILAN_NITELIK, type KaynakTuru } from "@/lib/kaynak";
import { UYGULANABILIR, ikiDilli, type OneriSatiri, type UygulanacakAlan } from "@/lib/oneri";
import { s } from "@/lib/sozluk";
import type { CokDilli, Dil } from "@/lib/tipler";

type Props = {
  dil: Dil;
  oneri: OneriSatiri;
  eserAd: string;
  /** Alanın sitedeki şu anki değeri. */
  mevcut: string;
  /** Eserin iki dilli metinlerinin (ad, adres) şu anki hâli. */
  mevcutMetin?: Partial<Record<string, CokDilli>>;
  /** YZ açık: kabul ederken iki dil karşılaştırılır. */
  yzAcik?: boolean;
  /** Önerinin seçtiği doğrulanmış kaynağın başlığı. */
  kaynakAd?: string;
  kategoriler: { id: string; ad: string }[];
  /** Önerinin bağlantısını/dosyasını kütüphaneye ekleyebilir mi (kaynak.dogrula). */
  kutuphaneYetkisi: boolean;
  /** YZ kaynak analizi kutusu (yalnız bilgi verir). */
  yz?: React.ReactNode;
  /** YZ ön eleme kutusu (etiketler, öncelik, benzer öneriler). */
  yzEleme?: React.ReactNode;
  /** Editörün gördüğü YZ analizleri: kararla birlikte denetim kaydına "YZ önerisi görüldü" yazılır. */
  yzAnalizleri?: number[];
  /** Onay bekleyenler panelinde Eser / Bilgi / Karar bölümlerine ayrılmış düzen (YZ kutuları o zaman sol sütunda). */
  panel?: PanelBasliklari;
};

const tarih = (iso: string, dil: Dil) =>
  new Date(iso).toLocaleString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

async function gonder(govde: Record<string, unknown>): Promise<string | undefined> {
  const yanit = await fetch("/api/oneri", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde) });
  if (yanit.ok) return undefined;
  const veri = (await yanit.json().catch(() => ({}))) as { hata?: string; ayrinti?: string[] };
  return [veri.hata ?? String(yanit.status), ...(veri.ayrinti ?? [])].join(" ");
}

/** Onay bekleyenler listesindeki bilgi önerisi: öneri, kaynağı ve kabul/ret formu. */
export default function OneriKarti({
  dil,
  oneri: o,
  eserAd,
  mevcut,
  mevcutMetin = {},
  yzAcik = false,
  kaynakAd,
  kategoriler,
  kutuphaneYetkisi,
  yz,
  yzEleme,
  yzAnalizleri = [],
  panel,
}: Props) {
  const t = s(dil);
  const u = t.oneri;
  const k = t.kutuphane;
  const du = t.dilUyumu;
  const oneriDili: Dil = o.dil === "en" ? "en" : "tr";
  const alanAdi = (f: DilFarki) => u.alanlar[f.alan] ?? f.alan;
  const dilDenetimi = useDilDenetimi(dil, yzAcik, alanAdi);
  // Öneri olduğu gibi yayına girse iki dilde ne değişirdi (kartın üstündeki basit uyarı için).
  const oneriFarki = ikiDilli(o.alan)
    ? metinFarki(
        o.alan,
        mevcutMetin[o.alan],
        oneriDili === "en" ? { tr: mevcutMetin[o.alan]?.tr, en: o.onerilen } : { tr: o.onerilen, en: mevcutMetin[o.alan]?.en },
      )
    : null;
  const router = useRouter();
  const [alan, setAlan] = useState<UygulanacakAlan>(o.alan === "diger" ? "olgu" : o.alan);
  const kendiKaynagi = Boolean(o.url || o.dosya_yolu);
  const [kutuphaneye, setKutuphaneye] = useState(kendiKaynagi && kutuphaneYetkisi);
  const [kaynakTuru, setKaynakTuru] = useState<KaynakTuru>(o.kaynak_turu ?? (o.dosya_yolu ? "diger" : "web"));
  const [hata, setHata] = useState<string>();
  const [bekle, setBekle] = useState(false);
  const baslikId = `oneri-${o.id}`;

  async function yap(govde: Record<string, unknown>) {
    setBekle(true);
    setHata(undefined);
    const h = await gonder(govde);
    if (!h) return router.refresh();
    setBekle(false);
    setHata(h);
  }

  // Kabul formundaki Türkçe/İngilizce kutularının ilk değeri: önerinin dilindeki kutuya öneri, diğerine sitedeki hâli.
  const eskiMetin = alan === "olgu" ? undefined : mevcutMetin[alan];
  const ilkTr = oneriDili === "en" ? (eskiMetin?.tr ?? "") : o.onerilen;
  const ilkEn = oneriDili === "en" ? o.onerilen : (eskiMetin?.en ?? "");

  function kabul(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    const deger = String(v.get("deger") ?? "");
    const degerEn = String(v.get("deger_en") ?? "");
    // Sunucu boş İngilizceyi "eski hâliyle kalsın" sayar; karşılaştırma da öyle.
    const farklar = ikiDilli(alan)
      ? [metinFarki(alan, eskiMetin, { tr: deger, en: degerEn.trim() || eskiMetin?.en })].filter((f): f is DilFarki => f !== null)
      : [];
    dilDenetimi.denetle(farklar, o.dil_uyumu === true, (dilOnayi) => gonderKabul(v, deger, degerEn, dilOnayi));
  }

  function gonderKabul(v: FormData, deger: string, degerEn: string, dilOnayi: boolean) {
    yap({
      islem: "kabul",
      id: o.id,
      yz_analizleri: yzAnalizleri,
      alan,
      deger,
      deger_en: ikiDilli(alan) ? degerEn : undefined,
      dil_onayi: dilOnayi,
      kategori: v.get("kategori"),
      konum: v.get("konum"),
      kutuphane: kutuphaneye
        ? { baslik: v.get("baslik"), kaynak_turu: kaynakTuru, nitelik: v.get("nitelik"), herkese_acik: v.get("herkese_acik") === "on" }
        : undefined,
    });
  }

  const ust = (
    <>
      <p className="katki-ust">
        <span className="tur-etiketi">{t.surum.onayTuru.oneri}</span>
        <span className="etiket etiket-oneri-bekliyor">{u.durumlar[o.durum]}</span>
        {o.kaynaksiz && <span className="etiket etiket-kaynaksiz">{u.kaynaksiz}</span>}
        {ikiDilli(o.alan) && <span className="etiket">{du.diller[oneriDili]}</span>}
        {o.kullanici_ad && <span>· {o.kullanici_ad}</span>}
        <span>· {tarih(o.olusturuldu, dil)}</span>
      </p>
      <h3 id={baslikId}>
        <Link href={`/${dil}/eser/${o.eser_id}`}>{eserAd}</Link> <small>· {u.alanlar[o.alan]}</small>
      </h3>
    </>
  );
  const bilgi = (
    <>
      <dl className="kunye">
        <dt>{u.mevcut}</dt>
        <dd>{mevcut || "—"}</dd>
        <dt>{u.onerilen}</dt>
        <dd>
          <strong>{o.onerilen}</strong>
        </dd>
        <dt>{u.kaynak}</dt>
        <dd>
          {o.kaynak_id && <Link href={`/${dil}/yonetim/kaynaklar/${o.kaynak_id}`}>{kaynakAd ?? o.kaynak_id}</Link>}
          {o.url && (
            <a href={o.url} target="_blank" rel="noopener noreferrer">
              {o.url} ↗
            </a>
          )}
          {o.dosya_yolu && (
            <a href={`/api/oneri/dosya/${o.id}`} target="_blank" rel="noopener noreferrer">
              {u.dosyaAc} ({o.dosya_turu ?? "?"}
              {o.dosya_boyutu ? `, ${(o.dosya_boyutu / 1024 / 1024).toFixed(1)} MB` : ""}) ↗
            </a>
          )}
          {o.kaynak_turu && ` · ${k.kaynakTurleri[o.kaynak_turu]}`}
          {o.konum && ` · ${o.konum}`}
          {o.kaynaksiz && u.kaynaksiz}
        </dd>
      </dl>
      <DilNotu dil={dil} farklar={oneriFarki ? [oneriFarki] : []} dilUyumu={o.dil_uyumu === true} alanAdi={alanAdi} yzAcik={yzAcik} />
    </>
  );
  const karar = (
    <>
      {yzEleme}
      {yz}

      <form className="form" onSubmit={kabul}>
        <div className="form-satir">
          <label>
            {u.uygulanacakAlan}
            <select value={alan} onChange={(e) => setAlan(e.target.value as UygulanacakAlan)}>
              {UYGULANABILIR.map((a) => (
                <option key={a} value={a}>
                  {u.alanlar[a]}
                </option>
              ))}
            </select>
          </label>
          {alan === "olgu" && (
            <label>
              {u.kategori}
              <select name="kategori" required defaultValue={kategoriler[0]?.id}>
                {kategoriler.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.ad}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {ikiDilli(alan) ? (
          <div key={alan}>
            <label>
              {du.degerTr}
              <textarea name="deger" rows={3} required maxLength={2000} defaultValue={ilkTr} lang="tr" />
            </label>
            <label>
              {du.degerEn}
              <textarea name="deger_en" rows={3} maxLength={2000} defaultValue={ilkEn} lang="en" aria-describedby={alan !== "olgu" ? `${baslikId}-en` : undefined} />
            </label>
            {alan !== "olgu" && (
              <p className="not" id={`${baslikId}-en`}>
                {du.enBos}
              </p>
            )}
          </div>
        ) : (
          <label>
            {u.uygulanacakDeger}
            <textarea name="deger" rows={3} required maxLength={2000} defaultValue={o.onerilen} />
          </label>
        )}
        {!o.kaynaksiz && (
          <label>
            {u.konum}
            <input name="konum" maxLength={100} defaultValue={o.konum ?? ""} />
          </label>
        )}
        {kendiKaynagi && kutuphaneYetkisi && (
          <fieldset>
            <legend>{u.kaynak}</legend>
            <label className="secim">
              <input type="checkbox" checked={kutuphaneye} onChange={(e) => setKutuphaneye(e.target.checked)} /> {u.kutuphaneyeEkle}
            </label>
            {kutuphaneye && (
              <>
                <label>
                  {u.kaynakBaslik}
                  <input name="baslik" required maxLength={300} />
                </label>
                <div className="form-satir">
                  <label>
                    {k.kaynakTuru}
                    <select value={kaynakTuru} onChange={(e) => setKaynakTuru(e.target.value as KaynakTuru)}>
                      {KAYNAK_TURLERI.map((x) => (
                        <option key={x} value={x}>
                          {k.kaynakTurleri[x]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {k.nitelik}
                    <select name="nitelik" key={kaynakTuru} defaultValue={VARSAYILAN_NITELIK[kaynakTuru]}>
                      {NITELIKLER.map((x) => (
                        <option key={x} value={x}>
                          {k.nitelikler[x]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="secim">
                  <input name="herkese_acik" type="checkbox" /> {k.herkeseAcik}
                </label>
              </>
            )}
          </fieldset>
        )}
        <div className="dugmeler">
          <button type="submit" disabled={bekle || dilDenetimi.karsilastiriyor}>
            {u.kabulEt}
          </button>
        </div>
        {dilDenetimi.kutu}
      </form>
      <RetFormu u={u} bekle={bekle} reddet={(gerekce) => yap({ islem: "reddet", id: o.id, gerekce, yz_analizleri: yzAnalizleri })} />
      {hata && <p role="alert">{hata}</p>}
    </>
  );

  if (panel)
    return (
      <article className="katki ib-kart" aria-labelledby={baslikId}>
        <Bolum baslik={panel.eser}>{ust}</Bolum>
        <Bolum baslik={panel.bilgi}>{bilgi}</Bolum>
        <Bolum baslik={panel.karar} sinif="ib-karar">
          {karar}
        </Bolum>
      </article>
    );
  return (
    <article className="katki" aria-labelledby={baslikId}>
      {ust}
      {bilgi}
      {karar}
    </article>
  );
}

function RetFormu({ u, bekle, reddet }: { u: ReturnType<typeof s>["oneri"]; bekle: boolean; reddet: (gerekce: string) => void }) {
  const [gerekce, setGerekce] = useState("");
  return (
    <div className="form">
      <label>
        {u.retGerekcesi}
        <input value={gerekce} onChange={(e) => setGerekce(e.target.value)} maxLength={2000} />
      </label>
      <div className="dugmeler">
        <button type="button" className="ikincil" disabled={bekle || !gerekce.trim()} onClick={() => reddet(gerekce.trim())}>
          {u.reddet}
        </button>
      </div>
    </div>
  );
}
