"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SINIRLAR } from "@/lib/sergi";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";

async function istek(govde: Record<string, unknown>): Promise<Record<string, unknown>> {
  const yanit = await fetch("/api/sergi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde) });
  const veri = (await yanit.json().catch(() => ({}))) as Record<string, unknown>;
  if (!yanit.ok) throw new Error((veri.hata as string) ?? String(yanit.status));
  return veri;
}

/**
 * Sergi ekleme ya da düzenleme formu (sergi.yonet). ilk verilirse düzenleme: kimlik değiştirilemez.
 * Kaydedilen değişiklik onaysız hemen sitede görünür; sunucu ve veritabanı aynı kuralları yeniden denetler.
 */
export function SergiFormu({ dil, ilk }: { dil: Dil; ilk?: Record<string, string> }) {
  const t = s(dil).sergiPaneli;
  const router = useRouter();
  const yeni = !ilk;
  const d = ilk ?? {};
  const [durum, setDurum] = useState<{ tamam: boolean; metin: string }>();
  const [bekle, setBekle] = useState(false);

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setDurum(undefined);
    setBekle(true);
    try {
      const alanlar = Object.fromEntries(new FormData(form));
      await istek({ islem: yeni ? "ekle" : "duzenle", ...alanlar, ...(yeni ? {} : { id: d.id }) });
      if (yeni) form.reset();
      setDurum({ tamam: true, metin: yeni ? t.eklendi : t.kaydedildi });
      router.refresh();
    } catch (h) {
      setDurum({ tamam: false, metin: h instanceof Error ? h.message : String(h) });
    } finally {
      setBekle(false);
    }
  }

  return (
    <form className="form" onSubmit={gonder}>
      <div className="form-satir">
        <label>
          {t.adTr}
          <input name="ad_tr" required minLength={2} maxLength={SINIRLAR.ad} defaultValue={d.ad_tr} />
        </label>
        <label>
          {t.adEn}
          <input name="ad_en" maxLength={SINIRLAR.ad} lang="en" defaultValue={d.ad_en} />
        </label>
      </div>
      {yeni ? (
        <label>
          {t.kimlik}
          <input name="id" pattern="[a-z0-9][a-z0-9\-]{1,79}" maxLength={80} placeholder="bursa-fotograf-sergisi" />
        </label>
      ) : (
        <p className="not">
          {t.kimlikSabit} <code>{d.id}</code>
        </p>
      )}
      <div className="form-satir">
        <label>
          {t.sehir}
          <input name="sehir" maxLength={SINIRLAR.sehir} defaultValue={d.sehir} />
        </label>
        <label>
          {t.yer}
          <input name="yer" maxLength={SINIRLAR.yer} defaultValue={d.yer} />
        </label>
      </div>
      <label>
        {t.harita}
        <input name="harita" maxLength={SINIRLAR.harita} defaultValue={d.harita} />
      </label>
      <p className="not">{t.haritaIpucu}</p>
      <div className="form-satir">
        <label>
          {t.baslangic}
          <input name="baslangic" type="date" min="2000-01-01" max="2100-12-31" defaultValue={d.baslangic} />
        </label>
        <label>
          {t.bitis}
          <input name="bitis" type="date" min="2000-01-01" max="2100-12-31" defaultValue={d.bitis} />
        </label>
      </div>
      <p className="not">
        {t.bitisIpucu} {t.gizli}
      </p>
      <label>
        {t.aciklamaTr}
        <textarea name="aciklama_tr" maxLength={SINIRLAR.aciklama} rows={3} defaultValue={d.aciklama_tr} />
      </label>
      <label>
        {t.aciklamaEn}
        <textarea name="aciklama_en" maxLength={SINIRLAR.aciklama} rows={3} lang="en" defaultValue={d.aciklama_en} />
      </label>
      <label>
        {t.url}
        <input name="url" type="url" maxLength={SINIRLAR.url} placeholder="https://" defaultValue={d.url} />
      </label>
      <div className="dugmeler">
        <button type="submit" disabled={bekle}>
          {yeni ? t.ekleDugme : t.kaydet}
        </button>
      </div>
      <p role={durum?.tamam === false ? "alert" : "status"} className={durum?.tamam === false ? "hata" : undefined}>
        {durum?.metin}
      </p>
    </form>
  );
}

/** Sergiyi siler (sergi.yonet); gerekçe zorunlu, silinen kaydın tamamı denetim kaydında kalır. */
export function SergiSil({ dil, id, ad }: { dil: Dil; id: string; ad: string }) {
  const t = s(dil).sergiPaneli;
  const router = useRouter();
  const [gerekce, setGerekce] = useState("");
  const [mesaj, setMesaj] = useState<{ tamam: boolean; metin: string }>();
  const [bekle, setBekle] = useState(false);

  async function sil() {
    if (!window.confirm(`${t.silOnay}: ${ad}?`)) return;
    setMesaj(undefined);
    setBekle(true);
    try {
      await istek({ islem: "sil", id, gerekce });
      setMesaj({ tamam: true, metin: t.silindi });
      router.refresh();
    } catch (h) {
      setMesaj({ tamam: false, metin: h instanceof Error ? h.message : String(h) });
    } finally {
      setBekle(false);
    }
  }

  return (
    <details>
      <summary>{t.sil}</summary>
      <div className="form">
        <label>
          {t.silGerekce}
          <input value={gerekce} onChange={(e) => setGerekce(e.target.value)} maxLength={500} required />
        </label>
        <div className="dugmeler">
          <button type="button" className="ikincil" disabled={bekle || !gerekce.trim()} onClick={sil}>
            {t.silOnay}
          </button>
        </div>
        <p role={mesaj?.tamam === false ? "alert" : "status"} className={mesaj?.tamam === false ? "hata" : undefined}>
          {mesaj?.metin}
        </p>
      </div>
    </details>
  );
}
