"use client";
import { useState } from "react";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";

type Secenek = { id: string; ad: string };
type Props = { dil: Dil; eserId: string; kategoriler: Secenek[]; kaynaklar: Secenek[] };

/** Esere kaynaklı bilgi ekleme formu. Gönderilen bilgi onay kuyruğuna düşer (POST /api/katki). */
export default function BilgiEkle({ dil, eserId, kategoriler, kaynaklar }: Props) {
  const t = s(dil);
  const [kaynak, setKaynak] = useState("");
  const [durum, setDurum] = useState<{ tur: "tamam" | "hata"; metin: string }>();
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const v = new FormData(form);
    const en = String(v.get("en") ?? "").trim();
    setGonderiliyor(true);
    setDurum(undefined);
    try {
      const yanit = await fetch("/api/katki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tur: "olgu",
          eser_id: eserId,
          nereden: "web",
          ekleyen: v.get("ekleyen"),
          kaynak_id: kaynak,
          sayfa: v.get("sayfa"),
          not: v.get("not"),
          olgu: { metin: { tr: String(v.get("tr") ?? "").trim(), ...(en ? { en } : {}) }, kategori: v.get("kategori") },
        }),
      });
      const veri = (await yanit.json()) as { hata?: string; ayrinti?: string[] };
      if (!yanit.ok) throw new Error([veri.hata, ...(veri.ayrinti ?? [])].filter(Boolean).join(" "));
      form.reset();
      setKaynak("");
      setDurum({ tur: "tamam", metin: t.katkiBekliyor });
    } catch (hata) {
      setDurum({ tur: "hata", metin: `${t.gonderilemedi} ${hata instanceof Error ? hata.message : ""}` });
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <form className="form" onSubmit={gonder}>
      <label>
        {t.bilgiMetni}
        <textarea name="tr" required rows={3} maxLength={1000} />
      </label>
      <label>
        {t.bilgiMetniEn}
        <textarea name="en" rows={3} maxLength={1000} lang="en" />
      </label>
      <label>
        {t.kategori}
        <select name="kategori" required defaultValue={kategoriler[0]?.id}>
          {kategoriler.map((k) => (
            <option key={k.id} value={k.id}>
              {k.ad}
            </option>
          ))}
        </select>
      </label>
      <div className="form-satir">
        <label>
          {t.kaynak}
          <select name="kaynak_id" required value={kaynak} onChange={(e) => setKaynak(e.target.value)} aria-describedby="kaynak-not">
            <option value="">{t.kaynakSec}</option>
            {kaynaklar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ad}
              </option>
            ))}
          </select>
        </label>
        <label className="kisa">
          {t.sayfaNo}
          <input name="sayfa" maxLength={40} inputMode="numeric" />
        </label>
      </div>
      <p id="kaynak-not" className="not">{t.kaynaksizOlmaz}</p>
      <label>
        {t.ekleyen}
        <input name="ekleyen" required maxLength={120} autoComplete="name" />
      </label>
      <label>
        {t.notAlani}
        <textarea name="not" rows={2} maxLength={2000} />
      </label>
      <div className="dugmeler">
        <button type="submit" disabled={!kaynak || gonderiliyor}>
          {gonderiliyor ? t.gonderiliyor : t.gonder}
        </button>
      </div>
      <p role="status" className={durum?.tur === "hata" ? "uyari" : undefined}>
        {durum?.metin}
      </p>
    </form>
  );
}
