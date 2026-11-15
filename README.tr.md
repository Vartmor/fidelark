<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="branding/assets/logo/svg/lockup-paper.svg">
    <img src="branding/assets/logo/svg/lockup-ink.svg" alt="Fidelark" width="280">
  </picture>
</p>

<p align="center"><strong>Ürettiklerin, sohbetin ötesinde.</strong></p>

<p align="center"><a href="README.md">English</a> · Türkçe · <a href="https://vartmor.github.io/fidelark/">Web sitesi</a></p>

> [!IMPORTANT]
> **Fidelark aktif geliştirme aşamasında (pre-alpha).** CLI, rapor formatı ve API'ler haber
> verilmeden değişebilir. Henüz üretim ortamında kullanıma hazır değildir.

Fidelark, yapay zekâ ile üretilen işlerin üretildikleri platformun dışında da kullanılabilir
kalmasını sağlar. Etkileşimli AI çıktılarını (HTML, React/JSX, Markdown, ZIP export) inceler,
neyin çevrimdışı çalışıp neyin çalışmadığını gösterir ve bunları taşınabilir dosyalar
olarak dışa aktarır: **İçe aktar. İncele. Koru. Dışa aktar.**

## İçindekiler

- [Bugün neler çalışıyor](#bugün-neler-çalışıyor)
- [Temel ilkeler](#temel-ilkeler)
- [Kullanım](#kullanım)
- [Dönüştürme ve doğrulama](#dönüştürme-ve-doğrulama)
- [Örnek rapor](#örnek-rapor)
- [Fidelity sınıfları](#fidelity-sınıfları)
- [Yol haritası](#yol-haritası)
- [Repo yapısı](#repo-yapısı)
- [Geliştirme](#geliştirme)
- [Marka](#marka)
- [Lisans](#lisans)

## Bugün neler çalışıyor

`fidelark inspect`, **tek bir HTML dosyasını** veya bir **ZIP export'unu** çalıştırmadan analiz
eder ve şema sürümlü bir taşınabilirlik raporu üretir:

- **Bağımlılıklar:** Script, modül, stil dosyası, font, görsel, medya, frame ve çalışma anında
  yapılan ağ istekleri. Her biri satır numarasıyla birlikte uzak, göreli, gömülü veya çıplak
  modül adı olarak işaretlenir.
- **İzinler:** Çıktının script, ağ erişimi veya tarayıcı depolaması gerektirip gerektirmediği.
- **Fidelity:** İçerik, görsel ve davranış sadakati ayrı ayrı, her biri kanıtıyla değerlendirilir.
- **Bulgular:** Uzak ve eksik dosyalar, ağ çağrıları, uzak formlar ve frame'ler, dinamik kod,
  yalnızca AI platformunun içinde var olan API'ler ve olası gizli anahtarlar (her zaman
  maskelenmiş olarak).
- **ZIP export'ları:** Bellekte okunur, diske asla açılmaz. Analiz edilen sayfa `index.html`
  (yoksa tek HTML dosyası ya da `--entry`) olur; arşivdeki stil dosyaları, script'ler ve modül
  grafları da izlenip analiz edilir. Güvensiz girdiler (arşivin dışına çıkan veya mutlak yollar,
  sembolik bağlantılar), ZIP bombaları ve bozuk girdiler reddedilip raporlanır.

`fidelark convert`, bir HTML dosyasını veya bir ZIP export'undaki sayfayı script, stil, font,
görsel ve medya dosyalarıyla birlikte içinde köken manifest'i bulunan **tek ve kendi kendine
yeten bir HTML dosyasına** dönüştürür.
`fidelark verify`, bir dosyayı **ağ erişimi tamamen kapalı, sandbox içindeki bir tarayıcıda**
açar; neyi yüklemeye çalıştığını ve hangi hataları verdiğini raporlar.

Diğer formatlar (React/JSX kaynağı, Markdown) tanınır ama henüz analiz edilmez ve
dönüştürülmez. ES modül grafları, gömülü sayfalar ve canlı ağ çağrıları dışarıda kalır;
dönüşüm raporu bunu açıkça söyler.

## Temel ilkeler

- **Yerel öncelikli:** Her şey kendi bilgisayarınızda çalışır; CLI hiçbir içerik veya telemetri
  göndermez.
- **Varsayılan olarak güvenli:** `inspect` ve `convert` girdiyi asla çalıştırmaz. `convert` yerel
  dosyaları yalnızca girdinin klasöründen ya da yalnızca ZIP'in içinden okur; yalnızca
  `--allow-network` verilirse ve yalnızca herkese açık adreslerden indirir. Arşivler diske asla
  açılmaz. `verify` dosyayı yalnızca ağı kapalı, sandbox içindeki bir
  tarayıcıda çalıştırır.
- **Dürüst taşınabilirlik:** Fidelity yüzde olarak değil, eksen eksen ve kanıtıyla raporlanır.
- **Deterministik:** Aynı girdi her zaman aynı raporu verir; hiçbir AI modeli kullanılmaz.

## Kullanım

Node.js 24 ve pnpm gerekir.

```bash
pnpm install
pnpm fidelark inspect path/to/artifact.html
pnpm fidelark inspect path/to/artifact.html --json
pnpm fidelark inspect path/to/export.zip
```

Çıkış kodları: `0` başarılı, `1` sorun bulundu (raporda hata, gömülemeyen dosya veya `verify`
sonucunun passed olmaması), `2` kullanım veya girdi hatası. JSON çıktısı
[`packages/schema/json-schema/`](packages/schema/json-schema/) altındaki şemalara uyar.

## Dönüştürme ve doğrulama

```bash
# Yerel bağımlılıkları tek dosyaya göm (artifact.fidelark.html yazılır)
pnpm fidelark convert path/to/artifact.html

# Bir ZIP export'unu tek dosyaya çevir (birden fazla sayfa varsa --entry ile seç)
pnpm fidelark convert path/to/export.zip

# Uzak script, stil, font ve görselleri de indir (yalnızca herkese açık adresler)
pnpm fidelark convert path/to/artifact.html --allow-network -o portable.html

# Sonucu sandbox içindeki Chromium'da çevrimdışı aç ve neyin bozulduğunu raporla
pnpm fidelark verify portable.html
```

`convert`, Subresource Integrity hash'lerini doğrular, `defer`/`async` davranışını korur,
çevrimdışında yalnızca hata verecek kaynak ipuçlarını (preload, preconnect) kaldırır ve girdinin
klasörü (veya `--base`), ZIP için de arşivin dışındaki dosyaları reddeder. Her çıktı, gömülen her kaynağı SHA-256
değeriyle ve dışarıda kalan her referansı nedeniyle listeleyen bir
`<script type="application/json" id="fidelark-export">` manifest'i taşır.

`verify` için Chrome, Chromium veya Edge gerekir (farklı bir yol için `FIDELARK_BROWSER`).
Sonuç **passed** (engellenen istek ve hata yok), **partial** (açılıyor ama bir şey engelleniyor,
hata veriyor veya bağlantı gerektiriyor) ya da **failed** (yüklenmiyor, boş kalıp hata veriyor,
dosyadan ayrılıyor veya yanıt vermiyor) olur. Yalnızca sayfayı açar; tıklama veya yazma yapmaz.
İstek engellemenin altında tarayıcının kendisi de hiçbir yere ulaşamaz: proxy'si yerel bir çıkmaz
sokaktır, alan adı çözümlemez ve WebRTC UDP gönderemez
([tehdit modeli](docs/adr/0002-guvenilmeyen-girdi-tehdit-modeli-ve-sandbox.md)).

## Örnek rapor

Chart.js'i CDN'den yükleyen ve canlı veri çeken bir grafik widget'ı
([fixture](fixtures/synthetic/live-data-widget/artifact.html)). CLI çıktısı İngilizcedir:

```text
$ pnpm fidelark inspect fixtures/synthetic/live-data-widget/artifact.html
  File      artifact.html
  Format    html
  Size      866 B
  SHA-256   a1a638cedcb17332b4d6eb3ad452651b661b0ffd92f23544ebc650543f8b8ded
  Fidelity  ↗ Connected  (static analysis, not yet verified offline)
            content     ● Exact portable
              · 26 characters of static text are in the document.
            visual      ● Exact portable
              · All styles and images are inline or embedded.
            behavioral  ↗ Connected
              · Makes 1 network request at runtime: https://api.example.com/rates?base=EUR (fetch() line 13).
              · 1 remote script can be bundled for offline use.
  Needs     scripts, network
  Uses      html, inline-script, external-script, canvas, network-fetch

Dependencies (2)
  script   remote  https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js  (<script src> line 6)
  network  remote  https://api.example.com/rates?base=EUR  (fetch() line 13)

Findings
  warning  dependency.remote    1 remote resource must be bundled for the artifact to work offline.
                                - script: https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js
  warning  network.runtime      Makes 1 network request at runtime; these features need a connection.
                                - https://api.example.com/rates?base=EUR (fetch() line 13)
  info     script.inline        Contains 1 inline script. Nothing is executed during inspection.
  info     fidelity.unverified  Fidelity is assessed by static analysis; it is not yet verified by exporting and reopening the artifact offline.
```

## Fidelity sınıfları

En taşınabilirden en az taşınabilire altı adlandırılmış sonuç. Genel sınıf, üç eksenin en
kötüsüdür. CLI ve JSON çıktısında İngilizce adlar kullanılır.

| Sınıf | Türkçesi | Anlamı |
|---|---|---|
| ● Exact portable | Birebir taşınabilir | Kaynağın anlamı ve davranışı bağımsız olarak korunur. |
| ▣ Bundled portable | Paketlenerek taşınabilir | Bağımlılıklar pakete eklenir ve hedef ortamda doğrulanır. |
| ≈ Semantic equivalent | Anlamca eşdeğer | Anlam korunur, görünüm farklı olabilir. |
| ↗ Connected | Bağlantı gerektiriyor | Bazı davranışlar ağ veya API erişimi ister. |
| ◧ Static fallback | Statik yedek | Kaynak ve anlık görüntü saklanır, etkileşim korunmaz. |
| × Unsupported | Desteklenmiyor | Güvenli ya da mümkün değil; rapor nedenini açıklar. |

Bulguları sınıflara bağlayan kurallar
[ADR-010](docs/adr/0010-html-statik-analiz-ve-fidelity-kurallari.md) içinde belgelenmiştir.

## Yol haritası

- [x] Girdi sınıflandırma, boyut limitleri ve şema sürümlü raporlar
- [x] Tek HTML dosyaları için statik analiz ve fidelity değerlendirmesi
- [x] Otomatik çevrimdışı doğrulamalı bağımsız HTML export
- [x] ZIP export incelemesi ve dönüştürme
- [ ] React/JSX artifact kaynağından çevrimdışı çalışan HTML üretme
- [ ] ES modül graflarını paketleme
- [ ] Sandbox içinde yerel önizleme

## Repo yapısı

```text
packages/
  schema/     sözleşmeler (Zod) ve yayınlanan JSON Schema: fidelity sınıfları, raporlar, fixture'lar
  core/       girdi sınıflandırma, limitler, güvenli ZIP okuma, inceleme akışı
  analyzer/   statik HTML, CSS ve JavaScript analizi; fidelity kuralları
  exporter/   izin kontrollü yerel ve ağ yükleyicileriyle bağımsız HTML export
  verifier/   sandbox içindeki tarayıcıda çevrimdışı doğrulama
  cli/        `fidelark` komutu
fixtures/     beklenen sonuçlarıyla test corpus'u (bkz. fixtures/README.md)
apps/site/    GitHub Pages'teki tanıtım sitesi (Vite, React; raporlar fixture'lardan üretilir)
tests/        paketler arası testler (fixture corpus'u, ZIP export'ları, marka dosyası bütünlüğü, site verisi)
branding/     marka kimliği: logolar, token'lar, UI kiti, kılavuz (bkz. branding/README.md)
docs/adr/     mimari karar kayıtları
```

## Geliştirme

```bash
pnpm check         # lint + tip kontrolü + test + site derlemesi
pnpm format        # biçimlendirme ve güvenli lint düzeltmeleri
pnpm schema:emit   # packages/schema değiştikten sonra JSON Schema'yı yeniden üret
pnpm site:dev      # web sitesini yerelde çalıştır (raporları fixtures/ üzerinden üretilir)
```

TypeScript, Node'un yerleşik type stripping özelliğiyle doğrudan çalışır, derleme adımı yoktur;
bkz. [ADR-008](docs/adr/0008-monorepo-ve-arac-secimi.md). Her test çalıştırmasında fixture'ların
beklenen yetenekleri, fidelity sınıfları ve bulguları, tarayıcı varsa çevrimdışı sonuçları da
kontrol edilir; değişiklikler regresyon olarak görünür. Export ve doğrulama kararları
[ADR-011](docs/adr/0011-standalone-html-export-ve-cevrimdisi-dogrulama.md), ZIP işleme kararları
[ADR-012](docs/adr/0012-zip-export-ve-guvenli-arsiv-okuma.md) içindedir.

## Marka

Logo, renk, tipografi, dil ve altı fidelity etiketi [`branding/`](branding/README.md) klasöründe
tanımlıdır; `branding/assets/logo/svg/` altındaki SVG dosyaları ana kaynaktır. `pnpm test`, marka
dosyası manifest'ini, SVG güvenliğini, token tutarlılığını ve kontrast denetimini kontrol eder.
Fidelark aday bir isim ve kimliktir; marka tescil onayı beklemektedir.

## Lisans

Kod [Apache License 2.0](LICENSE) ile lisanslanmıştır. Fidelark adı, logoları ve marka
varlıkları bu lisansın kapsamında değildir; bkz. [TRADEMARKS.md](TRADEMARKS.md) ve
[branding/LICENSE.md](branding/LICENSE.md).

Katkılar [Developer Certificate of Origin](CONTRIBUTING.md#developer-certificate-of-origin) ile
kabul edilir. Güvenlik açıklarını lütfen gizli olarak bildirin; bkz. [SECURITY.md](SECURITY.md).
