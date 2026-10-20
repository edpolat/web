// veri/ altındaki JSON dosyalarının tipleri. Kaynak: sema/*.schema.json

export type Dil = "tr" | "en";
export type CokDilli = { tr: string; en?: string; [dil: string]: string | undefined };

export type Konum = {
  enlem: number;
  boylam: number;
  dogrulandi: boolean;
  yontem?: "kitap" | "geocoding" | "elle" | "osm";
  hassasiyet?: "eser" | "adres" | "mahalle" | "ilce";
};

export type Olgu = {
  metin: CokDilli;
  kategori: string;
  durum: string;
  kaynak_id?: string;
  sayfa?: string;
};

export type Gorsel = {
  dosya: string;
  alt: CokDilli;
  aciklama?: CokDilli;
  lisans: string;
  atif: string;
  kaynak_id?: string;
};

export type Eser = {
  id: string;
  ad: CokDilli;
  tur: string;
  ilce?: string;
  adres?: CokDilli;
  konum?: Konum;
  donem?: { yapim_yili?: number; yapim_yili_hicri?: number; yaklasik?: boolean; metin?: CokDilli };
  banisi?: string;
  mimar?: string;
  tarihce?: CokDilli;
  mimari?: {
    metin?: CokDilli;
    plan?: string;
    malzeme?: string[];
    ust_ortu?: string;
    onarimlar?: { yil: number; aciklama?: CokDilli; kaynak_id?: string }[];
  };
  olgular: Olgu[];
  gorseller?: Gorsel[];
  sergi_idleri?: string[];
  vakif_id?: string;
  kulliye_id?: string;
  envanter?: { kaynak_id?: string; sayfa?: string; envanter_no?: string };
  taslak?: boolean;
};

export type Il = {
  id: string;
  ad: CokDilli;
  merkez: Konum;
  yakinlastirma?: number;
  envanter_kaynak_id?: string;
  envanter_yili?: number;
  toplam_eser?: number;
};

/** Listede kullanılan eser: hangi ile ait olduğu eklenmiş hâli. */
export type IlliEser = Eser & { il: string };

/** Keşfet kartı için hafif eser: tarihçe ve olgular tarayıcıya gönderilmez. */
export type KesifEseri = Pick<IlliEser, "id" | "il" | "ad" | "tur" | "ilce" | "banisi" | "konum"> & {
  yil?: number;
  gorsel?: Pick<Gorsel, "dosya" | "alt">;
  gorselSayisi: number;
  kaynakliSayisi: number;
};

export type Tanim = { id: string; ad: CokDilli; yayinda?: boolean };

export type Ayarlar = {
  diller: { kod: Dil; ad: string; varsayilan?: boolean }[];
  eser_turleri: Tanim[];
  olgu_durumlari: Tanim[];
  olgu_kategorileri: Tanim[];
};

export type Kaynak = {
  id: string;
  tur: string;
  baslik: string;
  yazar?: string;
  yayinci?: string;
  yil?: number;
  url?: string;
  lisans?: string;
  not?: string;
};

export type Sergi = {
  id: string;
  ad: CokDilli;
  sehir?: string;
  harita?: string;
  yer?: string;
  baslangic?: string;
  bitis?: string;
  aciklama?: CokDilli;
  url?: string;
  kaynak_id?: string;
};

export type Vakif = {
  id: string;
  ad: CokDilli;
  vakif?: string;
  vakfiye_tarihi?: number;
  kaynak_idleri: string[];
  akislar?: unknown[];
  sartlar?: { metin: CokDilli; kaynak_id: string; sayfa?: string }[];
};

export type KatkiTuru = "olgu" | "eser_ekle" | "eser_duzenle";
export type KatkiDurumu = "bekliyor" | "onaylandi" | "reddedildi";
/** eser_duzenle: değişen üst düzey eser alanları; null alanı siler. */
export type EserDegisikligi = { [A in keyof Eser]?: Eser[A] | null };

/** Onay kuyruğundaki kayıt (veri/kuyruk/<id>.json). Kaynak: sema/katki.schema.json */
export type Katki = {
  id: string;
  tur: KatkiTuru;
  eser_id: string;
  il: string;
  nereden: "web" | "uygulama";
  ekleyen: string;
  kaynak_id: string;
  sayfa?: string;
  not?: string;
  olgu?: { metin: CokDilli; kategori: string };
  degisiklik?: EserDegisikligi;
  onceki?: EserDegisikligi;
  durum: KatkiDurumu;
  gonderildi: string;
  karar?: { tarih: string; not?: string };
};

/** POST /api/katki gövdesi. eser_ekle'de eser_id sunucuda addan üretilir. */
export type KatkiIstegi = Omit<Katki, "id" | "durum" | "gonderildi" | "karar" | "onceki" | "eser_id"> & { eser_id?: string };

/** Pasaport rotası (veri/rotalar.json): her şehirde mobil uygulamadaki 6 durak. */
export type Rota = { il: string; duraklar: { eser_id: string; damga_ust?: string; damga_alt?: string }[] };
