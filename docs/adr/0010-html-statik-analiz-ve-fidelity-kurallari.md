# ADR-010: HTML statik analiz ve fidelity kuralları

**Tarih:** 2026-11-14  
**Durum:** Kabul edildi

## Bağlam

`inspect` bugüne kadar yalnızca dosya türünü belirliyor ve fidelity için “not assessed” diyordu.
Ürünün ayırt edici özelliği, bir artifact'ın neyinin taşınabildiğini kanıtıyla söyleyen
raporlardır. Bu raporlar güvenilmeyen dosyalardan üretilecek, paylaşılabilecek ve aynı girdi
için her zaman aynı sonucu vermelidir.

## Karar

`@fidelark/analyzer` paketi tek bir HTML dosyasını **çalıştırmadan** analiz eder.

- **HTML:** parse5 ile, tarayıcıyla aynı ayrıştırma kurallarıyla okunur. `<template>` içeriği ve
  çalıştırılmayan script blokları (JSON, şablon) bağımlılık sayılmaz.
- **JavaScript:** Inline script'ler, olay işleyici öznitelikleri ve `javascript:` URL'leri acorn
  ile ayrıştırılır. Yorum ve string içindeki ifadeler yanlış alarm üretmez. JSX gibi ayrıştırılamayan
  kod için daha basit düzenli ifade kuralları kullanılır ve `script.unparsed` bulgusu eklenir.
- **CSS:** `<style>` ve `style` özniteliklerindeki `@import`, `@font-face` ve `url()` referansları.
- **Konum:** Her bağımlılık `remote`, `relative`, `embedded` (data: URI) veya `bare` (import map
  olmadan modül adı) olarak sınıflanır; satır numarasıyla kanıt tutulur.
- **Gizli bilgi:** Bilinen anahtar biçimleri ve URL'deki kimlik bilgisi parametreleri
  `secret.possible` olarak raporlanır. Değerler raporda hiçbir zaman açık yazılmaz; bağımlılık
  adreslerindeki kimlik bilgileri de maskelenir.
- **Şema 0.2.0:** Sabit bir yetenek (capability) sözlüğü, bağımlılık konumu ve kanıt alanları
  eklendi. Fixture'larda `expected.security` yerine beklenen bulgu kodları (`expected.findings`)
  tutulur.

### Fidelity kuralları

Her eksen tetiklenen kuralların en kötüsünü alır; genel sınıf üç eksenin en kötüsüdür. Kanıt
listesi, sınıfı belirleyen kuralla başlar.

| Eksen | Koşul | Sınıf |
|---|---|---|
| Görsel | Uzak bir sayfa gömülü (iframe, embed, object) | Connected |
| Görsel | Dosyada olmayan göreli stil, font veya görsel | Semantic equivalent |
| Görsel | Uzak stil, font, görsel veya medya | Bundled portable |
| Görsel | Hepsi inline veya gömülü | Exact portable |
| Davranış | Yalnızca AI platformunun içinde var olan API (ör. `window.claude`) | Unsupported |
| Davranış | Dosyada olmayan veya çıplak adla import edilen script/modül | Static fallback |
| Davranış | Çalışma anında ağ isteği, uzak form, uzak frame, adresi hesaplanan kod | Connected |
| Davranış | Uzak script veya modül | Bundled portable |
| Davranış | Script yok veya hepsi inline ve ağsız | Exact portable |
| İçerik | Statik metin var | Exact portable |
| İçerik | Metin yok, script var | Davranış sınıfını izler |

- Sınıflar, statik analizin **korunabilir** gördüğü durumu anlatır. Henüz export ve çevrimdışı
  doğrulama olmadığı için her rapora `fidelity.unverified` bulgusu eklenir ve CLI bunu açıkça
  yazar.
- Exporter olmadığı için `exportOptions` boş kalır; desteklenmeyen bir hedef vaat edilmez.

## Alternatifler

- **Yalnızca düzenli ifadeler:** Basit, ama yorum ve stringlerde yanlış alarm üretir; HTML'i
  tarayıcıdan farklı yorumlar.
- **Headless tarayıcıda çalıştırarak gözlemlemek:** Dinamik davranışı görür, ama güvenilmeyen kodu
  çalıştırır, ağ erişimi ister, yavaş ve deterministik değildir. İleride sandbox içinde, açık
  izinle doğrulama (verify) adımı olarak değerlendirilecek; analiz için değil.
- **LLM ile sınıflandırma:** Deterministik değil, maliyetli ve açıklanabilirliği zayıf
  (“deterministic before AI” ilkesi).

## Sonuçlar

- Rapor, her sonucun nedenini satır numarasıyla gösterir; fixture corpus'u her test
  çalıştırmasında beklenen yetenek, sınıf ve bulgularla karşılaştırılır.
- Statik analiz çalışma anında üretilen davranışı göremez: adresi hesaplanan istekler “computed
  at runtime” olarak işaretlenir ve muhafazakâr biçimde Connected sayılır.
- JSX gibi ayrıştırılamayan kodda sonuçlar daha az kesindir; rapor bunu `script.unparsed` ile
  belirtir.
- Çok büyük HTML dosyalarında parse5'in konum bilgisi bellek kullanır (3,8 MB'lık uç bir dosyada
  yaklaşık 2 saniye ve 470 MB); gerçek artifact'lar bunun çok altında.
