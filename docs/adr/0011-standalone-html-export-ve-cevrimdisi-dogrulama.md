# ADR-011: Bağımsız HTML export ve çevrimdışı doğrulama

**Tarih:** 2026-11-14  
**Durum:** Kabul edildi

## Bağlam

`inspect` neyin korunabileceğini statik olarak söylüyor, ama bunu gerçekleştirmiyor ve
doğrulamıyordu. Ürünün söz verdiği zincir “Import → Inspect → Preserve → Export” ve doğrulanmış
sonuçtur. Export, güvenilmeyen bir dosyanın yönlendirmesiyle diske ve ağa erişeceği için asıl
risk burada.

## Karar

### `convert`: tek dosyaya gömme

- HTML parse5 ile okunur ve kaynak konumlarına göre **yerinde** değiştirilir. Belgenin geri kalanı
  bayt bayt aynı kalır (yeniden serileştirme yok).
- Gömülenler: klasik script'ler, stil dosyaları (`@import`, `@font-face` ve `url()` dahil,
  özyinelemeli), görseller ve `srcset`, ikonlar, medya, `style` öznitelikleri.
- Dışarıda bırakılanlar (nedeniyle manifest'e yazılır): ES modül grafları, gömülü sayfalar
  (iframe, embed, object), web app manifest'leri, çalışma anındaki ağ çağrıları,
  `layer()`/`supports()` koşullu `@import`'lar.
- `defer`/`async` script'ler data URI olarak gömülür; çalışma sırası değişmez. Inline script'lerde
  `</script` ve `<!--` kaçışlanır.
- Preload, prefetch ve preconnect ipuçları kaldırılır; çevrimdışında yalnızca hata üretirler.
- Subresource Integrity varsa doğrulanır; uyuşmazsa dosya gömülmez ve hata olarak raporlanır.
- Her çıktıya `<script type="application/json" id="fidelark-export">` manifest'i eklenir: kaynağın
  SHA-256'sı, gömülen her dosyanın türü, kaynağı, boyutu ve SHA-256'sı, dışarıda kalanlar ve
  nedenleri. Manifest girdileri belge sırasıyla yazılır; indirme sırasından bağımsız ve
  deterministiktir. Tekrar export edilen dosyada eski manifest değiştirilir.

### Yükleyiciler: izin ve sınırlar

- **Yerel:** Yalnızca girdinin klasöründen (veya `--base`) okunur. Yol, sembolik bağlantılar
  çözüldükten sonra kontrol edilir; klasör dışına çıkış reddedilir. Kök-göreli yollar (`/x`)
  bu klasöre göre çözülür.
- **Ağ:** Varsayılan kapalı; yalnızca `--allow-network` ile. Yalnızca http/https. DNS çözümlemesi
  bağlantının içinde yapılır ve loopback, özel ağ, link-local, CGNAT, metadata ve belgeleme
  aralıkları reddedilir; bu nedenle bir alan adı kontrolde herkese açık, istekte özel bir adrese
  çözülemez (DNS rebinding). En fazla 5 yönlendirme, 15 sn zaman aşımı, dosya başına 10 MB,
  toplamda 50 MB, aynı anda en fazla 6 indirme. Ağ izni verilmediği için atlanan dosyalar hata
  değil, uyarıdır.

### `verify`: çevrimdışı smoke test

- Kurulu Chrome/Chromium/Edge, `playwright-core` ile başlatılır (tarayıcı indirilmez;
  `FIDELARK_BROWSER` ile yol verilebilir). Varsayılan olarak tarayıcı sandbox'ı açıktır;
  `--no-sandbox` yalnızca güvenilen dosyalar için açık bir tercihtir.
- Bağlam: çevrimdışı, tüm istekler yönlendirilir; yalnızca doğrulanan dosyanın kendisi, `data:`,
  `blob:` ve `about:` geçer. Diğer yerel dosyalar, ağ istekleri ve WebSocket'ler engellenir ve
  kaydedilir. İzin yok, service worker yok, indirme yok; açılır pencereler ve diyaloglar kapatılır.
- Sonuç kuralları:
  - **failed:** Sayfa yüklenmedi, ya da hiç görünür metin yokken hata verdi veya istekleri
    engellendi.
  - **partial:** Açılıyor ama istek engellendi, hata oluştu, dosya hâlâ dışarıda referans veriyor
    ya da statik analiz Connected, Static fallback veya Unsupported dedi. Smoke test tıklama ve
    yazma yapmadığı için bu davranışlar ayrıca `verify.static-limits` ile belirtilir.
  - **passed:** Hiçbiri yok.
- Fixture'larda `expected.offline`, orijinal dosyanın `verify` sonucudur. Tarayıcı varsa her yerel
  test çalıştırmasında (`pnpm check`) bütün corpus çevrimdışı açılır ve sonuçlar karşılaştırılır.

## Alternatifler

- **DOM'u yeniden serileştirmek:** Daha basit, ama boşlukları, öznitelik sırasını ve tırnakları
  değiştirir; kaynakla karşılaştırmayı ve güveni zorlaştırır.
- **Her script'i data URI yapmak:** Tek kural, ama dosya %33 büyür ve okunamaz olur. Yalnızca
  `defer`/`async` için kullanılıyor.
- **Paketlenmiş tarayıcı indirmek (Playwright browsers):** Kurulumda yüzlerce MB indirme gerektirir;
  kurulu tarayıcı yeterli.
- **`convert` sonrası otomatik doğrulama:** Kullanıcının dosyasını o istemeden çalıştırmak olur;
  `verify` ayrı ve açık bir komut olarak kaldı.

## Sonuçlar

- `convert` → `verify` zinciri, statik tahminin gerçek tarayıcıda ne kadar tuttuğunu ölçmeyi
  sağlıyor; iki sonuç uyuşmazsa bu, analizde düzeltilecek bir kuralı gösterir.
- ES modül grafları ve React/JSX kaynağı için bir paketleyici (ör. esbuild) gerekecek; bu ayrı bir
  karar olacak (ADR-006 ile birlikte).
- `verify` sayfayı yalnızca açar; etkileşimle ortaya çıkan ağ çağrılarını göremez. Rapor bunu
  açıkça söyler.
