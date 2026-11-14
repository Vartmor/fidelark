<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="branding/assets/logo/svg/lockup-paper.svg">
    <img src="branding/assets/logo/svg/lockup-ink.svg" alt="Fidelark" width="280">
  </picture>
</p>

<p align="center"><strong>Ürettiklerin, sohbetin ötesinde.</strong></p>

<p align="center"><a href="README.md">English</a> · Türkçe</p>

> [!IMPORTANT]
> **Fidelark aktif geliştirme aşamasında (pre-alpha).** CLI, rapor formatı ve API'ler haber
> verilmeden değişebilir. Henüz üretim ortamında kullanıma hazır değildir.

Fidelark, yapay zekâ ile üretilen işlerin üretildikleri platformun dışında da kullanılabilir
kalmasını sağlar. Etkileşimli AI çıktılarını (HTML, React/JSX, Markdown, ZIP export) inceler,
neyin çevrimdışı çalışıp neyin çalışmadığını gösterir ve ileride bunları taşınabilir dosyalar
olarak dışa aktaracak: **İçe aktar. İncele. Koru. Dışa aktar.**

## İçindekiler

- [Bugün neler çalışıyor](#bugün-neler-çalışıyor)
- [Temel ilkeler](#temel-ilkeler)
- [Kullanım](#kullanım)
- [Örnek rapor](#örnek-rapor)
- [Fidelity sınıfları](#fidelity-sınıfları)
- [Yol haritası](#yol-haritası)
- [Repo yapısı](#repo-yapısı)
- [Geliştirme](#geliştirme)
- [Marka](#marka)
- [Lisans](#lisans)

## Bugün neler çalışıyor

`fidelark inspect`, **tek bir HTML dosyasını** çalıştırmadan analiz eder ve şema sürümlü bir
taşınabilirlik raporu üretir:

- **Bağımlılıklar:** Script, modül, stil dosyası, font, görsel, medya, frame ve çalışma anında
  yapılan ağ istekleri. Her biri satır numarasıyla birlikte uzak, göreli, gömülü veya çıplak
  modül adı olarak işaretlenir.
- **İzinler:** Çıktının script, ağ erişimi veya tarayıcı depolaması gerektirip gerektirmediği.
- **Fidelity:** İçerik, görsel ve davranış sadakati ayrı ayrı, her biri kanıtıyla değerlendirilir.
- **Bulgular:** Uzak ve eksik dosyalar, ağ çağrıları, uzak formlar ve frame'ler, dinamik kod,
  yalnızca AI platformunun içinde var olan API'ler ve olası gizli anahtarlar (her zaman
  maskelenmiş olarak).

Diğer formatlar (React/JSX kaynağı, Markdown, ZIP) tanınır ama henüz analiz edilmez. Henüz dışa
aktarma yok ve fidelity, export'u çevrimdışı yeniden açarak doğrulanmıyor; raporlar bunu açıkça
söyler.

## Temel ilkeler

- **Yerel öncelikli:** Her şey kendi bilgisayarınızda çalışır; CLI hiçbir içerik veya telemetri
  göndermez.
- **Varsayılan olarak güvenli:** İnceleme sırasında girdi asla çalıştırılmaz, render edilmez ve
  girdideki hiçbir adres çağrılmaz.
- **Dürüst taşınabilirlik:** Fidelity yüzde olarak değil, eksen eksen ve kanıtıyla raporlanır.
- **Deterministik:** Aynı girdi her zaman aynı raporu verir; hiçbir AI modeli kullanılmaz.

## Kullanım

Node.js 24 ve pnpm gerekir.

```bash
pnpm install
pnpm fidelark inspect path/to/artifact.html
pnpm fidelark inspect path/to/artifact.html --json
```

Çıkış kodları: `0` rapor üretildi, `1` raporda hata var, `2` kullanım veya girdi hatası.
JSON çıktısı
[`portability-report.schema.json`](packages/schema/json-schema/portability-report.schema.json)
şemasına uyar.

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
- [ ] React/JSX artifact kaynağından çevrimdışı çalışan HTML üretme
- [ ] Otomatik çevrimdışı doğrulamalı bağımsız HTML export
- [ ] ZIP export incelemesi
- [ ] Sandbox içinde yerel önizleme

## Repo yapısı

```text
packages/
  schema/     sözleşmeler (Zod) ve yayınlanan JSON Schema: fidelity sınıfları, raporlar, fixture'lar
  core/       girdi sınıflandırma, limitler, inceleme akışı
  analyzer/   statik HTML, CSS ve JavaScript analizi; fidelity kuralları
  cli/        `fidelark` komutu
fixtures/     beklenen sonuçlarıyla test corpus'u (bkz. fixtures/README.md)
tests/        paketler arası testler (fixture corpus'u, marka dosyası bütünlüğü)
branding/     marka kimliği: logolar, token'lar, UI kiti, kılavuz (bkz. branding/README.md)
docs/adr/     mimari karar kayıtları
```

## Geliştirme

```bash
pnpm check         # lint + tip kontrolü + test
pnpm format        # biçimlendirme ve güvenli lint düzeltmeleri
pnpm schema:emit   # packages/schema değiştikten sonra JSON Schema'yı yeniden üret
```

TypeScript, Node'un yerleşik type stripping özelliğiyle doğrudan çalışır, derleme adımı yoktur;
bkz. [ADR-008](docs/adr/0008-monorepo-ve-arac-secimi.md). Her test çalıştırmasında fixture'ların
beklenen yetenekleri, fidelity sınıfları ve bulguları kontrol edilir; analizdeki değişiklikler
regresyon olarak görünür.

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
