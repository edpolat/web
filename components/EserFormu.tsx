"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { kucukGorsel } from "@/lib/gorsel";
import { s } from "@/lib/sozluk";
import type { CokDilli, Dil, Eser } from "@/lib/tipler";

type Secenek = { id: string; ad: string };
type Props = { dil: Dil; eser?: Eser; iller: Secenek[]; turler: Secenek[]; kaynaklar: Secenek[] };

const SEKMELER = ["temel", "konum", "gorseller", "kaynaklar"] as const;
type Sekme = (typeof SEKMELER)[number];
const HASSASIYETLER = ["eser", "adres", "mahalle", "ilce"] as const;

const yazi = (v: FormData, ad: string) => String(v.get(ad) ?? "").trim();
function cokDilli(v: FormData, ad: string): CokDilli | null {
  const tr = yazi(v, `${ad}_tr`);
  const en = yazi(v, `${ad}_en`);
  return tr ? { tr, ...(en ? { en } : {}) } : null;
}
/** Boş kalan nesneyi siler (null), doluysa döner. */
const doluysa = <T extends object>(o: T): T | null => (Object.keys(o).length ? o : null);

/**
 * Yönetim panelinde eser ekleme (eser yoksa) ve düzenleme formu. Yayındaki hâli değiştirmez: düzenleme taslak
 * olarak kaydedilir ya da incelemeye gider; editör onaylayınca yayına geçer (/api/surum). Gönderen, giriş yapan hesaptır.
 * Sekmeler: temel bilgiler, konum, görseller (yalnız görüntüleme) ve kaynaklı bilgiler; hepsi tek formdur.
 * Formda olmayan alanlar (olgular, görseller, mimari künye) olduğu gibi kalır.
 */
