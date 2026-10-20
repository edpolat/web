import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import OnayKuyrugu, { type GosterilenKatki } from "@/components/OnayKuyrugu";
import { gecerliDil, metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { goster } from "@/lib/sunucu/goster";
import { farklar } from "@/lib/sunucu/katki";
import { katkilar } from "@/lib/sunucu/kuyruk";
import { yetkili } from "@/lib/sunucu/oturum";
import type { CokDilli, Eser } from "@/lib/tipler";
import { iller, yayindakiKaynaklar } from "@/lib/veri";

export const metadata: Metadata = { robots: { index: false } };

export default async function OnaySayfasi({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  if (!(await yetkili("eser.onayla"))) redirect(`/${dil}/yonetim`);
  const t = s(dil);
  const kaynakMap = await yayindakiKaynaklar();
  const dosyalar = iller();
  const liste: GosterilenKatki[] = katkilar().map((k) => {
    const dosya = dosyalar.find((d) => d.il.id === k.il);
    const mevcut = dosya?.eserler.find((e) => e.id === k.eser_id);
    const ad = mevcut?.ad ?? (k.degisiklik?.ad as CokDilli | undefined);
    return {
      id: k.id,
      tur: k.tur,
      durum: k.durum,
      nereden: k.nereden,
      ekleyen: k.ekleyen,
      gonderildi: k.gonderildi,
      not: k.not,
      karar: k.karar,
      eser: ad ? metin(ad, dil) : k.eser_id,
      eserAdresi: mevcut ? `/${dil}/eser/${mevcut.id}` : undefined,
      il: dosya ? metin(dosya.il.ad, dil) : k.il,
      kaynak: `${kaynakMap.get(k.kaynak_id)?.baslik ?? k.kaynak_id}${k.sayfa ? `, ${t.sayfa} ${k.sayfa}` : ""}`,
      farklar: (k.durum === "bekliyor"
        ? farklar(k, mevcut)
        : // Karar verilmiş katkıda "şu anki hâl" artık katkının kendisidir; gönderildiği andaki eski değeri göster.
          farklar(k, undefined).map((f) => ({ ...f, eski: k.onceki?.[f.alan as keyof Eser] ?? undefined, araDegisti: false }))
      ).map((f) => ({
        alan: t.alanlar[f.alan] ?? f.alan,
        eski: goster(f.alan, f.eski, dil, t, kaynakMap),
        yeni: goster(f.alan, f.yeni, dil, t, kaynakMap),
        araDegisti: f.araDegisti,
      })),
    };
  });
  return (
    <section>
      <p>
        <Link href={`/${dil}/yonetim`}>← {t.yonetim}</Link>
      </p>
      <h1>{t.onayKuyrugu}</h1>
      <p className="not">{t.yonetimAciklama}</p>
      <OnayKuyrugu dil={dil} katkilar={liste} />
    </section>
  );
}
