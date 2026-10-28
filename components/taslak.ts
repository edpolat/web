"use client";
// Panel formlarının "Taslak olarak kaydet" düğmesi için ortak kanca (yeni il, kaynak, bilgi bağlama). Sunucu: /api/taslak.
import { useState } from "react";

async function istek(govde: Record<string, unknown>): Promise<Record<string, unknown>> {
  const yanit = await fetch("/api/taslak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde) });
  const veri = (await yanit.json().catch(() => ({}))) as Record<string, unknown>;
  if (!yanit.ok) throw new Error((veri.hata as string) ?? String(yanit.status));
  return veri;
}

/** Formun yazı alanlarını taslağa kaydeder (dosyalar hariç); ilk kayıttan sonra aynı taslak güncellenir. */
export function useTaslak(tur: "il" | "kaynak" | "bilgi", hedef?: string, ilkId?: number) {
  const [id, setId] = useState(ilkId);
  async function kaydet(form: HTMLFormElement, ek: Record<string, string> = {}): Promise<void> {
    const veri: Record<string, string> = {};
    for (const [k, v] of new FormData(form)) if (typeof v === "string") veri[k] = v;
    const yanit = await istek({ islem: "kaydet", id, tur, hedef, veri: { ...veri, ...ek } });
    setId(yanit.id as number);
  }
  /** Form gönderilince taslak artık gereksiz; silinemezse gönderimi bozmaz. */
  async function bitir(): Promise<void> {
    if (!id) return;
    await istek({ islem: "sil", id }).catch(() => undefined);
    setId(undefined);
  }
  return { id, kaydet, bitir };
}

/** Taslaklarım'daki "Sil" düğmesi. */
export async function taslakSil(id: number): Promise<void> {
  await istek({ islem: "sil", id });
}
