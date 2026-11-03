import "server-only";
import { formTaslaklarim } from "@/lib/sunucu/taslak-depo";
import { kaynakListesi } from "@/lib/sunucu/kaynak-depo";
import { oneriler } from "@/lib/sunucu/oneri-depo";
import { talepler } from "@/lib/sunucu/talep-depo";
import { surumler } from "@/lib/sunucu/surum-depo";
import { benimSurumlerim } from "@/lib/sunucu/panel";
import { izinli, type Kimlik } from "@/lib/yetki";

export type PanelSayilari = {
  tarihcide?: number;
  editorde?: number;
  oneri?: number;
  talep?: number;
  dogrulanacak?: number;
  taslaklarim?: number;
};

/** Pano kutuları ve kenar menüsü sayaçları. İzni olmayan ya da tablosu olmayan sayı undefined döner. */
export async function panelSayilari(ben: Kimlik): Promise<PanelSayilari> {
  const say = <T,>(izin: boolean, sorgu: () => Promise<T[]>) => (izin ? sorgu().then((x) => x.length).catch(() => undefined) : undefined);
  const tarihci = izinli(ben, "eser.incele");
  const katkici = izinli(ben, "eser.ekle") || izinli(ben, "eser.duzenle");
  const [tarihcide, editorde, oneri, talep, dogrulanacak, taslaklarim] = await Promise.all([
    say(tarihci, () => surumler({ durum: "incelemede" })),
    say(izinli(ben, "eser.onayla"), () => surumler({ durum: "editorde" })),
    say(tarihci, () => oneriler({ durum: "bekliyor" })),
    say(tarihci, () => talepler(false)),
    say(izinli(ben, "kaynak.dogrula"), () => kaynakListesi({ durum: "dogrulanmamis" })),
    say(katkici, () =>
      Promise.all([benimSurumlerim().then((x) => x.filter((y) => y.durum === "taslak")), formTaslaklarim()]).then(([a, b]) => [...a, ...b]),
    ),
  ]);
  return { tarihcide, editorde, oneri, talep, dogrulanacak, taslaklarim };
}

/** İnceleme kuyruğundaki toplam bekleyen iş (menü sayacı). */
export const incelemeToplami = (x: PanelSayilari) =>
  (x.tarihcide ?? 0) + (x.editorde ?? 0) + (x.oneri ?? 0) + (x.talep ?? 0) + (x.dogrulanacak ?? 0);