export default function EserFormu({ dil, eser, iller, turler, kaynaklar }: Props) {
  const t = s(dil);
  const router = useRouter();
  const [kaynak, setKaynak] = useState("");
  const [durum, setDurum] = useState<{ tur: "tamam" | "hata"; metin: string }>();
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [sekme, setSekme] = useState<Sekme>("temel");
  const p = t.pano;
  const kaynakAdi = new Map(kaynaklar.map((k) => [k.id, k.ad]));

  /** Konum değişmediyse dosyadaki hâli aynen döner (fark sayılmaz); değiştiyse elle doğrulanmış sayılır. */
  function konum(v: FormData): Eser["konum"] | null {
    const enlem = Number.parseFloat(yazi(v, "enlem").replace(",", "."));
    const boylam = Number.parseFloat(yazi(v, "boylam").replace(",", "."));
    const hassasiyet = yazi(v, "hassasiyet") as NonNullable<Eser["konum"]>["hassasiyet"] | "";
    if (!Number.isFinite(enlem) || !Number.isFinite(boylam)) return null;
    const k = eser?.konum;
    if (k && k.enlem === enlem && k.boylam === boylam && (k.hassasiyet ?? "") === hassasiyet) return k;
    return { enlem, boylam, dogrulandi: true, yontem: "elle", ...(hassasiyet ? { hassasiyet } : {}) };
  }

  function degisiklik(v: FormData) {
    const donem: NonNullable<Eser["donem"]> = { ...eser?.donem };
    const yil = Number.parseInt(yazi(v, "yapim_yili"), 10);
    if (Number.isFinite(yil)) donem.yapim_yili = yil;
    else delete donem.yapim_yili;
    if (v.get("yaklasik")) donem.yaklasik = true;
    else if (donem.yaklasik) delete donem.yaklasik;
    const donemMetni = yazi(v, "donem_metni");
    if (donemMetni) donem.metin = { ...donem.metin, tr: donemMetni };
    else delete donem.metin;
    const mimari: NonNullable<Eser["mimari"]> = { ...eser?.mimari };
    const mimariMetni = cokDilli(v, "mimari");
    if (mimariMetni) mimari.metin = mimariMetni;
    else delete mimari.metin;
    return {
      ad: cokDilli(v, "ad"),
      tur: yazi(v, "tur"),
      ilce: yazi(v, "ilce") || null,
      adres: cokDilli(v, "adres"),
      konum: konum(v),
      banisi: yazi(v, "banisi") || null,
      mimar: yazi(v, "mimar") || null,
      donem: doluysa(donem),
      tarihce: cokDilli(v, "tarihce"),
      mimari: doluysa(mimari),
      taslak: v.get("taslak") ? true : eser?.taslak === false ? false : null,
    };
  }

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    const taslak = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "taslak";
    setGonderiliyor(true);
    setDurum(undefined);
    try {
      const yanit = await fetch("/api/surum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          islem: "gonder",
          taslak,
          tur: eser ? "eser_duzenle" : "eser_ekle",
          eser_id: eser?.id,
          il: yazi(v, "il") || undefined,
          kaynak_id: kaynak,
          sayfa: yazi(v, "sayfa"),
          not: yazi(v, "not"),
          degisiklik: degisiklik(v),
        }),
      });
      const veri = (await yanit.json()) as { hata?: string; ayrinti?: string[] };
      if (!yanit.ok) throw new Error([veri.hata, ...(veri.ayrinti ?? [])].filter(Boolean).join(" "));
      // İncelemeye giden düzenlemeden sonra eserler listesine dönülür (orada "incelemeye gönderildi" notu çıkar).
      if (!taslak) return router.push(`/${dil}/yonetim/eserler?gonderildi=1`);
      setDurum({ tur: "tamam", metin: t.surum.taslakKaydedildi });
    } catch (hata) {
      setDurum({ tur: "hata", metin: `${t.gonderilemedi} ${hata instanceof Error ? hata.message : ""}` });
    } finally {
      setGonderiliyor(false);
    }
  }

  const alan = (ad: string, etiket: string, deger?: string, ek?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label>
      {etiket}
      <input name={ad} defaultValue={deger ?? ""} {...ek} />
    </label>
  );
  const uzun = (ad: string, etiket: string, deger?: string, lang?: string) => (
    <label>
      {etiket}
      <textarea name={ad} defaultValue={deger ?? ""} rows={8} lang={lang} />
    </label>
  );

  return (
    <form className="form" onSubmit={gonder}>
      <div className="panel-sekmeler" role="tablist" aria-label={t.eseriDuzenle}>
        {SEKMELER.map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            id={`sekme-${x}`}
            aria-controls={`bolum-${x}`}
            aria-selected={sekme === x}
            onClick={() => setSekme(x)}
          >
            {p.sekmeler[x]}
            {x === "gorseller" && eser?.gorseller?.length ? ` (${eser.gorseller.length})` : ""}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="bolum-temel" aria-labelledby="sekme-temel" hidden={sekme !== "temel"} className="form">
      <fieldset>
        <legend>{t.alanlar.ad}</legend>
        {alan("ad_tr", t.adTr, eser?.ad.tr, { required: true })}
        {alan("ad_en", t.adEn, eser?.ad.en, { lang: "en" })}
        {!eser && (
          <label>
            {t.il}
            <select name="il" required defaultValue={iller[0]?.id}>
              {iller.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.ad}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {t.tur}
          <select name="tur" required defaultValue={eser?.tur ?? ""}>
            <option value="" disabled>
              —
            </option>
            {turler.map((x) => (
              <option key={x.id} value={x.id}>
                {x.ad}
              </option>
            ))}
          </select>
        </label>
        {alan("ilce", t.ilce, eser?.ilce)}
      </fieldset>
      <fieldset>
        <legend>{t.donem}</legend>
        <div className="form-satir">
          {alan("donem_metni", t.donemMetni, eser?.donem?.metin?.tr)}
          {alan("yapim_yili", t.yapimYili, eser?.donem?.yapim_yili?.toString(), { inputMode: "numeric", pattern: "[0-9]{3,4}" })}
        </div>
        <label className="secim">
          <input type="checkbox" name="yaklasik" defaultChecked={!!eser?.donem?.yaklasik} /> {t.yaklasik}
        </label>
        {alan("banisi", t.banisi, eser?.banisi)}
        {alan("mimar", t.mimar, eser?.mimar)}
      </fieldset>
      <fieldset>
        <legend>{t.tarihce}</legend>
        {uzun("tarihce_tr", t.tarihceTr, eser?.tarihce?.tr)}
        {uzun("tarihce_en", t.tarihceEn, eser?.tarihce?.en, "en")}
      </fieldset>
      <fieldset>
        <legend>{t.mimari}</legend>
        {uzun("mimari_tr", t.mimariTr, eser?.mimari?.metin?.tr)}
        {uzun("mimari_en", t.mimariEn, eser?.mimari?.metin?.en, "en")}
      </fieldset>
      <label className="secim">
        <input type="checkbox" name="taslak" defaultChecked={!!eser?.taslak} /> {t.taslakMi}
      </label>
      </div>

      <div role="tabpanel" id="bolum-konum" aria-labelledby="sekme-konum" hidden={sekme !== "konum"} className="form">
        <fieldset>
          <legend>{t.alanlar.adres}</legend>
          {alan("adres_tr", t.adresTr, eser?.adres?.tr)}
          {alan("adres_en", t.adresEn, eser?.adres?.en, { lang: "en" })}
        </fieldset>
        <fieldset>
          <legend>{p.sekmeler.konum}</legend>
          <div className="form-satir">
            {alan("enlem", p.enlem, eser?.konum?.enlem?.toString(), { inputMode: "decimal" })}
            {alan("boylam", p.boylam, eser?.konum?.boylam?.toString(), { inputMode: "decimal" })}
          </div>
          <label>
            {p.hassasiyet}
            <select name="hassasiyet" defaultValue={eser?.konum?.hassasiyet ?? ""}>
              <option value="">—</option>
              {HASSASIYETLER.map((h) => (
                <option key={h} value={h}>
                  {p.hassasiyetler[h]}
                </option>
              ))}
            </select>
          </label>
          <p className="not">
            {p.konumNot}{" "}
            {eser?.konum && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${eser.konum.enlem}&mlon=${eser.konum.boylam}#map=18/${eser.konum.enlem}/${eser.konum.boylam}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {p.haritadaAc}
              </a>
            )}
          </p>
        </fieldset>
      </div>

      <div role="tabpanel" id="bolum-gorseller" aria-labelledby="sekme-gorseller" hidden={sekme !== "gorseller"}>
        {eser?.gorseller?.length ? (
          <ul className="galeri">
            {eser.gorseller.map((g) => (
              <li key={g.dosya}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={kucukGorsel(g.dosya)} alt={g.alt.tr} loading="lazy" />
                <small>{g.atif}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p>{p.gorselYok}</p>
        )}
        <p className="not">{p.gorselNot}</p>
      </div>

      <div role="tabpanel" id="bolum-kaynaklar" aria-labelledby="sekme-kaynaklar" hidden={sekme !== "kaynaklar"}>
        <h2>{p.bilgiler}</h2>
        {eser?.olgular.length ? (
          <ul className="bilgi-listesi">
            {eser.olgular.map((o, i) => (
              <li key={i}>
                {o.metin.tr}
                <br />
                <small>
                  {o.kaynak_id ? `${kaynakAdi.get(o.kaynak_id) ?? o.kaynak_id}${o.sayfa ? `, ${t.sayfa} ${o.sayfa}` : ""}` : o.durum}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p>{p.bilgiYok}</p>
        )}
        {eser && (
          <p>
            <Link href={`/${dil}/yonetim/eser/${eser.id}/gecmis`}>{p.bilgiKaynaklariSayfasi}</Link>
          </p>
        )}
      </div>

      <fieldset>
        <legend>{t.dayanak}</legend>
        <p className="not" id="dayanak-not">
          {t.dayanakAciklama}
        </p>
        <div className="form-satir">
          <label>
            {t.kaynak}
            <select name="kaynak_id" required value={kaynak} onChange={(e) => setKaynak(e.target.value)} aria-describedby="dayanak-not">
              <option value="">{t.kaynakSec}</option>
              {kaynaklar.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.ad}
                </option>
              ))}
            </select>
          </label>
          {alan("sayfa", t.sayfaNo, undefined, { maxLength: 40 })}
        </div>
        <label>
          {t.notAlani}
          <textarea name="not" rows={2} maxLength={2000} />
        </label>
      </fieldset>
      <div className="dugmeler">
        {!kaynak && <p className="not">{p.dayanakIpucu}</p>}
        <button type="submit" value="inceleme" disabled={!kaynak || gonderiliyor}>
          {gonderiliyor ? t.gonderiliyor : t.surum.incelemeyeGonder}
        </button>
        <button type="submit" value="taslak" className="ikincil" disabled={!kaynak || gonderiliyor}>
          {t.surum.taslakKaydet}
        </button>
      </div>
      <p role="status" className={durum?.tur === "hata" ? "uyari" : undefined}>
        {durum?.metin}{" "}
        {durum?.tur === "tamam" && <Link href={`/${dil}/yonetim/katkilarim`}>{t.surum.katkilarim}</Link>}
      </p>
    </form>
  );
}
