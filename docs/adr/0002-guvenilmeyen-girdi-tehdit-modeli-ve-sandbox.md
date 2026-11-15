# ADR-002: Güvenilmeyen girdi: tehdit modeli ve sandbox ilkeleri

**Tarih:** 2026-11-15  
**Durum:** Kabul edildi

## Bağlam

Fidelark'ın işlediği her dosya güvenilmeyen girdidir: bir AI platformunda üretilmiş, başkasından
gelmiş ya da bilerek kötü niyetli hazırlanmış olabilir. Plan, sertleştirme döneminde büyük dosya,
çökme ve temizlenmemiş kod hatalarını yayın engeli sayıyor (§13, 7–8. hafta). Bu ADR tehdit
modelini, her komutun sınırlarını ve bu sınırları sınayan testleri tek yerde toplar. ZIP'e özgü
kurallar [ADR-012](0012-zip-export-ve-guvenli-arsiv-okuma.md) içindedir.

## Tehdit modeli

- **Saldırgan:** Dosyanın yazarı. Dosyanın içeriğini tamamen kontrol eder; kullanıcının makinesini
  ve ağını kontrol etmez.
- **Korunanlar:** Kullanıcının dosyaları; ağ kimliği (IP adresi, dosyayı açtığı bilgisi); yerel
  ağdaki servisler; işlemci ve bellek; paylaşılan raporların gizliliği (dosyadaki gizli anahtarlar).
- **Kapsam dışı:** Chromium'un kendi sandbox'ını aşan sıfırıncı gün açıkları. Bunlar için
  tarayıcı sandbox'ı varsayılan olarak açıktır; `--no-sandbox` yalnızca güvenilen dosyalar içindir
  ve rapora yazılır.

## Karar

### `inspect` ve `convert`: girdi asla çalıştırılmaz

- Girdi yalnızca ayrıştırılır (parse5, acorn, CSS tarayıcıları); hiçbir şey çalıştırılmaz veya
  render edilmez.
- **Kaynak tüketimi:** Boyut limitleri okumadan önce uygulanır. Ağaç gezintileri özyinelemeli
  değildir (açık yığın), bu yüzden derin iç içe belgeler yığını taşıramaz. CSS taraması doğrusal
  zamanlıdır: hiçbir desen bir sonraki yapının başlangıcını geçemez; kapanmayan `url(`,
  `@font-face {`, `@import` ve yorumlar karesel geri izlemeye yol açmaz. Düzenlemeler tek geçişte
  uygulanır.
- **Disk ve ağ:** `convert` yerel dosyaları yalnızca girdinin klasöründen (sembolik bağlantılar
  çözüldükten sonra) ya da yalnızca ZIP'in içinden okur. Ağ varsayılan kapalıdır; açıldığında
  yalnızca herkese açık adreslere gidilir ([ADR-011](0011-standalone-html-export-ve-cevrimdisi-dogrulama.md)).
- **Gizlilik:** Olası gizli anahtarlar rapora yalnızca maskelenmiş olarak yazılır; URL'lerdeki
  kimlik bilgileri tüm çıktılarda `[redacted]` olur.

### `verify`: çalıştırma yalnızca iki katlı bir duvarın içinde

`verify` dosyayı çalıştıran tek komuttur. İki bağımsız katman vardır:

1. **İstek yönlendirme (sayfa düzeyi):** Çevrimdışı bağlam; yalnızca doğrulanan dosya, `data:`,
   `blob:` ve `about:` geçer. Diğer her istek, WebSocket ve yerel dosya engellenir ve kaydedilir.
   İzin yok, service worker yok, indirme yok; açılır pencereler kapatılır, diyaloglar reddedilir.
2. **Tarayıcı süreci (alt katman):** Kırmızı takım testi, bazı trafiğin istek yönlendirmesinden hiç
   geçmediğini gösterdi: speculation rules ile prerender/prefetch ve Chromium'un bir gezinme
   öncesinde açtığı bağlantılar. Engellenen gezinmeler bile hedefe TCP bağlantısı açıyordu;
   gerçek bir alan adında bu bir DNS sorgusu, yani veri taşıyabilecek bir kanaldır. Bu yüzden
   tarayıcı şu bayraklarla başlatılır:
   - `--proxy-server` her doğrulama için açılan yerel bir **çıkmaz** proxy'yi gösterir. Hiçbir
     şey iletilmez; proxy'ye ulaşan isteğin hedefi "blocked" listesine yazılır.
   - `--proxy-bypass-list=<-loopback>`: loopback adresleri de proxy'den geçer.
   - `--host-resolver-rules=MAP * ~NOTFOUND`: hiçbir alan adı çözümlenmez.
   - `--force-webrtc-ip-handling-policy=disable_non_proxied_udp`: WebRTC UDP gönderemez.
