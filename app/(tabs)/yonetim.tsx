import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { ListSkeleton } from '../../components/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { assignTalepToEkip, db, getActiveEkipler, getTalepler } from '../../firebaseConfig';
import { sendPushNotification } from '../../services/notificationService';
import toast from '../../services/toastService';

interface Talep {
    id: string;
    baslik: string;
    aciklama: string;
    kategori: string;
    durum: string;
    oncelik: string;
    projeAdi: string;
    blokAdi?: string;
    daireNo?: string;
    musteriAdi: string;
    musteriTelefon: string;
    musteriId?: string;
    olusturmaTarihi: { seconds: number };
    atananTeknisyenId?: string;
    atananTeknisyenAdi?: string;
    atananEkipId?: string;
    atananEkipAdi?: string;
    fotograflar?: string[];
}

interface Ekip {
    id: string;
    ad: string;
    renk: string;
    uyeler: string[];
}

const durumConfig: Record<string, { bg: string; bgDark: string; text: string; textDark: string; icon: string; label: string }> = {
    yeni: { bg: '#e3f2fd', bgDark: '#1a3a5c', text: '#1565c0', textDark: '#64b5f6', icon: 'hourglass-outline', label: 'Yeni' },
    atandi: { bg: '#fff3e0', bgDark: '#3a2a1a', text: '#ef6c00', textDark: '#ffb74d', icon: 'person-outline', label: 'Atandı' },
    islemde: { bg: '#e8f5e9', bgDark: '#1a3a1a', text: '#2e7d32', textDark: '#81c784', icon: 'construct-outline', label: 'İşlemde' },
    beklemede: { bg: '#fce4ec', bgDark: '#3a1a2a', text: '#c2185b', textDark: '#f48fb1', icon: 'pause-circle-outline', label: 'Beklemede' },
    cozuldu: { bg: '#e0f2f1', bgDark: '#1a3a3a', text: '#00796b', textDark: '#4db6ac', icon: 'checkmark-circle', label: 'Çözüldü' },
    iptal: { bg: '#ffebee', bgDark: '#3a1a1a', text: '#c62828', textDark: '#ef5350', icon: 'close-circle', label: 'İptal' },
};

