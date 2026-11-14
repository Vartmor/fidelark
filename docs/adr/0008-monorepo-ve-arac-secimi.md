# ADR-008: Monorepo ve geliştirme araçları

**Tarih:** 2026-11-14  
**Durum:** Kabul edildi

## Bağlam

Plan §4 TypeScript ve pnpm workspaces'i ilk tercih olarak belirliyor. ENG-01 tek komutla yeşil
lint/typecheck/test pipeline'ı, ENG-02 import contract ve schema v0 istiyor. Gate 1 öncesinde
kapasite sınırlı (§7), bu yüzden araç zinciri olabildiğince az parça içermeli.

## Karar

- **Dil ve çalışma zamanı:** TypeScript 7, Node.js 24. Kod Node'un yerleşik type stripping
  özelliğiyle **derleme adımı olmadan** çalışır. `tsc` yalnızca tip kontrolü yapar (`noEmit`).
  Bunun için `erasableSyntaxOnly` açıktır: `enum`, `namespace` ve constructor parameter
  property kullanılmaz. İç importlar `.ts` uzantısıyla yazılır.
- **Monorepo:** pnpm workspaces. Paketler `exports` alanında doğrudan `src/*.ts` dosyalarını
  gösterir.
- **Paketler:** `@fidelark/schema` (Zod ile sözleşmeler, yayınlanan JSON Schema dosyaları),
  `@fidelark/core` (girdi sınıflandırma, limitler, inspect pipeline), `@fidelark/cli`.
  Plan §18'deki diğer paketler (`import-html`, `import-jsx`, `analyzer`, ...) ihtiyaç doğduğunda
  açılır; boş iskelet paket oluşturulmaz.
- **Şema:** Zod 4. JSON Schema dosyaları Zod'dan üretilir (`pnpm schema:emit`) ve repoda tutulur;
  test, dosyaların güncel olduğunu doğrular. Rapor ve fixture sözleşmesi `SCHEMA_VERSION` ile
  semver'e göre sürümlenir.
- **Lint ve format:** Biome (tek araç, tek yapılandırma).
- **Test:** Vitest.
- **Kontroller yerelde:** `pnpm check` (lint, tip kontrolü, testler) commit ve push öncesinde
  yerelde çalıştırılır. Proje kuralı olarak GitHub Actions veya başka barındırılan CI kullanılmaz.

## Alternatifler

- **`tsc -b` ile derleme ve project references:** Her paket için `dist/` ve ayrı tsconfig gerekir.
  npm'e yayın yapılana kadar fayda sağlamıyor.
- **ESLint + Prettier:** Daha yaygın, ama iki araç ve daha fazla yapılandırma demek. Biome'un
  kuralları şu an için yeterli.
- **Tek paket:** Daha basit, ama plan §4/§18'deki "aynı core'u CLI, web ve SDK kullanır" ilkesini
  baştan zorlamıyor.

## Sonuçlar

- Kurulumdan sonra `pnpm fidelark inspect <dosya>` derleme olmadan çalışır.
- Node, `node_modules` içindeki `.ts` dosyalarını çalıştırmaz. Paketler npm'e yayınlanacağı zaman
  bir build adımı (`dist/` + `.d.ts`) eklenmeli; bu karar o zaman yeniden açılır.
- Sınıflandırma ve rapor sözleşmesi şimdiden test altında; analyzer (ENG-03) raporun `analysis`
  alanını dolduracak.
