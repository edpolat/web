import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PanelBaslik } from "@/components/PanelTablo";
import KullaniciYonetimi, { type PanelKullanicisi } from "@/components/KullaniciYonetimi";
import { gecerliDil } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { hesapIstemcisi } from "@/lib/sunucu/kimlik";
import { panelKimligi } from "@/lib/sunucu/oturum";
import { izinli } from "@/lib/yetki";

export const metadata: Metadata = { robots: { index: false } };

/** Kullanıcı yönetimi: yalnız kullanici.yonet izni olanlar (süper yönetici). */
export default async function Kullanicilar({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const ben = await panelKimligi();
  if (!izinli(ben, "kullanici.yonet")) redirect(`/${dil}/yonetim`);
  const t = s(dil);
  const vt = await hesapIstemcisi();
  const { data, error } = vt ? await vt.rpc("kullanicilari_listele") : { data: null, error: true };
  return (
    <section>
      <p>
        <Link href={`/${dil}/yonetim`}>← {t.yonetim}</Link>
      </p>
      <PanelBaslik simge="kisiler" baslik={t.panel.kullanicilar} alt={t.panel.kullaniciAciklama} />
      {error ? (
        <p className="hata">{t.panel.listeHatasi}</p>
      ) : (
        <KullaniciYonetimi dil={dil} kullanicilar={(data ?? []) as PanelKullanicisi[]} benim={ben!.id} />
      )}
    </section>
  );
}
