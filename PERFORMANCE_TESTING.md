# DNA DESTEK - Performans Test Rehberi

## 1. React Native Performance Monitoring

### Flipper ile Profiling (Development)
```bash
# Flipper'ı indir: https://fbflipper.com/
# Expo dev client ile kullan
npx expo start --dev-client
```

### React DevTools Performance Tab
```bash
# Chrome uzantısı yükle
# Expo web modunda F12 > Performance
npm run web
```

---

## 2. Firebase Performance Monitoring (Production)

### Kurulum
```bash
npx expo install @react-native-firebase/perf
```

### app.json'a ekle
```json
{
  "expo": {
    "plugins": [
      "@react-native-firebase/perf"
    ]
  }
}
```

> ⚠️ Firebase Performance Monitoring ücretsizdir.

---

## 3. Temel Performans Metrikleri

| Metrik | Hedef | Nasıl Ölçülür |
|--------|-------|---------------|
| **TTI** (Time to Interactive) | < 3s | Flipper / Lighthouse |
| **FPS** (Frame Rate) | 60 FPS | React DevTools |
| **Memory** | < 200MB | Android Profiler |
| **API Response** | < 500ms | Firebase Console |

---

## 4. Yük Testi (Load Testing)

### Firestore Okuma Yükü
```javascript
// scripts/load_test.js
const iterations = 100;
console.time('Firestore Read');
for (let i = 0; i < iterations; i++) {
  await getDocs(collection(db, 'talepler'));
}
console.timeEnd('Firestore Read');
```

### Çalıştırma
```bash
node scripts/load_test.js
```

---

## 5. Bundle Size Analizi

```bash
# Expo ile bundle analizi
npx expo export --platform web
# Çıktı: dist/ klasöründe

# Bundle boyutunu kontrol et
du -sh dist/
```

---

## 6. Önerilen Optimizasyonlar

| Alan | Öneri |
|------|-------|
| **Listeler** | FlashList kullan (zaten var) |
| **Görseller** | expo-image (zaten var) |
| **Memoization** | useMemo/useCallback |
| **Lazy Loading** | React.lazy + Suspense |
| **Firestore** | Pagination (zaten var) |

---

## 7. CI'da Performance Budgets

```yaml
# .github/workflows/perf.yml
- name: Bundle Size Check
  run: |
    SIZE=$(du -sb dist/ | cut -f1)
    if [ $SIZE -gt 10000000 ]; then
      echo "Bundle too large: $SIZE bytes"
      exit 1
    fi
```

---

## Sonuç

Performans izleme için:
1. **Development:** Flipper + React DevTools
2. **Production:** Firebase Performance (ücretsiz)
3. **CI:** Bundle size budgets
