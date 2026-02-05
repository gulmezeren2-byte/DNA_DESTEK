import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ListSkeleton } from '../../components/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getAllUsers } from '../../services/authService';
import {
    addUserToEkip,
    createDefaultEkipler,
    createEkip,
    deleteEkip,
    getAllEkipler,
    removeUserFromEkip,
    updateEkip,
} from '../../services/ekipService';
import toast from '../../services/toastService';
import { Ekip } from '../../types';

interface Kullanici {
    id: string;
    ad: string;
    soyad: string;
    email: string;
    rol: string;
    aktif: boolean;
}

const RENK_SECENEKLERI = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6',
];

export default function EkiplerScreen() {
    const { user, isYonetim, isBoardMember } = useAuth();
    const { isDark, colors } = useTheme();
    const router = useRouter();

    // SEC-003 FIX: Immediate role guard - prevents content flash
    if (!isYonetim) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#121212' : '#fff' }}>
                <Ionicons name="lock-closed" size={64} color={isDark ? '#666' : '#ccc'} />
                <Text style={{ marginTop: 16, fontSize: 18, color: isDark ? '#aaa' : '#666' }}>
                    Bu sayfaya erişim yetkiniz yok
                </Text>
                <TouchableOpacity
                    onPress={() => router.replace('/(tabs)')}
                    style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 8 }}
                >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Ana Sayfaya Dön</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const [ekipler, setEkipler] = useState<Ekip[]>([]);
    const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
    const [yukleniyor, setYukleniyor] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modal states
    const [ekipModalVisible, setEkipModalVisible] = useState(false);
    const [uyeModalVisible, setUyeModalVisible] = useState(false);
    const [seciliEkip, setSeciliEkip] = useState<Ekip | null>(null);
    const [islemYukleniyor, setIslemYukleniyor] = useState(false);

    // Yeni ekip formu
    const [yeniEkipAd, setYeniEkipAd] = useState('');
    const [yeniEkipRenk, setYeniEkipRenk] = useState('#3b82f6');
    const [duzenlemeMode, setDuzenlemeMode] = useState(false);


    const verileriYukle = async () => {
        const [ekipResult, kullaniciResult] = await Promise.all([
            getAllEkipler(),
            getAllUsers(),
        ]);

        if (ekipResult.success && ekipResult.data) {
            setEkipler(ekipResult.data.filter(e => e.aktif));
        }

        // Fix: Handle getAllUsers object response
        if (kullaniciResult.success && Array.isArray(kullaniciResult.data)) {
            const users = kullaniciResult.data as Kullanici[];
            setKullanicilar(users.filter((u: any) => (u.rol === 'teknisyen' || u.role === 'teknisyen') && u.aktif));
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

    // Ekip oluştur/güncelle
    const ekipKaydet = async () => {
        if (!yeniEkipAd.trim()) {
            toast.warning('Ekip adı zorunludur');
            return;
        }

        setIslemYukleniyor(true);

        let result;
        if (duzenlemeMode && seciliEkip) {
            result = await updateEkip(seciliEkip.id, {
                ad: yeniEkipAd.trim(),
                renk: yeniEkipRenk,
            });
            if (result.success) {
                toast.success('Ekip güncellendi!');
            }
        } else {
            result = await createEkip({
                ad: yeniEkipAd.trim(),
                renk: yeniEkipRenk,
            });
            if (result.success) {
                toast.success('Ekip oluşturuldu!');
            }
        }

        if (!result.success) {
            toast.error(result.message || 'İşlem başarısız');
        } else {
            setEkipModalVisible(false);
            resetForm();
            verileriYukle();
        }

        setIslemYukleniyor(false);
    };

    // Ekip sil
    const ekipSil = async (ekip: Ekip) => {
        setIslemYukleniyor(true);
        const result = await deleteEkip(ekip.id);

        if (result.success) {
            toast.success('Ekip silindi!');
            verileriYukle();
        } else {
            toast.error(result.message || 'Ekip silinemedi');
        }
        setIslemYukleniyor(false);
    };

    // Üye ekle
    const uyeEkle = async (kullaniciId: string) => {
        if (!seciliEkip) return;

        setIslemYukleniyor(true);
        // Arguman sirasi: ekipId, userId
        const result = await addUserToEkip(seciliEkip.id, kullaniciId);

        if (result.success) {
            toast.success('Üye eklendi!');
            verileriYukle();
            // Secili ekibi güncelle
            setSeciliEkip({
                ...seciliEkip,
                uyeler: [...seciliEkip.uyeler, kullaniciId],
            });
        } else {
            toast.error(result.message || 'Üye eklenemedi');
        }
        setIslemYukleniyor(false);
    };

    // Üye çıkar
    const uyeCikar = async (kullaniciId: string) => {
        if (!seciliEkip) return;

        setIslemYukleniyor(true);
        // Arguman sirasi: ekipId, userId
        const result = await removeUserFromEkip(seciliEkip.id, kullaniciId);

        if (result.success) {
            toast.success('Üye çıkarıldı!');
            verileriYukle();
            setSeciliEkip({
                ...seciliEkip,
                uyeler: seciliEkip.uyeler.filter(id => id !== kullaniciId),
            });
        } else {
            toast.error(result.message || 'Üye çıkarılamadı');
        }
        setIslemYukleniyor(false);
    };

    // Varsayılan ekipleri oluştur
    const varsayilanEkipleriOlustur = async () => {
        setIslemYukleniyor(true);
        const result = await createDefaultEkipler();

        if (result.success) {
            toast.success(result.message || '');
            verileriYukle();
        } else {
            toast.error(result.message || '');
        }
        setIslemYukleniyor(false);
    };

    const resetForm = () => {
        setYeniEkipAd('');
        setYeniEkipRenk('#3b82f6');
        setDuzenlemeMode(false);
        setSeciliEkip(null);
    };

    const ekipDuzenle = (ekip: Ekip) => {
        setSeciliEkip(ekip);
        setYeniEkipAd(ekip.ad);
        setYeniEkipRenk(ekip.renk);
        setDuzenlemeMode(true);
        setEkipModalVisible(true);
    };

    const uyeYonetModalAc = (ekip: Ekip) => {
        setSeciliEkip(ekip);
        setUyeModalVisible(true);
    };

    const getKullaniciAdi = (kullaniciId: string) => {
        const kullanici = kullanicilar.find(k => k.id === kullaniciId);
        return kullanici ? `${kullanici.ad} ${kullanici.soyad}` : 'Bilinmiyor';
    };

    // Ekip kartı
    const renderEkipKart = ({ item }: { item: Ekip }) => (
        <View style={[styles.ekipCard, { backgroundColor: colors.card }]}>
            <View style={[styles.ekipRenk, { backgroundColor: item.renk }]} />
            <View style={styles.ekipInfo}>
                <Text style={[styles.ekipAdi, { color: colors.text }]}>{item.ad}</Text>
                <Text style={[styles.ekipUyeSayisi, { color: colors.textSecondary }]}>
                    {item.uyeler.length} üye
                </Text>
                <View style={styles.uyeAvatarlar}>
                    {item.uyeler.slice(0, 3).map((uyeId, index) => (
                        <View key={uyeId} style={[styles.uyeAvatar, { backgroundColor: item.renk, marginLeft: index > 0 ? -8 : 0 }]}>
                            <Text style={styles.uyeAvatarText}>
                                {getKullaniciAdi(uyeId).charAt(0)}
                            </Text>
                        </View>
                    ))}
                    {item.uyeler.length > 3 && (
                        <View style={[styles.uyeAvatar, { backgroundColor: colors.textMuted, marginLeft: -8 }]}>
                            <Text style={styles.uyeAvatarText}>+{item.uyeler.length - 3}</Text>
                        </View>
                    )}
                </View>
            </View>
            {!isBoardMember && (
                <View style={styles.ekipActions}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: item.renk + '20' }]}
                        onPress={() => uyeYonetModalAc(item)}
                    >
                        <Ionicons name="people" size={18} color={item.renk} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                        onPress={() => ekipDuzenle(item)}
                    >
                        <Ionicons name="pencil" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#ef444420' }]}
                        onPress={() => ekipSil(item)}
                    >
                        <Ionicons name="trash" size={18} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    if (yukleniyor) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <StatusBar barStyle="light-content" />
                <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
                    <View style={styles.headerTop}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Ekip Yönetimi</Text>
                        <View style={{ width: 24 }} />
                    </View>
                </View>
                <ListSkeleton count={4} type="user" />
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
                    <View>
                        <Text style={styles.headerTitle}>Ekip Yönetimi</Text>
                        <Text style={styles.headerSubtitle}>{ekipler.length} aktif ekip</Text>
                    </View>
                    {!isBoardMember && (
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => {
                                resetForm();
                                setEkipModalVisible(true);
                            }}
                        >
                            <Ionicons name="add" size={24} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Ekip yoksa */}
            {ekipler.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="people-outline" size={64} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Henüz ekip oluşturulmamış
                    </Text>
                    <TouchableOpacity
                        style={[styles.varsayilanButton, { backgroundColor: colors.primary }]}
                        onPress={varsayilanEkipleriOlustur}
                        disabled={islemYukleniyor}
                    >
                        {islemYukleniyor ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="flash" size={20} color="#fff" />
                                <Text style={styles.varsayilanButtonText}>Varsayılan Ekipleri Oluştur</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={ekipler}
                    keyExtractor={(item) => item.id}
                    renderItem={renderEkipKart}
                    contentContainerStyle={styles.listContainer}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                />
            )}

            {/* Ekip Oluştur/Düzenle Modal */}
            <Modal visible={ekipModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                {duzenlemeMode ? 'Ekip Düzenle' : 'Yeni Ekip'}
                            </Text>
                            <TouchableOpacity onPress={() => setEkipModalVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Ekip Adı</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                            placeholder="örn: Tesisat Ekibi"
                            placeholderTextColor={colors.textMuted}
                            value={yeniEkipAd}
                            onChangeText={setYeniEkipAd}
                        />

                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Renk</Text>
                        <View style={styles.renkSecim}>
                            {RENK_SECENEKLERI.map((renk) => (
                                <TouchableOpacity
                                    key={renk}
                                    style={[
                                        styles.renkSecenegi,
                                        { backgroundColor: renk },
                                        yeniEkipRenk === renk && styles.renkSecili,
                                    ]}
                                    onPress={() => setYeniEkipRenk(renk)}
                                >
                                    {yeniEkipRenk === renk && (
                                        <Ionicons name="checkmark" size={16} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: colors.primary }]}
                            onPress={ekipKaydet}
                            disabled={islemYukleniyor}
                        >
                            {islemYukleniyor ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveButtonText}>
                                    {duzenlemeMode ? 'Güncelle' : 'Oluştur'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Üye Yönetimi Modal */}
            <Modal visible={uyeModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>
                                {seciliEkip?.ad} - Üyeler
                            </Text>
                            <TouchableOpacity onPress={() => setUyeModalVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* Mevcut Üyeler */}
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                            MEVCUT ÜYELER ({seciliEkip?.uyeler.length || 0})
                        </Text>
                        {seciliEkip?.uyeler.length === 0 ? (
                            <Text style={[styles.emptySmall, { color: colors.textMuted }]}>
                                Bu ekipte üye yok
                            </Text>
                        ) : (
                            seciliEkip?.uyeler.map((uyeId) => (
                                <View key={uyeId} style={[styles.uyeRow, { borderColor: colors.border }]}>
                                    <View style={[styles.uyeRowAvatar, { backgroundColor: seciliEkip.renk }]}>
                                        <Text style={styles.uyeAvatarText}>
                                            {getKullaniciAdi(uyeId).charAt(0)}
                                        </Text>
                                    </View>
                                    <Text style={[styles.uyeRowName, { color: colors.text }]}>
                                        {getKullaniciAdi(uyeId)}
                                    </Text>
                                    <TouchableOpacity
                                        style={[styles.uyeRemoveBtn, { backgroundColor: '#ef444420' }]}
                                        onPress={() => uyeCikar(uyeId)}
                                    >
                                        <Ionicons name="remove" size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}

                        {/* Eklenebilir Teknisyenler */}
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 16 }]}>
                            TEKNİSYENLER
                        </Text>
                        <FlatList
                            data={kullanicilar.filter(k => !seciliEkip?.uyeler.includes(k.id))}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <View style={[styles.uyeRow, { borderColor: colors.border }]}>
                                    <View style={[styles.uyeRowAvatar, { backgroundColor: colors.textMuted }]}>
                                        <Text style={styles.uyeAvatarText}>
                                            {item.ad.charAt(0)}
                                        </Text>
                                    </View>
                                    <Text style={[styles.uyeRowName, { color: colors.text }]}>
                                        {item.ad} {item.soyad}
                                    </Text>
                                    <TouchableOpacity
                                        style={[styles.uyeAddBtn, { backgroundColor: seciliEkip?.renk + '20' }]}
                                        onPress={() => uyeEkle(item.id)}
                                    >
                                        <Ionicons name="add" size={18} color={seciliEkip?.renk} />
                                    </TouchableOpacity>
                                </View>
                            )}
                            ListEmptyComponent={
                                <Text style={[styles.emptySmall, { color: colors.textMuted }]}>
                                    Eklenebilir teknisyen yok
                                </Text>
                            }
                            style={{ maxHeight: 200 }}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    addButton: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 8 },
    listContainer: { padding: 16 },

    // Ekip Card
    ekipCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
    },
    ekipRenk: { width: 6, height: '100%' },
    ekipInfo: { flex: 1, padding: 16 },
    ekipAdi: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    ekipUyeSayisi: { fontSize: 13, marginBottom: 8 },
    uyeAvatarlar: { flexDirection: 'row' },
    uyeAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    uyeAvatarText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    ekipActions: { flexDirection: 'row', paddingRight: 12, gap: 8 },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Empty State
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyText: { fontSize: 16, marginTop: 16, marginBottom: 24, textAlign: 'center' },
    varsayilanButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    varsayilanButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: { fontSize: 18, fontWeight: '700' },
    inputLabel: { fontSize: 12, fontWeight: '500', marginBottom: 8 },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        marginBottom: 16,
    },
    renkSecim: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
    renkSecenegi: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    renkSecili: { borderWidth: 3, borderColor: '#fff' },
    saveButton: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },

    // Üye Satırı
    sectionTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 12 },
    emptySmall: { fontSize: 13, marginBottom: 12 },
    uyeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    uyeRowAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    uyeRowName: { flex: 1, fontSize: 15 },
    uyeRemoveBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    uyeAddBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
