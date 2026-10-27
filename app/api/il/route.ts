// Panelden il ekleme (hesapla giriş gerekli): yeni il ya da il bilgisi düzeltmesi gönder, editör onaylar/reddeder.
// İzin hem burada hem Supabase fonksiyonlarında denetlenir. Kurallar lib/sunucu/il-surum.ts'de.
import { KatkiHatasi } from "@/lib/sunucu/katki";
import { ilGonder, ilKarar, ilOku } from "@/lib/sunucu/il-depo";
import { ilHazirla } from "@/lib/sunucu/il-surum";
import { kimlik } from "@/lib/sunucu/kimlik";
import { yetkili } from "@/lib/sunucu/oturum";
import { yayiniYenile } from "@/lib/sunucu/surum-depo";
import { yayindakiIller, yayindakiKaynaklar } from "@/lib/veri";

const metin = (x: unknown) => (typeof x === "string" ? x.trim() : "");

async function islem(g: Record<string, unknown>): Promise<Record<string, unknown>> {
  const ben = await kimlik();
  if (!ben?.rol) throw new KatkiHatasi("Panel için hesabınla giriş yapmalısın.");
  switch (g.islem) {
    case "gonder": {
      if (!(await yetkili("eser.ekle"))) throw new KatkiHatasi("Bu işlem için yetkin yok.");
      const [iller, kaynakMap] = await Promise.all([yayindakiIller(), yayindakiKaynaklar()]);
      const hazir = ilHazirla(g, iller, new Set(kaynakMap.keys()));
      return { id: await ilGonder(hazir), il_id: hazir.il_id };
    }
    case "karar": {
      if (!(await yetkili("eser.onayla"))) throw new KatkiHatasi("Bu işlem için yetkin yok.");
      const id = typeof g.id === "number" && Number.isInteger(g.id) ? g.id : NaN;
      const kayit = await ilOku(id);
      if (!kayit || kayit.durum !== "incelemede") throw new KatkiHatasi("Bu kayıt incelemede değil.");
      const onay = g.onay === true;
      if (!onay && !metin(g.gerekce)) throw new KatkiHatasi("Reddetmek için gerekçe yazmalısın.");
      await ilKarar(id, onay, metin(g.gerekce));
      if (onay) yayiniYenile();
      return { tamam: true, il_id: kayit.il_id };
    }
  }
  throw new KatkiHatasi("Bilinmeyen işlem.");
}

export async function POST(istek: Request) {
  let govde: unknown;
  try {
    govde = await istek.json();
  } catch {
    return Response.json({ hata: "Geçersiz JSON." }, { status: 400 });
  }
  if (typeof govde !== "object" || govde === null) return Response.json({ hata: "Geçersiz istek." }, { status: 400 });
  try {
    return Response.json(await islem(govde as Record<string, unknown>));
  } catch (hata) {
    if (hata instanceof KatkiHatasi) return Response.json({ hata: hata.message, ayrinti: hata.ayrinti }, { status: 400 });
    throw hata;
  }
}
