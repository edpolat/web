"use client";
import { useEffect, useState } from "react";
import {
  BulutHatasi,
  bulutHazir,
  cikisYap,
  formDenetle,
  girisYap,
  kayitliOturum,
  pullariEkle,
  pullariGetir,
  sifreGuncelle,
  sifreKurtarmaIzle,
  sifreSifirla,
  uyeOl,
  type BulutHataKodu,
  type BulutOturumu,
} from "@/lib/bulut";
import Pasaport from "@/components/Pasaport";
import { s } from "@/lib/sozluk";
import type { CokDilli, Dil, Rota } from "@/lib/tipler";
import { PASAPORT_NO, z } from "@/lib/ziyaret";
import { kagitBagliMi, yerelPullar } from "@/lib/yerel-pul";

type AcikUye = BulutOturumu & { pullar: string[] };

/** Ziyaretçi hesabı: üye ol / giriş yap, girişliyse profil ve pasaport pulları. Hesaplar mobil uygulamayla aynı Supabase projesinde (lib/bulut.ts). */
export default function Hesap({
  dil,
  eserler,
  rotalar,
  iller,
}: {
  dil: Dil;
  eserler: { id: string; ad: CokDilli }[];
  rotalar: Rota[];
  iller: { id: string; ad: CokDilli }[];
}) {
  const t = s(dil);
  const u = t.uyelik;
  const [uye, setUye] = useState<AcikUye | null>();
  const [sekme, setSekme] = useState<"uye" | "gir">("gir");
  const [hata, setHata] = useState<BulutHataKodu>();
  const [onayBekliyor, setOnayBekliyor] = useState(false);
  const [bekliyor, setBekliyor] = useState(false);
  const zs = z(dil).sifre;
  const [sifreNotu, setSifreNotu] = useState<{ metin: string; hata?: boolean }>();
  const [kurtarma, setKurtarma] = useState(false);
  const [kagit, setKagit] = useState(false);

  async function yukle(o: BulutOturumu) {
    try {
      // Misafirken bu tarayıcıda (Tara sayfasında) alınan pullar hesaba aktarılır.
      await pullariEkle(o.id, yerelPullar()).catch(() => {});
      setUye({ ...o, pullar: await pullariGetir() });
    } catch {
      // Oturum süresi dolmuş ya da yenilenemiyor: yeniden giriş istenir.
      await cikisYap();
      setUye(null);
      setSekme("gir");
    }
  }

  useEffect(() => {
    setKagit(kagitBagliMi());
    if (!bulutHazir) return setUye(null);
    // E-postadaki şifre sıfırlama bağlantısıyla gelindiyse "Yeni şifre belirle" formu açılır.
    const birak = sifreKurtarmaIzle(() => setKurtarma(true));
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("error_code")) {
      setSifreNotu({ metin: zs.gecersiz, hata: true });
      setSekme("gir");
      window.history.replaceState(null, "", window.location.pathname);
    }
    void kayitliOturum()
      .then((o) => (o ? yukle(o) : setUye(null)))
      .catch(() => setUye(null));
    return birak;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Uygulamada alınan pullar sayfa açıkken de gelsin: sekmeye dönünce ve açıkken 20 saniyede bir pullar yeniden okunur.
  const uyeId = uye?.id;
  useEffect(() => {
    if (!uyeId) return;
    const tazele = () => {
      if (document.visibilityState !== "visible") return;
      pullariGetir()
        .then((pullar) => setUye((o) => (o && o.id === uyeId && o.pullar.join() !== pullar.join() ? { ...o, pullar } : o)))
        .catch(() => {});
    };
    const zamanlayici = setInterval(tazele, 20000);
    document.addEventListener("visibilitychange", tazele);
    window.addEventListener("focus", tazele);
    return () => {
      clearInterval(zamanlayici);
      document.removeEventListener("visibilitychange", tazele);
      window.removeEventListener("focus", tazele);
    };
  }, [uyeId]);

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHata(undefined);
    setOnayBekliyor(false);
    const form = Object.fromEntries(new FormData(e.currentTarget)) as { ad?: string; eposta: string; sifre: string };
    const eposta = form.eposta.trim().toLowerCase();
    const kural = formDenetle(form, sekme === "uye");
    if (kural) return setHata(kural);
    setBekliyor(true);
    try {
      if (sekme === "uye") {
        const o = await uyeOl(form.ad!.trim(), eposta, form.sifre);
        if (o) await yukle(o);
        else (setOnayBekliyor(true), setSekme("gir"));
      } else await yukle(await girisYap(eposta, form.sifre));
    } catch (h) {
      setHata(h instanceof BulutHatasi ? h.kod : "genel");
    } finally {
      setBekliyor(false);
    }
  }

  async function sifremiUnuttum(e: React.MouseEvent<HTMLButtonElement>) {
    const eposta = String(new FormData(e.currentTarget.form!).get("eposta") ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(eposta)) return setSifreNotu({ metin: zs.epostaYaz, hata: true });
    try {
      await sifreSifirla(eposta, `${window.location.origin}/${dil}/hesap`);
      setSifreNotu({ metin: zs.gonderildi });
    } catch (h) {
      setSifreNotu({ metin: u.hatalar[h instanceof BulutHatasi ? h.kod : "genel"], hata: true });
    }
  }

  async function yeniSifre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    const s1 = String(v.get("s1") ?? ""), s2 = String(v.get("s2") ?? "");
    if (s1.length < 6) return setSifreNotu({ metin: u.hatalar.sifre, hata: true });
    if (s1 !== s2) return setSifreNotu({ metin: zs.ayniDegil, hata: true });
    setBekliyor(true);
    try {
      const o = await sifreGuncelle(s1);
      setKurtarma(false);
      setSifreNotu({ metin: zs.guncellendi });
      window.history.replaceState(null, "", window.location.pathname);
      await yukle(o);
    } catch (h) {
      setSifreNotu({ metin: u.hatalar[h instanceof BulutHatasi ? h.kod : "genel"], hata: true });
    } finally {
      setBekliyor(false);
    }
  }

  async function cik() {
    await cikisYap();
    setUye(null);
    setSekme("gir");
  }

  if (kurtarma)
    return (
      <section className="hesap" aria-labelledby="hesap-baslik">
        <h1 id="hesap-baslik">{zs.yeniBaslik}</h1>
        <form className="form" onSubmit={yeniSifre} noValidate>
          <label>
            {zs.yeni}
            <input name="s1" type="password" autoComplete="new-password" placeholder={u.sifreYer} required minLength={6} />
          </label>
          <label>
            {zs.tekrar}
            <input name="s2" type="password" autoComplete="new-password" required minLength={6} />
          </label>
          <p role="alert" className="hata">
            {sifreNotu?.hata && sifreNotu.metin}
          </p>
          <div className="dugmeler">
            <button type="submit" disabled={bekliyor}>
              {zs.kaydet}
            </button>
          </div>
        </form>
      </section>
    );

  if (uye === undefined) return <p className="not">…</p>;

  const kagitKarti = kagit && (
    <div className="pasaport-kart">
      <span className="kart-baslik">{z(dil).tara.kagitBaslik}</span>
      <p>
        <b>{PASAPORT_NO}</b> <span className="etiket etiket-kaynakli">{z(dil).tara.bagli}</span>
      </p>
    </div>
  );

  if (uye) {
    const adlar = new Map(eserler.map((e) => [e.id, e.ad]));
    return (
      <section className="hesap" aria-labelledby="hesap-baslik">
        <div className="pasaport-kart pasaport-sahibi">
          <span className="kart-baslik">{u.pasaportSahibi}</span>
          <h1 id="hesap-baslik">{uye.ad}</h1>
          <small>{uye.eposta}</small>
          <button type="button" className="dugme ikincil" onClick={cik}>
            {t.cikisYap}
          </button>
        </div>
        {sifreNotu && !sifreNotu.hata && <p role="status">{sifreNotu.metin}</p>}
        {kagitKarti}
        <Pasaport dil={dil} pullar={uye.pullar} rotalar={rotalar} iller={iller} adlar={adlar} ad={uye.ad} />
      </section>
    );
  }

  return (
    <section className="hesap" aria-labelledby="hesap-baslik">
      <h1 id="hesap-baslik">{u.baslik}</h1>
      <p>{u.alt}</p>
      {!bulutHazir && <p className="hata">{u.ayarYok}</p>}
      {onayBekliyor && <p role="status">{u.onayGerekli}</p>}
      <h2 className="hesap-form-baslik">{sekme === "gir" ? u.girisYap : u.uyeOl}</h2>
      <form className="form" onSubmit={gonder} noValidate>
        {sekme === "uye" && (
          <label>
            {u.ad}
            <input name="ad" autoComplete="name" placeholder={u.adYer} required />
          </label>
        )}
        <label>
          {u.eposta}
          <input name="eposta" type="email" autoComplete="email" placeholder="ornek@eposta.com" required />
        </label>
        <label>
          {u.sifre}
          <input
            name="sifre"
            type="password"
            autoComplete={sekme === "uye" ? "new-password" : "current-password"}
            placeholder={u.sifreYer}
            required
            minLength={6}
          />
        </label>
        <p role="alert" className="hata">
          {hata ? u.hatalar[hata] : sifreNotu?.hata ? sifreNotu.metin : ""}
        </p>
        {sifreNotu && !sifreNotu.hata && <p role="status">{sifreNotu.metin}</p>}
        <div className="dugmeler">
          <button type="submit" disabled={bekliyor || !bulutHazir}>
            {sekme === "uye" ? u.uyeOl : u.girisYap}
          </button>
          {sekme === "gir" && (
            <button type="button" className="ikincil" onClick={sifremiUnuttum} disabled={!bulutHazir}>
              {zs.unuttum}
            </button>
          )}
        </div>
      </form>
      <p className="hesap-gecis">
        {sekme === "gir" ? u.hesapYok : u.hesapVar}{" "}
        <button
          type="button"
          onClick={() => (setSekme(sekme === "gir" ? "uye" : "gir"), setHata(undefined), setSifreNotu(undefined))}
        >
          {sekme === "gir" ? u.uyeOl : u.girisYap}
        </button>
      </p>
      <p className="not">{u.misafir}</p>
      {kagitKarti}
    </section>
  );
}
