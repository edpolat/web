import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import EserFormu from "@/components/EserFormu";
import { gecerliDil, metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { yoneticiMi } from "@/lib/sunucu/oturum";
import { ayarlar, iller, kaynaklar } from "@/lib/veri";

export const metadata: Metadata = { robots: { index: false } };

/** /yonetim/eser/yeni yeni eser, /yonetim/eser/<id> mevcut eseri düzenler. Taslaklar da düzenlenebilir. */
export default async function EserDuzenle({ params }: { params: Promise<{ dil: string; id: string }> }) {
  const { dil, id } = await params;
  if (!gecerliDil(dil)) notFound();
  if (!(await yoneticiMi())) redirect(`/${dil}/yonetim`);
  const t = s(dil);
  const tumu = iller();
  const eser = id === "yeni" ? undefined : tumu.flatMap((d) => d.eserler).find((e) => e.id === id);
  if (id !== "yeni" && !eser) notFound();
  return (
    <section className="kart">
      <p>
        <Link href={`/${dil}/yonetim`}>← {t.yonetim}</Link>
      </p>
      <h1>{eser ? `${t.eseriDuzenle}: ${metin(eser.ad, dil)}` : t.yeniEser}</h1>
      <p className="not">{t.yonetimAciklama}</p>
      <EserFormu
        dil={dil}
        eser={eser}
        iller={tumu.map(({ il }) => ({ id: il.id, ad: metin(il.ad, dil) }))}
        turler={ayarlar().eser_turleri.map((x) => ({ id: x.id, ad: metin(x.ad, dil) }))}
        kaynaklar={[...kaynaklar().values()].map((k) => ({ id: k.id, ad: k.baslik }))}
      />
    </section>
  );
}
