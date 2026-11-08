import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bolum } from "@/components/IncelemeBolum";
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
import { kucukGorsel } from "@/lib/gorsel";
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
/** YZ etiketi menüsündeki sıra: olumludan olumsuza. */
const ETIKET_SIRASI = ["degerli", "benzer", "mevcut_bilgiyle_celisiyor", "mevcut_bilgiyle_ayni", "kaynaksiz", "kaynak_alakasiz", "anlamsiz", "spam"] as const;

export default async function Inceleme({
  params,
  searchParams,
}: {
  params: Promise<{ dil: string }>;
  searchParams: Promise<{ tur?: string; sira?: string; etiket?: string; sec?: string }>;
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
  const { tur, sira, etiket, sec } = await searchParams;
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
      key={`yz-${tur}-${id}`}
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

  const adres = (x: { tur?: Tur; sira?: string; etiket?: string; sec?: string }) => {
    const q = new URLSearchParams();
    if (x.tur && !x.etiket) q.set("tur", x.tur);
    if (x.sira) q.set("sira", x.sira);
    if (x.etiket) q.set("etiket", x.etiket);
    if (x.sec) q.set("sec", x.sec);
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
  const ib = t.surum.ib;
  const siraSecenekleri: [string | undefined, string][] = [
    [undefined, t.surum.eskidenYeniye],
    ["yeni", t.surum.yenidenEskiye],
    ...(eserYetkisi ? ([["oncelik", y.siraOncelik]] as [string, string][]) : []),
  ];

  // Aşamalar (üst bant) ve aşama sütunları: danışmanda = tarihçideki sürümler + öneriler; editörde = editördeki sürümler.
  const asamaSayisi = {
    danisman: (eserler ?? []).filter((x) => x.durum === "incelemede").length + sayi.oneri,
    editor: (eserler ?? []).filter((x) => x.durum === "editorde").length,
    kaynak: sayi.kaynak,
    talep: sayi.talep,
  };
  type Sutun = keyof typeof asamaSayisi;
  const sutunu = (x: Kayit): Sutun =>
    x.tur === "eser" ? (x.surum.durum === "editorde" ? "editor" : "danisman") : x.tur === "oneri" ? "danisman" : x.tur === "kaynak" ? "kaynak" : "talep";
  // Dört sütun hep görünür; kişinin yetkisi olmayan aşamanın sütunu boş kalır (sayısı okunmaz, "—").
  const sutunlar: Sutun[] = ["danisman", "editor", "kaynak", "talep"];
  const yetkili: Record<Sutun, boolean> = { danisman: tarihciYetkisi, editor: editorYetkisi, kaynak: kaynakYetkisi, talep: tarihciYetkisi };
  const anahtar = (x: Kayit) =>
    x.tur === "eser" ? `e-${x.surum.id}` : x.tur === "oneri" ? `o-${x.oneri.id}` : x.tur === "kaynak" ? `k-${x.kaynak.id}` : `t-${x.talep.id}`;
  const secilen = kayitlar.find((x) => anahtar(x) === sec) ?? kayitlar[0];
  const rol =
    tarihciYetkisi && editorYetkisi ? ib.rol.ikisi : tarihciYetkisi ? ib.rol.danisman : editorYetkisi ? ib.rol.editor : ib.rol.kaynak;
  const ne = (iso: string) => {
    const dk = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    return dk < 60 ? ib.once.dk(dk) : dk < 60 * 24 ? ib.once.sa(Math.round(dk / 60)) : ib.once.gun(Math.round(dk / 1440));
  };
  const eserAdi = (id: string, yedek?: string | null) => metin(eserMap.get(id)?.ad, dil) || yedek || id;
  const basliklar = { eser: ib.eser, bilgi: ib.bilgi, karar: ib.karar };

  /** Seçili işin aşama adımları: [ad, alt yazı][] ve şu anki adımın sırası. */
  const surecAdimlari = (x: Kayit): { adimlar: [string, string][]; simdi: number } => {
    if (x.tur === "kaynak")
      return {
        adimlar: [
          [ib.adim.eklendi, [x.kaynak.ekleyen_ad, tarih(x.kaynak.eklendi, dil)].filter(Boolean).join(" · ")],
          [ib.adim.dogrulama, ib.simdi],
          [ib.adim.kutuphanede, "—"],
        ],
        simdi: 1,
      };
    if (x.tur === "talep")
      return {
        adimlar: [
          [ib.adim.gonderildi, [x.talep.gonderen_ad, tarih(x.talep.olusturuldu, dil)].filter(Boolean).join(" · ")],
          [ib.adim.inceleme, ib.simdi],
          [ib.adim.sonuc, "—"],
        ],
        simdi: 1,
      };
    const kim = x.tur === "eser" ? x.surum.ekleyen : x.oneri.kullanici_ad;
    const simdi = x.tur === "eser" && x.surum.durum === "editorde" ? 2 : 1;
    return {
      adimlar: [
        [ib.adim.gonderildi, [kim, tarih(x.zaman, dil)].filter(Boolean).join(" · ")],
        [ib.adim.danisman, simdi === 1 ? ib.simdi : (x.tur === "eser" && x.surum.tarihci) || "✓"],
        [ib.adim.editor, simdi === 2 ? ib.simdi : ib.sirada],
        [ib.adim.sitede, "—"],
      ],
      simdi,
    };
  };

  /** Sol sütun: seçili işin YZ çıktısı. */
  const yzSutunu = (x: Kayit) => {
    if (x.tur === "eser")
      return kaynakliSurumler.has(x.surum.id) ? yzKutusu("surum", x.surum.id, surumAnalizleri.get(x.surum.id)) : <p className="ib-yz-bos">{ib.yzYok}</p>;
    if (x.tur === "oneri")
      return (
        <>
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
          {x.oneri.kaynaksiz ? <p className="ib-yz-bos">{ib.yzKaynaksiz}</p> : yzKutusu("oneri", x.oneri.id, oneriAnalizleri.get(x.oneri.id))}
        </>
      );
    return <p className="ib-yz-bos">{ib.yzYok}</p>;
  };

  /** Sağ sütun: seçili işin kartı, Eser / Bilgi / Karar bölümleriyle. */
  const kart = (x: Kayit) =>
    x.tur === "talep" ? (
      <TalepKarti
        key={`t-${x.talep.id}`}
        dil={dil}
        talep={x.talep}
        eserAd={eserAdi(x.talep.eser_id, x.talep.eser_adi)}
        duzenleyebilir={izinli(ben, "eser.duzenle") && eserMap.has(x.talep.eser_id)}
        panel={basliklar}
      />
    ) : x.tur === "oneri" ? (
      <OneriKarti
        key={`o-${x.oneri.id}`}
        dil={dil}
        oneri={x.oneri}
        eserAd={eserAdi(x.oneri.eser_id)}
        mevcut={mevcutDeger(eserMap.get(x.oneri.eser_id), x.oneri.alan)}
        mevcutMetin={mevcutMetinler(eserMap.get(x.oneri.eser_id))}
        yzAcik={yzAcikMi}
        kaynakAd={x.oneri.kaynak_id ? kaynakAdlari.get(x.oneri.kaynak_id)?.baslik : undefined}
        kategoriler={kategoriler}
        kutuphaneYetkisi={kaynakYetkisi}
        yzAnalizleri={[...tamamlanan(oneriAnalizleri.get(x.oneri.id)), ...tamamlanan(elemeAnalizleri.get(x.oneri.id))]}
        panel={basliklar}
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
        yzAnalizleri={tamamlanan(surumAnalizleri.get(x.surum.id))}
        yzAcik={yzAcikMi}
        panel={basliklar}
      />
    ) : (
      <article key={`k-${x.kaynak.id}`} className="katki ib-kart" aria-labelledby={`kaynak-${x.kaynak.id}`}>
        <Bolum baslik={ib.kaynak}>
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
        </Bolum>
        <Bolum baslik={ib.bilgi}>
          <KaynakKunye dil={dil} kaynak={x.kaynak} />
        </Bolum>
        <Bolum baslik={ib.karar} sinif="ib-karar">
          <KaynakDogrula dil={dil} id={x.kaynak.id} durum={x.kaynak.durum} herkeseAcik={x.kaynak.herkese_acik} />
        </Bolum>
      </article>
    );

  /** Aşama sütunundaki kart: eserin kapak fotoğrafı ve ili, tür etiketi, aşama çubuğu, YZ etiketi. */
  const isKarti = (x: Kayit) => {
    const eserId = x.tur === "eser" ? x.surum.eserId : x.tur === "oneri" ? x.oneri.eser_id : x.tur === "talep" ? x.talep.eser_id : undefined;
    const e = eserId ? eserMap.get(eserId) : undefined;
    const g = e?.gorseller?.[0];
    const ilId = e?.il ?? (x.tur === "eser" ? x.surum.il : undefined);
    const ilAdi = ilId ? ilId.charAt(0).toLocaleUpperCase("tr-TR") + ilId.slice(1) : "";
    const fotoSayisi = x.tur === "talep" ? x.talep.foto_yollari.length : 0;
    const [tur, ad, kim] =
      x.tur === "eser"
        ? [t.surum.onayTuru.eser, x.surum.eser, x.surum.ekleyen]
        : x.tur === "oneri"
          ? [t.surum.onayTuru.oneri, eserAdi(x.oneri.eser_id), x.oneri.kullanici_ad ?? ""]
          : x.tur === "kaynak"
            ? [x.kaynak.dosya_yolu ? ib.pdfEkli : t.surum.onayTuru.kaynak, x.kaynak.baslik, x.kaynak.ekleyen_ad ?? ""]
            : [t.surum.onayTuru.talep, eserAdi(x.talep.eser_id, x.talep.eser_adi), x.talep.gonderen_ad ?? ""];
    const etiketler = x.tur === "oneri" ? (gecerliEtiket(x.oneri.id)?.etiketler ?? []) : [];
    const spam = etiketler.includes("spam");
    const yzEtiket = etiketler[0];
    // Aşama çubuğu (yalnız iki aşamalı işler): danışmanda yarı, editörde dörtte üç.
    const ilerleme = x.tur === "eser" ? (x.surum.durum === "editorde" ? 75 : 50) : x.tur === "oneri" ? 50 : undefined;
    return (
      <li key={anahtar(x)}>
        <Link
          className={`ib-is ib-is-${x.tur}${spam ? " ib-is-soluk" : ""}`}
          aria-current={x === secilen || undefined}
          href={adres({ tur: secili, sira: yeniSira, etiket: seciliEtiket, sec: anahtar(x) })}
          scroll={false}
        >
          {eserId && !spam && (
            <span className="ib-is-foto" style={g ? { backgroundImage: `url("${kucukGorsel(g.dosya)}")`, backgroundPosition: g.odak } : undefined}>
              <span>
                {ilAdi}
                {fotoSayisi > 0 && ` · ${ib.foto(fotoSayisi)}`}
              </span>
            </span>
          )}
          <span className="ib-is-ic">
            <span className={`ib-rozet ib-r-${spam ? "spam" : x.tur}`}>{spam ? `${ib.yzKisa}: ${y.etiketler.spam}` : tur}</span>
            <span className="ib-is-ad">{ad}</span>
            {ilerleme !== undefined && !spam && (
              <span className="ib-is-cubuk" aria-hidden="true">
                <b style={{ width: `${ilerleme}%` }} />
              </span>
            )}
            <span className="ib-is-alt">
              {yzEtiket && !spam ? (
                <span className={`ib-rozet ib-r-yz-${yzEtiket === "degerli" ? "iyi" : "notr"}`}>
                  {ib.yzKisa}: {y.etiketler[yzEtiket]}
                </span>
              ) : (
                <span>{kim}</span>
              )}
              <span>{ne(x.zaman)}</span>
            </span>
          </span>
        </Link>
      </li>
    );
  };

  const surec = secilen && surecAdimlari(secilen);

  return (
    <section className="ib-sayfa">
      <header className="ib-bant">
        <div>
          <h1>{t.surum.inceleme}</h1>
          <p>
            {ib.rolun}: <b>{rol}</b> · {ib.kural}
          </p>
        </div>
        <ul className="ib-asamalar">
          {sutunlar.map((x) => (
            <li key={x}>
              <b>{yetkili[x] ? asamaSayisi[x] : "—"}</b>
              <span>{ib.asamalar[x]}</span>
            </li>
          ))}
        </ul>
      </header>

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
      {!kayitlar.length && <p className="ib-hepsi">{t.surum.hepsiOnaylandi}</p>}

      {secilen && surec && (
        <div className="ib-masa" id="secili">
          <aside className="ib-yz" aria-label={ib.yzBaslik}>
            <p className="ib-serit">{ib.yzBaslik}</p>
            <div className="ib-yz-ic">{yzSutunu(secilen)}</div>
          </aside>
          <div className="ib-sag">
            <Bolum baslik={ib.surec}>
              <ol className="ib-surec">
                {surec.adimlar.map(([ad, alt], i) => (
                  <li key={ad} className={i < surec.simdi ? "gecti" : i === surec.simdi ? "simdi" : undefined} aria-current={i === surec.simdi ? "step" : undefined}>
                    <b>{i < surec.simdi ? "✓" : i + 1}</b>
                    {ad}
                    <small>{alt}</small>
                  </li>
                ))}
              </ol>
            </Bolum>
            {kart(secilen)}
          </div>
        </div>
      )}

      <div className="ib-pano-ust">
        <h2>{ib.siradaki}</h2>
        <div className="ib-filtre-satiri">
          <nav className="cipler" aria-label={u.suz}>
            {cipler.map(([cipTuru, ad, n]) => (
              <Link key={ad} className="cip" aria-pressed={!seciliEtiket && secili === cipTuru} href={adres({ tur: cipTuru, sira: yeniSira })}>
                {ad} ({n})
              </Link>
            ))}
          </nav>
          <div className="ib-menuler">
            <details className="ib-menu" key={`sira-${yeniSira ?? "eski"}`}>
              <summary>
                {y.sirala} <small>· {oncelikle ? y.siraOncelik : yeniOnce ? t.surum.yenidenEskiye : t.surum.eskidenYeniye}</small>
              </summary>
              <div className="ib-menu-ic" role="menu" aria-label={t.surum.sira}>
                {siraSecenekleri.map(([deger, ad]) => (
                  <Link key={ad} role="menuitemradio" aria-checked={yeniSira === deger} href={adres({ tur: secili, sira: deger, etiket: seciliEtiket })}>
                    {ad}
                  </Link>
                ))}
              </div>
            </details>
            {eserYetkisi && (oneriler?.length ?? 0) > 0 && (
              <details className="ib-menu" key={`etiket-${seciliEtiket ?? "hepsi"}`}>
                <summary>
                  {y.etiketSuz} <small>· {seciliEtiket ? y.etiketler[seciliEtiket] : u.tumu}</small>
                </summary>
                <div className="ib-menu-ic" role="menu" aria-label={y.etiketSuz}>
                  <Link role="menuitemradio" aria-checked={!seciliEtiket} href={adres({ tur: secili, sira: yeniSira })}>
                    {u.tumu}
                  </Link>
                  {ETIKET_SIRASI.map((e) => (
                    <Link key={e} role="menuitemradio" aria-checked={seciliEtiket === e} href={adres({ sira: yeniSira, etiket: e })}>
                      {y.etiketler[e]} <span className="ib-menu-n">{etiketSayilari.get(e) ?? 0}</span>
                    </Link>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
        {(etiketSayilari.get("spam") ?? 0) > 0 && <p className="not">{y.spamNot}</p>}
      </div>
      <div className="ib-pano-sar">
        <div className="ib-pano" style={{ ["--ib-sutun" as string]: String(sutunlar.length) }}>
          {sutunlar.map((sutun) => {
            const isler = kayitlar.filter((x) => sutunu(x) === sutun);
            return (
              <section key={sutun} className="ib-sutun" aria-label={ib.sutunlar[sutun]}>
                <p className="ib-sutun-bas">
                  {ib.sutunlar[sutun]} <b>{yetkili[sutun] ? isler.length : "—"}</b>
                </p>
                {isler.length ? <ul>{isler.map(isKarti)}</ul> : <p className="ib-sutun-bos">{yetkili[sutun] ? ib.bos : ib.yetkiDisi}</p>}
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
