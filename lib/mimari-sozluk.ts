// Mimari sözlük: mobil uygulamadaki SOZLUK_TERIMLERI ile aynı liste.
// [terim, Türkçe kalıp, İngilizce kalıp, Türkçe açıklama, İngilizce açıklama]
import type { Dil } from "./tipler";

export const TERIMLER: [string, string, string, string, string][] = [
  ["Mihrap", "mihra[pb]", "mihrab", "Caminin kıble duvarında, namazın yönünü gösteren niş. İmam namazı burada kıldırır.", "The niche in the qibla wall showing the direction of prayer; the imam leads prayer here."],
  ["Kitabe", "kit[âa]be", "inscription", "Yapının kim tarafından, ne zaman yapıldığını ya da onarıldığını anlatan taş veya mermer yazıt.", "A stone or marble panel recording who built or repaired the building, and when."],
  ["Harim", "harim", "prayer hall", "Caminin namaz kılınan asıl iç mekânı.", "The main interior of a mosque where prayer is performed."],
  ["Minber", "minber", "minbar", "Mihrabın sağında, cuma ve bayram hutbesinin okunduğu merdivenli kürsü.", "The stepped pulpit to the right of the mihrab, used for the Friday and festival sermon."],
  ["Kırma çatı", "kırma çatı", "hipped roof", "Dört yöne eğimli, saçakları her taraftan inen çatı.", "A roof sloping down on all four sides."],
  ["Sahın", "sah(?:ın|n[ıi])", "nave", "Sütun ya da paye dizileriyle ayrılmış, boyuna uzanan iç mekân bölümü.", "A lengthwise section of the interior separated by rows of columns or piers."],
  ["Son cemaat yeri", "son cemaat yer", "narthex|last congregation", "Caminin girişinin önündeki revaklı bölüm; geç kalanlar namazı burada kılardı.", "The porch in front of a mosque's entrance, where latecomers used to pray."],
  ["Mahfil", "mahfil", "gallery", "Cami içinde, genellikle girişin üstünde, ahşap ya da taş yükseltilmiş balkon (kadınlar, müezzin için).", "A raised wooden or stone gallery inside the mosque, often above the entrance (for women or the muezzin)."],
  ["Çini", "çini", "tile", "Sırlı, desenli seramik kaplama. Selçuklu ve Osmanlı yapılarında duvar ve mihrap süslemesinde kullanılır.", "Glazed, patterned ceramic tile used to decorate walls and mihrabs in Seljuk and Ottoman buildings."],
  ["Şerefe", "şerefe", "balcony", "Minarenin etrafını dolanan, ezanın okunduğu balkon.", "The balcony around a minaret from which the call to prayer was made."],
  ["Kesme taş", "kesme taş", "ashlar|cut stone", "Düzgün yüzeyli, köşeli biçimde yontulmuş taş.", "Stone dressed into regular blocks with flat faces."],
  ["Sivri kemer", "sivri kemer", "pointed arch", "Tepesi sivri birleşen kemer; Selçuklu ve Osmanlı mimarisinde yaygındır.", "An arch whose two sides meet at a point; common in Seljuk and Ottoman architecture."],
  ["Basık kemer", "basık kemer", "depressed arch", "Yüksekliği açıklığına göre az olan, yayvan kemer.", "A flattened arch that is low relative to its span."],
  ["Moloz taş", "moloz", "rubble", "Düzgün yontulmamış, kaba taş. Genellikle harçla örülür.", "Rough, undressed stone, usually laid in mortar."],
  ["Sanduka", "sanduka", "cenotaph", "Türbede mezarın üstüne konan, sandık biçimli sembolik mezar.", "A chest-shaped symbolic tomb placed over the grave in a mausoleum."],
  ["Taç kapı", "taç kapı", "portal", "Yapının süslü, anıtsal giriş kapısı.", "The decorated monumental entrance of a building."],
  ["Külah", "külah", "conical (roof|cap)", "Minare ya da kümbetin tepesindeki konik örtü.", "The conical cap on top of a minaret or tomb tower."],
  ["Eyvan", "eyvan", "iwan", "Üç yanı kapalı, bir yanı tamamen açık, tonozlu mekân. Medreselerde yaygındır.", "A vaulted hall walled on three sides and fully open on the fourth; common in madrasas."],
  ["Vakfiye", "vakfiye", "endowment deed|vakfiye", "Vakfı kuran kişinin, vakfettiği malları ve şartlarını yazdığı belge.", "The deed in which a founder lists the endowed property and its conditions."],
  ["Tonoz", "tonoz", "vault", "Kemerin uzayarak oluşturduğu kavisli örtü. Beşik tonoz yarım silindir biçimindedir.", "A curved roof formed by extending an arch; a barrel vault is half a cylinder."],
  ["Sülüs", "s[üu]l[üu]s", "thuluth", "Kitabelerde sık kullanılan, büyük ve gösterişli Arap yazı stili.", "A large, ornate Arabic script often used for inscriptions."],
  ["Lento", "lento", "lintel", "Kapı ya da pencerenin üstündeki yatay taşıyıcı.", "The horizontal beam over a door or window."],
  ["Kavsara", "kavsara", "hood", "Mihrap ya da taç kapı nişinin üstünü örten yarım kubbe veya mukarnaslı başlık.", "The half-dome or muqarnas cap over a mihrab or portal niche."],
  ["Şadırvan", "şadırvan", "ablution fountain|şadırvan", "Abdest almak için cami avlusunda bulunan, musluklu çeşme.", "The fountain with taps in a mosque courtyard used for ritual washing."],
  ["Zaviye", "zaviye", "dervish lodge|zaviye", "Dervişlerin ve yolcuların barındığı küçük tekke.", "A small lodge sheltering dervishes and travellers."],
  ["Mukarnas", "mukarnas", "muqarnas", "Küçük niş dizilerinin kademeli olarak üst üste bindiği, petek görünümlü süsleme.", "Honeycomb-like decoration of small niches stacked in tiers."],
  ["Devşirme malzeme", "devşirme", "spolia|reused", "Eski bir yapıdan alınıp yeni yapıda yeniden kullanılan taş, sütun gibi malzeme.", "Stone, columns and other material taken from an older building and reused."],
  ["Silme", "silme", "moulding", "Cephede ya da kapı çevresinde dolanan, çıkıntılı süs şeridi.", "A projecting decorative band around a façade or doorway."],
  ["Rumi", "r[ûu]mi", "rumi", "Selçuklu'dan gelen, kıvrık yaprak biçimli stilize bitki motifi.", "A stylised, curling leaf motif originating in Seljuk art."],
  ["Alınlık", "alınlı[kğ]", "pediment", "Pencere ya da kapının üstündeki, çoğu zaman kemerli veya üçgen bölüm.", "The often arched or triangular panel above a window or door."],
  ["Sütunce", "sütunce", "colonnette", "Mihrap ya da kapı kenarlarındaki ince, süs amaçlı küçük sütun.", "A slender decorative column at the sides of a mihrab or door."],
  ["Hazire", "hazire", "graveyard|hazire", "Cami ya da türbenin yanındaki, çevresi duvarla çevrili küçük mezarlık.", "A small walled graveyard beside a mosque or tomb."],
  ["Kalem işi", "kalem iş", "hand-painted|kalem işi", "Sıva ya da ahşap üzerine fırçayla yapılan boyalı süsleme.", "Painted decoration applied by brush on plaster or wood."],
  ["Saçak", "saçak", "eaves", "Çatının duvardan dışarı taşan kenarı.", "The edge of a roof projecting beyond the wall."],
  ["Tromp", "tromp", "squinch", "Kare mekândan yuvarlak kubbeye geçişi sağlayan, köşelerdeki yarım koni biçimli öğe.", "A half-cone in the corner that turns a square room into a base for a round dome."],
  ["Kasnak", "kasnak", "drum", "Kubbenin oturduğu silindir ya da çokgen gövde.", "The cylindrical or polygonal base on which a dome rests."],
  ["İmaret", "imaret", "soup kitchen|imaret", "Yoksullara, öğrencilere ve yolculara ücretsiz yemek veren vakıf aşhanesi.", "An endowed kitchen serving free meals to the poor, students and travellers."],
  ["Hatıl", "hatıl", "timber band", "Duvarı sağlamlaştırmak için yatay olarak yerleştirilen ahşap kiriş.", "A horizontal timber beam set in a wall to strengthen it."],
  ["Bedesten", "bedesten", "bedesten", "Değerli malların satıldığı, kapıları kilitlenen kapalı çarşı.", "A lockable covered market for valuable goods."],
  ["Pandantif", "pandantif", "pendentive", "Kare mekândan kubbeye geçişi sağlayan, küresel üçgen biçimli öğe.", "A curved triangle that carries a round dome over a square room."],
  ["Kündekâri", "kündek[âa]ri", "kündekari", "Çivi ve tutkal kullanmadan, geçmeli küçük ahşap parçalarla yapılan geometrik işçilik.", "Geometric woodwork of small interlocking pieces, made without nails or glue."],
  ["Darülhuffaz", "d[âa]r[üu]['’]?l[ -]?huffaz", "darülhuffaz|qur'an school", "Kur'an-ı Kerim'in ezberlendiği okul.", "A school where the Qur'an is memorised."],
  ["Sebil", "sebil", "sebil", "Gelip geçenlere ücretsiz su dağıtılan, pencereli küçük yapı.", "A small windowed kiosk where water was handed out free to passers-by."]
];