- **Askıda kalma ve çökme:** Yükleme süresi sınırlıdır; yükleme sonrası ölçüm de sınırlıdır
  (sonsuz döngü "the page stopped responding" olur), çökme kaydedilir, tarayıcıyı kapatma da
  sınırlıdır. Doğrulama hiçbir girdide sonsuza kadar beklemez.
- **Sayfadan ayrılma:** Dosya kendini başka bir adrese yönlendirirse (location, meta refresh, form
  gönderimi) gezinme engellenir ve sonuç **failed** olur; tarayıcının hata sayfasındaki metin
  sayfanın metni sayılmaz.

### Kırmızı takım kontrol listesi

Her madde otomatik bir testle sınanır. Tarayıcı gerektiren testler, tarayıcı bulunursa her yerel
`pnpm check` çalıştırmasında koşar.

| Saldırı | Beklenen | Test |
|---|---|---|
| fetch, XHR, beacon, EventSource, WebSocket, görsel/CSS isteği, iframe, worker, popup | Engellenir ve kaydedilir; yerel dinleyiciye hiçbir şey ulaşmaz | `packages/verifier/src/isolation.test.ts` |
| Preconnect, DNS prefetch, prefetch, speculation rules prerender | Ağa çıkmaz | aynı |
| WebRTC STUN (UDP) ve TURN (TCP) | Ağa çıkmaz; TCP denemesi kaydedilir | aynı |
| `file://` ile başka yerel dosya okuma | Engellenir | aynı, `sandbox-escape-attempts` fixture'ı |
| `location`, meta refresh veya form ile sayfadan ayrılma | Engellenir, ağa çıkmaz, sonuç failed | aynı, `redirect-away` |
| Yükleme sonrası sonsuz döngü | Sınırlı sürede "stopped responding" | aynı, `endless-loop` |
| Kapanmayan CSS yapıları (ReDoS) | Doğrusal sürede taranır | `packages/analyzer/src/units.test.ts` |
| 100.000 seviye iç içe öğe | Çökmez | `analyze.test.ts`, `export.test.ts` |
| Raporlarda gizli anahtar | Hiçbir çıktıda açık değeri görünmez | `tests/redaction.test.ts`, `leaked-credentials` |
| SVG içinde script, `javascript:` bağlantısı | Raporlanır; inspect çalıştırmaz | `svg-script` |
| ZIP: yol aşımı, sembolik bağlantı, ZIP bombası, yalan başlık | Okunmaz, raporlanır | `packages/core/src/zip.test.ts`, ZIP fixture'ları |

Testlerin gerçekten koruduğu, düzeltme kapatılarak doğrulandı: tarayıcı bayrakları olmadan
izolasyon testlerinin dördü başarısız olur.

## Alternatifler

- **Yalnızca Playwright istek yönlendirmesi:** Önceki durum. Speculation rules ve gezinme öncesi
  bağlantıları göremez.
- **Ağ ad alanı veya konteyner (Linux `unshare`, Docker):** En güçlü yalıtım, ama platforma bağlı,
  çoğu kullanıcıda ek kurulum veya yetki ister ve Windows/macOS'ta yoktur. Tarayıcı bayrakları
  her platformda çalışır; ileride isteğe bağlı ek katman olabilir.
- **Gerçek bir filtreleyen proxy:** Hiçbir şey iletmeyen çıkmaz proxy daha basit ve daha
  güvenlidir; iletilecek meşru trafik yoktur.

## Sonuçlar

- `verify`'ın "ağ kapalı" iddiası artık tarayıcı süreci düzeyinde de doğru ve testle sınanıyor.
- Statik analiz kırmızı takım fixture'larından öğrendi: script ile yönlendirme, `window.open`,
  WebRTC ve speculation rules artık raporlanıyor; `convert` speculation rules'u kaynak
  ipuçları gibi kaldırıyor.
- Açık kalanlar: `verify` yalnızca sayfayı açar, tıklama ve yazma yapmaz; etkileşimle ortaya
  çıkan davranış statik analize kalır. Bellek tüketimi tarayıcının kendi sınırlarına bırakılmıştır.
