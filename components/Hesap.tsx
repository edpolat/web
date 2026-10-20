"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BulutHatasi,
  bulutHazir,
  cikisYap,
  formDenetle,
  girisYap,
  kayitliOturum,
  pullariGetir,
  uyeOl,
  type BulutHataKodu,
  type BulutOturumu,
} from "@/lib/bulut";
import { metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import type { CokDilli, Dil, Rota } from "@/lib/tipler";

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
  const [sekme, setSekme] = useState<"uye" | "gir">("uye");
  const [hata, setHata] = useState<BulutHataKodu>();
  const [onayBekliyor, setOnayBekliyor] = useState(false);
  const [bekliyor, setBekliyor] = useState(false);

  async function yukle(o: BulutOturumu) {
    try {
      setUye({ ...o, pullar: await pullariGetir() });
    } catch {
      // Oturum süresi dolmuş ya da yenilenemiyor: yeniden giriş istenir.
      await cikisYap();
      setUye(null);
      setSekme("gir");
    }
  }

  useEffect(() => {
    if (!bulutHazir) return setUye(null);
    void kayitliOturum()
      .then((o) => (o ? yukle(o) : setUye(null)))
      .catch(() => setUye(null));
  }, []);

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

  async function cik() {
    await cikisYap();
    setUye(null);
    setSekme("gir");
  }

  if (uye === undefined) return <p className="not">…</p>;

  if (uye) {
    const adlar = new Map(eserler.map((e) => [e.id, e.ad]));
    return (
      <section className="hesap" aria-labelledby="hesap-baslik">
        <div className="profil">
          <span className="profil-harf" aria-hidden="true">
            {uye.ad.charAt(0).toLocaleUpperCase("tr")}
          </span>
          <span>
            <strong id="hesap-baslik">{u.hosGeldin(uye.ad.split(" ")[0])}</strong>
            <small>{uye.eposta}</small>
          </span>
        </div>
        <h2>{u.pullar}</h2>
        <p>{u.pulSayisi(uye.pullar.length)}</p>
        <ul className="rota-ilerleme">
          {rotalar.map((r) => {
            const alinan = r.duraklar.filter((d) => uye.pullar.includes(d.eser_id)).length;
            return (
              <li key={r.il}>
                <strong>{u.rota(metin(iller.find((i) => i.id === r.il)?.ad, dil) || r.il)}</strong>
                <span>
                  {alinan} / {r.duraklar.length}
                </span>
                <progress max={r.duraklar.length} value={alinan} />
              </li>
            );
          })}
        </ul>
        {uye.pullar.length > 0 && (
          <ul className="pul-listesi">
            {uye.pullar.map((id) => (
              <li key={id}>
                <Link href={`/${dil}/eser/${id}`}>{metin(adlar.get(id), dil) || id}</Link>
              </li>
            ))}
          </ul>
        )}
        <div className="dugmeler">
          <button type="button" className="ikincil" onClick={cik}>
            {t.cikisYap}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="hesap" aria-labelledby="hesap-baslik">
      <h1 id="hesap-baslik">{u.baslik}</h1>
      <p>{u.alt}</p>
      {!bulutHazir && <p className="hata">{u.ayarYok}</p>}
      {onayBekliyor && <p role="status">{u.onayGerekli}</p>}
      <div className="hesap-sekmeler" role="group">
        {(["uye", "gir"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={sekme === k} onClick={() => (setSekme(k), setHata(undefined))}>
            {k === "uye" ? u.uyeOl : u.girisYap}
          </button>
        ))}
      </div>
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
          {hata && u.hatalar[hata]}
        </p>
        <div className="dugmeler">
          <button type="submit" disabled={bekliyor || !bulutHazir}>
            {sekme === "uye" ? u.uyeOl : u.girisYap}
          </button>
        </div>
      </form>
      <p className="not">{u.misafir}</p>
    </section>
  );
}
