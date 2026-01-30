import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { createTalep, getProjeler, uploadImage } from '../../firebaseConfig';
import toast from '../../services/toastService';

// Dropdown bileşeni
interface DropdownProps {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  colors: any;
  isDark: boolean;
}

const Dropdown = ({ label, value, options, onSelect, placeholder, disabled, colors, isDark }: DropdownProps) => {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.dropdownContainer}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.dropdown,
          { backgroundColor: colors.inputBg, borderColor: colors.border },
          disabled && styles.dropdownDisabled
        ]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
      >
        <Text style={[styles.dropdownText, { color: colors.text }, !value && { color: colors.textMuted }]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{label} Seçin</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    { borderBottomColor: colors.border },
                    value === item && { backgroundColor: isDark ? '#1a3a5c' : '#f0f7ff' }
                  ]}
                  onPress={() => {
                    onSelect(item);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, { color: colors.text }, value === item && { color: colors.primary, fontWeight: '600' }]}>
                    {item}
                  </Text>
                  {value === item && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// Proje tipi
interface Proje {
  id: string;
  ad: string;
  bloklar: { ad: string; daireler: string[] }[];
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { isDark, colors } = useTheme();
  const router = useRouter();

  // Form state
  const [telefon, setTelefon] = useState('');
  const [seciliProje, setSeciliProje] = useState('');
  const [seciliBlok, setSeciliBlok] = useState('');
  const [seciliDaire, setSeciliDaire] = useState('');
  const [seciliKategori, setSeciliKategori] = useState('');
  const [sorunBasligi, setSorunBasligi] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [fotograflar, setFotograflar] = useState<string[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [resimYukleniyor, setResimYukleniyor] = useState(false);

  // Proje verileri
  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [projeYukleniyor, setProjeYukleniyor] = useState(true);

  useEffect(() => {
    if (user?.telefon) {
      setTelefon(user.telefon);
    }
  }, [user]);

  useEffect(() => {
    const yukle = async () => {
      const result = await getProjeler();
      if (result.success) {
        setProjeler(result.projeler as Proje[]);
      }
      setProjeYukleniyor(false);
    };
    yukle();
  }, []);

  const fotografSec = async () => {
    if (fotograflar.length >= 2) {
      Platform.OS === 'web'
        ? alert('En fazla 2 fotoğraf ekleyebilirsiniz.')
        : Alert.alert('Limit', 'En fazla 2 fotoğraf ekleyebilirsiniz.');
      return;
    }

    if (Platform.OS === 'web') {
      // Web'de Alert buton desteği sınırlı olduğu için direkt galeriyi açıyoruz
      // İstenirse burada özel bir modal ile seçim yaptırılabilir
      galeridenSec();
    } else {
      Alert.alert(
        'Fotoğraf Ekle',
        'Fotoğraf kaynağını seçin',
        [
          {
            text: 'Kamera',
            onPress: () => kameradanCek(),
          },
          {
            text: 'Galeri',
            onPress: () => galeridenSec(),
          },
          {
            text: 'İptal',
            style: 'cancel',
          },
        ]
      );
    }
  };

  const resmiIsleVeEkle = async (uri: string) => {
    try {
      setResimYukleniyor(true);
      // Resmi sıkıştır ve boyutlandır
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }], // Genişlik max 800px
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      setFotograflar([...fotograflar, result.uri]);
    } catch (error) {
      console.error('Resim işleme hatası:', error);
      Alert.alert('Hata', 'Fotoğraf işlenirken bir sorun oluştu.');
    } finally {
      setResimYukleniyor(false);
    }
  };

  const kameradanCek = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Kamera izni vermeniz gerekiyor.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      resmiIsleVeEkle(result.assets[0].uri);
    }
  };

  const galeridenSec = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Galeri erişim izni vermeniz gerekiyor.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      resmiIsleVeEkle(result.assets[0].uri);
    }
  };

  const fotografSil = (index: number) => {
    const yeniFotograflar = [...fotograflar];
    yeniFotograflar.splice(index, 1);
    setFotograflar(yeniFotograflar);
  };

  const bloklar = projeler.find((p) => p.ad === seciliProje)?.bloklar || [];
  const blokAdlari = bloklar.map((b) => b.ad);
  const daireler = bloklar.find((b) => b.ad === seciliBlok)?.daireler || [];

  const handleProjeChange = (proje: string) => {
    setSeciliProje(proje);
    setSeciliBlok('');
    setSeciliDaire('');
  };

  const handleBlokChange = (blok: string) => {
    setSeciliBlok(blok);
    setSeciliDaire('');
  };

  const talepGonder = async () => {
    if (!telefon.trim()) {
      Platform.OS === 'web' ? alert('Lütfen telefon numaranızı girin.') : Alert.alert('Eksik Bilgi', 'Lütfen telefon numaranızı girin.');
      return;
    }
    if (!seciliProje) {
      Platform.OS === 'web' ? alert('Lütfen proje seçin.') : Alert.alert('Eksik Bilgi', 'Lütfen proje seçin.');
      return;
    }
    if (!seciliKategori) {
      Platform.OS === 'web' ? alert('Lütfen kategori seçin.') : Alert.alert('Eksik Bilgi', 'Lütfen kategori seçin.');
      return;
    }
    if (!sorunBasligi.trim()) {
      Platform.OS === 'web' ? alert('Lütfen sorun başlığı yazın.') : Alert.alert('Eksik Bilgi', 'Lütfen sorun başlığı yazın.');
      return;
    }

    setYukleniyor(true);

    try {
      // Fotoğrafları Firebase Storage'a Yükle
      const yuklenenFotoUrls: string[] = [];
      if (fotograflar.length > 0) {
        for (let i = 0; i < fotograflar.length; i++) {
          const uri = fotograflar[i];
          const filename = `talep_${user?.uid}_${Date.now()}_${i}.jpg`;
          const path = `talepler/${user?.uid}/${filename}`;

          try {
            const result = await uploadImage(uri, path);
            if (result.success) {
              yuklenenFotoUrls.push(result.downloadURL!);
            } else {
              console.error('Fotoğraf yüklenemedi:', uri, result.message);
              toast.error(`Fotoğraf ${i + 1} yüklenemedi`);
            }
          } catch (imgError) {
            console.error('Fotoğraf yükleme hatası:', imgError);
          }
        }
      }
      const result = await createTalep({
        musteriId: user?.uid,
        musteriAdi: `${user?.ad} ${user?.soyad}`,
        musteriTelefon: telefon,
        projeAdi: seciliProje,
        blokAdi: seciliBlok,
        daireNo: seciliDaire,
        kategori: seciliKategori,
        baslik: sorunBasligi,
        aciklama: aciklama,
        fotograflar: yuklenenFotoUrls,
      });

      if (result.success) {
        Platform.OS === 'web'
          ? alert('✅ Destek talebiniz başarıyla oluşturuldu!')
          : Alert.alert('Başarılı! ✅', 'Destek talebiniz başarıyla oluşturuldu.', [{ text: 'Tamam' }]);

        setSeciliProje('');
        setSeciliBlok('');
        setSeciliDaire('');
        setSeciliKategori('');
        setSorunBasligi('');
        setAciklama('');
        setFotograflar([]); // Fotoğrafları temizle
      } else {
        Platform.OS === 'web'
          ? alert('Hata: ' + (result.message || 'Talep oluşturulamadı.'))
          : Alert.alert('Hata', result.message || 'Talep oluşturulamadı.');
      }
    } catch (error: any) {
      Platform.OS === 'web'
        ? alert('Hata: ' + (error.message || 'Bir hata oluştu.'))
        : Alert.alert('Hata', error.message || 'Bir hata oluştu.');
    } finally {
      setYukleniyor(false);
    }
  };

  const kategoriler = ['Tesisat', 'Elektrik', 'Boya', 'Mobilya', 'Pencere', 'Kapı', 'Diğer'];
  const projeAdlari = projeler.map((p) => p.ad);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.headerText }]}>DNA DESTEK</Text>
            <Text style={styles.headerSubtitle}>Yapı & Teknik Çözüm Merkezi</Text>
          </View>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/ayarlar')}>
            <Ionicons name="settings-outline" size={24} color={colors.headerText} />
          </TouchableOpacity>
        </View>
        <View style={[styles.userInfo, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {user?.ad?.charAt(0)}{user?.soyad?.charAt(0)}
            </Text>
          </View>
          <View style={styles.userTextContainer}>
            <Text style={styles.userName}>{user?.ad} {user?.soyad}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <Ionicons name="create-outline" size={24} color={colors.primary} />
          <Text style={[styles.sectionHeaderText, { color: colors.text }]}>Yeni Destek Talebi</Text>
        </View>

        {/* Telefon */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>📞 Telefon Numarası</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            placeholder="0532 123 4567"
            placeholderTextColor={colors.textMuted}
            value={telefon}
            onChangeText={setTelefon}
            keyboardType="phone-pad"
          />
        </View>

        {/* Proje Seçimi */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>📍 Konum Bilgisi</Text>
          {projeYukleniyor ? (
            <ActivityIndicator color={colors.primary} />
          ) : projeler.length === 0 ? (
            <View style={styles.emptyProje}>
              <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyProjeText, { color: colors.textMuted }]}>Henüz proje eklenmemiş</Text>
            </View>
          ) : (
            <>
              <Dropdown label="Proje" value={seciliProje} options={projeAdlari} onSelect={handleProjeChange} placeholder="Proje seçin..." colors={colors} isDark={isDark} />
              <Dropdown label="Blok" value={seciliBlok} options={blokAdlari} onSelect={handleBlokChange} placeholder="Blok seçin..." disabled={!seciliProje} colors={colors} isDark={isDark} />
              <Dropdown label="Daire No" value={seciliDaire} options={daireler} onSelect={setSeciliDaire} placeholder="Daire seçin..." disabled={!seciliBlok} colors={colors} isDark={isDark} />
            </>
          )}
        </View>

        {/* Kategori */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>🏷️ Sorun Kategorisi</Text>
          <View style={styles.categoryGrid}>
            {kategoriler.map((kategori) => (
              <TouchableOpacity
                key={kategori}
                style={[
                  styles.catChip,
                  { backgroundColor: isDark ? colors.inputBg : '#f0f0f0', borderColor: 'transparent' },
                  seciliKategori === kategori && { backgroundColor: isDark ? '#1a3a5c' : '#e3f2fd', borderColor: colors.primary }
                ]}
                onPress={() => setSeciliKategori(kategori)}
              >
                <Text style={[
                  styles.catChipText,
                  { color: colors.textSecondary },
                  seciliKategori === kategori && { color: colors.primary, fontWeight: '600' }
                ]}>
                  {kategori}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sorun Detayları */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>📝 Sorun Detayları</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Başlık *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            placeholder="Kısa ve öz bir başlık yazın"
            placeholderTextColor={colors.textMuted}
            value={sorunBasligi}
            onChangeText={setSorunBasligi}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Fotoğraf Ekle (Opsiyonel)</Text>
          <View style={styles.fotoContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fotoList}>
              {fotograflar.map((foto, index) => (
                <View key={index} style={styles.fotoWrapper}>
                  <Image source={{ uri: foto }} style={styles.fotoPreview} />
                  <TouchableOpacity
                    style={styles.fotoSilBtn}
                    onPress={() => fotografSil(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#ff1744" />
                  </TouchableOpacity>
                </View>
              ))}

              {fotograflar.length < 2 && (
                <TouchableOpacity
                  style={[styles.fotoEkleBtn, { borderColor: colors.border, backgroundColor: isDark ? colors.inputBg : '#f8f9fa' }]}
                  onPress={fotografSec}
                  disabled={resimYukleniyor}
                >
                  {resimYukleniyor ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={24} color={colors.textSecondary} />
                      <Text style={[styles.fotoEkleText, { color: colors.textSecondary }]}>Ekle</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
            <Text style={[styles.fotoHint, { color: colors.textMuted }]}>
              En fazla 2 fotoğraf ekleyebilirsiniz. (Max 800px)
            </Text>
          </View>

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Açıklama</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            placeholder="Sorunu detaylıca açıklayın..."
            placeholderTextColor={colors.textMuted}
            multiline={true}
            numberOfLines={4}
            value={aciklama}
            onChangeText={setAciklama}
          />
        </View>

        {/* Gönder */}
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }, yukleniyor && styles.submitButtonDisabled]}
          onPress={talepGonder}
          disabled={yukleniyor}
        >
          {yukleniyor ? (
            <View style={styles.submitLoading}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.submitButtonText}>Gönderiliyor...</Text>
            </View>
          ) : (
            <>
              <Ionicons name="paper-plane" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>TALEBİ GÖNDER</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  settingsButton: { padding: 8 },
  userInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 15, padding: 12, borderRadius: 12 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  userTextContainer: { marginLeft: 12 },
  userName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  userEmail: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  content: { flex: 1, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionHeaderText: { fontSize: 20, fontWeight: 'bold', marginLeft: 8 },
  card: { borderRadius: 16, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 12 },
  textArea: { height: 90, textAlignVertical: 'top' },
  dropdownContainer: { marginBottom: 12 },
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 14 },
  dropdownDisabled: { opacity: 0.5 },
  dropdownText: { fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: 'bold' },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  modalItemText: { fontSize: 15 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  catChipText: { fontSize: 13, fontWeight: '500' },
  emptyProje: { alignItems: 'center', padding: 20 },
  emptyProjeText: { fontSize: 14, marginTop: 10 },
  submitButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 12, gap: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitButtonDisabled: { opacity: 0.7 },
  submitLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  fotoContainer: { marginBottom: 16 },
  fotoList: { gap: 12, alignItems: 'center' },
  fotoWrapper: { position: 'relative' },
  fotoPreview: { width: 80, height: 80, borderRadius: 8 },
  fotoSilBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#fff', borderRadius: 12 },
  fotoEkleBtn: { width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 4 },
  fotoEkleText: { fontSize: 12, fontWeight: '500' },
  fotoHint: { fontSize: 11, marginTop: 6, fontStyle: 'italic' },
});