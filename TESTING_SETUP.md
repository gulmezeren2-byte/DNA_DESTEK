# Bilgisayar Üzerinden Mobil Test Rehberi (Android)

Uygulamanızı kendi bilgisayarınızda bir "Sanal Telefon" (Emulator) üzerinde test etmek için **Android Studio** kurulumu gereklidir. Önceki hatanız (`adb not recognized`), bu kurulumun eksik olduğunu gösteriyor.

## 1. Android Studio Kurulumu
Eğer yüklü değilse:
1.  [Android Studio İndir](https://developer.android.com/studio) adresine gidin.
2.  İndirip kurun. Kurulum sırasında "Android Virtual Device" (AVD) seçeneğinin işaretli olduğundan emin olun.
3.  Android Studio'yu açın -> **More Actions** -> **SDK Manager**'a girin.
4.  **SDK Tools** sekmesinde şu kutucukların işaretli olduğundan emin olun:
    *   Android SDK Build-Tools
    *   Android Emulator
    *   Android SDK Platform-Tools
    *   Google Play Services

## 2. Ortam Değişkenlerini (Environment Variables) Ayarlama
`adb` komutunun çalışması için Windows'a Android SDK'nın yerini göstermeliyiz.

1.  Windows Arama çubuğuna **"Sistem ortam değişkenlerini düzenleyin"** yazın ve açın.
2.  **Ortam Değişkenleri...** butonuna tıklayın.
3.  **Kullanıcı değişkenleri** (üstteki kutu) kısmında, `Path` değişkenini seçin ve **Düzenle** deyin.
4.  **Yeni** butonuna basarak şu yolu ekleyin (Kullanıcı adınızı düzeltin):
    *   `C:\Users\Morbilya\AppData\Local\Android\Sdk\platform-tools`
    *   `C:\Users\Morbilya\AppData\Local\Android\Sdk\emulator` (İsteğe bağlı)
5.  Tamam diyerek tüm pencereleri kapatın.

*Not: Eğer `AppData` klasörünü bulamazsanız, Dosya Gezgini'nde "Görünüm -> Gizli Öğeler" kutucuğunu işaretleyin.*

## 3. Sanal Telefon (Emulator) Oluşturma
1.  Android Studio'yu açın -> **More Actions** -> **Virtual Device Manager**.
2.  **Create Device** butonuna basın.
3.  Bir telefon seçin (Örn: Pixel 6) ve **Next** deyin.
4.  Bir Android sürümü indirin (Örn: Android 13 - Tiramisu) ve **Next/Finish** deyin.
5.  Oluşturduğunuz telefonun yanındaki **Play (▶)** butonuna basın. Sanal telefon açılacaktır.

## 4. Test Başlatma
Sanal telefon açıkken projenizde terminale şu komutu yazın:

```bash
npx expo start --android
```

Expo uygulamayı otomatik olarak sanal telefona yükleyip açacaktır.

---

## ALTERNATİF: Kendi Telefonunuzu Bilgisayara Yansıtma (Scrcpy)
Eğer sanal telefon bilgisayarınızı çok yorarsa, gerçek telefonunuzu bilgisayardan kontrol edebilirsiniz.

1.  Telefonunuzu USB ile bağlayın.
2.  Telefonda **Geliştirici Seçenekleri -> USB Hata Ayıklama (Debugging)** açın.
3.  Bilgisayara [scrcpy](https://github.com/Genymobile/scrcpy) indirin.
4.  `scrcpy.exe` çalıştırın. Telefon ekranınız bilgisayara gelecek ve mouse ile kullanabileceksiniz.
