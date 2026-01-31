import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { AnimatedItem } from '../../components/AnimatedList';
import { ListSkeleton } from '../../components/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { createUser, getAllUsers, updateUser } from '../../services/authService';
import toast from '../../services/toastService';
import { validateUserForm } from '../../utils/validation';

interface Kullanici {
    id: string;
    email: string;
    ad: string;
    soyad: string;
    telefon?: string;
    rol: 'musteri' | 'teknisyen' | 'yonetim';
    kategori?: string;
    aktif: boolean;
    olusturmaTarihi?: { seconds: number };
}

const rolConfig: Record<string, { label: string; color: string; icon: string }> = {
    musteri: { label: 'Müşteri', color: '#1565c0', icon: 'person' },
    teknisyen: { label: 'Teknisyen', color: '#ef6c00', icon: 'construct' },
    yonetim: { label: 'Yönetim', color: '#7b1fa2', icon: 'shield-checkmark' },
};

const kategoriSecenekleri = ['Tesisat', 'Elektrik', 'Boya', 'Mobilya', 'Pencere', 'Kapı', 'Diğer'];

export default function KullanicilarScreen() {
    const { user } = useAuth();
    const { isDark, colors } = useTheme();
    const router = useRouter();

    const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
    const [yukleniyor, setYukleniyor] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filtre, setFiltre] = useState<'hepsi' | 'musteri' | 'teknisyen' | 'yonetim'>('hepsi');
    const [aramaMetni, setAramaMetni] = useState('');

    // Yeni kullanıcı modalı
    const [modalVisible, setModalVisible] = useState(false);
    const [yeniKullanici, setYeniKullanici] = useState({
        email: '',
        sifre: '',
        ad: '',
        soyad: '',
        telefon: '',
        rol: 'musteri' as 'musteri' | 'teknisyen' | 'yonetim',
        kategori: '',
    });
    const [kaydetmeYukleniyor, setKaydetmeYukleniyor] = useState(false);

    // Admin şifre modalı
    const [adminSifreModalVisible, setAdminSifreModalVisible] = useState(false);
    const [adminSifre, setAdminSifre] = useState('');

    const verileriYukle = async () => {
        try {
            const result = await getAllUsers();
            if (result.success && result.users) {
                setKullanicilar(result.users as Kullanici[]);
            } else {
                setKullanicilar([]);
                console.error('Kullanıcı verisi formatı hatalı:', result);
            }
        } catch (error) {
            console.error('Kullanıcılar yüklenemedi:', error);
            setKullanicilar([]);
        }
        setYukleniyor(false);
        setRefreshing(false);
    };

    useEffect(() => {
        verileriYukle();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        verileriYukle();
    }, []);

    // Yönetici kontrolü - Güvenlik için
    useEffect(() => {
        if (user && user.rol !== 'yonetim') {
            router.replace('/');
        }
    }, [user]);

    const filtrelenmisKullanicilar = kullanicilar.filter(k => {
        let uygun = true;
        if (filtre !== 'hepsi') uygun = k.rol === filtre;

        if (uygun && aramaMetni) {
            const metin = aramaMetni.toLowerCase();
            uygun = (
                k.ad.toLowerCase().includes(metin) ||
                k.soyad.toLowerCase().includes(metin) ||
                k.email.toLowerCase().includes(metin)
            );
        }
        return uygun;
    });

    const aktiflikDegistir = async (kullanici: Kullanici) => {
        const yeniDurum = !kullanici.aktif;
        const result = await updateUser(kullanici.id, { aktif: yeniDurum });

        if (result.success) {
            setKullanicilar(prev =>
                prev.map(k => k.id === kullanici.id ? { ...k, aktif: yeniDurum } : k)
            );
            toast.success(`Kullanıcı ${yeniDurum ? 'aktif' : 'pasif'} yapıldı`);
        } else {
            toast.error(result.message || 'Güncelleme başarısız');
        }
    };

    const yeniKullaniciOlustur = async () => {
        // Merkezi doğrulama kullan
        const validation = validateUserForm(yeniKullanici);
        if (!validation.valid) {
            const firstError = Object.values(validation.errors)[0];
            toast.warning(firstError);
            return;
        }

        // Admin şifresini iste
        setAdminSifreModalVisible(true);
    };

    const kullaniciKaydet = async () => {
        if (!adminSifre) {
            toast.warning('Lütfen yönetici şifrenizi girin');
            return;
        }

        setKaydetmeYukleniyor(true);
        setAdminSifreModalVisible(false);

        const result = await createUser(yeniKullanici, user?.email || '', adminSifre);

        if (result.success) {
            toast.success('Kullanıcı başarıyla oluşturuldu!');

            setModalVisible(false);
            setYeniKullanici({
                email: '',
                sifre: '',
                ad: '',
                soyad: '',
                telefon: '',
                rol: 'musteri',
                kategori: '',
            });
            setAdminSifre('');
            verileriYukle();
        } else {
            toast.error(result.message || 'Kullanıcı oluşturulamadı');
        }

        setKaydetmeYukleniyor(false);
    };

    const istatistikler = {
        toplam: kullanicilar.length,
        musteri: kullanicilar.filter(k => k.rol === 'musteri').length,
        teknisyen: kullanicilar.filter(k => k.rol === 'teknisyen').length,
        yonetim: kullanicilar.filter(k => k.rol === 'yonetim').length,
    };

    if (yukleniyor) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <StatusBar barStyle="light-content" />
                <View style={[styles.header, { backgroundColor: colors.headerBg, marginBottom: 10 }]}>
                    <View style={{ height: 100 }} />
                </View>
                <ListSkeleton count={5} type="user" />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>Kullanıcı Yönetimi</Text>
                        <Text style={styles.headerSubtitle}>Toplam {istatistikler.toplam} kullanıcı</Text>
                    </View>
                    <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
                        <Ionicons name="person-add" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Arama */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="rgba(255,255,255,0.7)" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="İsim veya e-posta ara..."
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        value={aramaMetni}
                        onChangeText={setAramaMetni}
                    />
                    {aramaMetni.length > 0 && (
                        <TouchableOpacity onPress={() => setAramaMetni('')}>
                            <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* İstatistikler */}
                <View style={styles.statsRow}>
                    <TouchableOpacity style={styles.statChip} onPress={() => setFiltre('hepsi')}>
                        <Text style={[styles.statChipText, filtre === 'hepsi' && styles.statChipActive]}>
                            Tümü ({istatistikler.toplam})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.statChip} onPress={() => setFiltre('musteri')}>
                        <Text style={[styles.statChipText, filtre === 'musteri' && styles.statChipActive]}>
                            Müşteri ({istatistikler.musteri})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.statChip} onPress={() => setFiltre('teknisyen')}>
                        <Text style={[styles.statChipText, filtre === 'teknisyen' && styles.statChipActive]}>
                            Teknisyen ({istatistikler.teknisyen})
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Kullanıcı Listesi */}
            <FlatList
                data={filtrelenmisKullanicilar}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={60} color={colors.textMuted} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Kullanıcı bulunamadı</Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const rol = rolConfig[item.rol] || rolConfig.musteri;
                    return (
                        <AnimatedItem index={0} delay={50} style={{ marginBottom: 10 }}>
                            <View style={[styles.userCard, { backgroundColor: colors.card, marginBottom: 0 }]}>
                                <View style={[styles.userAvatar, { backgroundColor: rol.color + '20' }]}>
                                    <Ionicons name={rol.icon as any} size={24} color={rol.color} />
                                </View>
                                <View style={styles.userInfo}>
                                    <Text style={[styles.userName, { color: colors.text }]}>
                                        {item.ad} {item.soyad}
                                    </Text>
                                    <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{item.email}</Text>
                                    <View style={styles.userMeta}>
                                        <View style={[styles.rolBadge, { backgroundColor: rol.color + '20' }]}>
                                            <Text style={[styles.rolText, { color: rol.color }]}>{rol.label}</Text>
                                        </View>
                                        {item.kategori && (
                                            <Text style={[styles.kategoriText, { color: colors.textMuted }]}>• {item.kategori}</Text>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.switchContainer}>
                                    <Text style={[styles.switchLabel, { color: item.aktif ? '#4caf50' : '#f44336' }]}>
                                        {item.aktif ? 'Aktif' : 'Pasif'}
                                    </Text>
                                    <Switch
                                        value={item.aktif}
                                        onValueChange={() => aktiflikDegistir(item)}
                                        trackColor={{ false: '#ccc', true: '#81c784' }}
                                        thumbColor={item.aktif ? '#4caf50' : '#f44336'}
                                    />
                                </View>
                            </View>
                        </AnimatedItem>
                    );
                }}
            />

            {/* Yeni Kullanıcı Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Yeni Kullanıcı</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={styles.modalBody}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>E-posta *</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                placeholder="ornek@email.com"
                                placeholderTextColor={colors.textMuted}
                                value={yeniKullanici.email}
                                onChangeText={(t) => setYeniKullanici({ ...yeniKullanici, email: t })}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Şifre *</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                placeholder="En az 6 karakter"
                                placeholderTextColor={colors.textMuted}
                                value={yeniKullanici.sifre}
                                onChangeText={(t) => setYeniKullanici({ ...yeniKullanici, sifre: t })}
                                secureTextEntry
                            />

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Ad *</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                        placeholder="Ad"
                                        placeholderTextColor={colors.textMuted}
                                        value={yeniKullanici.ad}
                                        onChangeText={(t) => setYeniKullanici({ ...yeniKullanici, ad: t })}
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Soyad *</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                        placeholder="Soyad"
                                        placeholderTextColor={colors.textMuted}
                                        value={yeniKullanici.soyad}
                                        onChangeText={(t) => setYeniKullanici({ ...yeniKullanici, soyad: t })}
                                    />
                                </View>
                            </View>

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Telefon</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                placeholder="0532 123 4567"
                                placeholderTextColor={colors.textMuted}
                                value={yeniKullanici.telefon}
                                onChangeText={(t) => setYeniKullanici({ ...yeniKullanici, telefon: t })}
                                keyboardType="phone-pad"
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Rol *</Text>
                            <View style={styles.rolSecim}>
                                {(['musteri', 'teknisyen', 'yonetim'] as const).map((rol) => (
                                    <TouchableOpacity
                                        key={rol}
                                        style={[
                                            styles.rolButon,
                                            yeniKullanici.rol === rol && { backgroundColor: rolConfig[rol].color },
                                        ]}
                                        onPress={() => setYeniKullanici({ ...yeniKullanici, rol, kategori: '' })}
                                    >
                                        <Ionicons
                                            name={rolConfig[rol].icon as any}
                                            size={18}
                                            color={yeniKullanici.rol === rol ? '#fff' : rolConfig[rol].color}
                                        />
                                        <Text
                                            style={[
                                                styles.rolButonText,
                                                { color: yeniKullanici.rol === rol ? '#fff' : colors.text },
                                            ]}
                                        >
                                            {rolConfig[rol].label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {yeniKullanici.rol === 'teknisyen' && (
                                <>
                                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Uzmanlık Kategorisi *</Text>
                                    <View style={styles.kategoriSecim}>
                                        {kategoriSecenekleri.map((kat) => (
                                            <TouchableOpacity
                                                key={kat}
                                                style={[
                                                    styles.kategoriButon,
                                                    { borderColor: colors.border },
                                                    yeniKullanici.kategori === kat && { backgroundColor: colors.primary, borderColor: colors.primary },
                                                ]}
                                                onPress={() => setYeniKullanici({ ...yeniKullanici, kategori: kat })}
                                            >
                                                <Text
                                                    style={[
                                                        styles.kategoriButonText,
                                                        { color: yeniKullanici.kategori === kat ? '#fff' : colors.text },
                                                    ]}
                                                >
                                                    {kat}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.kaydetButon, kaydetmeYukleniyor && { opacity: 0.7 }]}
                            onPress={yeniKullaniciOlustur}
                            disabled={kaydetmeYukleniyor}
                        >
                            {kaydetmeYukleniyor ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="person-add" size={20} color="#fff" />
                                    <Text style={styles.kaydetButonText}>Kullanıcı Oluştur</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Admin Şifre Modalı */}
            <Modal visible={adminSifreModalVisible} animationType="fade" transparent onRequestClose={() => setAdminSifreModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.sifreModalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.sifreModalTitle, { color: colors.text }]}>Yönetici Doğrulama</Text>
                        <Text style={[styles.sifreModalDesc, { color: colors.textSecondary }]}>
                            Yeni kullanıcı oluşturmak için şifrenizi girin.
                        </Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                            placeholder="Şifreniz"
                            placeholderTextColor={colors.textMuted}
                            value={adminSifre}
                            onChangeText={setAdminSifre}
                            secureTextEntry
                        />
                        <View style={styles.sifreModalButtons}>
                            <TouchableOpacity
                                style={[styles.sifreModalBtn, { backgroundColor: colors.border }]}
                                onPress={() => { setAdminSifreModalVisible(false); setAdminSifre(''); }}
                            >
                                <Text style={{ color: colors.text }}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.sifreModalBtn, { backgroundColor: colors.primary }]} onPress={kullaniciKaydet}>
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Onayla</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, fontSize: 14 },
    header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20 },
    headerTop: { flexDirection: 'row', alignItems: 'center' },
    backButton: { marginRight: 12 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    addButton: { padding: 8 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, marginTop: 16, paddingHorizontal: 12 },
    searchInput: { flex: 1, paddingVertical: 10, color: '#fff', fontSize: 14, marginLeft: 8 },
    statsRow: { flexDirection: 'row', marginTop: 12 },
    statChip: { marginRight: 12 },
    statChipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
    statChipActive: { color: '#fff', fontWeight: '600' },
    listContent: { padding: 16 },
    emptyContainer: { alignItems: 'center', marginTop: 60 },
    emptyText: { marginTop: 12, fontSize: 15 },
    userCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    userAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    userInfo: { flex: 1, marginLeft: 12 },
    userName: { fontSize: 16, fontWeight: '600' },
    userEmail: { fontSize: 13, marginTop: 2 },
    userMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    rolBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    rolText: { fontSize: 11, fontWeight: '600' },
    kategoriText: { fontSize: 11, marginLeft: 6 },
    switchContainer: { alignItems: 'center' },
    switchLabel: { fontSize: 10, marginBottom: 4, fontWeight: '500' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)' },
    modalTitle: { fontSize: 18, fontWeight: '700' },
    modalBody: { padding: 20 },
    inputLabel: { fontSize: 13, marginBottom: 6, fontWeight: '500' },
    input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 16 },
    row: { flexDirection: 'row' },
    rolSecim: { flexDirection: 'row', marginBottom: 16 },
    rolButon: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.05)', marginRight: 8 },
    rolButonText: { marginLeft: 6, fontSize: 13, fontWeight: '500' },
    kategoriSecim: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
    kategoriButon: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
    kategoriButonText: { fontSize: 13 },
    kaydetButon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4caf50', padding: 16, margin: 20, borderRadius: 12 },
    kaydetButonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
    sifreModalContent: { margin: 20, borderRadius: 16, padding: 24 },
    sifreModalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
    sifreModalDesc: { fontSize: 14, marginBottom: 16 },
    sifreModalButtons: { flexDirection: 'row', marginTop: 8 },
    sifreModalBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', marginHorizontal: 4 },
});
