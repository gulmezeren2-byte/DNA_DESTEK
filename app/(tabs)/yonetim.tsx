import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import AnimatedItem from '../../components/AnimatedList';
import Logo from '../../components/Logo';
import OptimizedImage from '../../components/OptimizedImage';
import { ListSkeleton } from '../../components/Skeleton';
import { DURUM_CONFIG } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { db } from '../../firebaseConfig';
import { assignTalepToEkip, getActiveEkipler } from '../../services/ekipService';
import { sendPushNotification } from '../../services/notificationService';
import { getTalepler, subscribeToTalepler } from '../../services/talepService';
import toast from '../../services/toastService';
import { Ekip, Talep } from '../../types';

// const durumConfig removed - using global DURUM_CONFIG

export default function YonetimScreen() {
    const { user } = useAuth();
    const { isDark, colors } = useTheme();
    const router = useRouter();

    // State
    // State Strategy Refactor: Split Head (Realtime) & Tail (Pagination)
    const [headData, setHeadData] = useState<Talep[]>([]); // First 20 items (Realtime)
    const [tailData, setTailData] = useState<Talep[]>([]); // Loaded via pagination (Static)
    const [ekipler, setEkipler] = useState<Ekip[]>([]);
    const [yukleniyor, setYukleniyor] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Pagination State
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [seciliTalep, setSeciliTalep] = useState<Talep | null>(null);
    const [detayModalVisible, setDetayModalVisible] = useState(false);
    const [atamaModalVisible, setAtamaModalVisible] = useState(false);
    const [islemYukleniyor, setIslemYukleniyor] = useState(false);
    const [filtre, setFiltre] = useState<'hepsi' | 'yeni' | 'atanmamis' | 'acil'>('hepsi');
    const [zamanFiltre, setZamanFiltre] = useState<'hepsi' | 'bugun' | 'buHafta' | 'buAy'>('hepsi');
    const [aramaMetni, setAramaMetni] = useState('');
    const [tamEkranFoto, setTamEkranFoto] = useState<string | null>(null);

    // Date helper for time-based filtering
    const getTalepDate = (timestamp: any): Date | null => {
        if (!timestamp) return null;
        if (timestamp.toDate) return timestamp.toDate();
        if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
        return new Date(timestamp);
    };

    // Derived State: Merge Head + Tail deterministically
    // Logic: Head is truth. Tail items that exist in Head are filtered out.
    // This prevents duplicates if an item moves from Paged area to Top area (e.g. status change).
    const talepler = React.useMemo(() => {
        const headIds = new Set(headData.map(t => t.id));
        const filteredTail = tailData.filter(t => !headIds.has(t.id));
        return [...headData, ...filteredTail];
    }, [headData, tailData]);

    // Manual Refresh
    const verileriYukle = async (isRefresh = false) => {
        setRefreshing(true);
        // Resetting logic handled by Effect dependency on 'filtre' mostly.
        // But for manual pull-to-refresh, we might want to re-fetch ekipler or just wait for realtime.
        try {
            const res = await getActiveEkipler();
            if (res.success && res.data) setEkipler(res.data as Ekip[]);
        } catch (e) { }
        setRefreshing(false);
    };

    // Load More (Infinite Scroll)
    const dahaFazlaYukle = async () => {
        if (loadingMore || !hasMore || !lastDoc) return;

        setLoadingMore(true);
        try {
            const queryOptions: any = {};
            if (filtre === 'yeni') queryOptions.durum = 'yeni';
            if (filtre === 'atanmamis') queryOptions.atanmamis = true;
            if (filtre === 'acil') queryOptions.oncelik = 'acil';

            // Load next page
            const result = await getTalepler(user?.uid || '', 'yonetim', queryOptions, lastDoc, 20);

            if (result.success && result.data && result.data.length > 0) {
                // Append to TAIL
                setTailData(prev => {
                    const existingIds = new Set(prev.map(t => t.id));
                    const newItems = result.data!.filter(t => !existingIds.has(t.id));
                    return [...prev, ...newItems];
                });

                setLastDoc(result.lastVisible);
                if (!result.lastVisible || result.data.length < 20) setHasMore(false);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error('Sayfalama hatası:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    // Realtime Subscription Effect
    useEffect(() => {
        console.log('🔄 useEffect triggered - user:', user?.id, 'rol:', user?.rol, 'filtre:', filtre);

        if (!user) {
            console.log('❌ No user, returning early');
            return;
        }

        setYukleniyor(true);
        setHeadData([]);
        setTailData([]); // Reset tail on filter change
        setLastDoc(null);
        setHasMore(true);

        const filters: any = {};
        if (filtre === 'yeni') filters.durum = 'yeni';
        if (filtre === 'atanmamis') filters.atanmamis = true;
        if (filtre === 'acil') filters.oncelik = 'acil';

        console.log('📤 Calling subscribeToTalepler with filters:', filters);

        // Subscribe ONLY to the first page (Head)
        const unsubscribe = subscribeToTalepler(user.id, user.rol, filters, (result) => {
            console.log('📥 subscribeToTalepler callback received:', { success: result.success, dataCount: result.data?.length, error: result.message });

            if (result.success && result.data) {
                const freshData = result.data as Talep[];
                console.log('✅ Setting headData with', freshData.length, 'items');

                // Update HEAD data
                setHeadData(freshData);

                // Update pagination cursor (lastDoc) ONLY if we haven't loaded more pages yet.
                // If tailData exists, it means user has paged. We shouldn't mess with lastDoc from page 1.
                // However, for the very first load, we need to set it.
                setLastDoc((currentLastDoc: any) => {
                    // Logic: If lastDoc is null (fresh load), take it.
                    if (!currentLastDoc) return result.lastVisible;
                    return currentLastDoc;
                });

                // If less than page size returned, no more data
                if (result.data.length < 20) setHasMore(false);

                setYukleniyor(false);
            } else {
                console.error('❌ subscribeToTalepler failed:', result.message);
                setYukleniyor(false);
            }
        });

        // Load active ekipler
        getActiveEkipler().then(res => {
            if (res.success && res.data) setEkipler(res.data as Ekip[]);
        });

        return () => {
            console.log('🧹 Cleaning up subscription for filtre:', filtre);
            if (unsubscribe) unsubscribe();
        };
    }, [user, filtre]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        verileriYukle(true);
    }, [filtre]);

    const formatTarih = (timestamp: any) => {
        if (!timestamp) return '-';
        let date;
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }
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

            // Bildirim Gönder (Müşteriye)
            const targetUserId = seciliTalep.olusturanId;
            if (targetUserId) {
                try {
                    const tokenDoc = await getDoc(doc(db, 'push_tokens', targetUserId));
                    if (tokenDoc.exists()) {
                        const tokenData = tokenDoc.data();
                        if (tokenData?.token) {
                            await sendPushNotification(
                                tokenData.token,
                                'Ekip Atandı 🛠️',
                                `Sayın ${seciliTalep.musteriAdi || seciliTalep.olusturanAd || 'Müşteri'}, talebiniz için ${ekip.ad} atandı.`
                            );
                        }
                    }
                } catch (err) {
                    console.error('Müşteri bildirim hatası:', err);
                }
            }

            // Bildirim Gönder (Ekip Üyelerine / Teknisyenlere)
            if (ekip.uyeler && ekip.uyeler.length > 0) {
                try {
                    // Tüm üyelerin push tokenlarını çek ve bildirim gönder
                    ekip.uyeler.forEach(async (memberId) => {
                        try {
                            const tokenDoc = await getDoc(doc(db, 'push_tokens', memberId));
                            if (tokenDoc.exists()) {
                                const tokenData = tokenDoc.data();
                                if (tokenData?.token) {
                                    await sendPushNotification(
                                        tokenData.token,
                                        'Yeni Görev Atandı 📋',
                                        `${seciliTalep.projeAdi}: ${seciliTalep.baslik}`
                                    );
                                }
                            }
                        } catch (err) {
                            console.error(`Üye (${memberId}) bildirim hatası:`, err);
                        }
                    });
                } catch (err) {
                    console.error('Ekip bildirim hatası:', err);
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
        // Time-based filtering
        if (zamanFiltre !== 'hepsi') {
            const talepDate = getTalepDate(t.olusturmaTarihi);
            if (!talepDate) return false;

            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfWeek = new Date(startOfToday);
            startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay()); // Sunday as start
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            if (zamanFiltre === 'bugun' && talepDate < startOfToday) return false;
            if (zamanFiltre === 'buHafta' && talepDate < startOfWeek) return false;
            if (zamanFiltre === 'buAy' && talepDate < startOfMonth) return false;
        }

        // Text search filtering
        if (!aramaMetni) return true;
        const metin = aramaMetni.toLowerCase();
        return (
            t.baslik.toLowerCase().includes(metin) ||
            (t.musteriAdi && t.musteriAdi.toLowerCase().includes(metin)) ||
            (t.olusturanAd && t.olusturanAd.toLowerCase().includes(metin)) ||
            t.projeAdi.toLowerCase().includes(metin) ||
            (t.blokAdi ? t.blokAdi.toLowerCase().includes(metin) : false) ||
            (t.kategori ? t.kategori.toLowerCase().includes(metin) : false)
        );
    });

    const renderFooter = () => {
        if (!loadingMore) return <View style={{ height: 30 }} />;
        return (
            <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={colors.primary} />
            </View>
        );
    };

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
                <LinearGradient
                    colors={['#1a3a5c', '#203a43', '#2c5364']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    <View style={styles.headerTop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Logo size="sm" variant="glass" />
                            <View>
                                <Text style={styles.headerTitle}>Yönetim Paneli</Text>
                                <Text style={styles.headerSubtitle}>Yükleniyor...</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>
                <ListSkeleton count={5} type="talep" />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <LinearGradient
                colors={['#1a3a5c', '#203a43', '#2c5364']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Logo size="sm" variant="glass" />
                        <View>
                            <Text style={styles.headerTitle}>Yönetim Paneli</Text>
                            <Text style={styles.headerSubtitle}>Talep Yönetimi</Text>
                        </View>
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
            </LinearGradient>


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

            {/* Zaman Filtresi */}
            <View style={[styles.zamanFiltreContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                {[
                    { key: 'hepsi', label: 'Tümü', icon: 'infinite-outline' },
                    { key: 'bugun', label: 'Bugün', icon: 'today-outline' },
                    { key: 'buHafta', label: 'Bu Hafta', icon: 'calendar-outline' },
                    { key: 'buAy', label: 'Bu Ay', icon: 'calendar-number-outline' },
                ].map((z) => (
                    <TouchableOpacity
                        key={z.key}
                        style={[
                            styles.zamanFiltreButon,
                            zamanFiltre === z.key && { backgroundColor: isDark ? '#1a3a5c' : '#e3f2fd', borderColor: colors.primary }
                        ]}
                        onPress={() => setZamanFiltre(z.key as any)}
                    >
                        <Text style={[
                            styles.zamanFiltreText,
                            { color: zamanFiltre === z.key ? colors.primary : colors.textSecondary }
                        ]}>
                            {z.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Liste */}
            {yukleniyor && !refreshing ? (
                <ListSkeleton />
            ) : (
                <View style={{ flex: 1, minHeight: 2 }}>
                    <FlashList
                        data={listelenecekTalepler}
                        renderItem={({ item, index }: { item: Talep; index: number }) => {
                            const talep = item;
                            const durum = DURUM_CONFIG[talep.durum as keyof typeof DURUM_CONFIG] || DURUM_CONFIG.yeni;
                            return (
                                <AnimatedItem index={index}>
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
                                </AnimatedItem>
                            );
                        }}
                        keyExtractor={item => item.id}
                        contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
                        showsVerticalScrollIndicator={false}
                        // @ts-ignore
                        estimatedItemSize={200}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={colors.primary}
                                colors={[colors.primary]}
                            />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="folder-open-outline" size={64} color={colors.textSecondary} />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                    Kriterlere uygun talep bulunamadı
                                </Text>
                            </View>
                        }
                        onEndReached={dahaFazlaYukle}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={renderFooter}
                    />
                </View>
            )}

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
                                                    <OptimizedImage source={{ uri: foto }} style={styles.detayFoto} />
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
                                renderItem={({ item }: { item: Ekip }) => (
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
                        <OptimizedImage source={{ uri: tamEkranFoto }} style={styles.fullScreenImage} contentFit="contain" />
                    )}
                </View>
            </Modal>
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
        zIndex: 10,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 5,
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    headerButton: {
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 15,
        paddingHorizontal: 15,
        height: 50,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        padding: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statNumber: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    filtreContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 15,
        paddingHorizontal: 10,
        marginBottom: 5,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    filtreButon: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    filtreText: {
        fontSize: 14,
        fontWeight: '600',
    },
    zamanFiltreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderTopWidth: 1,
    },
    zamanFiltreButon: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'transparent',
        marginHorizontal: 4,
    },
    zamanFiltreText: {
        fontSize: 12,
        fontWeight: '500',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    listContent: {
        paddingBottom: 100,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 50,
        opacity: 0.7,
    },
    emptyText: {
        marginTop: 15,
        fontSize: 16,
        textAlign: 'center',
    },
    talepCard: {
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    statusBar: {
        height: 4,
        width: '100%',
    },
    talepContent: {
        padding: 16,
    },
    talepHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    headerBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    kategoriBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    kategoriText: {
        fontSize: 12,
        fontWeight: '600',
    },
    acilBadgeInline: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#d32f2f',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    acilTextInline: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    durumBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    durumText: {
        fontSize: 12,
        fontWeight: '600',
    },
    talepBaslik: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
        lineHeight: 22,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 6,
    },
    infoText: {
        fontSize: 14,
    },
    teknisyenInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
        marginTop: 8,
        gap: 6,
    },
    teknisyenText: {
        fontSize: 13,
        fontWeight: '600',
    },
    talepFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
    },
    tarihText: {
        fontSize: 12,
    },
    atanmamisBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    detayModal: {
        flex: 1,
        marginTop: 60,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 24,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    detayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    acilBadgeLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#d32f2f',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: 'flex-start',
        gap: 6,
    },
    acilTextLarge: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    detayBaslik: {
        fontSize: 22,
        fontWeight: 'bold',
        lineHeight: 30,
    },
    musteriCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
        gap: 16,
    },
    musteriInfo: {
        flex: 1,
    },
    musteriAdi: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    musteriTelefon: {
        fontSize: 14,
        fontWeight: '500',
    },
    detaySection: {
        marginBottom: 24,
    },
    detaySectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 10,
    },
    detayInfo: {
        fontSize: 16,
        lineHeight: 24,
    },
    detayAciklama: {
        fontSize: 15,
        lineHeight: 24,
        fontStyle: 'italic',
    },
    detayFotoScroll: {
        paddingRight: 20,
        gap: 10,
    },
    detayFoto: {
        width: 120,
        height: 120,
        borderRadius: 12,
    },
    oncelikButonlar: {
        flexDirection: 'row',
        gap: 12,
    },
    oncelikButon: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderWidth: 2,
        borderRadius: 12,
        gap: 8,
    },
    teknisyenCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 12,
    },
    teknisyenName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 10,
    },
    degistirButon: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    ataButon: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    ataButonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    atamaModal: {
        backgroundColor: '#fff',
        marginTop: 'auto',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '80%',
    },
    atamaHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    atamaTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    emptyTeknisyen: {
        alignItems: 'center',
        padding: 40,
    },
    teknisyenItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    teknisyenAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    teknisyenItemInfo: {
        flex: 1,
        marginLeft: 12,
    },
    teknisyenItemName: {
        fontSize: 16,
        fontWeight: '600',
    },
    teknisyenKategori: {
        fontSize: 13,
    },
    fullScreenModal: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 10,
        padding: 10,
    },
    fullScreenImage: {
        width: '100%',
        height: '100%',
    },
});


