// Ziyaretçinin konumu (tarayıcıda): Keşfet'te "Yakınımda" sıralaması ve eser sayfasındaki mesafe için.
// Son alınan konum 5 dakika bu sekmede saklanır, her sayfada yeniden izin sorulmaz.
export type Nokta = { enlem: number; boylam: number };

const ANAHTAR = "vakfiye:konum";
const OMUR = 5 * 60 * 1000;

function sakli(): Nokta | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(ANAHTAR) ?? "null") as (Nokta & { zaman: number }) | null;
    return v && Date.now() - v.zaman < OMUR ? { enlem: v.enlem, boylam: v.boylam } : null;
  } catch {
    return null;
  }
}

function al(): Promise<Nokta | null> {
  return new Promise((coz) => {
    navigator.geolocation.getCurrentPosition(
      (k) => {
        const n = { enlem: k.coords.latitude, boylam: k.coords.longitude };
        try {
          sessionStorage.setItem(ANAHTAR, JSON.stringify({ ...n, zaman: Date.now() }));
        } catch {}
        coz(n);
      },
      () => coz(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/** Konumu ister (gerekirse tarayıcı izin sorar). Alınamazsa null. */
export async function konumIste(): Promise<Nokta | null> {
  const s = sakli();
  if (s) return s;
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return al();
}

/**
 * Konumu yalnızca izin daha önce verildiyse sessizce alır; izin penceresi açılmaz
 * (uygulamada eser sayfasındaki mesafe böyle çalışıyor).
 */
export async function konumSessiz(): Promise<Nokta | null> {
  const s = sakli();
  if (s) return s;
  if (typeof navigator === "undefined" || !navigator.geolocation || !navigator.permissions) return null;
  try {
    const izin = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return izin.state === "granted" ? al() : null;
  } catch {
    return null;
  }
}
