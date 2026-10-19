# Uygulamanın üyeliğini web'le ortak hesaba bağlamak (Feyza için)

Web artık aynı hesabı tutan uçlar sunuyor. Uygulamadaki `localStorage` hesapları yerine bunlar çağrılırsa web'de ve telefonda aynı e-posta/şifre ile girilir, pasaport pulları hesapta saklanır.

Adres: web sitesinin adresi + aşağıdaki yol (geliştirmede `http://<bilgisayarın IP'si>:3000`). Uçlar CORS açık, başka adresten çağrılabilir.

| İş | İstek | Gövde | Cevap |
|---|---|---|---|
| Üye ol | `POST /api/uye` | `{ad, eposta, sifre, pullar?}` | `{uye, jeton}` |
| Giriş yap | `POST /api/uye/giris` | `{eposta, sifre, pullar?}` | `{uye, jeton}` |
| Ben kimim | `GET /api/uye` | – | `{uye}` ya da 401 |
| Pul ekle | `POST /api/uye/pasaport` | `{pullar: ["eser-id", ...]}` | `{pullar}` |
| Pulları al | `GET /api/uye/pasaport` | – | `{pullar}` |
| Çıkış | `POST /api/uye/cikis` | – | `{tamam: true}` |

- Girişten sonra `jeton`u `localStorage`'a yaz, sonraki isteklerde `Authorization: Bearer <jeton>` başlığıyla gönder. Jeton 30 gün geçerli.
- `uye` = `{id, ad, eposta, pullar}`. Şifre hiçbir cevapta dönmez; sunucuda scrypt özetiyle saklanır, uygulamadaki SHA-256 özetine gerek kalmaz.
- Misafirken alınan pulları üye olurken ya da girerken `pullar` alanında gönder; hesaba eklenir (tekrarsız, yalnız bilinen eser kimlikleri).
- Hata cevabı `{hata, kod}`. `kod`: `ad`, `eposta`, `sifre`, `kayitli`, `hatali`. Mesajlar uygulamadakilerle aynı.
- "Üye olmadan devam et" aynen kalabilir: misafir pulları cihazda durur, üye olunca gönderilir.
