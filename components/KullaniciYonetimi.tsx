"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import { ROLLER, type Rol } from "@/lib/yetki";
import { Kisi } from "./PanelTablo";
import PanelTablo, { type PanelSatir } from "./PanelTabloGovde";

export type PanelKullanicisi = { id: string; eposta: string; ad: string | null; rol: Rol | null };

/** Hesap listesi ve rol seçimi (yalnız kullanici.yonet). Kişi kendi rolünü değiştiremez.
 *  Sistem yöneticisi atamak tek tıkla olmaz: işlemi yapan kendi şifresini girer, şifre sunucuda doğrulanır. */
export default function KullaniciYonetimi({ dil, kullanicilar, benim }: { dil: Dil; kullanicilar: PanelKullanicisi[]; benim: string }) {
  const t = s(dil).panel;
  const router = useRouter();
  const [mesaj, setMesaj] = useState("");
  const [bekleyen, setBekleyen] = useState<PanelKullanicisi | null>(null);
  const [sifre, setSifre] = useState("");
  const [sifreHatasi, setSifreHatasi] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const pencere = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (bekleyen && !pencere.current?.open) pencere.current?.showModal();
    if (!bekleyen && pencere.current?.open) pencere.current.close();
  }, [bekleyen]);

  async function gonder(kullanici: string, rol: Rol | null, sifreMetni?: string) {
    const yanit = await fetch("/api/yonetim/kullanicilar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kullanici, rol, sifre: sifreMetni }),
    });
    const govde = yanit.ok ? {} : ((await yanit.json().catch(() => ({}))) as { hata?: string; sifreGerekli?: boolean });
    return { ok: yanit.ok, hata: govde.hata ?? String(yanit.status), sifreGerekli: !!govde.sifreGerekli };
  }
  async function ata(k: PanelKullanicisi, rol: Rol | null) {
    setMesaj("");
    if (rol === "super_admin") {
      setSifre("");
      setSifreHatasi("");
      setBekleyen(k);
      return;
    }
    const sonuc = await gonder(k.id, rol);
    setMesaj(sonuc.ok ? t.kaydedildi : sonuc.hata);
    router.refresh();
  }
  async function onayla(e: FormEvent) {
    e.preventDefault();
    if (!bekleyen || !sifre) return;
    setGonderiliyor(true);
    const sonuc = await gonder(bekleyen.id, "super_admin", sifre);
    setGonderiliyor(false);
    setSifre("");
    if (!sonuc.ok && sonuc.sifreGerekli) {
      setSifreHatasi(sonuc.hata);
      return;
    }
    setBekleyen(null);
    setMesaj(sonuc.ok ? t.kaydedildi : sonuc.hata);
    router.refresh();
  }
  const satirlar: PanelSatir[] = kullanicilar.map((k) => {
    const ad = k.ad || k.eposta.split("@")[0];
    return {
      id: k.id,
      hucreler: [
        <Kisi key="k" ad={ad} alt={k.eposta} />,
        <select
          key="r"
          className="pt-secim"
          aria-label={`${t.rol}: ${k.eposta}`}
          value={k.rol ?? ""}
          disabled={k.id === benim}
          onChange={(e) => ata(k, (e.target.value || null) as Rol | null)}
        >
          <option value="">{t.rolsuz}</option>
          {ROLLER.map((r) => (
            <option key={r} value={r}>
              {t.roller[r]}
            </option>
          ))}
        </select>,
      ],
      sira: [ad, k.rol ? t.roller[k.rol] : t.rolsuz],
      ara: `${k.ad ?? ""} ${k.eposta}`,
      grup: [k.rol ?? "yok"],
    };
  });
  const ROL_SIMGESI = { super_admin: "rol", editor: "duzenle", tarihci: "kitap" } as const;
  return (
    <>
      <p role="status">{mesaj}</p>
      <PanelTablo
        dil={dil}
        sutunlar={[
          { ad: t.kisi, simge: "kisi" },
          { ad: t.rol, simge: "rol" },
        ]}
        satirlar={satirlar}
        haplar={[
          { ad: s(dil).tablo.herkes, simge: "kisiler", deger: "", secili: true },
          ...ROLLER.filter((r) => kullanicilar.some((k) => k.rol === r)).map((r) => ({ ad: t.roller[r], simge: ROL_SIMGESI[r], deger: r })),
          ...(kullanicilar.some((k) => !k.rol) ? [{ ad: t.rolsuz, simge: "kisi" as const, deger: "yok" }] : []),
        ]}
        ara={t.ara}
        birim={s(dil).tablo.birim.kisi}
      />
      <dialog ref={pencere} className="sifre-onayi" aria-labelledby="sifre-onayi-baslik" onClose={() => setBekleyen(null)}>
        {bekleyen && (
          <form onSubmit={onayla}>
            <h2 id="sifre-onayi-baslik">{t.sifreOnayBaslik}</h2>
            <p>{t.sifreOnayMetni(bekleyen.ad || bekleyen.eposta)}</p>
            <label>
              {t.sifren}
              <input type="password" autoComplete="current-password" required autoFocus value={sifre} onChange={(e) => setSifre(e.target.value)} />
            </label>
            <p className="hata" role="alert">{sifreHatasi}</p>
            <div className="dugmeler">
              <button type="submit" disabled={gonderiliyor || !sifre}>{t.onayla}</button>
              <button type="button" className="ikincil" onClick={() => setBekleyen(null)}>{t.vazgec}</button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
