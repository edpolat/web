import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import OnayKuyrugu, { type GosterilenKatki } from "@/components/OnayKuyrugu";
import { gecerliDil, metin } from "@/lib/metin";
import { s, type Sozluk } from "@/lib/sozluk";
import { farklar } from "@/lib/sunucu/katki";
import { katkilar } from "@/lib/sunucu/kuyruk";
import { yoneticiMi } from "@/lib/sunucu/oturum";
import type { CokDilli, Dil, Eser, Kaynak, Olgu } from "@/lib/tipler";
import { ayarlar, iller, kaynaklar } from "@/lib/veri";

export const metadata: Metadata = { robots: { index: false } };

const cokDilliMi = (x: unknown): x is CokDilli => typeof x === "object" && x !== null && typeof (x as CokDilli).tr === "string";
const iki = (m: CokDilli) => (m.en ? `TR: ${m.tr}\nEN: ${m.en}` : m.tr);

/** Kuyruktaki bir alan değerini onaylayanın okuyacağı düz metne çevirir. */
function goster(alan: string, x: unknown, dil: Dil, t: Sozluk, kaynakMap: Map<string, Kaynak>): string {
  if (x === undefined || x === null || x === "") return t.bos;
  const kaynakYazisi = (id?: string, sayfa?: string) =>
    id ? `${kaynakMap.get(id)?.baslik ?? id}${sayfa ? `, ${t.sayfa} ${sayfa}` : ""}` : "";
  const ay = ayarlar();
  if (alan === "tur") return metin(ay.eser_turleri.find((y) => y.id === x)?.ad, dil) || String(x);
  if (alan === "olgular") {
    const o = x as Olgu;
    const kategori = metin(ay.olgu_kategorileri.find((y) => y.id === o.kategori)?.ad, dil);
    return `${iki(o.metin)}\n[${kategori}] ${kaynakYazisi(o.kaynak_id, o.sayfa)}`;
  }
  if (alan === "donem") {
    const d = x as NonNullable<Eser["donem"]>;
    return [d.yapim_yili ? `${d.yaklasik ? `${t.yaklasik} ` : ""}${d.yapim_yili}` : "", d.metin ? iki(d.metin) : ""].filter(Boolean).join("\n");
  }
  if (alan === "mimari") {
    const m = x as NonNullable<Eser["mimari"]>;
    return [m.metin ? iki(m.metin) : "", m.plan ? `${t.plan}: ${m.plan}` : "", m.malzeme?.length ? `${t.malzeme}: ${m.malzeme.join(", ")}` : ""]
      .filter(Boolean)
      .join("\n") || t.bos;
  }
  if (alan === "envanter") {
    const e = x as NonNullable<Eser["envanter"]>;
    return kaynakYazisi(e.kaynak_id, e.sayfa) || t.bos;
  }
  if (typeof x === "boolean") return x ? t.evet : t.hayir;
  if (cokDilliMi(x)) return iki(x);
  return typeof x === "string" || typeof x === "number" ? String(x) : JSON.stringify(x, null, 2);
}

export default async function OnaySayfasi({ params }: { params: Promise<{ dil: string }> }) {
  const { dil } = await params;
  if (!gecerliDil(dil)) notFound();
  if (!(await yoneticiMi())) redirect(`/${dil}/yonetim`);
  const t = s(dil);
  const kaynakMap = kaynaklar();
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
