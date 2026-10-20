import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import KaynakKunye from "@/components/KaynakKunye";
import { KaynakDogrula } from "@/components/KaynakPaneli";
import OneriKarti from "@/components/OneriKarti";
import { SurumKarti, type GosterilenSurum } from "@/components/SurumListesi";
import type { KutuphaneKaynagi } from "@/lib/kaynak";
import { gecerliDil, metin } from "@/lib/metin";
import { mevcutDeger, type OneriSatiri } from "@/lib/oneri";
import { s } from "@/lib/sozluk";
import { kaynakListesi } from "@/lib/sunucu/kaynak-depo";
import { oneriler as oneriListesi } from "@/lib/sunucu/oneri-depo";
import { panelKimligi } from "@/lib/sunucu/oturum";
import { yayindakiHal } from "@/lib/sunucu/panel";
import { surumler } from "@/lib/sunucu/surum-depo";
import { surumuGoster } from "@/lib/sunucu/surum-goster";
import { ayarlar, yayindakiEserler, yayindakiKaynaklar } from "@/lib/veri";
import { izinli } from "@/lib/yetki";

export const metadata: Metadata = { robots: { index: false } };

const TURLER = ["eser", "kaynak", "oneri"] as const;
type Tur = (typeof TURLER)[number];

const hata = (h: unknown) => (h instanceof Error ? h.message : String(h));

const tarih = (iso: string, dil: string) => new Date(iso).toLocaleString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

type Kayit =
  | { tur: "eser"; zaman: string; surum: GosterilenSurum }
  | { tur: "kaynak"; zaman: string; kaynak: KutuphaneKaynagi }
  | { tur: "oneri"; zaman: string; oneri: OneriSatiri };

/**
 * Onay bekleyenler: eser düzenlemeleri ve bilgi önerileri (eser.onayla), doğrulanmamış kaynaklar (kaynak.dogrula) tek listede,
 * talep tarihine göre eskiden yeniye. ?tur=eser|kaynak|oneri türe göre süzer, ?sira=yeni sırayı çevirir.
 */
