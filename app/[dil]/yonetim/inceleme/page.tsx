import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import KaynakKunye from "@/components/KaynakKunye";
import { KaynakDogrula } from "@/components/KaynakPaneli";
import OneriKarti from "@/components/OneriKarti";
import { SurumKarti, type GosterilenSurum } from "@/components/SurumListesi";
import TalepKarti from "@/components/TalepKarti";
import YzElemeKutusu from "@/components/YzElemeKutusu";
import YzKaynakKutusu, { type GosterilenAnaliz } from "@/components/YzKaynakKutusu";
import { dilFarklari } from "@/lib/dil-uyumu";
import type { KutuphaneKaynagi } from "@/lib/kaynak";
import { gecerliDil, metin } from "@/lib/metin";
import { mevcutDeger, mevcutMetinler, type OneriSatiri } from "@/lib/oneri";
import { s } from "@/lib/sozluk";
import { kaynakListesi } from "@/lib/sunucu/kaynak-depo";
import { hesapIstemcisi } from "@/lib/sunucu/kimlik";
import { oneriler as oneriListesi } from "@/lib/sunucu/oneri-depo";
import { panelKimligi } from "@/lib/sunucu/oturum";
import { yayindakiHal } from "@/lib/sunucu/panel";
import { surumler } from "@/lib/sunucu/surum-depo";
import { surumuGoster } from "@/lib/sunucu/surum-goster";
import { talepler as talepListesi } from "@/lib/sunucu/talep-depo";
import type { TalepSatiri } from "@/lib/talep";
import { arkaPlanda, type ArkaPlanIsi } from "@/lib/sunucu/yz-analiz";
import { sonAnalizler, sonDuzeltmeler, type AnalizSatiri, type EtiketDuzeltmesi } from "@/lib/sunucu/yz-depo";
import { yzAcik } from "@/lib/sunucu/yz-servis";
import { ayarlar, yayindakiEserler, yayindakiKaynaklar } from "@/lib/veri";
import { izinli } from "@/lib/yetki";
import { ETIKETLER, benzerOneriler, siraPuani, type ElemeCevabi, type Etiket, type GecerliEtiket } from "@/lib/yz";

export const metadata: Metadata = { robots: { index: false } };

const TURLER = ["eser", "kaynak", "oneri", "talep"] as const;
type Tur = (typeof TURLER)[number];

const hata = (h: unknown) => (h instanceof Error ? h.message : String(h));

const tarih = (iso: string, dil: string) => new Date(iso).toLocaleString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

type Kayit =
  | { tur: "eser"; zaman: string; surum: GosterilenSurum }
  | { tur: "kaynak"; zaman: string; kaynak: KutuphaneKaynagi }
  | { tur: "oneri"; zaman: string; oneri: OneriSatiri }
  | { tur: "talep"; zaman: string; talep: TalepSatiri };

/**
 * Onay bekleyenler, iki aşamalı: tarihçi (eser.incele) tarihçideki eser sürümlerini, bilgi önerilerini ve mobil uygulama taleplerini,
 * editör (eser.onayla) tarihçiden geçmiş sürümleri görür; doğrulanmamış kaynaklar (kaynak.dogrula) da aynı listede,
 * talep tarihine göre eskiden yeniye. ?tur=eser|kaynak|oneri|talep türe göre süzer, ?sira=yeni sırayı çevirir.
 */
