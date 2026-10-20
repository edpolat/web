// Panel işlemleri: eser formu, inceleme kararı, eski sürüme dönme ve arşivleme.
// İzin hem burada (yetkili) hem Supabase fonksiyonlarında denetlenir.
import "server-only";
import type { Eser } from "../tipler";
import { yayindakiIller, yayindakiKaynaklar } from "../veri";
import { KatkiHatasi, type Depo } from "./katki";
import { depoOku } from "./kuyruk";
import { hesapIstemcisi, kimlik } from "./kimlik";
import { yetkili } from "./oturum";
import { alanFarklari, surumHazirla, yayinaUygunMu } from "./surum";
import { arkaPlanda } from "./yz-analiz";
import { yzKararKaydet } from "./yz-depo";
import { surumGonder, surumIncelemeye, surumKarar, surumOku, surumYayinla, surumler, yayiniYenile, yayindakiSurumler } from "./surum-depo";

/** Onay kuyruğundaki doğrulama deposunun yayındaki hâli (JSON + onaylı sürümler). */
export async function yayindakiDepo(): Promise<Depo> {
  const depo = depoOku();
  const [iller, kaynakMap] = await Promise.all([yayindakiIller(), yayindakiKaynaklar()]);
  return {
    iller,
    tanimlar: { ...depo.tanimlar, kaynakIdleri: new Set(kaynakMap.keys()), eserIdleri: new Set(iller.flatMap((d) => d.eserler.map((e) => e.id))) },
  };
}

/** Eserin şu an yayındaki hâli ve onu oluşturan sürüm (JSON'daysa null). */
export async function yayindakiHal(eser_id: string): Promise<{ eser?: Eser; il?: string; surum: number | null }> {
  const [iller, yayindakiler] = await Promise.all([yayindakiIller(), yayindakiSurumler()]);
  const dosya = iller.find((d) => d.eserler.some((e) => e.id === eser_id));
  const arsivde = yayindakiler.get(eser_id);
  return {
    eser: dosya?.eserler.find((e) => e.id === eser_id) ?? (arsivde?.arsivlendi ? arsivde.veri : undefined),
    il: dosya?.il.id ?? arsivde?.il,
    surum: arsivde?.id ?? null,
  };
}

const metin = (x: unknown) => (typeof x === "string" ? x.trim() : "");
const sayi = (x: unknown) => (typeof x === "number" && Number.isInteger(x) ? x : NaN);

/** POST /api/surum gövdesi: { islem, ... }. Dönen değer yanıta konur. */
export async function panelIslemi(govde: Record<string, unknown>): Promise<Record<string, unknown>> {
  const ben = await kimlik();
  if (!ben?.rol) throw new KatkiHatasi("Panel için hesabınla giriş yapmalısın.");
  switch (govde.islem) {
    case "gonder": {
      const ekle = govde.tur === "eser_ekle";
      if (!(await yetkili(ekle ? "eser.ekle" : "eser.duzenle"))) throw new KatkiHatasi("Bu işlem için yetkin yok.");
      const hazir = surumHazirla(govde, await yayindakiDepo(), ben.ad);
      const temel = ekle ? null : (await yayindakiHal(hazir.eser_id)).surum;
      const id = await surumGonder(hazir, temel, govde.taslak === true);
      // Kaynakla gelen düzenleme incelemeye girdiyse YZ kaynak analizi yanıttan sonra çalışır (YZ kapalıysa hiçbir şey olmaz).
      if (govde.taslak !== true) arkaPlanda(await hesapIstemcisi(), [{ analiz: "kaynak", tur: "surum", id }]);
      return { id, eser_id: hazir.eser_id };
    }
    case "incelemeye": {
      await surumIncelemeye(sayi(govde.id));
      arkaPlanda(await hesapIstemcisi(), [{ analiz: "kaynak", tur: "surum", id: sayi(govde.id) }]);
      return { tamam: true };
    }
    case "onayla":
    case "reddet": {
      if (!(await yetkili("eser.onayla"))) throw new KatkiHatasi("Onaylama izni gerekli.");
      const surum = await surumOku(sayi(govde.id));
      if (!surum) throw new KatkiHatasi("Sürüm bulunamadı.");
      const gerekce = metin(govde.gerekce);
      if (govde.islem === "reddet") {
        if (!gerekce) throw new KatkiHatasi("Reddetmek için gerekçe yazmalısın.");
        await surumKarar(surum.id, false, gerekce, []);
        await yzKararKaydet(await hesapIstemcisi(), govde.yz_analizleri, "reddetti");
        return { tamam: true };
      }
      yayinaUygunMu(surum, await yayindakiDepo());
      const { eser } = await yayindakiHal(surum.eser_id);
      await surumKarar(surum.id, true, gerekce, alanFarklari(eser, surum.veri));
      yayiniYenile();
      await yzKararKaydet(await hesapIstemcisi(), govde.yz_analizleri, "onayladi");
      return { tamam: true };
    }
    case "geri_al": {
      if (!(await yetkili("eser.onayla"))) throw new KatkiHatasi("Geri almak için onaylama izni gerekli.");
      const eser_id = metin(govde.eser_id);
      const simdi = await yayindakiHal(eser_id);
      if (!simdi.eser || !simdi.il) throw new KatkiHatasi("Eser bulunamadı.");
      // Hedef: eski bir yayındaki sürüm ya da (hedef null) JSON dosyasındaki ilk hâl.
      let hedef: Eser | undefined;
      if (govde.hedef === null) hedef = depoOku().iller.flatMap((d) => d.eserler).find((e) => e.id === eser_id);
      else {
        const s = await surumOku(sayi(govde.hedef));
        if (s && s.eser_id === eser_id && s.durum === "yayinda") hedef = s.veri;
      }
      if (!hedef) throw new KatkiHatasi("Dönülecek sürüm bulunamadı.");
      const yeni = { eser_id, il: simdi.il, veri: hedef };
      yayinaUygunMu({ ...yeni, islem: "duzenle" }, await yayindakiDepo());
      await surumYayinla(yeni, "geri_al", simdi.surum, metin(govde.gerekce), alanFarklari(simdi.eser, hedef));
      yayiniYenile();
      return { tamam: true };
    }
    case "arsivle":
    case "arsivden_cikar": {
      if (!(await yetkili("eser.arsivle"))) throw new KatkiHatasi("Arşivleme izni gerekli.");
      const eser_id = metin(govde.eser_id);
      const simdi = await yayindakiHal(eser_id);
      if (!simdi.eser || !simdi.il) throw new KatkiHatasi("Eser bulunamadı.");
      const arsivde = (await yayindakiSurumler()).get(eser_id)?.arsivlendi ?? false;
      if (arsivde === (govde.islem === "arsivle")) throw new KatkiHatasi(arsivde ? "Eser zaten arşivde." : "Eser arşivde değil.");
      await surumYayinla({ eser_id, il: simdi.il, veri: simdi.eser }, govde.islem, simdi.surum, metin(govde.gerekce), [
        { alan: "durum", eski: arsivde ? "arsivlendi" : "yayinda", yeni: arsivde ? "yayinda" : "arsivlendi" },
      ]);
      yayiniYenile();
      return { tamam: true };
    }
  }
  throw new KatkiHatasi("Bilinmeyen işlem.");
}

/** Kişinin kendi gönderdiği sürümler (Katkılarım). */
export async function benimSurumlerim() {
  const ben = await kimlik();
  return ben ? surumler({ ekleyen: ben.id }) : [];
}
