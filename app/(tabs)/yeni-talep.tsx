import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import OptimizedImage from '../../components/OptimizedImage';
import { KATEGORILER } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getProjeler } from '../../services/ekipService';
import { createTalep } from '../../services/talepService';

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

export default function YeniTalepScreen() {
    const { user } = useAuth();
    const { isDark, colors } = useTheme();
    const router = useRouter();

    // Role Redirect Guard
    // Bu sayfa SADECE müşteri içindir (şimdilik), ama belki ilerde başkaları da girebilir.
    // Müşteri olmayanları buraya almamak mantıklı mı?
    // Evet, çünkü form müşteri adına açılıyor.
    useEffect(() => {
        if (user?.rol === 'teknisyen') {
            router.replace('/teknisyen');
        } else if (user?.rol === 'yonetim') {
            router.replace('/yonetim');
        }
    }, [user]);

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
            if (result.success && result.data) {
                setProjeler(result.data);
            }
            setProjeYukleniyor(false);
        };
        yukle();
    }, []);

    const fotografSec = async () => {
        if (fotograflar.length >= 3) {
            Platform.OS === 'web'
                ? alert('En fazla 3 fotoğraf ekleyebilirsiniz.')
                : Alert.alert('Limit', 'En fazla 3 fotoğraf ekleyebilirsiniz.');
            return;
        }

        if (Platform.OS === 'web') {
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
            // Compress heavily to ensure Firestore 1MB limit isn't breached easily
            const result = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 600 } }], // Reduced width for safety
                { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            if (result.base64) {
                const base64Uri = `data:image/jpeg;base64,${result.base64}`;
                setFotograflar([...fotograflar, base64Uri]);
            }
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
            quality: 0.5, // Lower quality initial capture
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
            quality: 0.5, // Lower quality initial select
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
            // Fotograflar zaten Base64 formatında state'te tutuluyor
            // Direkt Firestore'a kaydedeceğiz.

            const result = await createTalep({
                olusturanId: user?.uid!,
                olusturanAd: `${user?.ad} ${user?.soyad}`,
                olusturanTelefon: telefon,
                // Backward compatibility if needed:
                musteriAdi: `${user?.ad} ${user?.soyad}`,
                musteriTelefon: telefon,

                projeAdi: seciliProje,
                blokAdi: seciliBlok,
                daireNo: seciliDaire,
                kategori: seciliKategori,
                baslik: sorunBasligi,
                aciklama: aciklama,
                fotograflar: fotograflar, // Base64 array
                oncelik: 'normal',
            });


            if (result.success) {
                // Adminlere bildirim gönder
                try {
                    const { collection, query, where, getDocs } = require('firebase/firestore');
                    const { db } = require('../../firebaseConfig');
                    const { sendPushNotification } = require('../../services/notificationService');

                    const adminQuery = query(collection(db, 'users'), where('rol', '==', 'yonetim'));
                    const adminSnaps = await getDocs(adminQuery);

                    adminSnaps.forEach((doc: any) => {
                        const adminData = doc.data();
                        if (adminData.pushToken) {
                            sendPushNotification(
                                adminData.pushToken,
                                'Yeni Destek Talebi 🆕',
                                `${seciliProje} - ${seciliKategori}: ${sorunBasligi}`
                            );
                        }
                    });
                } catch (notiError) {
                    console.error('Admin bildirim hatası:', notiError);
                }

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
                router.push('/(tabs)/taleplerim'); // Yönlendir
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

    const kategoriler = KATEGORILER;
    const projeAdlari = projeler.map((p) => p.ad);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

            {/* Header */}
            <LinearGradient
                colors={['#1a3a5c', '#203a43', '#2c5364']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    {/* Geri Butonu Ekleyelim */}
                    <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View>
                            <Text style={styles.headerTitle}>Yeni Talep</Text>
                            <Text style={styles.headerSubtitle}>Sorun bildirin, çözelim</Text>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
                                    <OptimizedImage source={{ uri: foto }} style={styles.fotoPreview} />
                                    <TouchableOpacity
                                        style={styles.fotoSilBtn}
                                        onPress={() => fotografSil(index)}
                                    >
                                        <Ionicons name="close-circle" size={24} color="#ff1744" />
                                    </TouchableOpacity>
                                </View>
                            ))}

                            {fotograflar.length < 3 && (
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
                            En fazla 3 fotoğraf ekleyebilirsiniz. (Max 800px)
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
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    settingsButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
    userInfo: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20 },
    userAvatar: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center' },
    userAvatarText: { fontSize: 20, fontWeight: 'bold' },
    userTextContainer: { marginLeft: 16 },
    userName: { fontSize: 18, fontWeight: 'bold' },
    userEmail: { fontSize: 13 },
    content: { flex: 1, padding: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 10 },
    sectionHeaderText: { fontSize: 22, fontWeight: '800', marginLeft: 10 },
    card: { borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3, borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' },
    cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, opacity: 0.9 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
    input: { borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 16, marginBottom: 16 },
    textArea: { height: 120, textAlignVertical: 'top' },
    dropdownContainer: { marginBottom: 16 },
    dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 16 },
    dropdownDisabled: { opacity: 0.5 },
    dropdownText: { fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '70%', paddingBottom: 30 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    modalItemText: { fontSize: 16 },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    catChip: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 24, borderWidth: 1.5 },
    catChipText: { fontSize: 14, fontWeight: '600' },
    emptyProje: { alignItems: 'center', padding: 30 },
    emptyProjeText: { fontSize: 15, marginTop: 12 },
    submitButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 16, gap: 10, shadowColor: '#c62828', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, marginBottom: 40 },
    submitButtonDisabled: { opacity: 0.7 },
    submitLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    submitButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    fotoContainer: { marginBottom: 16 },
    fotoList: { gap: 16, alignItems: 'center' },
    fotoWrapper: { position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    fotoPreview: { width: 90, height: 90, borderRadius: 12 },
    fotoSilBtn: { position: 'absolute', top: -10, right: -10, backgroundColor: '#fff', borderRadius: 15, elevation: 2 },
    fotoEkleBtn: { width: 90, height: 90, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 6 },
    fotoEkleText: { fontSize: 13, fontWeight: '600' },
    fotoHint: { fontSize: 12, marginTop: 10, fontStyle: 'italic', textAlign: 'center' },
});
