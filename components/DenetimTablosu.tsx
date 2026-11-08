import { Cip, IslemMetni, Kisi, YuvarlakDugme, Zaman, type SimgeAdi } from "@/components/PanelTablo";
import PanelTablo, { type PanelHap, type PanelSatir } from "@/components/PanelTabloGovde";
import { s } from "@/lib/sozluk";
import { goster } from "@/lib/sunucu/goster";
import { kimlikMi, type DenetimSatiri } from "@/lib/sunucu/surum-depo";
import type { Sozluk } from "@/lib/sozluk";
import type { Dil, Kaynak } from "@/lib/tipler";

type Nesne = Record<string, unknown>;
const nesne = (x: unknown): Nesne => (typeof x === "object" && x !== null ? (x as Nesne) : {});

/** "surum #3" / "kaynak #5" / "oneri #7" → "Eser düzenlemesi #3" gibi. */
function yzHedefi(alan: string | null, t: Sozluk): string {
  const [tur, no] = (alan ?? "").split(" #");
  const ad = t.surum.onayTuru[(tur === "surum" ? "eser" : tur) as keyof typeof t.surum.onayTuru];
  return ad ? `${ad}${no ? ` #${no}` : ""}` : alan ?? "";
}

/** YZ etiket/öncelik nesnesi → "Spam, Kaynaksız · Düşük öncelik". */
function etiketYazisi(x: unknown, t: Sozluk): string {
  const o = nesne(x);
  const etiketler = Array.isArray(o.etiketler) ? o.etiketler.map((e) => t.yz.etiketler[String(e)] ?? String(e)) : [];
  const oncelik = typeof o.oncelik === "string" ? t.yz.oncelikler[o.oncelik] ?? o.oncelik : "";
  return [etiketler.join(", ") || t.yz.etiketYok, oncelik].filter(Boolean).join(" · ");
}

/** Saklanan YZ sonucunu (kaynak analizi ya da ön eleme) düz cümleye çevirir. */
function yzSonucu(x: unknown, t: Sozluk): string {
  const o = nesne(x);
  const y = t.yz;
  const aciklama = typeof o.aciklama === "string" ? o.aciklama.trim() : "";
  if (o.metin === "kaynak_yok") return `${y.okunamadi}. ${y.kaynakYok}`;
  if (o.metin === "okunamadi") {
    const neden = aciklama.replace(/^Metin okunamadı, manuel inceleme gerekli\.?\s*/, "");
    return `${y.okunamadi}.${neden ? ` ${neden}` : ""}`;
  }
  if (typeof o.sonuc === "string") {
    const parca = [y.sonuclar[o.sonuc] ?? o.sonuc];
    if (typeof o.guven === "string" && y.guven[o.guven]) parca.push(y.guven[o.guven]);
    if (o.pasaj_dogrulandi === false) parca.push(y.dogrulanamadiKisa);
    return `${parca.join(", ")}.${aciklama ? ` ${aciklama}` : ""}`;
  }
  if (Array.isArray(o.etiketler)) {
    const gerekce = typeof o.gerekce === "string" ? o.gerekce.trim() : "";
    return `${etiketYazisi(o, t)}.${gerekce ? ` ${gerekce}` : ""}`;
  }
  return aciklama || y.yapilamadi;
}

/** Gerekçenin sonundaki "X onayladı/reddetti" kısmından editör kararı. */
const yzKarar = (gerekce: string | null, t: Sozluk) =>
  gerekce?.trim().endsWith("reddetti") ? t.yz.kararlar.reddetti : gerekce?.trim().endsWith("onayladı") ? t.yz.kararlar.onayladi : null;

/** Hedef bağlantısından simge: eser, kaynak, il, sergi ya da kişi. */
function hedefSimgesi(yol?: string): SimgeAdi {
  if (!yol) return "kisi";
  if (yol.includes("/eser/")) return "cami";
  if (yol.includes("/kaynaklar/")) return "kitap";
  if (yol.includes("/iller")) return "harita";
  if (yol.includes("/sergiler")) return "katman";
  return "kisi";
}

/** En sık geçen değerler (hap süzgeci için). */
function enSik(liste: string[], n: number): string[] {
  const say = new Map<string, number>();
  for (const x of liste) if (x) say.set(x, (say.get(x) ?? 0) + 1);
  return [...say].sort((a, b) => b[1] - a[1]).slice(0, n).map(([x]) => x);
}

/**
 * Denetim kaydı tablosu (ortak panel tablosu): zaman, kim, işlem ve alan alan eski → yeni. hedefler verilirse "Hedef" sütunu da çıkar
 * (eser adı ya da kaynak başlığı, kendi sayfasına bağlı; kullanıcıysa adı). Adı bulunamayan kullanıcı kimliği kısaltılır.
 * suzgec: "kisiHedef" en sık kişi ve hedefleri, "islem" işlem türlerini hap olarak gösterir.
 */
