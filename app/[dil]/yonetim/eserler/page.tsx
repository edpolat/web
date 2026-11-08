import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { adSirala, gecerliDil, metin } from "@/lib/metin";
import { donemYuzyili } from "@/lib/filtre";
import { s } from "@/lib/sozluk";
import { panelKimligi } from "@/lib/sunucu/oturum";
import { surumler, yayindakiSurumler } from "@/lib/sunucu/surum-depo";
import type { Eser } from "@/lib/tipler";
import { ayarlar, yayindakiIller } from "@/lib/veri";
import { izinli, paneldeMi } from "@/lib/yetki";
import { Cip, DurumNoktasi, PanelBaslik, PanelSimge, YuvarlakDugme } from "@/components/PanelTablo";
import PanelTablo, { type PanelSatir } from "@/components/PanelTabloGovde";

export const metadata: Metadata = { robots: { index: false } };

const DURUMLAR = ["yayinda", "taslak", "incelemede", "arsivlendi"] as const;
const GOSTERILEN = 200;

type Arama = { q?: string; durum?: string; tur?: string; il?: string; donem?: string; gonderildi?: string };
type Satir = { eser: Eser; il: string; arsivde: boolean; incelemede: boolean };

const yuzyil = (e: Eser) => donemYuzyili(e.donem);

