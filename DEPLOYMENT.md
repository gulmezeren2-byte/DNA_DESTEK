# Android Build & Deployment Guide (EAS)

Bu rehber, uygulamanızı Android (APK veya Play Store AAB) için nasıl derleyeceğinizi anlatır.

## 1. Hazırlık (EAS CLI Kurulumu)
Eğer daha önce yapmadıysanız, Expo Application Services (EAS) aracını kurun:
```bash
npm install -g eas-cli
eas login
```

## 2. Proje Yapılandırması
Proje klasöründe `eas.json` oluşturmak için:
```bash
eas build:configure
```
*Soru sorarsa "Android" seçin.*

## 3. Kritik: Ortam Değişkenleri (Secrets)
Uygulamanız Firebase kullandığı için API anahtarlarını EAS ortamına eklemeniz **ŞARTTIR**.

Aşağıdaki komutla tüm .env değişkenlerini tek seferde yükleyebilirsiniz (Eğer .env dosyanız doluysa):
```bash
eas secret:push --scope project --env-file .env
```

Veya manuel olarak tek tek ekleyin:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "Sizin_API_Keyiniz"
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "dna-destek.firebaseapp.com"
# ... diğer tüm değişkenler için tekrarlayın
```

## 4. Build Alma (APK - Test İçin)
Uygulamayı emülatörde veya telefonda test etmek için `.apk` dosyası üretin:

Önce `eas.json` dosyasını açın ve `build.preview` ayarını şu şekilde güncelleyin/kontrol edin:
```json
// eas.json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  }
}
```

Sonra build komutunu çalıştırın:
```bash
eas build -p android --profile preview
```

## 5. Build Alma (Play Store - AAB)
Google Play Store'a yüklemek için:
```bash
eas build -p android --profile production
```

## Sık Karşılaşılan Sorunlar
- **Gradle Hataları:** Genelde paket versiyon uyumsuzluklarından olur. `npx expo install --fix` deneyin.
- **Beyaz Ekran / Çökme:** Genelde `EXPO_PUBLIC_...` anahtarlarının eksik olmasından kaynaklanır. Adım 3'ü tekrar kontrol edin.
