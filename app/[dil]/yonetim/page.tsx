import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DemoDugmeleri from "@/components/DemoDugmeleri";
import DenetimTablosu from "@/components/DenetimTablosu";
import EserSecici from "@/components/EserSecici";
import { demoKaydiZamani } from "@/lib/sunucu/demo";
import { PanelGirisFormu, PanelGirisi } from "@/components/PanelGiris";
import { CikisDugmesi, GirisFormu } from "@/components/YonetimGiris";
import { gecerliDil, metin } from "@/lib/metin";
import { s } from "@/lib/sozluk";
import { katkilar } from "@/lib/sunucu/kuyruk";
import { panelKimligi } from "@/lib/sunucu/oturum";
import { yonetimSifresi } from "@/lib/sunucu/yonetim";
import { formTaslaklarim } from "@/lib/sunucu/taslak-depo";
import { izinli, paneldeMi } from "@/lib/yetki";
import { kaynakListesi } from "@/lib/sunucu/kaynak-depo";
import { oneriler } from "@/lib/sunucu/oneri-depo";
import { talepler } from "@/lib/sunucu/talep-depo";
import { denetimKaydi, surumler } from "@/lib/sunucu/surum-depo";
import { benimSurumlerim } from "@/lib/sunucu/panel";
import { yayindakiIller, yayindakiKaynaklar } from "@/lib/veri";

export const metadata: Metadata = { robots: { index: false } };

