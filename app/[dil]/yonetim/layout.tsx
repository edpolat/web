import PanelMenu from "@/components/PanelMenu";
import { OturumKoprusu } from "@/components/PanelGiris";
import { gecerliDil } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { panelKimligi } from "@/lib/sunucu/oturum";
import { izinli, paneldeMi } from "@/lib/yetki";

/** Tüm panel sayfalarında tarayıcıdaki hesap oturumu sunucuyla eşitlenir; rolü olana panel menüsü gösterilir. */
export default async function YonetimDuzeni({ children, params }: { children: React.ReactNode; params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  const ben = gecerliDil(dil) ? await panelKimligi() : null;
  let menu: React.ReactNode = null;
  if (gecerliDil(dil) && paneldeMi(ben)) {
    const p = s(dil).pano;
    const k = `/${dil}/yonetim`;
    const ogeler = [
      { yol: k, ad: p.anaSayfa },
      { yol: `${k}/eserler`, ad: p.eserler, ayrica: `${k}/eser` },
      ...(izinli(ben, "eser.onayla") || izinli(ben, "kaynak.dogrula") ? [{ yol: `${k}/inceleme`, ad: p.onay }] : []),
      { yol: `${k}/kaynaklar`, ad: p.kaynaklar },
      ...(izinli(ben, "eser.ekle") || izinli(ben, "eser.duzenle") ? [{ yol: `${k}/katkilarim`, ad: p.katkilarim }] : []),
      ...(izinli(ben, "kullanici.yonet") ? [{ yol: `${k}/kullanicilar`, ad: p.kullanicilar }] : []),
      { yol: `${k}/denetim`, ad: p.denetim },
    ];
    menu = <PanelMenu etiket={p.menu} ogeler={ogeler} />;
  }
  return (
    <>
      <OturumKoprusu />
      {menu}
      {children}
    </>
  );
}
