"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import { useTaslak } from "./taslak";

/** Kayıtlı form taslağı: forma ilk değer olarak dolar. */
export type FormTaslagiVerisi = { id: number; veri: Record<string, string> };

async function istek(govde: Record<string, unknown>): Promise<Record<string, unknown>> {
  const yanit = await fetch("/api/il", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde) });
  const veri = (await yanit.json().catch(() => ({}))) as Record<string, unknown>;
  if (!yanit.ok) {
    const ayrinti = Array.isArray(veri.ayrinti) && veri.ayrinti.length ? ` (${(veri.ayrinti as string[]).join("; ")})` : "";
    throw new Error(((veri.hata as string) ?? String(yanit.status)) + ayrinti);
  }
  return veri;
}

/** Yeni il formu (eser.ekle): il incelemeye gider, editör onaylayınca sitede görünür. */
export function IlFormu({
  dil,
  kaynaklar,
  secilebilirIller,
  taslak,
}: {
  dil: Dil;
  kaynaklar: { id: string; ad: string }[];
  /** Eklenebilecek iller: 81 ilden sitede henüz olmayanlar (veri/il-ilce.json). */
  secilebilirIller: string[];
  taslak?: FormTaslagiVerisi;
}) {
  const t = s(dil).ilPaneli;
  const ft = s(dil).formTaslagi;
  const tk = useTaslak("il", undefined, taslak?.id);
  const ilk = taslak?.veri ?? {};
  const router = useRouter();
  const [durum, setDurum] = useState<{ tamam: boolean; metin: string }>();
  const [bekle, setBekle] = useState(false);

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setDurum(undefined);
    setBekle(true);
    try {
      await istek({ islem: "gonder", ...Object.fromEntries(new FormData(form)) });
      await tk.bitir();
      form.reset();
      setDurum({ tamam: true, metin: t.gonderildi });
      router.refresh();
    } catch (h) {
      setDurum({ tamam: false, metin: h instanceof Error ? h.message : String(h) });
    } finally {
      setBekle(false);
    }
  }

  async function taslagaKaydet(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.form;
    if (!form) return;
    setDurum(undefined);
    setBekle(true);
    try {
      await tk.kaydet(form);
      setDurum({ tamam: true, metin: ft.kaydedildi });
    } catch (h) {
      setDurum({ tamam: false, metin: h instanceof Error ? h.message : String(h) });
    } finally {
      setBekle(false);
    }
  }

  return (
    <details className="katki" id="il-formu" open={!!taslak}>
      <summary>{t.ekle}</summary>
      <form className="form" onSubmit={gonder}>
        {taslak && <p className="not">{ft.devam}</p>}
        <div className="form-satir">
          <label>
            {t.adTr}
            <select name="ad_tr" required defaultValue={secilebilirIller.includes(ilk.ad_tr ?? "") ? ilk.ad_tr : ""}>
              <option value="" disabled>
                {t.ilSec}
              </option>
              {secilebilirIller.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.adEn}
            <input name="ad_en" maxLength={60} lang="en" defaultValue={ilk.ad_en} />
          </label>
        </div>
        <div className="form-satir">
          <label>
            {t.enlem}
            <input name="enlem" required inputMode="decimal" placeholder="39.42" defaultValue={ilk.enlem} />
          </label>
          <label>
            {t.boylam}
            <input name="boylam" required inputMode="decimal" placeholder="29.98" defaultValue={ilk.boylam} />
          </label>
        </div>
        <p className="not">{t.merkezIpucu}</p>
        <div className="form-satir">
          <label>
            {t.yakinlastirma}
            <input name="yakinlastirma" type="number" min={5} max={18} defaultValue={ilk.yakinlastirma ?? 11} />
          </label>
          <label>
            {t.kitap}
            <select name="envanter_kaynak_id" defaultValue={ilk.envanter_kaynak_id ?? ""}>
              <option value="">{t.kitapYok}</option>
              {kaynaklar.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.ad}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-satir">
          <label>
            {t.yil}
            <input name="envanter_yili" type="number" min={1900} max={2100} defaultValue={ilk.envanter_yili} />
          </label>
          <label>
            {t.toplam}
            <input name="toplam_eser" type="number" min={0} defaultValue={ilk.toplam_eser} />
          </label>
        </div>
        <label>
          {t.not}
          <textarea name="not" maxLength={500} rows={2} defaultValue={ilk.not} />
        </label>
        <div className="dugmeler">
          <button type="submit" disabled={bekle}>
            {t.gonder}
          </button>
          <button type="button" className="ikincil" disabled={bekle} onClick={taslagaKaydet}>
            {ft.kaydet}
          </button>
        </div>
        <p role={durum?.tamam === false ? "alert" : "status"} className={durum?.tamam === false ? "hata" : undefined}>
          {durum?.metin}
        </p>
      </form>
    </details>
  );
}

/** Onay bekleyen il için editör kararı (eser.onayla). Reddetmede gerekçe zorunlu. */
export function IlKarari({ dil, id }: { dil: Dil; id: number }) {
  const t = s(dil).ilPaneli;
  const router = useRouter();
  const [gerekce, setGerekce] = useState("");
  const [mesaj, setMesaj] = useState<string>();
  const [bekle, setBekle] = useState(false);

  async function karar(onay: boolean) {
    setMesaj(undefined);
    setBekle(true);
    try {
      await istek({ islem: "karar", id, onay, gerekce });
      setMesaj(t.kararVerildi);
      router.refresh();
    } catch (h) {
      setMesaj(h instanceof Error ? h.message : String(h));
    } finally {
      setBekle(false);
    }
  }

  return (
    <div className="form">
      <label>
        {t.gerekce}
        <input value={gerekce} onChange={(e) => setGerekce(e.target.value)} maxLength={500} />
      </label>
      <div className="dugmeler">
        <button type="button" disabled={bekle} onClick={() => karar(true)}>
          {t.onayla}
        </button>
        <button type="button" className="ikincil" disabled={bekle} onClick={() => karar(false)}>
          {t.reddet}
        </button>
      </div>
      <p role="status">{mesaj}</p>
    </div>
  );
}

/** Panelden eklenen ili kaldırır (eser.arsivle): il ve yayındaki eserleri arşive gider, il sonra yeniden eklenebilir. */
export function IlKaldir({ dil, ilId, ad }: { dil: Dil; ilId: string; ad: string }) {
  const t = s(dil).ilPaneli;
  const router = useRouter();
  const [gerekce, setGerekce] = useState("");
  const [mesaj, setMesaj] = useState<string>();
  const [bekle, setBekle] = useState(false);

  async function kaldir() {
    if (!window.confirm(t.kaldirOnay(ad))) return;
    setMesaj(undefined);
    setBekle(true);
    try {
      const { eserSayisi } = (await istek({ islem: "kaldir", il_id: ilId, gerekce })) as { eserSayisi: number };
      setMesaj(t.kaldirildi(eserSayisi));
      router.refresh();
    } catch (h) {
      setMesaj(h instanceof Error ? h.message : String(h));
    } finally {
      setBekle(false);
    }
  }

  return (
    <details>
      <summary>{t.kaldir}</summary>
      <div className="form">
        <label>
          {t.kaldirGerekce}
          <input value={gerekce} onChange={(e) => setGerekce(e.target.value)} maxLength={500} required />
        </label>
        <div className="dugmeler">
          <button type="button" className="ikincil" disabled={bekle || !gerekce.trim()} onClick={kaldir}>
            {t.kaldir}
          </button>
        </div>
        <p role="status">{mesaj}</p>
      </div>
    </details>
  );
}