export default async function Inceleme({
  params,
  searchParams,
}: {
  params: Promise<{ dil: string }>;
  searchParams: Promise<{ tur?: string; sira?: string; etiket?: string }>;
}) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const ben = await panelKimligi();
  const tarihciYetkisi = izinli(ben, "eser.incele");
  const editorYetkisi = izinli(ben, "eser.onayla");
  // eserYetkisi: eser sürümlerinden en az bir aşamayı görür; öneri ve talepler tarihçinin işi.
  const eserYetkisi = tarihciYetkisi || editorYetkisi;
  const kaynakYetkisi = izinli(ben, "kaynak.dogrula");
  if (!eserYetkisi && !kaynakYetkisi) redirect(`/${dil}/yonetim`);
  const surumEylemleri = [...(tarihciYetkisi ? (["tarihci"] as const) : []), ...(editorYetkisi ? (["karar"] as const) : [])];
  const t = s(dil);
  const u = t.kutuphane;
  const { tur, sira, etiket } = await searchParams;
  const yeniOnce = sira === "yeni";
  const oncelikle = sira === "oncelik";
  // YZ etiketine göre süzme yalnız öneriler içindir.
  const seciliEtiket: Etiket | "benzer" | undefined = [...ETIKETLER, "benzer" as const].find((x) => x === etiket);
  const secili: Tur | undefined = seciliEtiket ? "oneri" : TURLER.find((x) => x === tur);

  let eserler: GosterilenSurum[] | undefined;
  let eserHatasi = "";
  // Kaynakla gelen sürümler YZ kaynak analizine girer.
  const kaynakliSurumler = new Set<number>();
  if (eserYetkisi) {
    try {
      const kaynakMap = await yayindakiKaynaklar();
      const bekleyen = [
        ...(tarihciYetkisi ? await surumler({ durum: "incelemede" }) : []),
        ...(editorYetkisi ? await surumler({ durum: "editorde" }) : []),
      ];
      for (const x of bekleyen) if (x.kaynak_id) kaynakliSurumler.add(x.id);
      eserler = await Promise.all(
        bekleyen.map(async (x) => {
          const simdi = await yayindakiHal(x.eser_id);
          const eski = x.islem === "ekle" ? undefined : simdi.eser;
          return surumuGoster(x, eski, dil, t, kaynakMap, {
            araDegisti: x.islem === "duzenle" && simdi.surum !== x.temel_surum,
            dilFarklari: dilFarklari(eski, x.veri),
            dilUyumu: x.dil_uyumu === true,
          });
        }),
      );
    } catch (h) {
      eserHatasi = hata(h);
    }
  }
  let kaynaklar: KutuphaneKaynagi[] | undefined;
  let kaynakHatasi = "";
  if (kaynakYetkisi) {
    try {
      kaynaklar = await kaynakListesi({ durum: "dogrulanmamis" });
    } catch (h) {
      kaynakHatasi = hata(h);
    }
  }

  let oneriler: OneriSatiri[] | undefined;
  let oneriHatasi = "";
  if (tarihciYetkisi) {
    try {
      oneriler = await oneriListesi({ durum: "bekliyor" });
    } catch (h) {
      oneriHatasi = hata(h);
    }
  }
  let talepler: TalepSatiri[] | undefined;
  let talepHatasi = "";
  if (tarihciYetkisi) {
    try {
      talepler = await talepListesi();
    } catch (h) {
      talepHatasi = hata(h);
    }
  }
  // YZ kaynak analizi: sonuçlar okunur; hiç analizi olmayanlar (en çok 3) sayfa yanıtından sonra arka planda başlatılır.
  // YZ'nin her hatası burada yutulur, liste ve karar düğmeleri her durumda çalışır.
  const yzAcikMi = yzAcik();
  let oneriAnalizleri = new Map<number, AnalizSatiri>();
  let surumAnalizleri = new Map<number, AnalizSatiri>();
  let elemeAnalizleri = new Map<number, AnalizSatiri>();
  let duzeltmeler = new Map<number, EtiketDuzeltmesi>();
  const baslatilan = new Set<string>();
  if (eserYetkisi) {
    const vt = await hesapIstemcisi().catch(() => null);
    if (vt) {
      const tumOneriler = (oneriler ?? []).map((o) => o.id);
      const kaynakliOneriler = (oneriler ?? []).filter((o) => !o.kaynaksiz).map((o) => o.id);
      [oneriAnalizleri, surumAnalizleri, elemeAnalizleri, duzeltmeler] = await Promise.all([
        sonAnalizler(vt, "kaynak", "oneri", kaynakliOneriler),
        sonAnalizler(vt, "kaynak", "surum", [...kaynakliSurumler]),
        sonAnalizler(vt, "eleme", "oneri", tumOneriler),
        sonDuzeltmeler(vt, tumOneriler),
      ]);
      if (yzAcikMi) {
        // Önerinin kaynak analizi ön elemeden önce gelir (ön eleme onun sonucunu da kullanır). En çok 4 iş.
        const eksik: ArkaPlanIsi[] = [
          ...kaynakliOneriler.filter((id) => !oneriAnalizleri.has(id)).map((id) => ({ analiz: "kaynak" as const, tur: "oneri" as const, id })),
          ...tumOneriler.filter((id) => !elemeAnalizleri.has(id)).map((id) => ({ analiz: "eleme" as const, tur: "oneri" as const, id })),
          ...[...kaynakliSurumler].filter((id) => !surumAnalizleri.has(id)).map((id) => ({ analiz: "kaynak" as const, tur: "surum" as const, id })),
        ].slice(0, 4);
        arkaPlanda(vt, eksik);
        for (const x of eksik) baslatilan.add(`${x.analiz}-${x.tur}-${x.id}`);
      }
    }
  }
  // Ön eleme: geçerli etiket (editör düzelttiyse onunki), tekrar tespiti (kodla).
  const gecerliEtiket = (id: number): GecerliEtiket | undefined => {
    const d = duzeltmeler.get(id);
    if (d) return { etiketler: d.etiketler as Etiket[], oncelik: d.oncelik, kaynak: "editor" };
    const a = elemeAnalizleri.get(id);
    const c = a?.durum === "tamam" ? (a.sonuc as ElemeCevabi) : undefined;
    return c && { etiketler: c.etiketler, oncelik: c.oncelik, kaynak: "yz" };
  };
  const benzerler = benzerOneriler(oneriler ?? []);
  const etiketUyar = (o: OneriSatiri) =>
    !seciliEtiket || (seciliEtiket === "benzer" ? (benzerler.get(o.id)?.length ?? 0) > 0 : (gecerliEtiket(o.id)?.etiketler.includes(seciliEtiket) ?? false));
  const gosterilen = (a?: AnalizSatiri): GosterilenAnaliz | undefined =>
    a && { id: a.id, durum: a.durum, sonuc: a.sonuc as GosterilenAnaliz["sonuc"], hata: a.hata, model: a.model };
  const yzKutusu = (tur: "oneri" | "surum", id: number, a?: AnalizSatiri) => (
    <YzKaynakKutusu
      dil={dil}
      hedefTur={tur}
      hedefId={id}
      analiz={gosterilen(a)}
      acik={yzAcikMi}
      basladi={baslatilan.has(`kaynak-${tur}-${id}`)}
      yenilenebilir={eserYetkisi}
    />
  );
  const tamamlanan = (a?: AnalizSatiri) => (a?.durum === "tamam" ? [a.id] : []);
  const elemeKutusuAnalizi = (a?: AnalizSatiri) =>
    a && { id: a.id, durum: a.durum, sonuc: a.sonuc as ElemeCevabi | null, hata: a.hata, model: a.model };

  const eserMap = new Map((await yayindakiEserler()).map((e) => [e.id, e]));
  const kaynakAdlari = await yayindakiKaynaklar();
  const kategoriler = ayarlar().olgu_kategorileri.map((k) => ({ id: k.id, ad: metin(k.ad, dil) }));

  const sayi = { eser: eserler?.length ?? 0, kaynak: kaynaklar?.length ?? 0, oneri: oneriler?.length ?? 0, talep: talepler?.length ?? 0 };
  const kayitlar: Kayit[] = [
    ...(!secili || secili === "eser" ? (eserler ?? []).map((x): Kayit => ({ tur: "eser", zaman: x.olusturuldu, surum: x })) : []),
    ...(!secili || secili === "kaynak" ? (kaynaklar ?? []).map((k): Kayit => ({ tur: "kaynak", zaman: k.eklendi, kaynak: k })) : []),
    ...(!secili || secili === "oneri" ? (oneriler ?? []).filter(etiketUyar).map((o): Kayit => ({ tur: "oneri", zaman: o.olusturuldu, oneri: o })) : []),
    ...(!secili || secili === "talep" ? (talepler ?? []).map((x): Kayit => ({ tur: "talep", zaman: x.olusturuldu, talep: x })) : []),
  ]
    // Spam etiketli öneri hep en sonda (silinmez, gizlenmez); "Önceliğe göre" seçiliyse önce öncelik, sonra tarih.
    .map((x) => ({ x, puan: x.tur === "oneri" ? siraPuani(gecerliEtiket(x.oneri.id), oncelikle) : oncelikle ? 1 : 0 }))
    .sort((a, b) => a.puan - b.puan || (yeniOnce ? -1 : 1) * (Date.parse(a.x.zaman) - Date.parse(b.x.zaman)))
    .map((y) => y.x);
  const etiketSayilari = new Map<string, number>();
  for (const o of oneriler ?? []) {
    for (const e of gecerliEtiket(o.id)?.etiketler ?? []) etiketSayilari.set(e, (etiketSayilari.get(e) ?? 0) + 1);
    if (benzerler.get(o.id)?.length) etiketSayilari.set("benzer", (etiketSayilari.get("benzer") ?? 0) + 1);
  }

  const adres = (x: { tur?: Tur; sira?: string; etiket?: string }) => {
    const q = new URLSearchParams();
    if (x.tur && !x.etiket) q.set("tur", x.tur);
    if (x.sira) q.set("sira", x.sira);
    if (x.etiket) q.set("etiket", x.etiket);
    const yazi = q.toString();
    return `/${dil}/yonetim/inceleme${yazi ? `?${yazi}` : ""}`;
  };
  const cipler: [Tur | undefined, string, number][] = [[undefined, u.tumu, sayi.eser + sayi.kaynak + sayi.oneri + sayi.talep]];
  if (eserYetkisi) cipler.push(["eser", t.surum.onayTurleri.eser, sayi.eser]);
  if (kaynakYetkisi) cipler.push(["kaynak", t.surum.onayTurleri.kaynak, sayi.kaynak]);
  if (tarihciYetkisi) cipler.push(["oneri", t.surum.onayTurleri.oneri, sayi.oneri]);
  if (tarihciYetkisi) cipler.push(["talep", t.surum.onayTurleri.talep, sayi.talep]);
  const yeniSira = yeniOnce ? "yeni" : oncelikle ? "oncelik" : undefined;
  const y = t.yz;

  return (
    <section>
      <p>
        <Link href={`/${dil}/yonetim`}>← {t.yonetim}</Link>
      </p>
      <h1>{t.surum.inceleme}</h1>
      <p className="not">{t.surum.incelemeAciklama}</p>
      <nav className="cipler" aria-label={u.suz}>
        {cipler.map(([cipTuru, ad, n]) => (
          <Link key={ad} className="cip" aria-pressed={!seciliEtiket && secili === cipTuru} href={adres({ tur: cipTuru, sira: yeniSira })}>
            {ad} ({n})
          </Link>
        ))}
      </nav>
      <p className="not">
        {t.surum.sira}:{" "}
        <Link aria-current={(!yeniOnce && !oncelikle) || undefined} href={adres({ tur: secili, etiket: seciliEtiket })}>
          {t.surum.eskidenYeniye}
        </Link>
        {" · "}
        <Link aria-current={yeniOnce || undefined} href={adres({ tur: secili, sira: "yeni", etiket: seciliEtiket })}>
          {t.surum.yenidenEskiye}
        </Link>
        {eserYetkisi && (
          <>
            {" · "}
            <Link aria-current={oncelikle || undefined} href={adres({ tur: secili, sira: "oncelik", etiket: seciliEtiket })}>
              {y.siraOncelik}
            </Link>
          </>
        )}
      </p>
      {eserYetkisi && (oneriler?.length ?? 0) > 0 && (
        <nav className="cipler" aria-label={y.etiketSuz}>
          <span className="not">{y.etiketSuz}:</span>
          {[...ETIKETLER, "benzer" as const].map((e) => (
            <Link key={e} className="cip" aria-pressed={seciliEtiket === e} href={adres({ sira: yeniSira, etiket: seciliEtiket === e ? undefined : e })}>
              {y.etiketler[e]} ({etiketSayilari.get(e) ?? 0})
            </Link>
          ))}
        </nav>
      )}
      {(etiketSayilari.get("spam") ?? 0) > 0 && <p className="not">{y.spamNot}</p>}
      {eserHatasi && (
        <p className="hata">
          {t.surum.tabloYok} <small>({eserHatasi})</small>
        </p>
      )}
      {oneriHatasi && (
        <p className="hata">
          {t.surum.oneriTabloYok} <small>({oneriHatasi})</small>
        </p>
      )}
      {talepHatasi && (
        <p className="hata">
          {t.talep.tabloYok} <small>({talepHatasi})</small>
        </p>
      )}
      {kaynakHatasi && (
        <p className="hata">
          {u.tabloYok} <small>({kaynakHatasi})</small>
        </p>
      )}
      {!kayitlar.length && <p>{t.surum.hepsiOnaylandi}</p>}
      {kayitlar.map((x) =>
        x.tur === "talep" ? (
          <TalepKarti
            key={`t-${x.talep.id}`}
            dil={dil}
            talep={x.talep}
            eserAd={metin(eserMap.get(x.talep.eser_id)?.ad, dil) || x.talep.eser_adi || x.talep.eser_id}
            duzenleyebilir={izinli(ben, "eser.duzenle") && eserMap.has(x.talep.eser_id)}
          />
        ) : x.tur === "oneri" ? (
          <OneriKarti
            key={`o-${x.oneri.id}`}
            dil={dil}
            oneri={x.oneri}
            eserAd={metin(eserMap.get(x.oneri.eser_id)?.ad, dil) || x.oneri.eser_id}
            mevcut={mevcutDeger(eserMap.get(x.oneri.eser_id), x.oneri.alan)}
            mevcutMetin={mevcutMetinler(eserMap.get(x.oneri.eser_id))}
            yzAcik={yzAcikMi}
            kaynakAd={x.oneri.kaynak_id ? kaynakAdlari.get(x.oneri.kaynak_id)?.baslik : undefined}
            kategoriler={kategoriler}
            kutuphaneYetkisi={kaynakYetkisi}
            yz={x.oneri.kaynaksiz ? undefined : yzKutusu("oneri", x.oneri.id, oneriAnalizleri.get(x.oneri.id))}
            yzAnalizleri={[...tamamlanan(oneriAnalizleri.get(x.oneri.id)), ...tamamlanan(elemeAnalizleri.get(x.oneri.id))]}
            yzEleme={
              <YzElemeKutusu
                dil={dil}
                oneriId={x.oneri.id}
                analiz={elemeKutusuAnalizi(elemeAnalizleri.get(x.oneri.id))}
                gecerli={gecerliEtiket(x.oneri.id)}
                duzelten={duzeltmeler.get(x.oneri.id)?.kim_ad}
                benzer={benzerler.get(x.oneri.id) ?? []}
                acik={yzAcikMi}
                basladi={baslatilan.has(`eleme-oneri-${x.oneri.id}`)}
                yetkili={eserYetkisi}
              />
            }
          />
        ) : x.tur === "eser" ? (
          <SurumKarti
            key={`e-${x.surum.id}`}
            dil={dil}
            k={x.surum}
            eylemler={surumEylemleri}
            benimId={ben?.id}
            eserAdresi
            turEtiketi={t.surum.onayTuru.eser}
            ek={kaynakliSurumler.has(x.surum.id) ? yzKutusu("surum", x.surum.id, surumAnalizleri.get(x.surum.id)) : undefined}
            yzAnalizleri={tamamlanan(surumAnalizleri.get(x.surum.id))}
            yzAcik={yzAcikMi}
          />
        ) : (
          <article key={`k-${x.kaynak.id}`} className="katki" aria-labelledby={`kaynak-${x.kaynak.id}`}>
            <p className="katki-ust">
              <span className="tur-etiketi">{t.surum.onayTuru.kaynak}</span>
              <span className={`etiket etiket-kaynak-${x.kaynak.durum}`}>{u.durumlar[x.kaynak.durum]}</span>
              {x.kaynak.ekleyen_ad && <span>· {x.kaynak.ekleyen_ad}</span>}
              <span>· {tarih(x.kaynak.eklendi, dil)}</span>
            </p>
            <h3 id={`kaynak-${x.kaynak.id}`}>
              <Link href={`/${dil}/yonetim/kaynaklar/${x.kaynak.id}`}>{x.kaynak.baslik}</Link>
              {x.kaynak.dosya_yolu && (
                <small>
                  {" "}
                  · <Link href={`/${dil}/yonetim/kaynaklar/${x.kaynak.id}`}>{u.onizleme} →</Link>
                </small>
              )}
            </h3>
            <KaynakKunye dil={dil} kaynak={x.kaynak} />
            <KaynakDogrula dil={dil} id={x.kaynak.id} durum={x.kaynak.durum} herkeseAcik={x.kaynak.herkese_acik} />
          </article>
        ),
      )}
    </section>
  );
}
