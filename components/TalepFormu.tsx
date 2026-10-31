"use client";
import { useEffect, useRef, useState } from "react";
import { bulutHazir, talepGonder } from "@/lib/bulut";
import type { Dil } from "@/lib/tipler";
import { z } from "@/lib/ziyaret";

const EN_COK_FOTO = 3;
const BEKLEME_MS = 30000;
let sonGonderim = 0;

/** Fotoğrafı küçültür (en uzun kenar 1280 px, JPEG): hızlı yüklenir, depoyu şişirmez (uygulamadaki fotoKucult). */
function fotoKucult(dosya: File): Promise<Blob> {
  return new Promise((coz, reddet) => {
    const url = URL.createObjectURL(dosya);
    const img = new Image();
    img.onload = () => {
      const oran = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * oran);
      c.height = Math.round(img.height * oran);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? coz(b) : reddet(new Error("foto"))), "image/jpeg", 0.8);
    };
    img.onerror = () => (URL.revokeObjectURL(url), reddet(new Error("foto")));
    img.src = url;
  });
}

/** Misafir de gönderebilen "Bilgi / fotoğraf öner" (mobil uygulamadakiyle aynı tablo; panelde Onay bekleyenler'de görünür). */
export default function TalepFormu({ dil, eserId, eserAdi }: { dil: Dil; eserId: string; eserAdi: string }) {
  const t = z(dil).talep;
  const [acik, setAcik] = useState(false);
  const [durum, setDurum] = useState<{ metin: string; hata?: boolean }>();
  const [bitti, setBitti] = useState(false);
  const [bekliyor, setBekliyor] = useState(false);
  const [onizleme, setOnizleme] = useState<string[]>([]);
  const [uzunluk, setUzunluk] = useState(0);
  const alan = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => onizleme.forEach((u) => URL.revokeObjectURL(u)), [onizleme]);
  useEffect(() => {
    if (!acik) return;
    alan.current?.focus();
    const kapat = (e: KeyboardEvent) => e.key === "Escape" && setAcik(false);
    document.addEventListener("keydown", kapat);
    return () => document.removeEventListener("keydown", kapat);
  }, [acik]);

  function ac() {
    setDurum(undefined);
    setBitti(false);
    setOnizleme([]);
    setUzunluk(0);
    setAcik(true);
  }

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    if (v.get("bal")) return; // bot tuzağı
    const bilgi = String(v.get("bilgi") ?? "").trim();
    const dosyalar = (v.getAll("foto") as File[]).filter((d) => d.size).slice(0, EN_COK_FOTO);
    if (bilgi.length < 5 && !dosyalar.length) return setDurum({ metin: t.bos, hata: true });
    if (Date.now() - sonGonderim < BEKLEME_MS) return setDurum({ metin: t.bekle, hata: true });
    setBekliyor(true);
    setDurum({ metin: dosyalar.length ? t.yukleniyor : t.gonderiliyor });
    try {
      const fotolar = await Promise.all(dosyalar.map(fotoKucult));
      await talepGonder({ eserId, eserAdi, bilgi, fotolar });
      sonGonderim = Date.now();
      setBitti(true);
    } catch {
      setDurum({ metin: t.hata, hata: true });
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <>
      <button type="button" className="dugme ikincil" onClick={ac} disabled={!bulutHazir} title={bulutHazir ? undefined : t.ayarYok}>
        {t.dugme}
      </button>
      {acik && (
        <div className="katman" role="dialog" aria-modal="true" aria-labelledby="talep-baslik" onClick={(e) => e.target === e.currentTarget && setAcik(false)}>
          <div className="katman-kutu">
            <div className="katman-ust">
              <b id="talep-baslik">{t.dugme}</b>
              <button type="button" className="katman-kapat" onClick={() => setAcik(false)} aria-label={t.kapat}>
                ✕
              </button>
            </div>
            {bitti ? (
              <div role="status">
                <p>
                  <b>{t.tesekkur}</b>
                </p>
                <p>{t.tesekkurMetin}</p>
                <div className="dugmeler">
                  <button type="button" onClick={() => setAcik(false)}>
                    {t.tamam}
                  </button>
                </div>
              </div>
            ) : (
              <form className="form" onSubmit={gonder} autoComplete="off">
                <small className="not">{eserAdi}</small>
                <p className="not">{t.aciklama}</p>
                <label>
                  {t.onerin}
                  <textarea ref={alan} name="bilgi" maxLength={2000} rows={5} placeholder={t.yer} onInput={(e) => setUzunluk(e.currentTarget.value.length)} />
                </label>
                <small className="not">{uzunluk} / 2000</small>
                <label>
                  {t.foto(EN_COK_FOTO)}
                  <input
                    name="foto"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const d = Array.from(e.currentTarget.files ?? []);
                      setOnizleme(d.slice(0, EN_COK_FOTO).map((f) => URL.createObjectURL(f)));
                      if (d.length > EN_COK_FOTO) setDurum({ metin: t.fazla(EN_COK_FOTO) });
                    }}
                  />
                </label>
                {onizleme.length > 0 && (
                  <div className="talep-onizleme">
                    {onizleme.map((u) => (
                      <img key={u} src={u} alt="" width={72} height={72} />
                    ))}
                  </div>
                )}
                <input type="text" name="bal" tabIndex={-1} autoComplete="off" aria-hidden="true" className="gizli" />
                <p role="status" className={durum?.hata ? "hata" : "not"}>
                  {durum?.metin}
                </p>
                <div className="dugmeler">
                  <button type="submit" disabled={bekliyor}>
                    {t.gonder}
                  </button>
                </div>
                <small className="not">{t.not}</small>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
