"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";
import { taslakSil } from "./taslak";

/** Taslaklarım'da bir form taslağını siler (onay sorar). */
export default function TaslakSil({ dil, id }: { dil: Dil; id: number }) {
  const t = s(dil).formTaslagi;
  const router = useRouter();
  const [hata, setHata] = useState<string>();
  const [bekle, setBekle] = useState(false);
  return (
    <>
      <button
        type="button"
        className="ikincil"
        disabled={bekle}
        onClick={async () => {
          if (!window.confirm(t.silOnay)) return;
          setBekle(true);
          try {
            await taslakSil(id);
            router.refresh();
          } catch (h) {
            setHata(h instanceof Error ? h.message : String(h));
          } finally {
            setBekle(false);
          }
        }}
      >
        {t.sil}
      </button>
      {hata && <span role="alert"> {hata}</span>}
    </>
  );
}
