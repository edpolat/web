"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";

/** Yönetim paneli şifre formu; giriş başarılıysa sayfayı yeniler. */
export function GirisFormu({ dil }: { dil: Dil }) {
  const t = s(dil);
  const router = useRouter();
  const [hata, setHata] = useState<string>();
  async function gir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHata(undefined);
    const yanit = await fetch("/api/yonetim/giris", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sifre: new FormData(e.currentTarget).get("sifre") }),
    });
    if (yanit.ok) router.refresh();
    else setHata(((await yanit.json()) as { hata?: string }).hata ?? String(yanit.status));
  }
  return (
    <form className="form" onSubmit={gir}>
      <label>
        {t.sifre}
        <input name="sifre" type="password" required autoComplete="current-password" />
      </label>
      <div className="dugmeler">
        <button type="submit">{t.girisYap}</button>
      </div>
      <p role="alert">{hata}</p>
    </form>
  );
}

export function CikisDugmesi({ dil }: { dil: Dil }) {
  const router = useRouter();
  return (
    <div className="dugmeler">
      <button
        type="button"
        className="ikincil"
        onClick={async () => {
          await fetch("/api/yonetim/giris", { method: "DELETE" });
          router.refresh();
        }}
      >
        {s(dil).cikisYap}
      </button>
    </div>
  );
}
