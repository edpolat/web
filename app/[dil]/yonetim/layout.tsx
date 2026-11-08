import PanelMenu, { PanelIz, type PanelGrubu } from "@/components/PanelMenu";
import { OturumKoprusu } from "@/components/PanelGiris";
import { gecerliDil } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { panelKimligi } from "@/lib/sunucu/oturum";
import { incelemeToplami, panelSayilari } from "@/lib/sunucu/panel-sayilari";
import { izinli, paneldeMi } from "@/lib/yetki";

/**
 * Tüm panel sayfalarında tarayıcıdaki hesap oturumu sunucuyla eşitlenir. Rolü olana sol kenar menüsü gösterilir
 * (gruplar: İş kuyruğu, İçerik, Yönetim); kişi yalnız izni olan satırları görür. Panelde sitenin üst menüsü CSS ile gizlenir.
 */
export default async function YonetimDuzeni({ children, params }: { children: React.ReactNode; params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  const ben = gecerliDil(dil) ? await panelKimligi() : null;
  if (!gecerliDil(dil) || !paneldeMi(ben)) {
    return (
      <>
        <OturumKoprusu />
        {children}
      </>
    );
  }
  const t = s(dil);
  const p = t.pano;
  const k = `/${dil}/yonetim`;
  const sayilar = await panelSayilari(ben);
  const ogeler = (x: ({ yol: string; ad: string; ayrica?: string; sayi?: number } | false)[]) => x.filter((o) => o !== false);
  const gruplar: PanelGrubu[] = [
    { anahtar: "pano", ogeler: [{ yol: k, ad: p.anaSayfa }] },
    {
      anahtar: "is",
      baslik: p.gruplar.is,
      ogeler: ogeler([
        (izinli(ben, "eser.incele") || izinli(ben, "eser.onayla") || izinli(ben, "kaynak.dogrula")) && {
          yol: `${k}/inceleme`,
          ad: p.onay,
          sayi: incelemeToplami(sayilar),
        },
        (izinli(ben, "eser.ekle") || izinli(ben, "eser.duzenle")) && { yol: `${k}/katkilarim`, ad: p.katkilarim, sayi: sayilar.taslaklarim },
      ]),
    },
    {
      anahtar: "icerik",
      baslik: p.gruplar.icerik,
      ogeler: [
        { yol: `${k}/eserler`, ad: p.eserler, ayrica: `${k}/eser` },
        { yol: `${k}/iller`, ad: p.iller },
        { yol: `${k}/sergiler`, ad: p.sergiler },
        { yol: `${k}/kaynaklar`, ad: p.kaynaklar },
      ],
    },
    {
      anahtar: "yonetim",
      baslik: p.gruplar.yonetim,
      ogeler: ogeler([
        izinli(ben, "kullanici.yonet") && { yol: `${k}/kullanicilar`, ad: p.kullanicilar },
        { yol: `${k}/denetim`, ad: p.denetim },
      ]),
    },
  ].filter((g) => g.ogeler.length > 0);
  return (
    <>
      <OturumKoprusu />
      <div className="panel-duzen">
        <PanelMenu
          dil={dil}
          kok={k}
          gruplar={gruplar}
          yazilar={{ menu: p.menu, panelAdi: p.panelAdi, menuAc: p.menuAc, menuKapat: p.menuKapat, siteyeDon: p.siteyeDon, yeniEser: t.yeniEser }}
          kisi={{ ad: ben.ad, eposta: ben.eposta || undefined, rol: t.panel.roller[ben.rol] }}
          yeniEser={izinli(ben, "eser.ekle") ? `${k}/eser/yeni` : undefined}
        />
        <div className="panel-icerik">
          <PanelIz kok={k} gruplar={gruplar} sinif="panel-iz panel-iz-masaustu" />
          {children}
        </div>
      </div>
    </>
  );
}
