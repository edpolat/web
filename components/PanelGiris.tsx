"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BulutHatasi, bulutHazir, erisimJetonu, girisYap, oturumIzle, type BulutHataKodu } from "@/lib/bulut";
import { s } from "@/lib/sozluk";
import type { Dil } from "@/lib/tipler";

/**
 * Tarayıcıdaki Supabase oturumunu sunucuya bildirir (httpOnly çerez). Oturum açılınca, yenilenince
 * ya da kapanınca çerez güncellenir ve sayfa yeniden çizilir; ziyaretçi hesabıyla aynı oturumdur.
 */
export function OturumKoprusu() {
  const router = useRouter();
  useEffect(() => {
    if (!bulutHazir) return;
    return oturumIzle(async (jeton) => {
      const yanit = await fetch(
        "/api/yonetim/oturum",
        jeton ? { method: "POST", headers: { Authorization: `Bearer ${jeton}` } } : { method: "DELETE" },
      ).catch(() => undefined);
      if (yanit?.ok && ((await yanit.json()) as { degisti?: boolean }).degisti) router.refresh();
    });
  }, [router]);
  return null;
}

/**
 * Sunucu çerezde oturum görmediğinde gösterilir. Tarayıcıda açık oturum varsa (çerezin süresi dolmuş ya da henüz
 * yazılmamış) giriş formu yerine "oturum açılıyor" der; jetonu sunucuya yazıp sayfayı yeniler. Oturum yoksa ya da
 * birkaç saniyede açılamazsa formu gösterir.
 */
export function PanelGirisi({ dil, children }: { dil: Dil; children: React.ReactNode }) {
  const router = useRouter();
  const [durum, setDurum] = useState<"bakiliyor" | "form">(bulutHazir ? "bakiliyor" : "form");
  useEffect(() => {
    if (!bulutHazir) return;
    let bitti = false;
    const yedek = setTimeout(() => !bitti && setDurum("form"), 6000);
    (async () => {
      const jeton = await erisimJetonu().catch(() => null);
      if (!jeton) {
        bitti = true;
        setDurum("form");
        return;
      }
      const yanit = await fetch("/api/yonetim/oturum", { method: "POST", headers: { Authorization: `Bearer ${jeton}` } }).catch(() => undefined);
      if (yanit?.ok) router.refresh();
      else {
        bitti = true;
        setDurum("form");
      }
    })();
    return () => clearTimeout(yedek);
  }, [router]);
  if (durum === "bakiliyor") {
    return (
      <p className="not" role="status">
        {s(dil).panel.oturumAciliyor}
      </p>
    );
  }
  return <>{children}</>;
}

/** Panele kişisel hesapla giriş (ziyaretçi hesabıyla aynı). Başarılı girişte OturumKoprusu sayfayı yeniler. */
export function PanelGirisFormu({ dil }: { dil: Dil }) {
  const t = s(dil);
  const [hata, setHata] = useState<BulutHataKodu>();
  const [bekliyor, setBekliyor] = useState(false);
  async function gir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHata(undefined);
    const f = new FormData(e.currentTarget);
    setBekliyor(true);
    try {
      await girisYap(String(f.get("eposta")).trim().toLowerCase(), String(f.get("sifre")));
    } catch (h) {
      setHata(h instanceof BulutHatasi ? h.kod : "genel");
    } finally {
      setBekliyor(false);
    }
  }
  return (
    <form className="form" onSubmit={gir}>
      <p className="not">
        {t.panel.girisAciklama} <Link href={`/${dil}/hesap`}>{t.panel.hesapSayfasi}</Link>
      </p>
      {!bulutHazir && <p className="hata">{t.uyelik.ayarYok}</p>}
      <label>
        {t.uyelik.eposta}
        <input name="eposta" type="email" required autoComplete="email" />
      </label>
      <label>
        {t.sifre}
        <input name="sifre" type="password" required autoComplete="current-password" />
      </label>
      <p role="alert" className="hata">
        {hata && t.uyelik.hatalar[hata]}
      </p>
      <div className="dugmeler">
        <button type="submit" disabled={bekliyor || !bulutHazir}>
          {t.girisYap}
        </button>
      </div>
    </form>
  );
}