export default function DenetimTablosu({
  dil,
  kayitlar,
  kaynakMap,
  hedefler,
  suzgec = "kisiHedef",
}: {
  dil: Dil;
  kayitlar: DenetimSatiri[];
  kaynakMap: Map<string, Kaynak>;
  hedefler?: Map<string, { ad: string; yol?: string }>;
  suzgec?: "kisiHedef" | "islem";
}) {
  const t = s(dil);
  const u = t.surum;
  if (!kayitlar.length) return <p>{u.hicYok}</p>;
  const hedefAdi = (k: DenetimSatiri) => {
    const h = k.hedef ? hedefler?.get(k.hedef) : undefined;
    return h ? h.ad : k.hedef && kimlikMi(k.hedef) ? `${k.hedef.slice(0, 8)}…` : (k.hedef ?? "");
  };
  const alanAdi = (alan: string) => (alan === "rol" ? t.panel.rol : (t.alanlar[alan] ?? t.oneri.alanlar[alan] ?? alan));

  const satirlar: PanelSatir[] = kayitlar.map((k) => {
    const hedef = k.hedef ? hedefler?.get(k.hedef) : undefined;
    const islemAdi = u.denetimIslem[k.islem as keyof typeof u.denetimIslem] ?? k.islem;
    let baslik: string;
    let aciklama: string[] = [];
    let durum: string | null = null;
    if (k.islem === "yz_onerisi") {
      baslik = `${u.denetimIslem.yz_onerisi} · ${yzHedefi(k.alan, t)}`;
      aciklama = [yzSonucu(k.yeni, t)];
      durum = yzKarar(k.gerekce, t);
    } else if (k.islem === "yz_etiket_duzelt") {
      baslik = `${u.denetimIslem.yz_etiket_duzelt} · ${yzHedefi(k.alan, t)}`;
      aciklama = [`${etiketYazisi(k.eski, t)} → ${etiketYazisi(k.yeni, t)}`];
    } else {
      baslik = k.alan ? `${islemAdi} · ${alanAdi(k.alan)}` : islemAdi;
      if (k.alan) aciklama.push(`${goster(k.alan, k.eski, dil, t, kaynakMap).slice(0, 200)} → ${goster(k.alan, k.yeni, dil, t, kaynakMap).slice(0, 200)}`);
      if (k.gerekce) aciklama.push(`${u.gerekce}: ${k.gerekce}`);
    }
    const hAd = hedefAdi(k);
    return {
      id: k.id,
      hucreler: [
        <Zaman key="z" iso={k.ne_zaman} dil={dil} />,
        <Kisi key="k" ad={k.kim_ad} />,
        ...(hedefler
          ? [
              hAd ? (
                <Cip key="h" simge={hedefSimgesi(hedef?.yol)} href={hedef?.yol} title={k.hedef ?? undefined}>
                  {hAd}
                </Cip>
              ) : null,
            ]
          : []),
        <IslemMetni
          key="i"
          baslik={baslik}
          aciklama={aciklama.length ? aciklama.map((x, i) => (i ? [<br key={i} />, x] : x)) : undefined}
          durum={durum}
          durumRengi={durum === t.yz.kararlar.onayladi ? "yesil" : "kirmizi"}
        />,
      ],
      eylem: hedef?.yol ? <YuvarlakDugme href={hedef.yol} etiket={t.tablo.ac} /> : undefined,
      sira: [k.ne_zaman, k.kim_ad ?? "", ...(hedefler ? [hAd] : []), baslik],
      ara: `${k.kim_ad ?? ""} ${hAd} ${baslik} ${aciklama.join(" ")} ${durum ?? ""}`,
      grup: [`kim:${k.kim_ad ?? ""}`, `hedef:${k.hedef ?? ""}`, `islem:${k.islem}`],
    };
  });

  const haplar: PanelHap[] = [{ ad: suzgec === "islem" ? t.tablo.tumu : t.tablo.tumDegisiklikler, simge: "liste", deger: "", secili: true }];
  if (suzgec === "islem") {
    for (const islem of enSik(kayitlar.map((k) => k.islem), 4))
      haplar.push({ ad: u.denetimIslem[islem as keyof typeof u.denetimIslem] ?? islem, simge: islem.startsWith("yz") ? "yz" : islem === "rol" ? "rol" : "duzenle", deger: `islem:${islem}` });
  } else {
    for (const kim of enSik(kayitlar.map((k) => k.kim_ad ?? ""), 1)) haplar.push({ ad: kim, simge: "kisi", deger: `kim:${kim}` });
    if (hedefler)
      for (const h of enSik(kayitlar.map((k) => k.hedef ?? ""), 2)) {
        const ad = hedefAdi({ hedef: h } as DenetimSatiri);
        if (ad) haplar.push({ ad, simge: hedefSimgesi(hedefler.get(h)?.yol), deger: `hedef:${h}` });
      }
  }

  return (
    <PanelTablo
      dil={dil}
      sutunlar={[
        { ad: u.zaman, simge: "takvim" },
        { ad: u.kim, simge: "kisi" },
        ...(hedefler ? [{ ad: t.pano.hedef, simge: "katman" as const }] : []),
        { ad: u.ne, simge: "belge" },
      ]}
      satirlar={satirlar}
      haplar={haplar.length > 1 ? haplar : undefined}
      ara=""
      birim={t.tablo.birim.degisiklik}
      genis
      ilkSira={{ sutun: 0, yon: -1 }}
    />
  );
}