const KALIPLAR: Record<Dil, RegExp[]> = {
  tr: TERIMLER.map((t) => new RegExp(`(?<![\\p{L}])${t[1]}[\\p{L}]*`, "iu")),
  en: TERIMLER.map((t) => new RegExp(`(?<![\\p{L}])(?:${t[2]})[\\p{L}]*`, "iu")),
};

export type Parca = string | { terim: number; yazi: string };

/** Metni düz yazı ve terim parçalarına böler. Her terim bir metinde yalnız ilk geçtiği yerde işaretlenir (uygulamadaki gibi). */
export function terimleriBol(metin: string, dil: Dil, kullanilan = new Set<number>()): Parca[] {
  const kaliplar = KALIPLAR[dil];
  const parcalar: Parca[] = [];
  let kalan = metin;
  for (;;) {
    let enIyi: { m: RegExpMatchArray; i: number } | null = null;
    kaliplar.forEach((k, i) => {
      if (kullanilan.has(i)) return;
      const m = kalan.match(k);
      if (m && m.index !== undefined && (enIyi === null || m.index < enIyi.m.index!)) enIyi = { m, i };
    });
    if (!enIyi) break;
    const { m, i } = enIyi as { m: RegExpMatchArray; i: number };
    kullanilan.add(i);
    if (m.index! > 0) parcalar.push(kalan.slice(0, m.index));
    parcalar.push({ terim: i, yazi: m[0] });
    kalan = kalan.slice(m.index! + m[0].length);
  }
  if (kalan) parcalar.push(kalan);
  return parcalar;
}
