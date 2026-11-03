"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import { ROLLER, type Rol } from "@/lib/yetki";

export type PanelKullanicisi = { id: string; eposta: string; ad: string | null; rol: Rol | null };

/** Hesap listesi ve rol seçimi (yalnız kullanici.yonet). Kişi kendi rolünü değiştiremez.
 *  Sistem yöneticisi atamak tek tıkla olmaz: işlemi yapan kendi şifresini girer, şifre sunucuda doğrulanır. */
export default function KullaniciYonetimi({ dil, kullanicilar, benim }: { dil: Dil; kullanicilar: PanelKullanicisi[]; benim: string }) {
  const t = s(dil).panel;
  const router = useRouter();
  const [mesaj, setMesaj] = useState("");
  const [arama, setArama] = useState("");
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
  const q = arama.trim().toLocaleLowerCase("tr");
  const gorunen = kullanicilar.filter((k) => !q || `${k.ad ?? ""} ${k.eposta}`.toLocaleLowerCase("tr").includes(q));
  return (
    <>
      <label>
        {t.ara}
        <input type="search" value={arama} onChange={(e) => setArama(e.target.value)} />
      </label>
      <p role="status">{mesaj}</p>
      <table className="tablo">
        <thead>
          <tr>
            <th>{t.kisi}</th>
            <th>{t.rol}</th>
          </tr>
        </thead>
        <tbody>
          {gorunen.map((k) => (
            <tr key={k.id}>
              <td>
                {k.ad || k.eposta.split("@")[0]}
                <br />
                <small>{k.eposta}</small>
              </td>
              <td>
                <select
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
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
