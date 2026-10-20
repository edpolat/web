import type { KutuphaneKaynagi } from "@/lib/kaynak";
import type { Dil } from "@/lib/tipler";
import { s } from "@/lib/sozluk";

const tarih = (iso: string, dil: string) => new Date(iso).toLocaleString(dil === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

/** Kaynağın bütün bilgileri etiketli liste olarak; boş alanlar "—". */
export default function KaynakKunye({ dil, kaynak: k }: { dil: Dil; kaynak: KutuphaneKaynagi }) {
  const t = s(dil);
  const u = t.kutuphane;
  return (
  <dl className="kunye">
    {(
      [
        [u.kaynakBaslik, k.baslik],
        [u.tur, u.turler[k.tur]],
        [u.kaynakTuru, u.kaynakTurleri[k.kaynak_turu]],
        [u.nitelik, u.nitelikler[k.nitelik]],
        [u.yazar, k.yazar],
        [u.yayinci, k.yayinci],
        [u.yil, k.yil],
        [u.not, k.aciklama],
        [u.ekleyen, k.ekleyen_ad],
        [u.eklenmeTarihi, tarih(k.eklendi, dil)],
        [u.dogrulayan, k.dogrulayan_ad && `${k.dogrulayan_ad}${k.dogrulama_tarihi ? ` (${tarih(k.dogrulama_tarihi, dil)})` : ""}`],
        [t.surum.gerekce, k.ret_gerekcesi],
      ] as [string, string | number | null][]
    ).map(([ad, deger]) => (
      <div key={ad} style={{ display: "contents" }}>
        <dt>{ad}</dt>
        <dd>{deger || "—"}</dd>
      </div>
    ))}
    {k.url && (
      <>
        <dt>{u.baglanti}</dt>
        <dd>
          <a href={k.url} target="_blank" rel="noopener noreferrer">
            {k.url} ↗
          </a>
        </dd>
      </>
    )}
    {k.dosya_yolu && (
      <>
        <dt>{u.dosyaBilgisi}</dt>
        <dd>
          {k.dosya_turu ?? "—"}
          {k.dosya_boyutu ? ` · ${(k.dosya_boyutu / 1024 / 1024).toFixed(1)} MB` : ""}
        </dd>
      </>
    )}
  </dl>
  );
}