export default async function Yonetim({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const t = s(dil);
  const ben = await panelKimligi();
  if (!ben) {
    return (
      <section className="kart">
        <PanelGirisi dil={dil}>
          <h1>{t.yonetimGiris}</h1>
          <PanelGirisFormu dil={dil} />
          {yonetimSifresi() && (
            <details>
              <summary>{t.panel.sifreliGiris}</summary>
              <GirisFormu dil={dil} />
            </details>
          )}
        </PanelGirisi>
      </section>
    );
  }
  const kim = (
    <p className="panel-kim">
      <span>
        {t.panel.girisYapan}: <strong>{ben.ad}</strong> {ben.eposta && <small>({ben.eposta})</small>}
      </span>
      {ben.rol && <span className="rozet">{t.panel.roller[ben.rol]}</span>}
    </p>
  );
  if (!paneldeMi(ben)) {
    return (
      <section className="kart">
        <h1>{t.yonetim}</h1>
        {kim}
        <p>{t.panel.rolYok}</p>
        <CikisDugmesi dil={dil} />
      </section>
    );
  }
  const bekleyen = katkilar().filter((k) => k.durum === "bekliyor").length;
  const say = <T,>(izin: boolean, sorgu: () => Promise<T[]>) => (izin ? sorgu().then((x) => x.length).catch(() => undefined) : undefined);
  const onaylayan = izinli(ben, "eser.onayla");
  const tarihci = izinli(ben, "eser.incele");
  const katkici = izinli(ben, "eser.ekle") || izinli(ben, "eser.duzenle");
  const [tarihcide, editorde, oneriSayisi, talepSayisi, dogrulanacak, taslaklarim, eserIlleri, kaynakMap, sonKayitlar] = await Promise.all([
    say(tarihci, () => surumler({ durum: "incelemede" })),
    say(onaylayan, () => surumler({ durum: "editorde" })),
    say(tarihci, () => oneriler({ durum: "bekliyor" })),
    say(tarihci, () => talepler(false)),
    say(izinli(ben, "kaynak.dogrula"), () => kaynakListesi({ durum: "dogrulanmamis" })),
    say(katkici, () =>
      Promise.all([benimSurumlerim().then((x) => x.filter((y) => y.durum === "taslak")), formTaslaklarim()]).then(([a, b]) => [...a, ...b]),
    ),
    yayindakiIller(),
    yayindakiKaynaklar(),
    denetimKaydi(undefined, 8).catch(() => undefined),
  ]);
  const hedefler = new Map<string, { ad: string; yol: string }>();
  for (const { eserler } of eserIlleri) for (const e of eserler) hedefler.set(e.id, { ad: metin(e.ad, dil), yol: `/${dil}/yonetim/eser/${e.id}/gecmis` });
  for (const k of kaynakMap.values()) hedefler.set(k.id, { ad: k.baslik, yol: `/${dil}/yonetim/kaynaklar/${k.id}` });
  for (const { il } of eserIlleri) hedefler.set(`il:${il.id}`, { ad: metin(il.ad, dil), yol: `/${dil}/yonetim/iller` });
  const p = t.pano;
  const kutular = [
    { sayi: tarihcide, ad: p.tarihciBekleyen, yol: `/${dil}/yonetim/inceleme?tur=eser` },
    { sayi: editorde, ad: p.editorBekleyen, yol: `/${dil}/yonetim/inceleme?tur=eser` },
    { sayi: oneriSayisi, ad: p.bilgiOnerisi, yol: `/${dil}/yonetim/inceleme?tur=oneri` },
    { sayi: talepSayisi, ad: p.uygulamaTalebi, yol: `/${dil}/yonetim/inceleme?tur=talep` },
    { sayi: dogrulanacak, ad: p.dogrulanmamisKaynak, yol: `/${dil}/yonetim/inceleme?tur=kaynak` },
    { sayi: taslaklarim, ad: p.taslaklarim, yol: `/${dil}/yonetim/katkilarim?durum=taslak` },
  ].filter((k) => k.sayi !== undefined);
  return (
    <section>
      <h1>{t.yonetim}</h1>
      {kim}
      <p className="not">{t.yonetimAciklama}</p>
      {kutular.length > 0 && (
        <div className="ozet-kutulari">
          {kutular.map((k) => (
            <Link key={k.ad} className="ozet-kutusu" href={k.yol}>
              <strong>{k.sayi}</strong>
              <span>{k.ad}</span>
            </Link>
          ))}
        </div>
      )}
      <p className="dugmeler">
        {izinli(ben, "eser.ekle") && (
          <Link className="dugme" href={`/${dil}/yonetim/eser/yeni`}>
            + {t.yeniEser}
          </Link>
        )}
        <Link className="dugme ikincil" href={`/${dil}/yonetim/eserler`}>
          {p.eserler}
        </Link>
        <Link className="dugme ikincil" href={`/${dil}/yonetim/kaynaklar`}>
          {t.kutuphane.baslik}
        </Link>
        {onaylayan && bekleyen > 0 && (
          <Link className="dugme ikincil" href={`/${dil}/yonetim/onay`}>
            {p.eskiKuyruk}: {t.bekleyen(bekleyen)}
          </Link>
        )}
        {process.env.NODE_ENV !== "production" && (
          <Link className="dugme ikincil" href={`/${dil}/duzenle/konum`}>
            {t.konumDuzenle}
          </Link>
        )}
      </p>
      <h2>{p.sonDegisiklikler}</h2>
      {sonKayitlar ? (
        <>
          <DenetimTablosu dil={dil} kayitlar={sonKayitlar} kaynakMap={kaynakMap} hedefler={hedefler} />
          <p>
            <Link href={`/${dil}/yonetim/denetim`}>{p.tumKayit}</Link>
          </p>
        </>
      ) : (
        <p className="hata">{t.surum.tabloYok}</p>
      )}
      {izinli(ben, "eser.duzenle") && (
        <>
          <h2>{p.hizliDuzenle}</h2>
          <EserSecici
            dil={dil}
            eserler={eserIlleri.flatMap(({ il, eserler }) =>
              eserler.map((e) => ({
                id: e.id,
                ad: metin(e.ad, dil),
                alt: [metin(il.ad, dil), e.ilce, e.taslak ? t.alanlar.taslak : ""].filter(Boolean).join(", "),
              })),
            )}
          />
        </>
      )}
      {onaylayan && <DemoDugmeleri dil={dil} kayitZamani={demoKaydiZamani()} />}
      <CikisDugmesi dil={dil} />
    </section>
  );
}
