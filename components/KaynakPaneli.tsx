"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dosyaYukle } from "@/lib/bulut";
import { DOSYA_TURLERI, EN_BUYUK_KAYNAK_DOSYASI, KAYNAK_TURLERI, NITELIKLER, VARSAYILAN_NITELIK, type KaynakTuru } from "@/lib/kaynak";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import type { FormTaslagiVerisi } from "./IlPaneli";
import { useTaslak } from "./taslak";

async function istek(govde: Record<string, unknown>): Promise<Record<string, unknown>> {
  const yanit = await fetch("/api/kaynak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde) });
  const veri = (await yanit.json().catch(() => ({}))) as Record<string, unknown>;
  if (!yanit.ok) throw new Error((veri.hata as string) ?? String(yanit.status));
  return veri;
}

/**
 * Kaynak ekleme: bağlantı ya da dosya. Dosya önce tarayıcıda denetlenir (tür, 50 MB), sunucudan alınan
 * tek kullanımlık adrese doğrudan Supabase'e yüklenir, sonra sunucu içeriğine bakıp kaydı oluşturur.
 */
export function KaynakFormu({ dil, taslak }: { dil: Dil; taslak?: FormTaslagiVerisi }) {
  const t = s(dil).kutuphane;
  const ft = s(dil).formTaslagi;
  const router = useRouter();
  const ilk = taslak?.veri ?? {};
  const tk = useTaslak("kaynak", undefined, taslak?.id);
  const [tur, setTur] = useState<"baglanti" | "dosya">(ilk.tur === "dosya" ? "dosya" : "baglanti");
  const [kaynakTuru, setKaynakTuru] = useState<KaynakTuru>(KAYNAK_TURLERI.find((k) => k === ilk.kaynak_turu) ?? "web");
  const [nitelik, setNitelik] = useState<string>(
    NITELIKLER.find((n) => n === ilk.nitelik) ?? VARSAYILAN_NITELIK[KAYNAK_TURLERI.find((k) => k === ilk.kaynak_turu) ?? "web"],
  );
  const [durum, setDurum] = useState<{ tamam: boolean; metin: string }>();
  const [bekle, setBekle] = useState(false);

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const v = new FormData(form);
    setDurum(undefined);
    setBekle(true);
    try {
      let dosya_yolu: string | undefined;
      if (tur === "dosya") {
        const dosya = v.get("dosya");
        if (!(dosya instanceof File) || !dosya.size) throw new Error(t.dosya);
        if (!(dosya.type in DOSYA_TURLERI)) throw new Error(t.dosyaTuruYanlis);
        if (dosya.size > EN_BUYUK_KAYNAK_DOSYASI) throw new Error(t.dosyaBuyukKaynak);
        const { yol, jeton } = (await istek({ islem: "yukleme_adresi", tur: dosya.type, boyut: dosya.size })) as { yol: string; jeton: string };
        await dosyaYukle(yol, jeton, dosya);
        dosya_yolu = yol;
      }
      await istek({
        islem: "ekle",
        tur,
        baslik: v.get("baslik"),
        kaynak_turu: kaynakTuru,
        nitelik,
        url: v.get("url"),
        dosya_yolu,
        yazar: v.get("yazar"),
        yayinci: v.get("yayinci"),
        yil: v.get("yil"),
        aciklama: v.get("aciklama"),
      });
      await tk.bitir();
      form.reset();
      setDurum({ tamam: true, metin: t.eklendi });
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
      await tk.kaydet(form, { tur, kaynak_turu: kaynakTuru, nitelik });
      setDurum({ tamam: true, metin: tur === "dosya" ? `${ft.kaydedildi} ${ft.dosyaNotu}` : ft.kaydedildi });
    } catch (h) {
      setDurum({ tamam: false, metin: h instanceof Error ? h.message : String(h) });
    } finally {
      setBekle(false);
    }
  }

  return (
    <details className="katki" id="kaynak-formu" open={!!taslak}>
      <summary>{t.ekle}</summary>
      <form className="form" onSubmit={gonder}>
        {taslak && <p className="not">{tur === "dosya" ? `${ft.devam} ${ft.dosyaNotu}` : ft.devam}</p>}
        <label>
          {t.kaynakBaslik}
          <input name="baslik" required maxLength={300} defaultValue={ilk.baslik} />
        </label>
        <div className="form-satir">
          <label>
            {t.tur}
            <select value={tur} onChange={(e) => setTur(e.target.value as "baglanti" | "dosya")}>
              <option value="baglanti">{t.turler.baglanti}</option>
              <option value="dosya">{t.turler.dosya}</option>
            </select>
          </label>
          <label>
            {t.kaynakTuru}
            <select
              value={kaynakTuru}
              onChange={(e) => {
                const k = e.target.value as KaynakTuru;
                setKaynakTuru(k);
                setNitelik(VARSAYILAN_NITELIK[k]);
              }}
            >
              {KAYNAK_TURLERI.map((k) => (
                <option key={k} value={k}>
                  {t.kaynakTurleri[k]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.nitelik}
            <select value={nitelik} onChange={(e) => setNitelik(e.target.value)}>
              {NITELIKLER.map((n) => (
                <option key={n} value={n}>
                  {t.nitelikler[n]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {tur === "baglanti" ? (
          <label>
            {t.url}
            <input name="url" type="url" required pattern="https?://.+" defaultValue={ilk.url} />
          </label>
        ) : (
          <label>
            {t.dosya}
            <input name="dosya" type="file" required accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" />
          </label>
        )}
        <div className="form-satir">
          <label>
            {t.yazar}
            <input name="yazar" maxLength={200} defaultValue={ilk.yazar} />
          </label>
          <label>
            {t.yayinci}
            <input name="yayinci" maxLength={200} defaultValue={ilk.yayinci} />
          </label>
          <label>
            {t.yil}
            <input name="yil" type="number" min={1} max={new Date().getFullYear()} step={1} defaultValue={ilk.yil} />
          </label>
        </div>
        <label>
          {t.not}
          <textarea name="aciklama" rows={2} maxLength={2000} defaultValue={ilk.aciklama} />
        </label>
        <div className="dugmeler">
          <button type="submit" disabled={bekle}>
            {bekle ? t.yukleniyor : t.kaydet}
          </button>
          <button type="button" className="ikincil" disabled={bekle} onClick={taslagaKaydet}>
            {ft.kaydet}
          </button>
        </div>
        <p role="status" className={durum && !durum.tamam ? "uyari" : undefined}>
          {durum?.metin}
        </p>
      </form>
    </details>
  );
}

/** Kaynak doğrulama (kaynak.dogrula): durum, herkese açıklık ve gerekçe. */
export function KaynakDogrula({ dil, id, durum, herkeseAcik }: { dil: Dil; id: string; durum: string; herkeseAcik: boolean }) {
  const t = s(dil).kutuphane;
  const router = useRouter();
  const [yeni, setYeni] = useState(durum === "dogrulanmamis" ? "dogrulandi" : durum);
  const [acik, setAcik] = useState(herkeseAcik);
  const [gerekce, setGerekce] = useState("");
  const [hata, setHata] = useState<string>();
  const [bekle, setBekle] = useState(false);
  return (
    <div className="form">
      <fieldset>
        <legend>{t.durum}</legend>
        {(["dogrulandi", "reddedildi", "dogrulanmamis"] as const).map((d) => (
          <label key={d} className="secim">
            <input type="radio" name={`durum-${id}`} checked={yeni === d} onChange={() => setYeni(d)} /> {t.durumlar[d]}
          </label>
        ))}
      </fieldset>
      <label className="secim">
        <input type="checkbox" checked={acik && yeni === "dogrulandi"} disabled={yeni !== "dogrulandi"} onChange={(e) => setAcik(e.target.checked)} />{" "}
        {t.herkeseAcik}
      </label>
      <label>
        {t.gerekce}
        <input value={gerekce} onChange={(e) => setGerekce(e.target.value)} maxLength={2000} />
      </label>
      <div className="dugmeler">
        <button
          type="button"
          disabled={bekle || (yeni === "reddedildi" && !gerekce.trim())}
          onClick={async () => {
            setBekle(true);
            setHata(undefined);
            try {
              await istek({ islem: "dogrula", id, durum: yeni, herkese_acik: acik, gerekce });
              router.refresh();
            } catch (h) {
              setHata(h instanceof Error ? h.message : String(h));
            } finally {
              setBekle(false);
            }
          }}
        >
          {t.dogrula}
        </button>
      </div>
      <p role="alert">{hata}</p>
    </div>
  );
}

/** Eserin bir bilgisini (alan + değer) kaynağa ve konumuna bağlar (eser.duzenle). */
export function BilgiKaynagiFormu({
  dil,
  eserId,
  alanlar,
  kaynaklar,
  taslak,
}: {
  dil: Dil;
  eserId: string;
  alanlar: { id: string; ad: string }[];
  kaynaklar: { id: string; ad: string }[];
  taslak?: FormTaslagiVerisi;
}) {
  const t = s(dil).kutuphane;
  const ft = s(dil).formTaslagi;
  const router = useRouter();
  const ilk = taslak?.veri ?? {};
  const tk = useTaslak("bilgi", eserId, taslak?.id);
  const [mesaj, setMesaj] = useState<string>();
  const [bekle, setBekle] = useState(false);
  return (
    <form
      id="bilgi-formu"
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const v = Object.fromEntries(new FormData(form));
        setBekle(true);
        try {
          await istek({ islem: "bilgi_bagla", eser_id: eserId, ...v });
          await tk.bitir();
          form.reset();
          setMesaj(t.baglandi);
          router.refresh();
        } catch (h) {
          setMesaj(h instanceof Error ? h.message : String(h));
        } finally {
          setBekle(false);
        }
      }}
    >
      {taslak && <p className="not">{ft.devam}</p>}
      <div className="form-satir">
        <label>
          {t.alan}
          <select name="alan" required defaultValue={ilk.alan}>
            {alanlar.map((a) => (
              <option key={a.id} value={a.id}>
                {a.ad}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.deger}
          <input name="deger" maxLength={500} defaultValue={ilk.deger} />
        </label>
      </div>
      <div className="form-satir">
        <label>
          {s(dil).kaynak}
          <select name="kaynak_id" required defaultValue={ilk.kaynak_id ?? ""}>
            <option value="" disabled>
              {s(dil).kaynakSec}
            </option>
            {kaynaklar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ad}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.konum}
          <input name="konum" maxLength={100} defaultValue={ilk.konum} />
        </label>
      </div>
      <div className="dugmeler">
        <button type="submit" disabled={bekle}>
          {t.bagla}
        </button>
        <button
          type="button"
          className="ikincil"
          disabled={bekle}
          onClick={async (e) => {
            const form = e.currentTarget.form;
            if (!form) return;
            setBekle(true);
            try {
              await tk.kaydet(form);
              setMesaj(ft.kaydedildi);
            } catch (h) {
              setMesaj(h instanceof Error ? h.message : String(h));
            } finally {
              setBekle(false);
            }
          }}
        >
          {ft.kaydet}
        </button>
      </div>
      <p role="status">{mesaj}</p>
    </form>
  );
}
