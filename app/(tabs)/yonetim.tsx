import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import AnimatedItem from '../../components/AnimatedList';
import ChatSection from '../../components/ChatSection'; // Import ChatSection
import Logo from '../../components/Logo';
import OptimizedImage from '../../components/OptimizedImage';
import { ListSkeleton } from '../../components/Skeleton';
import { DURUM_CONFIG } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { db } from '../../firebaseConfig';
import { AuditLog } from '../../services/auditService';
import { getActiveEkipler } from '../../services/ekipService';
import { assignTalepToTaskForce, deleteTalep, getTalepler, subscribeToTalepler } from '../../services/talepService';
import toast from '../../services/toastService';
import { getUsersByIds } from '../../services/userService';
import { DNAUser, Ekip, GorevliPersonel, Talep } from '../../types';

// const durumConfig removed - using global DURUM_CONFIG

export default function YonetimScreen() {
    const { user, isYonetim, isSorumlu } = useAuth();
    const { isDark, colors } = useTheme();
    const router = useRouter();

    // SEC-003 FIX: Server-side role guard - prevent unauthorized access via URL
    if (!isYonetim && !isSorumlu) {
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
    const [filtre, setFiltre] = useState<'hepsi' | 'acilan' | 'islemde' | 'cozuldu'>('hepsi');
    const [zamanFiltre, setZamanFiltre] = useState<'hepsi' | 'bugun' | 'buHafta' | 'buAy'>('hepsi');
    const [aramaMetni, setAramaMetni] = useState('');
    const [tamEkranFoto, setTamEkranFoto] = useState<string | null>(null);

    // Task Force Selection State
    const [isSelectingCrew, setIsSelectingCrew] = useState(false);
    const [hedefEkip, setHedefEkip] = useState<Ekip | null>(null);
    const [seciliEkipUyeleri, setSeciliEkipUyeleri] = useState<DNAUser[]>([]);
    const [gorevGucu, setGorevGucu] = useState<GorevliPersonel[]>([]);
    const [seciliLiderId, setSeciliLiderId] = useState<string | null>(null);

    // Report Editing State
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [editMaliyet, setEditMaliyet] = useState('');
    const [editMalzemeler, setEditMalzemeler] = useState('');
    const [editAciklama, setEditAciklama] = useState('');
    const [editNot, setEditNot] = useState('');
    const [editGaranti, setEditGaranti] = useState<'garanti' | 'ucretli' | 'belirsiz'>('belirsiz');

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
            if (filtre === 'acilan') queryOptions.durum = 'yeni';
            if (filtre === 'islemde') queryOptions.durumlar = ['atandi', 'islemde'];
            if (filtre === 'cozuldu') queryOptions.durum = 'cozuldu';

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
        if (filtre === 'acilan') filters.durum = 'yeni';
        if (filtre === 'islemde') filters.durumlar = ['atandi', 'islemde'];
        if (filtre === 'cozuldu') filters.durum = 'cozuldu';

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

    const formatRandevuTarihi = (ts: any) => {
        if (!ts) return '';
        const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', hour: '2-digit', minute: '2-digit' });
    };

    // Ekip Seçimi ve Üye Getirme
    const onEkipClick = async (ekip: Ekip) => {
        setIslemYukleniyor(true);
        try {
            setHedefEkip(ekip);

            // Fetch member details
            if (ekip.uyeler && ekip.uyeler.length > 0) {
                const res = await getUsersByIds(ekip.uyeler);
                if (res.success && res.data) {
                    setSeciliEkipUyeleri(res.data);
                    // Pre-select all by default? Or none? 
                    // Let's pre-select NONE to force conscious choice detailed in proposal (Checkboxes)
                    // Or maybe pre-select ALL for convenience?
                    // Proposal: "Sistem ... checkbox listesi olarak açar."
                    setGorevGucu([]);
                    setSeciliLiderId(null);
                    setIsSelectingCrew(true);
                } else {
                    toast.error('Ekip üyeleri getirilemedi.');
                }
            } else {
                toast.error('Bu ekipte üye bulunmuyor.');
            }
        } catch (error: any) {
            toast.error('Hata: ' + error.message);
        } finally {
            setIslemYukleniyor(false);
        }
    };

    const toggleCrewMember = (user: DNAUser) => {
        setGorevGucu(prev => {
            const exists = prev.find(p => p.id === user.id);
            if (exists) {
                // If removing leader, clear leader selection
                if (seciliLiderId === user.id) setSeciliLiderId(null);
                return prev.filter(p => p.id !== user.id);
            } else {
                return [...prev, {
                    id: user.id,
                    ad: user.ad + ' ' + user.soyad,
                    rol: 'destek', // Default
                    atamaTarihi: new Date()
                }];
            }
        });
    };

    const toggleLeader = (userId: string) => {
        if (seciliLiderId === userId) {
            setSeciliLiderId(null); // Toggle off
        } else {
            // Ensure user is in the crew
            const isInCrew = gorevGucu.find(p => p.id === userId);
            if (!isInCrew) {
                // Auto-add to crew if selected as leader
                const user = seciliEkipUyeleri.find(u => u.id === userId);
                if (user) toggleCrewMember(user);
            }
            setSeciliLiderId(userId);
        }
    };

    const confirmTaskForceAssignment = async () => {
        if (!seciliTalep || !hedefEkip) return;
        if (gorevGucu.length === 0) {
            Alert.alert('Uyarı', 'Lütfen en az bir personel seçiniz.');
            return;
        }

        setIslemYukleniyor(true);
        try {
            // Update roles based on leader selection
            const finalCrew = gorevGucu.map(p => ({
                ...p,
                rol: (p.id === seciliLiderId ? 'lider' : 'destek') as 'lider' | 'destek'
            }));

            const result = await assignTalepToTaskForce(
                seciliTalep.id,
                hedefEkip.id,
                hedefEkip.ad,
                finalCrew,
                seciliLiderId || undefined
            );

            if (!result.success) throw new Error(result.message);

            if (user) {
                AuditLog.talepAssigned(user.id, user.email, seciliTalep.id, hedefEkip.id, hedefEkip.ad);
            }

            toast.success(`Görev gücü atandı (${finalCrew.length} kişi).`);
            setAtamaModalVisible(false);
            setDetayModalVisible(false);

            // Rreset state
            setIsSelectingCrew(false);
            setHedefEkip(null);
            setGorevGucu([]);

            verileriYukle();
        } catch (error: any) {
            toast.error('Atama hatası: ' + error.message);
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

    // Mesaj Gönderme (Yönetim)
    // Report Editing Functions
    const openReportModal = () => {
        if (!seciliTalep) return;
        setEditMaliyet(seciliTalep.maliyet ? seciliTalep.maliyet.toString() : '');
        setEditMalzemeler(seciliTalep.kullanilanMalzemeler ? seciliTalep.kullanilanMalzemeler.join(', ') : '');
        setEditAciklama(seciliTalep.cozumAciklamasi || '');
        setEditNot(seciliTalep.yoneticiNotu || '');
        setEditGaranti(seciliTalep.garantiKapsami || 'belirsiz');
        setReportModalVisible(true);
    };

    const saveReport = async () => {
        if (!seciliTalep) return;

        // Validation
        if (!editAciklama.trim()) {
            toast.warning('Lütfen yapılan işlemi açıklayın.');
            return;
        }

        setIslemYukleniyor(true);
        try {
            const malzemeler = editMalzemeler.split(',').map(s => s.trim()).filter(s => s);
            const maliyet = editMaliyet ? parseFloat(editMaliyet) : 0;

            await updateDoc(doc(db as any, 'talepler', seciliTalep.id), {
                maliyet,
                kullanilanMalzemeler: malzemeler,
                cozumAciklamasi: editAciklama,
                yoneticiNotu: editNot,
                garantiKapsami: editGaranti,
                karariVeren: user ? `${user.ad} ${user.soyad}` : 'Yönetim'
            });

            toast.success('Rapor güncellendi');
            setReportModalVisible(false);

            // Update local state immediately
            setSeciliTalep({
                ...seciliTalep,
                maliyet,
                kullanilanMalzemeler: malzemeler,
                cozumAciklamasi: editAciklama,
                yoneticiNotu: editNot,
                garantiKapsami: editGaranti
            });
        } catch (error: any) {
            toast.error('Hata: ' + error.message);
        } finally {
            setIslemYukleniyor(false);
        }
    };

    const handleSendMessage = async (msg: string) => {
        if (!seciliTalep || !user) return;

        try {
            const yeniYorumObj = {
                yazanId: user.id, // Using user.id from auth context
                yazanAdi: user.ad ? (user.ad + ' ' + user.soyad) : 'Yönetici',
                yazanRol: 'yonetim',
                mesaj: msg,
                tarih: new Date(), // Local Date, Firestore converts to Timestamp
            };

            await updateDoc(doc(db, 'talepler', seciliTalep.id), {
                yorumlar: arrayUnion(yeniYorumObj)
            });

            // Optimistic update for UI
            setSeciliTalep(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    yorumlar: [...(prev.yorumlar || []), yeniYorumObj]
                };
            });

            toast.success('Mesaj gönderildi.');
        } catch (error: any) {
            console.error('Mesaj gönderme hatası:', error);
            toast.error('Mesaj gönderilemedi.');
            throw error;
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

                        {isYonetim && (
                            <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/raporlar')}>
                                <Ionicons name="stats-chart" size={22} color="#fff" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/ekipler')}>
                            <Ionicons name="people-circle-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/kullanicilar')}>
                            <Ionicons name="people-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/projeler')}>
                            <Ionicons name="business-outline" size={22} color="#fff" />
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
                    <TouchableOpacity style={styles.statItem} onPress={() => setFiltre('acilan')}>
                        <Text style={styles.statNumber}>{stats.yeni}</Text>
                        <Text style={styles.statLabel}>Yeni</Text>
                    </TouchableOpacity>
                    <View style={styles.statDivider} />
                    <TouchableOpacity style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: '#ffcdd2' }]}>{stats.acil}</Text>
                        <Text style={styles.statLabel}>Acil</Text>
                    </TouchableOpacity>
                    <View style={styles.statDivider} />
                    <TouchableOpacity style={styles.statItem} onPress={() => setFiltre('cozuldu')}>
                        <Text style={[styles.statNumber, { color: '#a5d6a7' }]}>{stats.cozuldu}</Text>
                        <Text style={styles.statLabel}>Çözüldü</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient >


            <View style={[styles.filtreContainer, { backgroundColor: colors.card }]}>
                {[
                    { key: 'hepsi', label: 'Hepsi' },
                    { key: 'acilan', label: 'Açılan Talepler' },
                    { key: 'islemde', label: 'İşleme Alınanlar' },
                    { key: 'cozuldu', label: 'Çözülenler' },
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
            {
                yukleniyor && !refreshing ? (
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

                                                {(talep.atananTeknisyenAdi || talep.atananEkipAdi) && (
                                                    <View style={[styles.teknisyenInfo, { backgroundColor: isDark ? '#1a3a5c' : '#e3f2fd' }]}>
                                                        <Ionicons name={talep.atananTeknisyenId ? "construct" : "people"} size={14} color={colors.primary} />
                                                        <Text style={[styles.teknisyenText, { color: colors.primary }]}>
                                                            {talep.atananTeknisyenAdi || talep.atananEkipAdi}
                                                        </Text>
                                                    </View>
                                                )}

                                                <View style={[styles.talepFooter, { borderTopColor: colors.border }]}>
                                                    <Text style={[styles.tarihText, { color: colors.textMuted }]}>{formatTarih(talep.olusturmaTarihi)}</Text>
                                                    {(!talep.atananTeknisyenId && !talep.atananEkipId) && (
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
                )
            }

            {/* Detay Modal */}
            <Modal visible={detayModalVisible} animationType="slide" transparent onRequestClose={() => setDetayModalVisible(false)}>
                <TouchableWithoutFeedback onPress={() => setDetayModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback onPress={() => { }}>
                            <View style={[styles.detayModal, { backgroundColor: colors.card }]}>
                                <View style={[styles.modalHandle, { backgroundColor: isDark ? '#555' : '#ddd' }]} />

                                {seciliTalep && (
                                    <>
                                        {/* Sticky Header */}
                                        <View style={[styles.detayHeader, { marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                                            <View style={{ flex: 1 }}>
                                                {seciliTalep.oncelik === 'acil' && (
                                                    <View style={[styles.acilBadgeLarge, { marginBottom: 8 }]}>
                                                        <Ionicons name="warning" size={14} color="#fff" />
                                                        <Text style={styles.acilTextLarge}>ACİL</Text>
                                                    </View>
                                                )}
                                                <Text style={[styles.detayBaslik, { color: colors.text }]}>{seciliTalep.baslik}</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => setDetayModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                                <Ionicons name="close-circle" size={32} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>

                                        <ScrollView showsVerticalScrollIndicator={false}>
                                            <View style={{ height: 10 }} />

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

                                            {/* Randevu Bilgisi */}
                                            {seciliTalep.kesinlesenRandevu ? (
                                                <View style={styles.detaySection}>
                                                    <Text style={[styles.detaySectionTitle, { color: colors.text }]}>📅 Randevu</Text>
                                                    <View style={{ backgroundColor: isDark ? '#1b5e20' : '#e8f5e9', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#4caf50' }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                                            <Ionicons name="checkmark-circle" size={24} color="#2e7d32" />
                                                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2e7d32', marginLeft: 8 }}>Randevu Onaylandı</Text>
                                                        </View>
                                                        <Text style={{ fontSize: 15, color: colors.text, marginLeft: 32 }}>
                                                            {formatRandevuTarihi(seciliTalep.kesinlesenRandevu.baslangic)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            ) : (seciliTalep.randevuTercihleri && seciliTalep.randevuTercihleri.length > 0 && (
                                                <View style={styles.detaySection}>
                                                    <Text style={[styles.detaySectionTitle, { color: colors.text }]}>📅 Randevu Tercihleri</Text>
                                                    <Text style={{ color: colors.textSecondary, fontStyle: 'italic', fontSize: 13, marginBottom: 5 }}>Henüz teknisyen onayı bekliyor. Alternatifler:</Text>
                                                    {seciliTalep.randevuTercihleri.map((slot: any, idx: number) => (
                                                        <Text key={idx} style={{ color: colors.text, fontSize: 13, marginLeft: 10 }}>
                                                            • {formatRandevuTarihi(slot.baslangic)}
                                                        </Text>
                                                    ))}
                                                </View>
                                            ))}

                                            {/* Öncelik */}
                                            <View style={styles.detaySection}>
                                                <Text style={[styles.detaySectionTitle, { color: colors.text }]}>⚡ Öncelik</Text>
                                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                                                    <TouchableOpacity
                                                        onPress={() => oncelikGuncelle('normal')}
                                                        style={{
                                                            flex: 1,
                                                            paddingVertical: 10,
                                                            borderRadius: 8,
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            backgroundColor: seciliTalep.oncelik === 'normal' ? '#4caf50' : (isDark ? '#333' : '#f5f5f5'),
                                                            borderWidth: 1,
                                                            borderColor: seciliTalep.oncelik === 'normal' ? '#4caf50' : colors.border
                                                        }}
                                                    >
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                            <Ionicons name="time-outline" size={18} color={seciliTalep.oncelik === 'normal' ? '#fff' : colors.text} />
                                                            <Text style={{ color: seciliTalep.oncelik === 'normal' ? '#fff' : colors.text, fontWeight: '600' }}>Normal</Text>
                                                        </View>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        onPress={() => oncelikGuncelle('acil')}
                                                        style={{
                                                            flex: 1,
                                                            paddingVertical: 10,
                                                            borderRadius: 8,
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            backgroundColor: seciliTalep.oncelik === 'acil' ? '#f44336' : (isDark ? '#333' : '#f5f5f5'),
                                                            borderWidth: 1,
                                                            borderColor: seciliTalep.oncelik === 'acil' ? '#f44336' : colors.border
                                                        }}
                                                    >
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                            <Ionicons name="flash" size={18} color={seciliTalep.oncelik === 'acil' ? '#fff' : colors.text} />
                                                            <Text style={{ color: seciliTalep.oncelik === 'acil' ? '#fff' : colors.text, fontWeight: '600' }}>Acil</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {/* --- EXCEL DATA FIELDS (Yeni Alanlar) --- */}
                                            <View style={styles.detaySection}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                    <Text style={[styles.detaySectionTitle, { color: colors.text, marginBottom: 0 }]}>📋 Detaylar & Rapor</Text>
                                                    {(isYonetim || isSorumlu) && (
                                                        <TouchableOpacity onPress={openReportModal} style={{ padding: 4 }}>
                                                            <Ionicons name="create-outline" size={20} color={colors.primary} />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>

                                                <View style={{ gap: 8 }}>
                                                    {/* Row 1: Garanti & Kaynak */}
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                        <View>
                                                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Garanti Kapsamı</Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                <Ionicons name="shield-checkmark-outline" size={14} color={seciliTalep.garantiKapsami ? colors.primary : colors.textMuted} />
                                                                <Text style={{ color: colors.text, fontWeight: '600' }}>
                                                                    {seciliTalep.garantiKapsami ?
                                                                        (seciliTalep.garantiKapsami === 'garanti' ? 'Garanti Kapsamında' :
                                                                            seciliTalep.garantiKapsami === 'ucretli' ? 'Ücretli' : 'Belirsiz')
                                                                        : 'Belirlenmedi'}
                                                                </Text>
                                                            </View>
                                                            {seciliTalep.karariVeren && (
                                                                <Text style={{ fontSize: 10, color: colors.textSecondary }}>Karar: {seciliTalep.karariVeren}</Text>
                                                            )}
                                                        </View>

                                                        <View>
                                                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Talep Kanalı</Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                <Ionicons name="git-network-outline" size={14} color={colors.textSecondary} />
                                                                <Text style={{ color: colors.text, fontWeight: '500' }}>
                                                                    {seciliTalep.talepKanali ? seciliTalep.talepKanali.toUpperCase() : '-'}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>

                                                    <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

                                                    {/* Maliyet & İşlem */}
                                                    {seciliTalep.maliyet !== undefined && (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text }}>💰 Maliyet:</Text>
                                                            <Text style={{ fontSize: 14, color: isDark ? '#81c784' : '#2e7d32', fontWeight: 'bold' }}>{seciliTalep.maliyet} TL</Text>
                                                        </View>
                                                    )}

                                                    {seciliTalep.cozumAciklamasi && (
                                                        <View>
                                                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Yapılan İşlem / Sonuç:</Text>
                                                            <Text style={{ color: colors.text, marginTop: 2 }}>{seciliTalep.cozumAciklamasi}</Text>
                                                        </View>
                                                    )}

                                                    {seciliTalep.kullanilanMalzemeler && seciliTalep.kullanilanMalzemeler.length > 0 && (
                                                        <View>
                                                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Kullanılan Malzemeler:</Text>
                                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                                                {seciliTalep.kullanilanMalzemeler.map((m, i) => (
                                                                    <View key={i} style={{ backgroundColor: isDark ? '#333' : '#eee', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                                                        <Text style={{ fontSize: 12, color: colors.text }}>{m}</Text>
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        </View>
                                                    )}

                                                    {/* Yönetici Notu */}
                                                    {seciliTalep.yoneticiNotu && (
                                                        <View style={{ marginTop: 4, padding: 10, backgroundColor: isDark ? 'rgba(255, 152, 0, 0.1)' : '#fff3e0', borderRadius: 8, borderWidth: 1, borderColor: isDark ? '#ff9800' : '#ffe0b2' }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                                <Ionicons name="lock-closed" size={14} color={isDark ? '#ffb74d' : '#ef6c00'} />
                                                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDark ? '#ffb74d' : '#ef6c00' }}>YÖNETİCİ NOTU (Gizli)</Text>
                                                            </View>
                                                            <Text style={{ fontSize: 13, color: isDark ? '#ffe0b2' : '#e65100' }}>{seciliTalep.yoneticiNotu}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>

                                            {/* ------------- SOHBET/MESAJLAR ------------- */}
                                            <ChatSection
                                                talepId={seciliTalep.id}
                                                yorumlar={seciliTalep.yorumlar}
                                                currentUserId={user?.id}
                                                userRole='yonetim'
                                                isClosed={seciliTalep.durum === 'kapatildi'}
                                                onSend={handleSendMessage}
                                            />

                                            {/* Atanan Ekip */}
                                            <View style={styles.detaySection}>
                                                <Text style={[styles.detaySectionTitle, { color: colors.text }]}>👥 Ekip</Text>
                                                {seciliTalep.atananEkipAdi ? (
                                                    <View style={[styles.teknisyenCard, { backgroundColor: isDark ? '#1a3a5c' : '#e3f2fd' }]}>
                                                        <Ionicons name="people" size={24} color={colors.primary} />
                                                        <Text style={[styles.teknisyenName, { color: colors.primary }]}>{seciliTalep.atananEkipAdi}</Text>
                                                        {isSorumlu && (
                                                            <TouchableOpacity
                                                                style={[styles.degistirButon, { backgroundColor: colors.primary }]}
                                                                onPress={() => setAtamaModalVisible(true)}
                                                            >
                                                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Değiştir</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                ) : (
                                                    isSorumlu ? (
                                                        <TouchableOpacity
                                                            style={[styles.ataButon, { backgroundColor: colors.primary }]}
                                                            onPress={() => setAtamaModalVisible(true)}
                                                        >
                                                            <Ionicons name="people-outline" size={20} color="#fff" />
                                                            <Text style={styles.ataButonText}>Ekip Ata</Text>
                                                        </TouchableOpacity>
                                                    ) : (
                                                        <View style={[styles.ataButon, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}>
                                                            <Ionicons name="alert-circle-outline" size={20} color={colors.textSecondary} />
                                                            <Text style={[styles.ataButonText, { color: colors.textSecondary }]}>Henüz atama yapılmamış</Text>
                                                        </View>
                                                    )
                                                )}
                                            </View>

                                            <View style={{ height: 20 }} />

                                            {/* ------------- SİLME BUTONU (Sadece Yöneticiler) ------------- */}
                                            <TouchableOpacity
                                                style={[styles.iptalButton, { backgroundColor: isDark ? '#b71c1c' : '#ef5350', marginTop: 10 }]}
                                                onPress={() => {
                                                    Alert.alert(
                                                        'Talep Kalıcı Olarak Silinecek',
                                                        'Bu işlem geri alınamaz. Devam etmek istiyor musunuz?',
                                                        [
                                                            { text: 'Vazgeç', style: 'cancel' },
                                                            {
                                                                text: 'Evet, Sil',
                                                                style: 'destructive',
                                                                onPress: async () => {
                                                                    setIslemYukleniyor(true);
                                                                    try {
                                                                        const result = await deleteTalep(seciliTalep.id);
                                                                        if (result.success) {
                                                                            toast.success('Talep kalıcı olarak silindi.');
                                                                            setDetayModalVisible(false);
                                                                            verileriYukle(true);
                                                                        } else {
                                                                            toast.error('Hata: ' + result.message);
                                                                        }
                                                                    } catch (error: any) {
                                                                        toast.error('Silme hatası: ' + error.message);
                                                                    } finally {
                                                                        setIslemYukleniyor(false);
                                                                    }
                                                                }
                                                            }
                                                        ]
                                                    );
                                                }}
                                                disabled={islemYukleniyor}
                                            >
                                                {islemYukleniyor ? (
                                                    <ActivityIndicator color="#fff" />
                                                ) : (
                                                    <>
                                                        <Ionicons name="trash" size={20} color="#fff" />
                                                        <Text style={styles.iptalButtonText}>Talebi Kalıcı Olarak Sil</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                            <View style={{ height: 40 }} />
                                        </ScrollView>
                                    </>
                                )}
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Atama Modal */}
            <Modal visible={atamaModalVisible} animationType="slide" transparent onRequestClose={() => setAtamaModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.atamaModal, { backgroundColor: colors.card }]}>
                        <View style={styles.atamaHeader}>
                            {isSelectingCrew ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <TouchableOpacity onPress={() => setIsSelectingCrew(false)}>
                                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                                    </TouchableOpacity>
                                    <Text style={[styles.atamaTitle, { color: colors.text }]}>
                                        {hedefEkip?.ad} - Personel Seç
                                    </Text>
                                </View>
                            ) : (
                                <Text style={[styles.atamaTitle, { color: colors.text }]}>👥 Ekip Seç</Text>
                            )}
                            <TouchableOpacity onPress={() => setAtamaModalVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {isSelectingCrew ? (
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.textSecondary, marginBottom: 15, fontSize: 13 }}>
                                    Bu iş için sahaya gidecek personelleri ve (opsiyonel) ekip liderini seçiniz.
                                </Text>
                                <FlatList
                                    data={seciliEkipUyeleri}
                                    keyExtractor={(item) => item.id}
                                    renderItem={({ item }) => {
                                        const isSelected = gorevGucu.some(p => p.id === item.id);
                                        const isLeader = seciliLiderId === item.id;
                                        return (
                                            <TouchableOpacity
                                                style={[
                                                    styles.crewItem,
                                                    {
                                                        backgroundColor: isSelected ? (isDark ? 'rgba(33, 150, 243, 0.1)' : '#e3f2fd') : 'transparent',
                                                        borderColor: isSelected ? colors.primary : colors.border
                                                    }
                                                ]}
                                                onPress={() => toggleCrewMember(item)}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                                    <View style={[styles.checkbox, { borderColor: isSelected ? colors.primary : colors.textMuted, backgroundColor: isSelected ? colors.primary : 'transparent' }]}>
                                                        {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                                                    </View>
                                                    <View>
                                                        <Text style={[styles.crewName, { color: colors.text }]}>{item.ad} {item.soyad}</Text>
                                                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{item.email}</Text>
                                                    </View>
                                                </View>

                                                {isSelected && (
                                                    <TouchableOpacity
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            toggleLeader(item.id);
                                                        }}
                                                        style={[styles.leaderBadge, { backgroundColor: isLeader ? '#f57f17' : 'transparent', borderWidth: 1, borderColor: isLeader ? 'transparent' : colors.border }]}
                                                    >
                                                        <Ionicons name={isLeader ? "star" : "star-outline"} size={16} color={isLeader ? "#fff" : colors.textMuted} />
                                                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: isLeader ? '#fff' : colors.textMuted, marginLeft: 4 }}>
                                                            {isLeader ? 'LİDER' : 'Lider Yap'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    }}
                                />
                                <TouchableOpacity
                                    style={[styles.confirmButton, { backgroundColor: colors.primary, opacity: gorevGucu.length > 0 ? 1 : 0.5 }]}
                                    onPress={confirmTaskForceAssignment}
                                    disabled={gorevGucu.length === 0 || islemYukleniyor}
                                >
                                    {islemYukleniyor ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>Görevlendir ({gorevGucu.length} Kişi)</Text>}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            ekipler.length === 0 ? (
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
                                            onPress={() => onEkipClick(item)}
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
                            )
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
            {/* Report Edit Modal */}
            <Modal visible={reportModalVisible} animationType="slide" transparent onRequestClose={() => setReportModalVisible(false)}>
                <TouchableWithoutFeedback onPress={() => setReportModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback onPress={() => { }}>
                            <View style={[styles.detayModalContent, { backgroundColor: colors.card, height: 'auto', maxHeight: '80%' }]}>
                                <View style={[styles.modalHandle, { backgroundColor: isDark ? '#555' : '#ddd' }]} />
                                <View style={styles.detayHeader}>
                                    <Text style={[styles.detayBaslik, { color: colors.text }]}>Raporu Düzenle</Text>
                                    <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                                        <Ionicons name="close-circle" size={30} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView contentContainerStyle={{ padding: 20 }}>
                                    <View style={{ gap: 15 }}>
                                        {/* Maliyet */}
                                        <View>
                                            <Text style={{ fontWeight: 'bold', marginBottom: 5, color: colors.text }}>💰 Maliyet (TL)</Text>
                                            <TextInput
                                                style={[styles.miniInput, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? colors.inputBg : '#fff' }]}
                                                value={editMaliyet}
                                                onChangeText={setEditMaliyet}
                                                placeholder="0.00"
                                                placeholderTextColor={colors.textMuted}
                                                keyboardType="numeric"
                                            />
                                        </View>

                                        {/* Malzemeler */}
                                        <View>
                                            <Text style={{ fontWeight: 'bold', marginBottom: 5, color: colors.text }}>🛠️ Kullanılan Malzemeler</Text>
                                            <TextInput
                                                style={[styles.miniInput, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? colors.inputBg : '#fff', height: 60 }]}
                                                value={editMalzemeler}
                                                onChangeText={setEditMalzemeler}
                                                placeholder="Virgülle ayırın..."
                                                placeholderTextColor={colors.textMuted}
                                                multiline
                                            />
                                        </View>

                                        {/* Açıklama */}
                                        <View>
                                            <Text style={{ fontWeight: 'bold', marginBottom: 5, color: colors.text }}>📝 Yapılan İşlem / Sonuç</Text>
                                            <TextInput
                                                style={[styles.miniInput, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? colors.inputBg : '#fff', height: 80 }]}
                                                value={editAciklama}
                                                onChangeText={setEditAciklama}
                                                placeholder="Detaylı açıklama..."
                                                placeholderTextColor={colors.textMuted}
                                                multiline
                                            />
                                        </View>

                                        {/* Yönetici Notu */}
                                        <View>
                                            <Text style={{ fontWeight: 'bold', marginBottom: 5, color: '#ff9800' }}>🔒 Yönetici Notu (Gizli)</Text>
                                            <TextInput
                                                style={[styles.miniInput, { color: colors.text, borderColor: '#ffb74d', backgroundColor: isDark ? 'rgba(255, 152, 0, 0.1)' : '#fff3e0', height: 60 }]}
                                                value={editNot}
                                                onChangeText={setEditNot}
                                                placeholder="Sadece yöneticiler görür..."
                                                placeholderTextColor={isDark ? '#ffcc80' : '#ffb74d'}
                                                multiline
                                            />
                                        </View>

                                        {/* Garanti */}
                                        <View>
                                            <Text style={{ fontWeight: 'bold', marginBottom: 5, color: colors.text }}>🛡️ Garanti Kapsamı</Text>
                                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                                {['garanti', 'ucretli', 'belirsiz'].map((g) => (
                                                    <TouchableOpacity
                                                        key={g}
                                                        onPress={() => setEditGaranti(g as any)}
                                                        style={{
                                                            paddingHorizontal: 12,
                                                            paddingVertical: 8,
                                                            borderRadius: 8,
                                                            backgroundColor: editGaranti === g ? colors.primary : (isDark ? '#333' : '#eee'),
                                                            borderWidth: 1,
                                                            borderColor: editGaranti === g ? colors.primary : colors.border
                                                        }}
                                                    >
                                                        <Text style={{ color: editGaranti === g ? '#fff' : colors.text, textTransform: 'capitalize' }}>{g}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>

                                        <TouchableOpacity
                                            style={{ backgroundColor: colors.primary, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 }}
                                            onPress={saveReport}
                                            disabled={islemYukleniyor}
                                        >
                                            {islemYukleniyor ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Kaydet</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
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
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
            },
            android: {
                elevation: 5,
            },
            web: {
                // @ts-ignore
                boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
            }
        }),
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
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
            },
            android: {
                elevation: 3,
            },
            web: {
                // @ts-ignore
                boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
            }
        }),
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
    iptalButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 10,
        shadowColor: "#d32f2f",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    iptalButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        letterSpacing: 0.5,
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
        fontSize: 12,
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
    // ---------------- CHAT STYLES ----------------
    chatContainer: {
        borderRadius: 16,
        padding: 16,
        maxHeight: 350,
        minHeight: 120,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    emptyChat: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
        opacity: 0.7,
    },
    emptyChatText: {
        fontSize: 15,
        fontStyle: 'italic',
        marginTop: 10,
    },
    messageBubble: {
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
        maxWidth: '80%',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.18,
        shadowRadius: 1.00,
        elevation: 1,
    },
    messageBubbleMe: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 2,
        marginLeft: '20%',
    },
    messageBubbleOther: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 2,
        marginRight: '20%',
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
        gap: 8,
    },
    messageAuthor: {
        fontSize: 11,
        fontWeight: 'bold',
        opacity: 0.9,
    },
    messageRoleBadge: {
        fontSize: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        overflow: 'hidden',
        fontWeight: '600',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    messageTime: {
        fontSize: 10,
        alignSelf: 'flex-end',
        marginTop: 4,
        opacity: 0.7,
    },
    crewItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    crewName: {
        fontSize: 16,
        fontWeight: '600',
    },
    leaderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 20,
    },
    confirmButton: {
        marginTop: 20,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    detayModalContent: {
        width: '100%',
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 0,
        maxHeight: '90%',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    miniInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        marginTop: 4,
    }
});