export default async function Inceleme({
  params,
  searchParams,
}: {
  params: Promise<{ dil: string }>;
  searchParams: Promise<{ tur?: string; sira?: string }>;
}) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const ben = await panelKimligi();
  const eserYetkisi = izinli(ben, "eser.onayla");
  const kaynakYetkisi = izinli(ben, "kaynak.dogrula");
  if (!eserYetkisi && !kaynakYetkisi) redirect(`/${dil}/yonetim`);
  const t = s(dil);
  const u = t.kutuphane;
  const { tur, sira } = await searchParams;
  const yeniOnce = sira === "yeni";
  const secili: Tur | undefined = TURLER.find((x) => x === tur);

  let eserler: GosterilenSurum[] | undefined;
  let eserHatasi = "";
  if (eserYetkisi) {
    try {
      const kaynakMap = await yayindakiKaynaklar();
      const bekleyen = await surumler({ durum: "incelemede" });
      eserler = await Promise.all(
        bekleyen.map(async (x) => {
          const simdi = await yayindakiHal(x.eser_id);
          const eski = x.islem === "ekle" ? undefined : simdi.eser;
          return surumuGoster(x, eski, dil, t, kaynakMap, { araDegisti: x.islem === "duzenle" && simdi.surum !== x.temel_surum });
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
  if (eserYetkisi) {
    try {
      oneriler = await oneriListesi({ durum: "bekliyor" });
    } catch (h) {
      oneriHatasi = hata(h);
    }
  }
  const eserMap = new Map((await yayindakiEserler()).map((e) => [e.id, e]));
  const kaynakAdlari = await yayindakiKaynaklar();
  const kategoriler = ayarlar().olgu_kategorileri.map((k) => ({ id: k.id, ad: metin(k.ad, dil) }));

  const sayi = { eser: eserler?.length ?? 0, kaynak: kaynaklar?.length ?? 0, oneri: oneriler?.length ?? 0 };
  const kayitlar: Kayit[] = [
    ...(!secili || secili === "eser" ? (eserler ?? []).map((x): Kayit => ({ tur: "eser", zaman: x.olusturuldu, surum: x })) : []),
    ...(!secili || secili === "kaynak" ? (kaynaklar ?? []).map((k): Kayit => ({ tur: "kaynak", zaman: k.eklendi, kaynak: k })) : []),
    ...(!secili || secili === "oneri" ? (oneriler ?? []).map((o): Kayit => ({ tur: "oneri", zaman: o.olusturuldu, oneri: o })) : []),
  ].sort((a, b) => (yeniOnce ? -1 : 1) * (Date.parse(a.zaman) - Date.parse(b.zaman)));

  const adres = (x: { tur?: Tur; sira?: string }) => {
    const q = new URLSearchParams();
    if (x.tur) q.set("tur", x.tur);
    if (x.sira) q.set("sira", x.sira);
    const yazi = q.toString();
    return `/${dil}/yonetim/inceleme${yazi ? `?${yazi}` : ""}`;
  };
  const cipler: [Tur | undefined, string, number][] = [[undefined, u.tumu, sayi.eser + sayi.kaynak + sayi.oneri]];
  if (eserYetkisi) cipler.push(["eser", t.surum.onayTurleri.eser, sayi.eser]);
  if (kaynakYetkisi) cipler.push(["kaynak", t.surum.onayTurleri.kaynak, sayi.kaynak]);
  if (eserYetkisi) cipler.push(["oneri", t.surum.onayTurleri.oneri, sayi.oneri]);
  const yeniSira = yeniOnce ? "yeni" : undefined;

  return (
    <section>
      <p>
        <Link href={`/${dil}/yonetim`}>← {t.yonetim}</Link>
      </p>
      <h1>{t.surum.inceleme}</h1>
      <p className="not">{t.surum.incelemeAciklama}</p>
      <nav className="cipler" aria-label={u.suz}>
        {cipler.map(([cipTuru, ad, n]) => (
          <Link key={ad} className="cip" aria-pressed={secili === cipTuru} href={adres({ tur: cipTuru, sira: yeniSira })}>
            {ad} ({n})
          </Link>
        ))}
      </nav>
      <p className="not">
        {t.surum.sira}:{" "}
        <Link aria-current={!yeniOnce || undefined} href={adres({ tur: secili })}>
          {t.surum.eskidenYeniye}
        </Link>
        {" · "}
        <Link aria-current={yeniOnce || undefined} href={adres({ tur: secili, sira: "yeni" })}>
          {t.surum.yenidenEskiye}
        </Link>
      </p>
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
      {kaynakHatasi && (
        <p className="hata">
          {u.tabloYok} <small>({kaynakHatasi})</small>
        </p>
      )}
      {!kayitlar.length && <p>{t.surum.hepsiOnaylandi}</p>}
      {kayitlar.map((x) =>
        x.tur === "oneri" ? (
          <OneriKarti
            key={`o-${x.oneri.id}`}
            dil={dil}
            oneri={x.oneri}
            eserAd={metin(eserMap.get(x.oneri.eser_id)?.ad, dil) || x.oneri.eser_id}
            mevcut={mevcutDeger(eserMap.get(x.oneri.eser_id), x.oneri.alan)}
            kaynakAd={x.oneri.kaynak_id ? kaynakAdlari.get(x.oneri.kaynak_id)?.baslik : undefined}
            kategoriler={kategoriler}
            kutuphaneYetkisi={kaynakYetkisi}
          />
        ) : x.tur === "eser" ? (
          <SurumKarti key={`e-${x.surum.id}`} dil={dil} k={x.surum} eylemler={["karar"]} eserAdresi turEtiketi={t.surum.onayTuru.eser} />
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
