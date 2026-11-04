import type { Dil } from "@/lib/tipler";
import { konumEksik } from "@/lib/filtre";
import { ayarlar, rotalar, yayindakiEserler, yayindakiIller } from "@/lib/veri";

/** Hesabım (tam sayfa ve yan panel) için gereken veri: Gitmek istediklerim ve Rotalarım kartları tür, il, ilçe ve konum da ister. */
export async function hesapVerisi(dil: Dil) {
  const eserler = (await yayindakiEserler()).map((e) => ({
    id: e.id,
    ad: e.ad,
    tur: e.tur,
    il: e.il,
    ilce: e.ilce,
    konum: e.konum ? { enlem: e.konum.enlem, boylam: e.konum.boylam } : undefined,
    yaklasik: konumEksik(e.konum),
  }));
  return {
    dil,
    eserler,
    rotalar: rotalar(),
    iller: (await yayindakiIller()).map(({ il }) => ({ id: il.id, ad: il.ad })),
    turAdlari: Object.fromEntries(ayarlar().eser_turleri.map((t) => [t.id, t.ad])),
  };
}
