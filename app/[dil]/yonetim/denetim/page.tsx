import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import DenetimTablosu from "@/components/DenetimTablosu";
import { PanelBaslik } from "@/components/PanelTablo";
import { gecerliDil, metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { panelKimligi } from "@/lib/sunucu/oturum";
import { yayindakiSergiler } from "@/lib/sunucu/sergi-depo";
import { denetimKaydi, kisiAdlari, type DenetimSatiri } from "@/lib/sunucu/surum-depo";
import { yayindakiEserler, yayindakiKaynaklar, yayindakiIller } from "@/lib/veri";
import { paneldeMi } from "@/lib/yetki";

export const metadata: Metadata = { robots: { index: false } };

const SINIR = 500;

/** Bütün denetim kaydı: kim, ne zaman, ne yaptı. İşleme, kişiye ve hedefe göre süzülür. */
export default async function Denetim({
  params,
  searchParams,
}: {
  params: Promise<{ dil: string }>;
  searchParams: Promise<{ islem?: string; kim?: string; q?: string }>;
}) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  if (!paneldeMi(await panelKimligi())) redirect(`/${dil}/yonetim`);
  const t = s(dil);
  const p = t.pano;
  const arama = await searchParams;
  const kim = (arama.kim ?? "").trim().toLocaleLowerCase("tr");
  const q = (arama.q ?? "").trim().toLocaleLowerCase("tr");

  const [eserler, kaynakMap, ilDosyalari, sergiMap] = await Promise.all([yayindakiEserler(), yayindakiKaynaklar(), yayindakiIller(), yayindakiSergiler()]);
  const hedefler = new Map<string, { ad: string; yol?: string }>();
  for (const e of eserler) hedefler.set(e.id, { ad: metin(e.ad, dil), yol: `/${dil}/yonetim/eser/${e.id}/gecmis` });
  for (const k of kaynakMap.values()) hedefler.set(k.id, { ad: k.baslik, yol: `/${dil}/yonetim/kaynaklar/${k.id}` });
  for (const { il } of ilDosyalari) hedefler.set(`il:${il.id}`, { ad: metin(il.ad, dil), yol: `/${dil}/yonetim/iller` });
  for (const x of sergiMap.values()) hedefler.set(`sergi:${x.id}`, { ad: metin(x.ad, dil), yol: `/${dil}/yonetim/sergiler#sergi-${x.id}` });

  let kayitlar: DenetimSatiri[] | undefined;
  let hataMetni = "";
  try {
    const tumu = await denetimKaydi(undefined, SINIR);
    for (const [id, ad] of await kisiAdlari(tumu)) hedefler.set(id, { ad });
    kayitlar = tumu.filter(
      (k) =>
        (!arama.islem || k.islem === arama.islem) &&
        (!kim || (k.kim_ad ?? "").toLocaleLowerCase("tr").includes(kim)) &&
        (!q || `${k.hedef ?? ""} ${hedefler.get(k.hedef ?? "")?.ad ?? ""}`.toLocaleLowerCase("tr").includes(q)),
    );
  } catch (h) {
    hataMetni = h instanceof Error ? h.message : String(h);
  }

  return (
    <section>
      <PanelBaslik simge="belge" baslik={p.denetim} alt={`${p.denetimAciklama} ${p.son(SINIR)}.`} />
      {kayitlar ? (
        <>
          <DenetimTablosu dil={dil} kayitlar={kayitlar} kaynakMap={kaynakMap} hedefler={hedefler} suzgec="islem" />
        </>
      ) : (
        <p className="hata">
          {t.surum.tabloYok} <small>({hataMetni})</small>
        </p>
      )}
    </section>
  );
}
