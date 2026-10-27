"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";

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
export function IlFormu({ dil, kaynaklar }: { dil: Dil; kaynaklar: { id: string; ad: string }[] }) {
  const t = s(dil).ilPaneli;
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
      form.reset();
      setDurum({ tamam: true, metin: t.gonderildi });
      router.refresh();
    } catch (h) {
      setDurum({ tamam: false, metin: h instanceof Error ? h.message : String(h) });
    } finally {
      setBekle(false);
    }
  }

  return (
    <details className="katki">
      <summary>{t.ekle}</summary>
      <form className="form" onSubmit={gonder}>
        <div className="form-satir">
          <label>
            {t.adTr}
            <input name="ad_tr" required minLength={2} maxLength={60} />
          </label>
          <label>
            {t.adEn}
            <input name="ad_en" maxLength={60} lang="en" />
          </label>
        </div>
        <div className="form-satir">
          <label>
            {t.enlem}
            <input name="enlem" required inputMode="decimal" placeholder="39.42" />
          </label>
          <label>
            {t.boylam}
            <input name="boylam" required inputMode="decimal" placeholder="29.98" />
          </label>
        </div>
        <p className="not">{t.merkezIpucu}</p>
        <div className="form-satir">
          <label>
            {t.yakinlastirma}
            <input name="yakinlastirma" type="number" min={5} max={18} defaultValue={11} />
          </label>
          <label>
            {t.kitap}
            <select name="envanter_kaynak_id" defaultValue="">
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
            <input name="envanter_yili" type="number" min={1900} max={2100} />
          </label>
          <label>
            {t.toplam}
            <input name="toplam_eser" type="number" min={0} />
          </label>
        </div>
        <label>
          {t.not}
          <textarea name="not" maxLength={500} rows={2} />
        </label>
        <div className="dugmeler">
          <button type="submit" disabled={bekle}>
            {t.gonder}
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
