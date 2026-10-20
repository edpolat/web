"use client";
import Link from "next/link";
import { useState } from "react";
import { s } from "@/lib/sozluk";
import type { CokDilli, Dil, Eser } from "@/lib/tipler";

type Secenek = { id: string; ad: string };
type Props = { dil: Dil; eser?: Eser; iller: Secenek[]; turler: Secenek[]; kaynaklar: Secenek[] };

const yazi = (v: FormData, ad: string) => String(v.get(ad) ?? "").trim();
function cokDilli(v: FormData, ad: string): CokDilli | null {
  const tr = yazi(v, `${ad}_tr`);
  const en = yazi(v, `${ad}_en`);
  return tr ? { tr, ...(en ? { en } : {}) } : null;
}
/** Boş kalan nesneyi siler (null), doluysa döner. */
const doluysa = <T extends object>(o: T): T | null => (Object.keys(o).length ? o : null);

/**
 * Yönetim panelinde eser ekleme (eser yoksa) ve düzenleme formu. Kaydetmez, onay kuyruğuna gönderir.
 * Formda olmayan alanlar (olgular, görseller, konum, mimari künye) olduğu gibi kalır.
 */
export default function EserFormu({ dil, eser, iller, turler, kaynaklar }: Props) {
  const t = s(dil);
  const [kaynak, setKaynak] = useState("");
  const [durum, setDurum] = useState<{ tur: "tamam" | "hata"; metin: string }>();
  const [gonderiliyor, setGonderiliyor] = useState(false);

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
    setGonderiliyor(true);
    setDurum(undefined);
    try {
      const yanit = await fetch("/api/katki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tur: eser ? "eser_duzenle" : "eser_ekle",
          eser_id: eser?.id,
          il: yazi(v, "il") || undefined,
          nereden: "web",
          ekleyen: yazi(v, "ekleyen"),
          kaynak_id: kaynak,
          sayfa: yazi(v, "sayfa"),
          not: yazi(v, "not"),
          degisiklik: degisiklik(v),
        }),
      });
      const veri = (await yanit.json()) as { hata?: string; ayrinti?: string[] };
      if (!yanit.ok) throw new Error([veri.hata, ...(veri.ayrinti ?? [])].filter(Boolean).join(" "));
      setDurum({ tur: "tamam", metin: t.kuyrugaGitti });
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
        {alan("adres_tr", t.adresTr, eser?.adres?.tr)}
        {alan("adres_en", t.adresEn, eser?.adres?.en, { lang: "en" })}
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
        {alan("ekleyen", t.ekleyen, undefined, { required: true, maxLength: 120, autoComplete: "name" })}
        <label>
          {t.notAlani}
          <textarea name="not" rows={2} maxLength={2000} />
        </label>
      </fieldset>
      <div className="dugmeler">
        <button type="submit" disabled={!kaynak || gonderiliyor}>
          {gonderiliyor ? t.gonderiliyor : t.kuyrugaGonder}
        </button>
      </div>
      <p role="status" className={durum?.tur === "hata" ? "uyari" : undefined}>
        {durum?.metin}{" "}
        {durum?.tur === "tamam" && <Link href={`/${dil}/yonetim/onay`}>{t.kuyruguAc}</Link>}
      </p>
    </form>
  );
}
