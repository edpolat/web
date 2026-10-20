"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import { ROLLER, type Rol } from "@/lib/yetki";

export type PanelKullanicisi = { id: string; eposta: string; ad: string | null; rol: Rol | null };

/** Hesap listesi ve rol seçimi (yalnız kullanici.yonet). Kişi kendi rolünü değiştiremez. */
export default function KullaniciYonetimi({ dil, kullanicilar, benim }: { dil: Dil; kullanicilar: PanelKullanicisi[]; benim: string }) {
  const t = s(dil).panel;
  const router = useRouter();
  const [mesaj, setMesaj] = useState("");
  const [arama, setArama] = useState("");
  async function ata(kullanici: string, rol: Rol | null) {
    setMesaj("");
    const yanit = await fetch("/api/yonetim/kullanicilar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kullanici, rol }),
    });
    setMesaj(yanit.ok ? t.kaydedildi : (((await yanit.json()) as { hata?: string }).hata ?? String(yanit.status)));
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
                  onChange={(e) => ata(k.id, (e.target.value || null) as Rol | null)}
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
    </>
  );
}
