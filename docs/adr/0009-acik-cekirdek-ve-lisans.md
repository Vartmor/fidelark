# ADR-009: Açık çekirdek ve lisans

**Tarih:** 2026-11-14  
**Durum:** Kabul edildi

## Bağlam

Kod reposu private açıldı, ama lisans kararı verilmemişti. Ürün yerel çalışan bir motor ve
ileride ücretli bulut hizmetlerinden oluşacak. Markanın sözü (“open exit”, platformdan
bağımsızlık) ve güvenlik iddiası (“girdiyi çalıştırmıyoruz, hiçbir şey göndermiyoruz”) kodun
denetlenebilir olmasıyla güçleniyor. En yakın alternatifler (SingleFile, monolith) açık kaynak ve
ücretsiz; savunulabilirlik koddan değil fixture corpus'undan, adaptörlerden ve hızdan geliyor.

## Karar

**Açık çekirdek (open core).**

| Kapsam | Durum |
|---|---|
| Yerel motor: `packages/*` (schema, core, CLI ve gelecekteki importer, analyzer, exporter) | Açık kaynak, Apache-2.0 |
| Rapor ve fixture sözleşmeleri, JSON Schema dosyaları | Açık kaynak, Apache-2.0 |
| Test fixture'ları | Her fixture kendi lisansıyla; sentetik olanlar CC0 |
| `branding/tokens/`, `branding/ui/components.css`, `branding/scripts/` | Apache-2.0 |
| İsim, logo ve diğer marka varlıkları | Lisanslanmaz; tüm hakları saklıdır, kullanım `TRADEMARKS.md` ile |
| Bulut ürünü (hosting, sync, hosted dönüşüm API'si, takım özellikleri) | Kapalı; ayrı private repoda yazılır |
| Strateji, araştırma, fiyat ve marka tescil notları | Açılmaz; private `fidelark-internal` reposunda |

- **Lisans: Apache-2.0.** Patent hakkı veriyor, markayı açıkça dışarıda tutuyor (madde 6) ve
  kurumların SDK'yı gömmesini kolaylaştırıyor.
- **Katkılar: DCO** (`git commit -s`). Apache-2.0 kapalı bir bulut ürününün çekirdek üzerine
  kurulmasına zaten izin verdiği için CLA gerekmiyor.
- **Repo yapısı:** `Vartmor/fidelark` yalnızca açık çekirdeği içerir ve temiz bir geçmişle
  başlar. Önceki tam geçmiş ve strateji dokümanları private `Vartmor/fidelark-internal`
  reposundadır; yerelde `internal/` klasörüne klonlanır ve `.gitignore` ile dışarıda tutulur.
- **Public'e geçiş:** Ayrı bir onayla, FIDELARK için TÜRKPATENT ön aramasından sonra ve en geç
  görüşmelere katılımcı toplamaya başlamadan önce.

## Alternatifler

- **Kapalı kaynak:** Bugünkü kodun rekabet değeri düşük; açık rakiplere karşı benimsenmeyi
  zorlaştırır ve markanın sözüyle çelişir.
- **MIT:** Daha basit, ama patent hakkı ve marka maddesi yok.
- **AGPL / MPL:** Barındırılan kopyalara karşı koruma sağlar, ama SDK'yı gömecek kurumları uzaklaştırır.
- **FSL / BSL (source-available):** Ticari rakibe karşı koruma sağlar, ama OSI tanımına göre açık
  kaynak değil ve güven argümanını zayıflatır. Bulut bileşenleri için ileride yeniden
  değerlendirilebilir.

## Sonuçlar

- Repo public olduğunda Pages, `main` koruması (ruleset) ve secret scanning Free planda açılır;
  tanıtım sayfası ayrı bir site reposu gerektirmez.
- Çekirdeğin gelecekte kapatılmayacağına dair ayrıca bir söz verilmez; Apache-2.0 ile yayımlanmış
  sürümler zaten geri alınamaz.
- Public repoya strateji dokümanı, müşteri verisi veya gizli bilgi eklenmez. Yeni iç dokümanlar
  `internal/` altına yazılır.
- Bu karar, Fidelark adının tescil durumunu değiştirmez; marka hukuki onay bekliyor.
