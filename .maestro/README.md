# DNA DESTEK - E2E Test Kurulum ve Çalıştırma

## Maestro Kurulumu

### Windows
```powershell
# Chocolatey ile
choco install maestro

# Veya manuel
iwr -useb https://get.maestro.mobile.dev | iex
```

### macOS
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

---

## Test Akışları

| Dosya | Açıklama | Rol |
|-------|----------|-----|
| `login_flow.yaml` | Giriş testi | Müşteri |
| `create_talep_flow.yaml` | Talep oluşturma | Müşteri |
| `technician_flow.yaml` | Teknisyen görev akışı | Teknisyen |
| `admin_flow.yaml` | Yönetici panel erişimi | Yönetici |
| `security_role_guard_test.yaml` | Güvenlik: Rol guard testi | Müşteri |

---

## Çalıştırma

### 1. Uygulamayı Başlat
```bash
# Emulator/Simulator'da
npx expo start --android
# veya
npx expo start --ios
```

### 2. Testleri Çalıştır
```bash
# Tüm testler
maestro test .maestro/

# Tek test
maestro test .maestro/login_flow.yaml

# CI modunda (headless)
maestro test --format junit .maestro/
```

---

## Test Hesapları (Örnek)

| Rol | E-posta | Şifre |
|-----|---------|-------|
| Müşteri | `musteri@example.com` | `Test123!` |
| Teknisyen | `teknisyen@example.com` | `Test123!` |
| Yönetici | `admin@dnadestek.com` | `AdminPass123!` |

> ⚠️ **Önemli:** Gerçek test hesaplarını Firebase'de oluşturun ve şifreleri güvenli tutun.

---

## Troubleshooting

### "Element not found"
- `testID` prop'larını React Native komponentlerine ekleyin
- Örnek: `<TextInput testID="email-input" />`

### "App not installed"
- `appId` değerini `app.json`'daki package name ile eşleştirin

---

## CI/CD Entegrasyonu (GitHub Actions Örneği)

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push]
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: mobile-dev-inc/action-maestro-cloud@v1
        with:
          api-key: ${{ secrets.MAESTRO_CLOUD_API_KEY }}
          app-file: app.apk
```