export default function YonetimScreen() {
    const { user } = useAuth();
    const { isDark, colors } = useTheme();
    const router = useRouter();

    const [talepler, setTalepler] = useState<Talep[]>([]);
    const [ekipler, setEkipler] = useState<Ekip[]>([]);
    const [yukleniyor, setYukleniyor] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Pagination State
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loadingMore, setLoadingMore] = useState(false);

    const [seciliTalep, setSeciliTalep] = useState<Talep | null>(null);
    const [detayModalVisible, setDetayModalVisible] = useState(false);
    const [atamaModalVisible, setAtamaModalVisible] = useState(false);
    const [islemYukleniyor, setIslemYukleniyor] = useState(false);
    const [filtre, setFiltre] = useState<'hepsi' | 'yeni' | 'atanmamis' | 'acil'>('hepsi');
    const [aramaMetni, setAramaMetni] = useState('');
    const [tamEkranFoto, setTamEkranFoto] = useState<string | null>(null);

    // Initial Load / Filter Change
    const verileriYukle = async (isRefresh = false) => {
        if (!isRefresh) setYukleniyor(true);
        try {
            // Filtreleri hazırla
            const queryOptions: any = {};
            if (filtre === 'yeni') queryOptions.durum = 'yeni';
            if (filtre === 'atanmamis') queryOptions.atanmamis = true;
            if (filtre === 'acil') queryOptions.oncelik = 'acil';

            // İlk sayfa yükle (lastDoc: null)
            const result = await getTalepler(user?.uid || '', 'yonetim', queryOptions, null, 20);

            if (result.success && result.talepler) {
                setTalepler(result.talepler as Talep[]);
                setLastDoc(result.lastVisible);
            }

            // Ekipleri yükle
            const ekipResult = await getActiveEkipler();
            if (ekipResult.success && ekipResult.ekipler) {
                setEkipler(ekipResult.ekipler as Ekip[]);
            }
        } catch (error) {
            console.error('Veri yükleme hatası:', error);
        }

        setYukleniyor(false);
        setRefreshing(false);
    };

    // Load More (Infinite Scroll)
    const dahaFazlaYukle = async () => {
        if (loadingMore || !lastDoc) return;

        setLoadingMore(true);
        try {
            const queryOptions: any = {};
            if (filtre === 'yeni') queryOptions.durum = 'yeni';
            if (filtre === 'atanmamis') queryOptions.atanmamis = true;
            if (filtre === 'acil') queryOptions.oncelik = 'acil';

            // Sonraki sayfa (lastDoc kullanarak)
            const result = await getTalepler(user?.uid || '', 'yonetim', queryOptions, lastDoc, 20);

            if (result.success && result.talepler && result.talepler.length > 0) {
                setTalepler(prev => [...prev, ...result.talepler]); // Append data
                setLastDoc(result.lastVisible);
            } else {
                setLastDoc(null); // End of list
            }
        } catch (error) {
            console.error('Sayfalama hatası:', error);
        }
        setLoadingMore(false);
    };

    useEffect(() => {
        verileriYukle();
    }, [filtre]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        verileriYukle(true);
    }, [filtre]);

    const formatTarih = (timestamp: { seconds: number }) => {
        if (!timestamp?.seconds) return '-';
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    // Ekip ata
    const ekipAta = async (ekip: Ekip) => {
        if (!seciliTalep) return;

        setIslemYukleniyor(true);
        try {
            const result = await assignTalepToEkip(seciliTalep.id, ekip.id, ekip.ad);

            if (!result.success) {
                throw new Error(result.message);
            }

            // Bildirim Gönder
            if (seciliTalep.musteriId) {
                try {
                    const musteriDoc = await getDoc(doc(db, 'users', seciliTalep.musteriId));
                    if (musteriDoc.exists()) {
                        const musteriData = musteriDoc.data();
                        if (musteriData?.pushToken) {
                            await sendPushNotification(
                                musteriData.pushToken,
                                'Ekip Atandı 🛠️',
                                `Sayın ${seciliTalep.musteriAdi}, talebiniz için ${ekip.ad} atandı.`
                            );
                        }
                    }
                } catch (err) {
                    console.error('Bildirim hatası:', err);
                }
            }

            toast.success(`Talep "${ekip.ad}" ekibine atandı!`);

            setAtamaModalVisible(false);
            setDetayModalVisible(false);
            verileriYukle();
        } catch (error: any) {
            toast.error('Hata: ' + error.message);
        } finally {
            setIslemYukleniyor(false);
        }
    };

    // Öncelik güncelle
    const oncelikGuncelle = async (yeniOncelik: 'normal' | 'acil') => {
        if (!seciliTalep) return;

        setIslemYukleniyor(true);
        try {
            await updateDoc(doc(db, 'talepler', seciliTalep.id), {
                oncelik: yeniOncelik,
            });

            toast.success(`Öncelik "${yeniOncelik}" olarak güncellendi!`);

            verileriYukle();
            setSeciliTalep({ ...seciliTalep, oncelik: yeniOncelik });
        } catch (error: any) {
            toast.error('Hata: ' + error.message);
        } finally {
            setIslemYukleniyor(false);
        }
    };

    // Listelenecek talepler (Sadece arama filtresi uygula, diğerleri sunucudan geldi)
    const listelenecekTalepler = talepler.filter(t => {
        if (!aramaMetni) return true;
        const metin = aramaMetni.toLowerCase();
        return (
            t.baslik.toLowerCase().includes(metin) ||
            t.musteriAdi.toLowerCase().includes(metin) ||
            t.projeAdi.toLowerCase().includes(metin) ||
            (t.blokAdi ? t.blokAdi.toLowerCase().includes(metin) : false) ||
            (t.kategori ? t.kategori.toLowerCase().includes(metin) : false)
        );
    });

    // İstatistikler
    const stats = {
        toplam: talepler.length,
        yeni: talepler.filter(t => t.durum === 'yeni').length,
        acil: talepler.filter(t => t.oncelik === 'acil').length,
        cozuldu: talepler.filter(t => t.durum === 'cozuldu').length,
    };

    if (yukleniyor) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <StatusBar barStyle="light-content" />
                <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
                    <View style={styles.headerTop}>
                        <View>
                            <Text style={styles.headerTitle}>Yönetim Paneli</Text>
                            <Text style={styles.headerSubtitle}>Yükleniyor...</Text>
                        </View>
                    </View>
                </View>
                <ListSkeleton count={5} type="talep" />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.headerTitle}>Yönetim Paneli</Text>
                        <Text style={styles.headerSubtitle}>Talep Yönetimi</Text>
                    </View>
                    <View style={styles.headerButtons}>
                        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/raporlar')}>
                            <Ionicons name="stats-chart" size={22} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/ekipler')}>
                            <Ionicons name="people-circle-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/kullanicilar')}>
                            <Ionicons name="people-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/ayarlar')}>
                            <Ionicons name="settings-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Arama Çubuğu */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="rgba(255,255,255,0.7)" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Talep, müşteri, proje ara..."
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
                <View style={styles.statsContainer}>
                    <TouchableOpacity style={styles.statItem} onPress={() => setFiltre('hepsi')}>
                        <Text style={styles.statNumber}>{stats.toplam}</Text>
                        <Text style={styles.statLabel}>Toplam</Text>
                    </TouchableOpacity>
                    <View style={styles.statDivider} />
                    <TouchableOpacity style={styles.statItem} onPress={() => setFiltre('yeni')}>
                        <Text style={styles.statNumber}>{stats.yeni}</Text>
                        <Text style={styles.statLabel}>Yeni</Text>
                    </TouchableOpacity>
                    <View style={styles.statDivider} />
                    <TouchableOpacity style={styles.statItem} onPress={() => setFiltre('acil')}>
                        <Text style={[styles.statNumber, { color: '#ffcdd2' }]}>{stats.acil}</Text>
                        <Text style={styles.statLabel}>Acil</Text>
                    </TouchableOpacity>
                    <View style={styles.statDivider} />
                    <TouchableOpacity style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: '#a5d6a7' }]}>{stats.cozuldu}</Text>
                        <Text style={styles.statLabel}>Çözüldü</Text>
                    </TouchableOpacity>
                </View>
            </View>


            <View style={[styles.filtreContainer, { backgroundColor: colors.card }]}>
                {[
                    { key: 'hepsi', label: 'Hepsi' },
                    { key: 'yeni', label: 'Yeni' },
                    { key: 'atanmamis', label: 'Atanmamış' },
                    { key: 'acil', label: 'Acil' },
                ].map((f) => (
                    <TouchableOpacity
                        key={f.key}
                        style={[styles.filtreButon, filtre === f.key && { backgroundColor: colors.primary }]}
                        onPress={() => setFiltre(f.key as any)}
                    >
                        <Text style={[styles.filtreText, { color: filtre === f.key ? '#fff' : colors.textSecondary }]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                style={styles.content}
                data={listelenecekTalepler}
                keyExtractor={(item) => item.id}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
                onEndReached={dahaFazlaYukle}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} /> : <View style={{ height: 30 }} />}
                ListEmptyComponent={
                    !yukleniyor ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="document-text-outline" size={60} color={colors.textMuted} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Bu filtrede talep yok</Text>
                        </View>
                    ) : null
                }
                renderItem={({ item: talep }) => {
                    const durum = durumConfig[talep.durum] || durumConfig.yeni;
                    return (
                        <TouchableOpacity
                            style={[styles.talepCard, { backgroundColor: colors.card }]}
                            onPress={() => { setSeciliTalep(talep); setDetayModalVisible(true); }}
                        >
                            <View style={[styles.statusBar, { backgroundColor: isDark ? durum.textDark : durum.text }]} />

                            <View style={styles.talepContent}>
                                <View style={styles.talepHeader}>
                                    <View style={styles.headerBadges}>
                                        <View style={[styles.kategoriBadge, { backgroundColor: isDark ? colors.inputBg : '#f5f5f5' }]}>
                                            <Text style={[styles.kategoriText, { color: colors.textSecondary }]}>{talep.kategori}</Text>
                                        </View>
                                        {talep.oncelik === 'acil' && (
                                            <View style={styles.acilBadgeInline}>
                                                <Ionicons name="warning" size={10} color="#fff" />
                                                <Text style={styles.acilTextInline}>ACİL</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={[styles.durumBadge, { backgroundColor: isDark ? durum.bgDark : durum.bg }]}>
                                        <Ionicons name={durum.icon as any} size={12} color={isDark ? durum.textDark : durum.text} />
                                        <Text style={[styles.durumText, { color: isDark ? durum.textDark : durum.text }]}>{durum.label}</Text>
                                    </View>
                                </View>

                                <Text style={[styles.talepBaslik, { color: colors.text }]}>{talep.baslik}</Text>

                                <View style={styles.infoRow}>
                                    <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>{talep.musteriAdi}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                        {talep.projeAdi} {talep.blokAdi && `• ${talep.blokAdi}`}
                                    </Text>
                                </View>

                                {talep.atananTeknisyenAdi && (
                                    <View style={[styles.teknisyenInfo, { backgroundColor: isDark ? '#1a3a5c' : '#e3f2fd' }]}>
                                        <Ionicons name="construct" size={14} color={colors.primary} />
                                        <Text style={[styles.teknisyenText, { color: colors.primary }]}>{talep.atananTeknisyenAdi}</Text>
                                    </View>
                                )}

                                <View style={[styles.talepFooter, { borderTopColor: colors.border }]}>
                                    <Text style={[styles.tarihText, { color: colors.textMuted }]}>{formatTarih(talep.olusturmaTarihi)}</Text>
                                    {!talep.atananTeknisyenId && (
                                        <View style={[styles.atanmamisBadge, { backgroundColor: isDark ? '#3a2a1a' : '#fff3e0' }]}>
                                            <Text style={{ color: isDark ? '#ffb74d' : '#ef6c00', fontSize: 10, fontWeight: '600' }}>Atanmamış</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />

            {/* Detay Modal */}
            <Modal visible={detayModalVisible} animationType="slide" transparent onRequestClose={() => setDetayModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.detayModal, { backgroundColor: colors.card }]}>
                        <View style={[styles.modalHandle, { backgroundColor: isDark ? '#555' : '#ddd' }]} />

                        {seciliTalep && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.detayHeader}>
                                    <View style={{ flex: 1 }}>
                                        {seciliTalep.oncelik === 'acil' && (
                                            <View style={[styles.acilBadgeLarge, { marginBottom: 8 }]}>
                                                <Ionicons name="warning" size={14} color="#fff" />
                                                <Text style={styles.acilTextLarge}>ACİL</Text>
                                            </View>
                                        )}
                                        <Text style={[styles.detayBaslik, { color: colors.text }]}>{seciliTalep.baslik}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setDetayModalVisible(false)}>
                                        <Ionicons name="close-circle" size={28} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                {/* Müşteri */}
                                <View style={[styles.musteriCard, { backgroundColor: isDark ? colors.inputBg : '#f8f9fa' }]}>
                                    <Ionicons name="person-circle-outline" size={40} color={colors.primary} />
                                    <View style={styles.musteriInfo}>
                                        <Text style={[styles.musteriAdi, { color: colors.text }]}>{seciliTalep.musteriAdi}</Text>
                                        <Text style={[styles.musteriTelefon, { color: colors.primary }]}>📞 {seciliTalep.musteriTelefon}</Text>
                                    </View>
                                </View>

                                {/* Konum */}
                                <View style={styles.detaySection}>
                                    <Text style={[styles.detaySectionTitle, { color: colors.text }]}>📍 Konum</Text>
                                    <Text style={[styles.detayInfo, { color: colors.textSecondary }]}>
                                        {seciliTalep.projeAdi} {seciliTalep.blokAdi && `• ${seciliTalep.blokAdi}`} {seciliTalep.daireNo && `• D.${seciliTalep.daireNo}`}
                                    </Text>
                                </View>

                                {/* Açıklama */}
                                {seciliTalep.aciklama && (
                                    <View style={styles.detaySection}>
                                        <Text style={[styles.detaySectionTitle, { color: colors.text }]}>📝 Açıklama</Text>
                                        <Text style={[styles.detayAciklama, { color: colors.textSecondary }]}>{seciliTalep.aciklama}</Text>
                                    </View>
                                )}

                                {/* Fotoğraflar */}
                                {seciliTalep.fotograflar && seciliTalep.fotograflar.length > 0 && (
                                    <View style={styles.detaySection}>
                                        <Text style={[styles.detaySectionTitle, { color: colors.text }]}>📸 Fotoğraflar</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detayFotoScroll}>
                                            {seciliTalep.fotograflar.map((foto, index) => (
                                                <TouchableOpacity key={index} onPress={() => setTamEkranFoto(foto)}>
                                                    <Image source={{ uri: foto }} style={styles.detayFoto} />
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                {/* Öncelik */}
                                <View style={styles.detaySection}>
                                    <Text style={[styles.detaySectionTitle, { color: colors.text }]}>⚡ Öncelik</Text>
                                    <View style={styles.oncelikButonlar}>
                                        <TouchableOpacity
                                            style={[
                                                styles.oncelikButon,
                                                { borderColor: '#2e7d32' },
                                                seciliTalep.oncelik !== 'acil' && { backgroundColor: '#2e7d32' }
                                            ]}
                                            onPress={() => oncelikGuncelle('normal')}
                                            disabled={islemYukleniyor}
                                        >
                                            <Ionicons name="checkmark-circle" size={18} color={seciliTalep.oncelik !== 'acil' ? '#fff' : '#2e7d32'} />
                                            <Text style={{ color: seciliTalep.oncelik !== 'acil' ? '#fff' : '#2e7d32', fontWeight: '600' }}>Normal</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                styles.oncelikButon,
                                                { borderColor: '#c62828' },
                                                seciliTalep.oncelik === 'acil' && { backgroundColor: '#c62828' }
                                            ]}
                                            onPress={() => oncelikGuncelle('acil')}
                                            disabled={islemYukleniyor}
                                        >
                                            <Ionicons name="warning" size={18} color={seciliTalep.oncelik === 'acil' ? '#fff' : '#c62828'} />
                                            <Text style={{ color: seciliTalep.oncelik === 'acil' ? '#fff' : '#c62828', fontWeight: '600' }}>Acil</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Atanan Ekip */}
                                <View style={styles.detaySection}>
                                    <Text style={[styles.detaySectionTitle, { color: colors.text }]}>👥 Ekip</Text>
                                    {seciliTalep.atananEkipAdi ? (
                                        <View style={[styles.teknisyenCard, { backgroundColor: isDark ? '#1a3a5c' : '#e3f2fd' }]}>
                                            <Ionicons name="people" size={24} color={colors.primary} />
                                            <Text style={[styles.teknisyenName, { color: colors.primary }]}>{seciliTalep.atananEkipAdi}</Text>
                                            <TouchableOpacity
                                                style={[styles.degistirButon, { backgroundColor: colors.primary }]}
                                                onPress={() => setAtamaModalVisible(true)}
                                            >
                                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Değiştir</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            style={[styles.ataButon, { backgroundColor: colors.primary }]}
                                            onPress={() => setAtamaModalVisible(true)}
                                        >
                                            <Ionicons name="people-outline" size={20} color="#fff" />
                                            <Text style={styles.ataButonText}>Ekip Ata</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <View style={{ height: 20 }} />
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Atama Modal */}
            <Modal visible={atamaModalVisible} animationType="slide" transparent onRequestClose={() => setAtamaModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.atamaModal, { backgroundColor: colors.card }]}>
                        <View style={styles.atamaHeader}>
                            <Text style={[styles.atamaTitle, { color: colors.text }]}>👥 Ekip Seç</Text>
                            <TouchableOpacity onPress={() => setAtamaModalVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {ekipler.length === 0 ? (
                            <View style={styles.emptyTeknisyen}>
                                <Ionicons name="people-outline" size={50} color={colors.textMuted} />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Ekip bulunamadı</Text>
                                <Text style={[styles.emptyText, { color: colors.textMuted, fontSize: 12 }]}>
                                    Önce ekip oluşturmanız gerekiyor
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={ekipler}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[styles.teknisyenItem, { borderBottomColor: colors.border }]}
                                        onPress={() => ekipAta(item)}
                                        disabled={islemYukleniyor}
                                    >
                                        <View style={[styles.teknisyenAvatar, { backgroundColor: item.renk }]}>
                                            <Ionicons name="people" size={20} color="#fff" />
                                        </View>
                                        <View style={styles.teknisyenItemInfo}>
                                            <Text style={[styles.teknisyenItemName, { color: colors.text }]}>{item.ad}</Text>
                                            <Text style={[styles.teknisyenKategori, { color: colors.textSecondary }]}>
                                                {item.uyeler.length} üye
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* Tam Ekran Fotoğraf Modal */}
            <Modal visible={!!tamEkranFoto} transparent={true} animationType="fade" onRequestClose={() => setTamEkranFoto(null)}>
                <View style={styles.fullScreenModal}>
                    <TouchableOpacity style={styles.closeButton} onPress={() => setTamEkranFoto(null)}>
                        <Ionicons name="close" size={30} color="#fff" />
                    </TouchableOpacity>
                    {tamEkranFoto && (
                        <Image source={{ uri: tamEkranFoto }} style={styles.fullScreenImage} resizeMode="contain" />
                    )}
                </View>
            </Modal>
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, fontSize: 14 },
    header: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    settingsButton: { padding: 8 },
    statsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 },
    statItem: { alignItems: 'center' },
    statNumber: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
    filtreContainer: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, borderRadius: 10, padding: 4 },
    filtreButon: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    filtreText: { fontSize: 12, fontWeight: '600' },
    content: { flex: 1, padding: 16 },
    emptyContainer: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 15, marginTop: 12 },
    talepCard: { borderRadius: 14, marginBottom: 12, overflow: 'hidden', flexDirection: 'row' },
    statusBar: { width: 4 },
    talepContent: { flex: 1, padding: 14 },
    talepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    kategoriBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    kategoriText: { fontSize: 11, fontWeight: '600' },
    durumBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, gap: 4 },
    durumText: { fontSize: 11, fontWeight: '600' },
    talepBaslik: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    infoText: { fontSize: 12 },
    teknisyenInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 8, marginTop: 8 },
    teknisyenText: { fontSize: 12, fontWeight: '500' },
    talepFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginTop: 8, borderTopWidth: 1 },
    tarihText: { fontSize: 11 },
    atanmamisBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    acilBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: '#c62828', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4, zIndex: 1 },
    acilText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    acilBadgeLarge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#c62828', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 6 },
    acilTextLarge: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    detayModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', padding: 20 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    detayHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    detayBaslik: { fontSize: 20, fontWeight: 'bold' },
    musteriCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 16, gap: 12 },
    musteriInfo: { flex: 1 },
    musteriAdi: { fontSize: 16, fontWeight: '600' },
    musteriTelefon: { fontSize: 14, marginTop: 4 },
    detaySection: { marginBottom: 18 },
    detaySectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
    detayInfo: { fontSize: 15 },
    detayAciklama: { fontSize: 14, lineHeight: 22 },
    oncelikButonlar: { flexDirection: 'row', gap: 12 },
    oncelikButon: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, borderWidth: 2, gap: 8 },
    teknisyenCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, gap: 10 },
    teknisyenName: { flex: 1, fontSize: 15, fontWeight: '600' },
    degistirButon: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    ataButon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, gap: 8 },
    ataButonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    atamaModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingTop: 20 },
    atamaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
    atamaTitle: { fontSize: 18, fontWeight: '600' },
    emptyTeknisyen: { alignItems: 'center', padding: 40 },
    teknisyenItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    teknisyenAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    teknisyenAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    teknisyenItemInfo: { flex: 1, marginLeft: 12 },
    teknisyenItemName: { fontSize: 15, fontWeight: '600' },
    teknisyenKategori: { fontSize: 12, marginTop: 2 },
    headerBadges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    acilBadgeInline: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#c62828', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 3 },
    acilTextInline: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
    detayFotoScroll: { flexDirection: 'row', gap: 12 },
    detayFoto: { width: 120, height: 120, borderRadius: 8, backgroundColor: '#eee' },
    fullScreenModal: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 1,
        padding: 10,
    },
    fullScreenImage: {
        width: '100%',
        height: '80%',
    },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, marginHorizontal: 20, marginBottom: 16, paddingHorizontal: 12 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, paddingVertical: 10, color: '#fff', fontSize: 14 },
    headerButtons: { flexDirection: 'row', alignItems: 'center' },
    headerButton: { padding: 8, marginLeft: 4 },
});
