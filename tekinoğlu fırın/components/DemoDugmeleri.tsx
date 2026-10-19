"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";

/** Yönetim panelinde sunum hazırlığı: demo başlangıcını kaydet ve her akıştan önce sıfırla. */
export default function DemoDugmeleri({ dil, kayitZamani }: { dil: Dil; kayitZamani?: string }) {
  const t = s(dil).demo;
  const router = useRouter();
  const [mesaj, setMesaj] = useState("");
  const [calisiyor, setCalisiyor] = useState(false);
  const tarih = (z: string) => new Date(z).toLocaleString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  async function yap(islem: "kaydet" | "sifirla") {
    if (islem === "sifirla" && !window.confirm(t.onay)) return;
    setCalisiyor(true);
    const yanit = await fetch("/api/yonetim/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ islem }),
    });
    const govde = (await yanit.json()) as { zaman?: string; hata?: string };
    setMesaj(yanit.ok ? (islem === "kaydet" ? t.kaydedildi(tarih(govde.zaman!)) : t.sifirlandi) : (govde.hata ?? t.hata));
    setCalisiyor(false);
    router.refresh();
  }

  return (
    <section className="demo-kutusu" aria-labelledby="demo-baslik">
      <h2 id="demo-baslik">{t.baslik}</h2>
      <p className="not">{t.aciklama}</p>
      <p className="not">{kayitZamani ? t.kaydedildi(tarih(kayitZamani)) : t.kayitYok}</p>
      <p className="dugmeler">
        <button type="button" onClick={() => yap("sifirla")} disabled={!kayitZamani || calisiyor}>
          {t.sifirla}
        </button>
        <button type="button" className="ikincil" onClick={() => yap("kaydet")} disabled={calisiyor}>
          {t.kaydet}
        </button>
      </p>
      <p role="status">{mesaj}</p>
    </section>
  );
}
