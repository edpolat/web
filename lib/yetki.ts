// Yönetim paneli rolleri ve izinleri. Kontroller her zaman izne göre yapılır (izinli(kimlik, "eser.onayla")), rol adına göre değil.
// Asıl eşleme Supabase'deki rol_izinleri tablosunda (supabase/001_roller.sql, 015'te tarihçi eklendi); buradaki kopya arayüz ve testler içindir.

// eser.incele: tarihçi aşaması (supabase/015_tarihci_onayi.sql); eser.onayla: editör aşaması; sergi.yonet: sergileri ekle/düzenle/sil (017).
export const IZINLER = ["eser.ekle", "eser.duzenle", "eser.incele", "eser.onayla", "eser.arsivle", "kaynak.dogrula", "sergi.yonet", "kullanici.yonet"] as const;
export type Izin = (typeof IZINLER)[number];

export const ROLLER = ["super_admin", "editor", "tarihci", "katkici", "goruntuleyici"] as const;
export type Rol = (typeof ROLLER)[number];

export const ROL_IZINLERI: Record<Rol, readonly Izin[]> = {
  super_admin: IZINLER,
  editor: ["eser.ekle", "eser.duzenle", "eser.onayla", "sergi.yonet"],
  tarihci: ["eser.incele", "kaynak.dogrula"],
  katkici: ["eser.ekle", "eser.duzenle"],
  goruntuleyici: [],
};

/** Panele giren kişi. rol null: hesabı var ama panel rolü yok. */
export type Kimlik = { id: string; eposta: string; ad: string; rol: Rol | null; izinler: Izin[] };

export const izinli = (k: Kimlik | null | undefined, izin: Izin): boolean => !!k?.izinler.includes(izin);

/** Panel sayfalarını görebilir mi: herhangi bir rolü olan (görüntüleyici dahil). */
export const paneldeMi = (k: Kimlik | null | undefined): k is Kimlik & { rol: Rol } => !!k?.rol;

export const rolMu = (x: unknown): x is Rol => ROLLER.includes(x as Rol);

/** benim_izinlerim() yanıtını denetler; tanınmayan rol ve izinler atılır. */
export function yetkiCoz(veri: unknown): Pick<Kimlik, "rol" | "izinler"> {
  const v = (typeof veri === "object" && veri !== null ? veri : {}) as { rol?: unknown; izinler?: unknown };
  const rol = rolMu(v.rol) ? v.rol : null;
  const izinler = Array.isArray(v.izinler) ? IZINLER.filter((i) => (v.izinler as unknown[]).includes(i)) : [];
  return { rol, izinler: rol ? izinler : [] };
}
