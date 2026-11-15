# ADR-012: ZIP export'larını içe alma ve güvenli arşiv okuma

**Tarih:** 2026-11-15  
**Durum:** Kabul edildi

## Bağlam

Platformların resmî olarak indirilebilen çıktılarının bir kısmı tek HTML değil, sayfa, stil,
script ve görsellerden oluşan bir ZIP'tir (örneğin tasarım araçlarının ve paketleyicilerin
export'ları). Tek HTML analizi bu dosyaları "eksik" diye raporluyor ve kullanıcıyı ZIP'e
yönlendiriyordu. ZIP aynı zamanda en eski saldırı yüzeylerinden biridir: arşivin dışına yazan
yollar (zip slip), sembolik bağlantılar, ZIP bombaları ve başlıkları yalan söyleyen girdiler.

## Karar

### Okuma: bellekte, katı ve bağımlılıksız

- ZIP, `@fidelark/core` içindeki küçük bir okuyucuyla (`zip.ts`) **bellekte** okunur; hiçbir şey
  diske açılmaz. Açma için Node'un `zlib` modülü kullanılır, yeni bağımlılık yoktur.
- Kaynak, merkez dizindir. Desteklenmeyenler arşiv düzeyinde reddedilir: ZIP64, çok parçalı
  arşivler, sınır dışı veya bozuk merkez dizin.
- Bir girdi yalnızca aşağıdakilerin hepsi geçerse okunur; aksi hâlde atlanır ve nedeniyle
  raporlanır:
  - **Yol:** göreli; `..` içermiyor; mutlak (`/x`, `C:/x`, `\\sunucu`) değil; kontrol karakteri
    içermiyor. Ters eğik çizgi ayraç sayılır, `.` ve boş parçalar atılır.
  - **Tür:** dizin değil, sembolik bağlantı değil, şifreli değil; sıkıştırma yöntemi stored veya
    deflate.
  - **Ad:** daha önceki bir girdiyle aynı değil (ilk girdi kazanır).
  - **Boyut:** tek dosya girdi limitini (25 MB), arşivin toplamı 100 MB'ı aşmıyor. 1 MB'tan büyük
    olup 100:1'den fazla açılan girdiler ZIP bombası sayılır ve açılmadan reddedilir.
  - **Bütünlük:** veri alanı başka bir girdiyle çakışmıyor (çakışan girdiler tekniğiyle yapılan
    ZIP bombası); açılan boyut başlıktakiyle aynı (`maxOutputLength` ile sınırlı, yani yalan
    söyleyen başlık belleği şişiremez); CRC-32 tutuyor.
- macOS ve Windows'un eklediği meta veriler (`__MACOSX/`, `.DS_Store`, `Thumbs.db`) bilgi
  düzeyinde atlanır.
- Rapordaki girdi adları kontrol karakterleri kaçışlanarak gösterilir; bir dosya adı terminali
  yeniden yazamaz.
- Limitler `Limits` ile ayarlanabilir: `maxArchiveEntries` (5000), `maxArchiveBytes` (100 MB),
  `maxCompressionRatio` (100).

### Giriş belgesi

1. `--entry <yol>` verildiyse o.
2. Kökte ya da her şeyi içeren tek üst klasörde `index.html`/`index.htm`.
3. Arşivde tek HTML dosyası varsa o.
4. Aksi hâlde analiz yapılmaz; `zip.no-entry` veya `zip.ambiguous-entry` hatası adayları listeler.

Kök-göreli yollar (`/assets/x.js`) her şeyi içeren tek üst klasöre, yoksa arşiv köküne göre
çözülür.

### Analiz: arşiv, belgenin dosya sistemidir

- Göreli referanslar tarayıcının çıkarılmış bir kopyada yapacağı gibi çözülür (sorgu ve parça
  atılır, yüzde kaçışları çözülür). Arşivin dışına çıkan referans eksik sayılır.
- Arşivde bulunan bağımlılık `bundled: true` olur; yani ZIP ile birlikte taşınır. Şemadaki
  tanım buna göre genişletildi.
- Stil dosyaları (`@import`, font ve görselleriyle), klasik script'ler ve modül grafları arşivin
  içinde izlenir ve satır içi kod gibi analiz edilir. Böylece `app.js` içindeki ağ çağrısı, host
  API'si veya olası gizli anahtar da raporlanır. Kanıtta dosya adı yazar
  (`fetch() in assets/app.js line 4`).
- Ayrı dosyalardan yüklenen modül script'leri tarayıcıda diskten (`file://`) çalışmaz. Bunlar
  `script.module-files` uyarısıyla ve davranış ekseninde Bundled portable olarak raporlanır:
  paketlenince veya yerel bir sunucuyla çalışırlar.
- Rapora isteğe bağlı `archive` alanı eklendi: giriş belgesi, okunan dosyalar (yol, boyut,
  SHA-256), atlanan girdiler ve nedenleri, toplam boyut. Bu nedenle şema **0.3.0** oldu.

### `convert`

- Giriş belgesi aynı exporter ile tek dosyaya çevrilir. Yerel yükleyici yalnızca arşivden okur;
  diske hiç dokunmaz. Arşiv dosyaları gerçek bir yola karşılık gelmeyen sanal bir `file:` kökü
  altında sunulur, kökün dışı reddedilir.
- Manifest'teki kaynak, ZIP dosyasının adı ve SHA-256'sıdır. ZIP girdisinde `--base` kullanılamaz.
- `verify` HTML'de kalır; ZIP için önce `convert` önerilir.

### Fixture'lar

ZIP fixture'ları ikili dosya olduğu için içerikleri incelenebilir bir betikte
(`packages/core/scripts/zip-fixtures.ts`) yazılıdır. Bir test, commit'lenmiş her arşivin bu
betiğin ürettiğiyle bayt bayt aynı olduğunu doğrular. Corpus'a gerçekçi iki export (çevrimdışı
çalışan bir ders; modül script'li, ağa bağlı bir dashboard) ve iki saldırı örneği (yol aşımı;
ZIP bombası) eklendi. Ders export'unun `convert` çıktısı, tarayıcı varsa `verify` ile çevrimdışı
doğrulanır.

## Alternatifler

- **Hazır kütüphane (fflate, yauzl, adm-zip):** Daha az kod, ama güvenlik kuralları yine bizim
  yazmamız gereken katmandır ve bazıları ZIP64 gibi istemediğimiz yolları açar. Kendi okuyucumuz
  ~300 satır; testleri Info-ZIP ve Python `zipfile` çıktılarıyla da çapraz kontrol edildi.
- **Geçici klasöre çıkarıp mevcut yerel yükleyiciyi kullanmak:** Daha az değişiklik, ama diske
  yazmak tam da zip slip ve sembolik bağlantı saldırılarının hedefidir; bellekte okumak bu sınıfı
  tamamen ortadan kaldırır.
- **Büyük/küçük harf duyarsız eşleştirme:** Windows'ta hazırlanmış arşivlerde işe yarar, ama
  Linux'ta çıkarılan kopyada çalışmayacak bir referansı çalışıyor gibi gösterir. Tam eşleşme
  seçildi.

## Sonuçlar

- Planın "Must Have" listesindeki resmî HTML/ZIP export girişi CLI'da çalışıyor.
- Paketleyici çıktılarının (Vite vb.) tek dosyaya tam çevrilmesi ES modül graflarının
  paketlenmesine bağlı; bu ayrı bir karar olacak (ADR-006).
- Arşiv içindeki birden fazla sayfa (çok sayfalı siteler) şimdilik yalnızca seçilen giriş
  belgesiyle analiz edilir.
