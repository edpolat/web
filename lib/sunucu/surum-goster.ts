// Panel sayfaları için sürüm satırını ekranda gösterilecek hâle çevirir (alan adları, okunur değerler).
import "server-only";
import type { GosterilenSurum } from "@/components/SurumListesi";
import { metin } from "../metin";
import type { Sozluk } from "../sozluk";
import type { Dil, Eser, Kaynak } from "../tipler";
import { iller } from "../veri";
import { goster } from "./goster";
import { alanFarklari, type SurumSatiri } from "./surum";

/** Eserin veri dosyasındaki (JSON) ilk hâli. */
export function ilkHal(eser_id: string): { eser: Eser; il: string } | undefined {
  for (const d of iller()) {
    const eser = d.eserler.find((e) => e.id === eser_id);
    if (eser) return { eser, il: d.il.id };
  }
}

export function surumuGoster(
  s: SurumSatiri,
  onceki: Eser | undefined,
  dil: Dil,
  t: Sozluk,
  kaynakMap: Map<string, Kaynak>,
  ek: Partial<GosterilenSurum> = {},
): GosterilenSurum {
  const ilAdi = iller().find((d) => d.il.id === s.il)?.il.ad;
  const farkla = (a: Eser | undefined, b: Eser) =>
    alanFarklari(a, b).map((f) => ({
      alan: t.alanlar[f.alan] ?? f.alan,
      eski: goster(f.alan, f.eski, dil, t, kaynakMap),
      yeni: goster(f.alan, f.yeni, dil, t, kaynakMap),
    }));
  return {
    id: s.id,
    eserId: s.eser_id,
    eser: metin(s.veri.ad, dil) || s.eser_id,
    il: ilAdi ? metin(ilAdi, dil) : s.il,
    durum: s.arsivlendi ? "arsivlendi" : s.durum,
    islem: s.islem,
    ekleyen: s.ekleyen_ad ?? "",
    olusturuldu: s.olusturuldu,
    inceleyen: s.inceleyen_ad ?? undefined,
    karar_tarihi: s.karar_tarihi ?? undefined,
    ret_gerekcesi: s.ret_gerekcesi ?? undefined,
    aciklama: s.aciklama ?? undefined,
    kaynak: s.kaynak_id ? `${kaynakMap.get(s.kaynak_id)?.baslik ?? s.kaynak_id}${s.sayfa ? `, ${t.sayfa} ${s.sayfa}` : ""}` : undefined,
    farklar: farkla(onceki, s.veri),
    tarihci: s.tarihci_ad ?? undefined,
    tarihciId: s.tarihci ?? undefined,
    tarihciNotu: s.tarihci_notu ?? undefined,
    editorNotu: s.editor_notu ?? undefined,
    ...(s.ilk_veri ? { tarihciFarklari: farkla(s.ilk_veri, s.veri) } : {}),
    ...ek,
  };
}