/** Paneldeki eser listesi: durum, kategori, bölge ve döneme göre süzülür; adla, banisiyle ya da kimlikle aranır. */
export default async function Eserler({ params, searchParams }: { params: Promise<{ dil: string }>; searchParams: Promise<Arama> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  const ben = await panelKimligi();
  if (!paneldeMi(ben)) redirect(`/${dil}/yonetim`);
  const t = s(dil);
  const p = t.pano;
  const a = await searchParams;

  const [iller, yayindakiler, bekleyen] = await Promise.all([
    yayindakiIller(),
    yayindakiSurumler(),
    // Onay bekleyen: tarihçide ya da editörde.
    Promise.all([surumler({ durum: "incelemede" }), surumler({ durum: "editorde" })])
      .then(([x, y]) => [...x, ...y])
      .catch(() => []),
  ]);
  const incelemede = new Set(bekleyen.map((x) => x.eser_id));
  const ilAdi = new Map(iller.map(({ il }) => [il.id, metin(il.ad, dil)]));
  const satirlar: Satir[] = [
    ...iller.flatMap(({ il, eserler }) => eserler.map((eser) => ({ eser, il: il.id, arsivde: false, incelemede: incelemede.has(eser.id) }))),
    ...[...yayindakiler.values()]
      .filter((x) => x.arsivlendi)
      .map((x) => ({ eser: { ...x.veri, id: x.eser_id }, il: x.il, arsivde: true, incelemede: incelemede.has(x.eser_id) })),
  ];
  const yuzyillar = [...new Set(satirlar.map((x) => yuzyil(x.eser)).filter((y): y is number => !!y))].sort((x, y) => x - y);
  const turler = ayarlar().eser_turleri;

  const q = (a.q ?? "").trim().toLocaleLowerCase("tr");
  const uyan = satirlar
    .filter((x) => {
      const e = x.eser;
      if (a.durum === "arsivlendi" && !x.arsivde) return false;
      if (a.durum === "yayinda" && (x.arsivde || e.taslak)) return false;
      if (a.durum === "taslak" && (x.arsivde || !e.taslak)) return false;
      if (a.durum === "incelemede" && !x.incelemede) return false;
      if (a.tur && e.tur !== a.tur) return false;
      if (a.il && x.il !== a.il) return false;
      if (a.donem === "yok" ? yuzyil(e) !== undefined : a.donem && String(yuzyil(e)) !== a.donem) return false;
      if (q && !`${e.ad.tr} ${e.ad.en ?? ""} ${e.banisi ?? ""} ${e.id} ${e.ilce ?? ""}`.toLocaleLowerCase("tr").includes(q)) return false;
      return true;
    })
    .sort((x, y) => adSirala(x.eser.ad.tr, y.eser.ad.tr));

  const duzenleyebilir = izinli(ben, "eser.duzenle");
  const sayac: Record<(typeof DURUMLAR)[number], number> = {
    yayinda: satirlar.filter((x) => !x.arsivde && !x.eser.taslak).length,
    taslak: satirlar.filter((x) => !x.arsivde && x.eser.taslak).length,
    incelemede: satirlar.filter((x) => x.incelemede).length,
    arsivlendi: satirlar.filter((x) => x.arsivde).length,
  };
  const durumu = (x: Satir) => (x.arsivde ? "arsivlendi" : x.eser.taslak ? "taslak" : "yayinda") as "arsivlendi" | "taslak" | "yayinda";
  const DURUM_RENGI = { yayinda: "yesil", taslak: "gri", arsivlendi: "gri" } as const;
  const DURUM_SIMGESI = { yayinda: "durum", taslak: "sayfa", incelemede: "belge", arsivlendi: "kitap" } as const;
  // Hap bağlantıları öteki süzgeçleri korur.
  const adres = (ek: Partial<Arama>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: a.q, tur: a.tur, il: a.il, donem: a.donem, ...ek })) if (v) q.set(k, v);
    const metinQ = q.toString();
    return metinQ ? `?${metinQ}` : "?";
  };
  const digerAcik = !!(a.tur || a.il || a.donem);
  const tabloSatirlari: PanelSatir[] = uyan.slice(0, GOSTERILEN).map((x) => {
    const { eser: e, il, arsivde, incelemede: bekliyor } = x;
    const ad = metin(e.ad, dil);
    const d = durumu(x);
    const yer = [ilAdi.get(il), e.ilce].filter(Boolean).join(", ");
    const kategori = metin(turler.find((y) => y.id === e.tur)?.ad, dil) || e.tur;
    const yil = e.donem?.yapim_yili ?? (e.donem?.metin ? metin(e.donem.metin, dil) : "—");
    return {
      id: e.id,
      hucreler: [
        <div key="a" className="pt-islem">
          {duzenleyebilir && !arsivde ? <Link href={`/${dil}/yonetim/eser/${e.id}`}>{ad}</Link> : <b>{ad}</b>}
          <small className="pt-kimlik" title={e.id}>
            {e.id}
          </small>
        </div>,
        yer ? (
          <Cip key="y" simge="harita">
            {yer}
          </Cip>
        ) : (
          "—"
        ),
        kategori,
        <span key="yl" className="pt-sayi">
          {yil}
        </span>,
        <DurumNoktasi
          key="d"
          renk={DURUM_RENGI[d]}
          alt={bekliyor ? <Link href={`/${dil}/yonetim/inceleme?tur=eser`}>{p.durumlar.incelemede}</Link> : undefined}
        >
          {p.durumlar[d]}
        </DurumNoktasi>,
      ],
      eylem: (
        <>
          {duzenleyebilir && !arsivde && <YuvarlakDugme href={`/${dil}/yonetim/eser/${e.id}`} simge="duzenle" etiket={`${p.duzenle}: ${ad}`} />}
          <YuvarlakDugme href={`/${dil}/yonetim/eser/${e.id}/gecmis`} simge="gecmis" etiket={`${p.gecmis}: ${ad}`} />
          {!arsivde && !e.taslak && <YuvarlakDugme href={`/${dil}/eser/${e.id}`} simge="sitede" etiket={`${p.sitede}: ${ad}`} yeniSekme />}
        </>
      ),
      sira: [ad, yer, kategori, typeof e.donem?.yapim_yili === "number" ? e.donem.yapim_yili : String(yil === "—" ? "" : yil), p.durumlar[d]],
    };
  });
  return (
    <section>
      <PanelBaslik simge="cami" baslik={p.eserler} alt={p.eserlerAciklama}>
        {izinli(ben, "eser.ekle") && (
          <Link className="dugme" href={`/${dil}/yonetim/eser/yeni`}>
            + {t.yeniEser}
          </Link>
        )}
      </PanelBaslik>
      {a.gonderildi && (
        <p className="uyari" role="status">
          {t.surum.incelemeyeGitti}
        </p>
      )}
      <PanelTablo
        dil={dil}
        sutunlar={[
          { ad: p.ad, simge: "cami" },
          { ad: p.yer, simge: "harita" },
          { ad: p.kategori, simge: "etiket" },
          { ad: p.yil, simge: "takvim" },
          { ad: p.durum, simge: "durum" },
        ]}
        satirlar={tabloSatirlari}
        haplar={([["", p.tumu, satirlar.length, "liste"], ...DURUMLAR.map((d) => [d, p.durumlar[d], sayac[d], DURUM_SIMGESI[d]] as const)] as const).map(
          ([d, ad, n, simge]) => ({ ad, simge, sayi: n, href: adres({ durum: d || undefined }), secili: (a.durum ?? "") === d }),
        )}
        araForm={{ ad: "q", deger: a.q ?? "", gizli: { durum: a.durum, tur: a.tur, il: a.il, donem: a.donem } }}
        ekAlan={
          <details className="pt-diger" open={digerAcik}>
            <summary>
              <PanelSimge ad="suzgec" />
              {t.tablo.digerSuzgecler}
            </summary>
            <form className="panel-filtre" method="get">
              {a.q && <input type="hidden" name="q" value={a.q} />}
              {a.durum && <input type="hidden" name="durum" value={a.durum} />}
              <label>
                {p.kategori}
                <select name="tur" defaultValue={a.tur ?? ""}>
                  <option value="">{p.tumu}</option>
                  {turler.map((x) => (
                    <option key={x.id} value={x.id}>
                      {metin(x.ad, dil)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {p.bolge}
                <select name="il" defaultValue={a.il ?? ""}>
                  <option value="">{p.tumu}</option>
                  {[...ilAdi].map(([id, ad]) => (
                    <option key={id} value={id}>
                      {ad}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {p.donem}
                <select name="donem" defaultValue={a.donem ?? ""}>
                  <option value="">{p.tumu}</option>
                  {yuzyillar.map((y) => (
                    <option key={y} value={y}>
                      {p.yuzyil(y)}
                    </option>
                  ))}
                  <option value="yok">{p.donemsiz}</option>
                </select>
              </label>
              <div className="dugmeler">
                <button type="submit" className="ikincil">
                  {p.filtrele}
                </button>
              </div>
            </form>
          </details>
        }
        birim={t.tablo.birim.eser}
        altEk={uyan.length > GOSTERILEN ? <small>· {p.ilkleri(GOSTERILEN)}</small> : undefined}
        bos={
          <>
            {p.sayi(0, satirlar.length)} <Link href="?">{p.tumu}</Link>
          </>
        }
        genis
      />
    </section>
  );
}
