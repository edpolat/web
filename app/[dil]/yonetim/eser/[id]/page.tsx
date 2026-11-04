import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import EserFormu from "@/components/EserFormu";
import { ilinIlceleri } from "@/lib/il-ilce";
import { gecerliDil, metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { yetkili } from "@/lib/sunucu/oturum";
import { surumOku } from "@/lib/sunucu/surum-depo";
import type { Eser } from "@/lib/tipler";
import { ayarlar, yayindakiIller, yayindakiKaynaklar } from "@/lib/veri";

export const metadata: Metadata = { robots: { index: false } };

/**
 * /yonetim/eser/yeni yeni eser, /yonetim/eser/<id> mevcut eseri düzenler. Taslaklar da düzenlenebilir.
 * ?surum=<id>: tarihçi, incelemedeki sürümü düzelterek editöre gönderir (form sürümün hâliyle açılır).
 */
export default async function EserDuzenle({
  params,
  searchParams,
}: {
  params: Promise<{ dil: string; id: string }>;
  searchParams: Promise<{ il?: string; surum?: string }>;
}) {
  const { dil, id } = await params;
  const { il: varsayilanIl, surum: surumNo } = await searchParams;
  if (!gecerliDil(dil)) notFound();
  const t = s(dil);
  const tumu = await yayindakiIller();
  let eser: Eser | undefined;
  let tarihciSurum: { id: number; kaynak_id: string } | undefined;
  let eserIl: string | undefined;
  if (surumNo) {
    if (!(await yetkili("eser.incele"))) redirect(`/${dil}/yonetim`);
    const surum = await surumOku(Number(surumNo));
    if (!surum || surum.durum !== "incelemede" || surum.eser_id !== id) notFound();
    eser = surum.veri as Eser;
    tarihciSurum = { id: surum.id, kaynak_id: surum.kaynak_id ?? "" };
    eserIl = surum.il ?? undefined;
  } else {
    if (!(await yetkili(id === "yeni" ? "eser.ekle" : "eser.duzenle"))) redirect(`/${dil}/yonetim`);
    eser = id === "yeni" ? undefined : tumu.flatMap((d) => d.eserler).find((e) => e.id === id);
    if (id !== "yeni" && !eser) notFound();
    eserIl = tumu.find((d) => d.eserler.some((e) => e.id === id))?.il.id;
  }
  // İl → ilçe açılır listesi (veri/il-ilce.json); listede olmayan il serbest yazıya döner.
  const ilceler = Object.fromEntries(
    tumu.flatMap(({ il }) => {
      const liste = ilinIlceleri(il.ad.tr);
      return liste ? [[il.id, liste]] : [];
    }),
  );
  return (
    <section className="kart">
      <p>
        <Link href={`/${dil}/yonetim`}>← {t.yonetim}</Link>
        {eser && (
          <>
            {" · "}
            <Link href={`/${dil}/yonetim/eser/${eser.id}/gecmis`}>{t.surum.gecmis}</Link>
          </>
        )}
      </p>
      <h1>{eser ? `${t.eseriDuzenle}: ${metin(eser.ad, dil)}` : t.yeniEser}</h1>
      <p className="not">{tarihciSurum ? t.surum.tarihciModu : t.yonetimAciklama}</p>
      <EserFormu
        dil={dil}
        eser={eser}
        iller={tumu.map(({ il }) => ({ id: il.id, ad: metin(il.ad, dil) }))}
        turler={ayarlar().eser_turleri.map((x) => ({ id: x.id, ad: metin(x.ad, dil) }))}
        kaynaklar={[...(await yayindakiKaynaklar()).values()].map((k) => ({ id: k.id, ad: k.baslik }))}
        varsayilanIl={varsayilanIl}
        eserIl={eserIl}
        ilceler={ilceler}
        tarihciSurum={tarihciSurum}
        kategoriler={Object.fromEntries(ayarlar().olgu_kategorileri.map((k) => [k.id, metin(k.ad, dil)]))}
      />
    </section>
  );
}
