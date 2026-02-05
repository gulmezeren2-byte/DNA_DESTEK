import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { arrayUnion, collection, doc, Firestore, limit, onSnapshot, orderBy, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';

import { ActivityIndicator, Modal, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import Logo from '../../components/Logo';
import OptimizedImage from '../../components/OptimizedImage';
import { ListSkeleton } from '../../components/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { db as dbAny } from '../../firebaseConfig';
import AuditLog from '../../services/auditService';
import toast from '../../services/toastService';
import { Talep } from '../../types';
const db = dbAny as Firestore;

// const durumConfig removed - using global DURUM_CONFIG

const durumSecenekleri = [
    { value: 'islemde', label: 'İşleme Al', icon: 'construct-outline', color: '#2e7d32' },
    { value: 'beklemede', label: 'Beklet', icon: 'pause-circle-outline', color: '#c2185b' },
    { value: 'cozuldu', label: 'Çözüldü', icon: 'checkmark-circle', color: '#00796b' },
];

const durumConfig: Record<string, { label: string; text: string; bg: string; textDark: string; bgDark: string; icon: string }> = {
    yeni: { label: 'Yeni', text: '#2196f3', bg: '#e3f2fd', textDark: '#64b5f6', bgDark: '#1a3a5c', icon: 'flash' },
    atandi: { label: 'Atandı', text: '#ff9800', bg: '#fff3e0', textDark: '#ffb74d', bgDark: '#3e2723', icon: 'people' },
    islemde: { label: 'İşlemde', text: '#9c27b0', bg: '#f3e5f5', textDark: '#ba68c8', bgDark: '#4a148c', icon: 'construct' },
    beklemede: { label: 'Beklemede', text: '#f44336', bg: '#ffebee', textDark: '#ef5350', bgDark: '#b71c1c', icon: 'time' },
    cozuldu: { label: 'Çözüldü', text: '#4caf50', bg: '#e8f5e9', textDark: '#81c784', bgDark: '#1b5e20', icon: 'checkmark-circle' },
    kapatildi: { label: 'Kapatıldı', text: '#607d8b', bg: '#eceff1', textDark: '#90a4ae', bgDark: '#263238', icon: 'close-circle' },
};

export default function TeknisyenScreen() {
    const { user, isTeknisyen } = useAuth();
    const { isDark, colors } = useTheme();
    const router = useRouter();

    // SEC-003 FIX: Server-side role guard - prevent unauthorized access via URL
    if (!isTeknisyen) {
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

    const [talepler, setTalepler] = useState<Talep[]>([]);
    const [yukleniyor, setYukleniyor] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [seciliTalep, setSeciliTalep] = useState<Talep | null>(null);
    const [detayModalVisible, setDetayModalVisible] = useState(false);
    const [yeniYorum, setYeniYorum] = useState('');
    const [islemYukleniyor, setIslemYukleniyor] = useState(false);
    const [tamEkranFoto, setTamEkranFoto] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'aktif' | 'gecmis'>('aktif');

    // Çözüm fotoğrafı için
    const [cozumModalVisible, setCozumModalVisible] = useState(false);
    const [cozumFotograflari, setCozumFotograflari] = useState<string[]>([]);
    const [yukleniyorFoto, setYukleniyorFoto] = useState(false);

    const pickImage = async () => {
        if (cozumFotograflari.length >= 3) {
            toast.warning('En fazla 3 fotoğraf ekleyebilirsiniz');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
        });

        if (!result.canceled) {
            const manipResult = await ImageManipulator.manipulateAsync(
                result.assets[0].uri,
                [{ resize: { width: 800 } }], // Smaller for Base64
                { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            if (manipResult.base64) {
                // Size check
                const sizeKB = Math.round((manipResult.base64.length * 3) / 4 / 1024);
                if (sizeKB > 500) {
                    toast.warning(`Resim boyutu biraz yüksek (${sizeKB}KB).`);
                }

                const base64Uri = `data:image/jpeg;base64,${manipResult.base64}`;
                setCozumFotograflari([...cozumFotograflari, base64Uri]);
            }
        }
    };

    const removeFoto = (index: number) => {
        const yeniFotograflar = [...cozumFotograflari];
        yeniFotograflar.splice(index, 1);
        setCozumFotograflari(yeniFotograflar);
    };

    const cozumKaydet = async () => {
        if (!seciliTalep) return;

        setIslemYukleniyor(true);
        setYukleniyorFoto(true);
        try {
            // Reverted to Base64: Use the strings already in state (compressed in pickImage/cozumFotografiSec)
            const cozumUrls = cozumFotograflari;

            await updateDoc(doc(db as Firestore, 'talepler', seciliTalep.id), {
                durum: 'cozuldu',
                cozumTarihi: Timestamp.now(),
                cozumFotograflari: cozumUrls
            });

            // SEC-001 FIX: Client-side notification kaldırıldı
            // Cloud Functions (onTalepStatusChange) bildirim gönderecek

            toast.success('Talep çözüldü olarak işaretlendi!');
            setCozumModalVisible(false);
            setDetayModalVisible(false);
            setCozumFotograflari([]);
        } catch (error: any) {
            toast.error('Hata: ' + error.message);
        } finally {
            setIslemYukleniyor(false);
            setYukleniyorFoto(false);
        }
    };

    // Realtime Data Loading
    useEffect(() => {
        const unsubscribes: (() => void)[] = [];

        const initRealtime = async () => {
            if (!user) return;
            setYukleniyor(true);

            try {
                // 1. Get Team Tasks for the technician's category
                const myTeamId = user.kategori;
                if (!myTeamId) {
                    setTalepler([]);
                    setYukleniyor(false);
                    return;
                }

                const activeStatus = ['atandi', 'islemde', 'beklemede'];
                const activeMap = new Map<string, Talep>();
                const completedMap = new Map<string, Talep>();

                const sortFn = (a: Talep, b: Talep) => {
                    if (a.oncelik === 'acil' && b.oncelik !== 'acil') return -1;
                    if (b.oncelik === 'acil' && a.oncelik !== 'acil') return 1;
                    const da = (a.olusturmaTarihi as any)?.seconds || 0;
                    const db = (b.olusturmaTarihi as any)?.seconds || 0;
                    return db - da;
                };

                const updateState = () => {
                    const activeList = Array.from(activeMap.values());
                    const completedList = Array.from(completedMap.values());
                    setTalepler([...activeList.sort(sortFn), ...completedList.sort(sortFn)]);
                };

                // A. Active Listeners (Primary Team)
                const qActive = query(
                    collection(db as Firestore, 'talepler'),
                    where('atananEkipId', '==', myTeamId),
                    where('durum', 'in', activeStatus)
                );

                const unsubActive = onSnapshot(qActive, (snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        const talep = { id: change.doc.id, ...change.doc.data() } as Talep;
                        if (change.type === 'removed') {
                            activeMap.delete(talep.id);
                        } else {
                            activeMap.set(talep.id, talep);
                        }
                    });
                    updateState();
                }, (error) => {
                    console.error("Active tasks listener error:", error);
                });
                unsubscribes.push(unsubActive);

                // A2. Active Listeners (Individual Assignments) - FIX for missing tasks
                const qIndividual = query(
                    collection(db as Firestore, 'talepler'),
                    where('atananTeknisyenId', '==', user.id),
                    where('durum', 'in', activeStatus)
                );

                const unsubIndividual = onSnapshot(qIndividual, (snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        const talep = { id: change.doc.id, ...change.doc.data() } as Talep;
                        if (change.type === 'removed') {
                            activeMap.delete(talep.id);
                        } else {
                            activeMap.set(talep.id, talep);
                        }
                    });
                    updateState();
                }, (error) => {
                    console.error("Individual tasks listener error:", error);
                });
                unsubscribes.push(unsubIndividual);

                // A3. Active Listeners (Team Membership - Robust)
                // This catches tasks assigned to a team where the user is a member, regardless of user.kategori matching
                const qMember = query(
                    collection(db as Firestore, 'talepler'),
                    where('atananEkipUyeIds', 'array-contains', user.id),
                    where('durum', 'in', activeStatus)
                );

                const unsubMember = onSnapshot(qMember, (snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        const talep = { id: change.doc.id, ...change.doc.data() } as Talep;
                        if (change.type === 'removed') {
                            activeMap.delete(talep.id);
                        } else {
                            activeMap.set(talep.id, talep);
                        }
                    });
                    updateState();
                }, (error) => {
                    console.error("Member tasks listener error:", error);
                });
                unsubscribes.push(unsubMember);

                // B. Completed Tasks (Primary Team - Limited)
                const qCompleted = query(
                    collection(db as Firestore, 'talepler'),
                    where('atananEkipId', '==', myTeamId),
                    where('durum', '==', 'cozuldu'),
                    orderBy('olusturmaTarihi', 'desc'),
                    limit(15)
                );

                const unsubCompleted = onSnapshot(qCompleted, (snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        const talep = { id: change.doc.id, ...change.doc.data() } as Talep;
                        if (change.type === 'removed') {
                            completedMap.delete(talep.id);
                        } else {
                            completedMap.set(talep.id, talep);
                        }
                    });
                    updateState();
                }, (error) => {
                    console.error("Completed tasks listener error:", error);
                });
                unsubscribes.push(unsubCompleted);

                // C. Havuz (Pool) - Optional: If we want technicians to see new unassigned tasks
                const qNew = query(
                    collection(db as Firestore, 'talepler'),
                    where('durum', '==', 'yeni'),
                    where('kategori', '==', myTeamId), // FLOW-001: Kural ile uyumlu kategori filtresi
                    limit(20)
                );
                const unsubNew = onSnapshot(qNew, (snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        const talep = { id: change.doc.id, ...change.doc.data() } as Talep;
                        if (change.type === 'removed') {
                            activeMap.delete(talep.id);
                        } else {
                            activeMap.set(talep.id, talep);
                        }
                    });
                    updateState();
                });
                unsubscribes.push(unsubNew);

                setYukleniyor(false);
            } catch (error) {
                console.error("initRealtime error:", error);
                setYukleniyor(false);
            }
        };

        initRealtime();

        return () => {
            unsubscribes.forEach(u => u());
        };
    }, [user?.uid, user?.kategori]);

    const onRefresh = useCallback(() => {
        // Realtime olduğu için refresh sadece ekipleri ve bağlantıyı yenilemek için kullanılabilir
        // Basitçe loading gösterip kapatabiliriz çünkü data zaten canlı.
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1000);
    }, []);

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

    // Durum güncelle
    const durumGuncelle = async (yeniDurum: string, fotograflar?: string[]) => {
        if (!seciliTalep) return;

        setIslemYukleniyor(true);
        try {
            const updateData: any = {
                durum: yeniDurum,
                guncellemeTarihi: Timestamp.now(),
            };

            // Çözüm fotoğrafları varsa ekle
            if (yeniDurum === 'cozuldu' && fotograflar && fotograflar.length > 0) {
                updateData.cozumFotograflari = fotograflar;
                updateData.cozumTarihi = Timestamp.now();
            }

            await updateDoc(doc(db as Firestore, 'talepler', seciliTalep.id), updateData);

            // SEC-010: Audit log for status change
            if (user) {
                AuditLog.talepStatusChanged(user.id, user.email, seciliTalep.id, seciliTalep.durum, yeniDurum);
            }

            // SEC-001 FIX: Client-side notification kaldırıldı
            // Cloud Functions (onTalepStatusChange) bildirim gönderecek

            toast.success('Durum güncellendi!');

            setCozumModalVisible(false);
            setCozumFotograflari([]);
        } catch (error: any) {
            toast.error('Hata: ' + error.message);
        } finally {
            setIslemYukleniyor(false);
        }
    };

    // Çözüm fotoğrafı seç
    const cozumFotografiSec = async () => {
        if (cozumFotograflari.length >= 3) {
            toast.warning('En fazla 3 fotoğraf ekleyebilirsiniz');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled && result.assets[0]) {
            try {
                const manipulated = await ImageManipulator.manipulateAsync(
                    result.assets[0].uri,
                    [{ resize: { width: 800 } }], // Smaller for Base64
                    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );

                if (manipulated.base64) {
                    const base64Image = `data:image/jpeg;base64,${manipulated.base64}`;
                    setCozumFotograflari(prev => [...prev, base64Image]);
                }
            } catch (error) {
                console.error('Fotoğraf işleme hatası:', error);
            }
        }
    };

    // Yorum ekle
    const yorumEkle = async () => {
        if (!seciliTalep || !yeniYorum.trim()) return;

        setIslemYukleniyor(true);
        try {
            const yorum = {
                yazanId: user?.uid,
                yazanAdi: `${user?.ad} ${user?.soyad}`,
                yazanRol: 'teknisyen',
                mesaj: yeniYorum.trim(),
                tarih: Timestamp.now(),
            };

            await updateDoc(doc(db as Firestore, 'talepler', seciliTalep.id), {
                yorumlar: arrayUnion(yorum),
            });

            toast.success('Yorum eklendi!');

            setYeniYorum('');
            setYeniYorum('');
            // setYorumModalVisible(false); // Modal kaldırıldı
        } catch (error: any) {
            toast.error('Hata: ' + error.message);
        } finally {
            setIslemYukleniyor(false);
        }
    };

    const talepDetayGoster = (talep: Talep) => {
        setSeciliTalep(talep);
        setDetayModalVisible(true);
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
                                <Text style={styles.headerTitle}>Teknisyen Paneli</Text>
                                <Text style={styles.headerSubtitle}>Yükleniyor...</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>
                <ListSkeleton count={4} type="talep" />
            </View>
        );
    }

    const aktifTalepler = talepler.filter(t => t.durum !== 'cozuldu' && t.durum !== 'kapatildi');
    const tamamlananTalepler = talepler.filter(t => t.durum === 'cozuldu' || t.durum === 'kapatildi');

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="light-content" />

            {/* Premium Custom Header & Stats */}
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
                            <Text style={styles.headerTitle}>Teknisyen Paneli</Text>
                            <Text style={styles.headerSubtitle}>İş Listesi</Text>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            {/* İstatistikler - Floating Card Style */}
            <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{aktifTalepler.length}</Text>
                    <Text style={styles.statLabel}>Aktif</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
                <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{tamamlananTalepler.length}</Text>
                    <Text style={styles.statLabel}>Biten</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#ffcdd2' }]}>
                        {talepler.filter(t => t.oncelik === 'acil' && t.durum !== 'cozuldu').length}
                    </Text>
                    <Text style={styles.statLabel}>Acil</Text>
                </View>
            </View >

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            >
                {/* Tab Buttons */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'aktif' && styles.activeTabButton, { borderBottomColor: activeTab === 'aktif' ? colors.primary : 'transparent' }]}
                        onPress={() => setActiveTab('aktif')}
                    >
                        <Text style={[styles.tabText, activeTab === 'aktif' && styles.activeTabText, { color: activeTab === 'aktif' ? colors.primary : colors.textSecondary }]}>Aktif Görevler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'gecmis' && styles.activeTabButton, { borderBottomColor: activeTab === 'gecmis' ? colors.primary : 'transparent' }]}
                        onPress={() => setActiveTab('gecmis')}
                    >
                        <Text style={[styles.tabText, activeTab === 'gecmis' && styles.activeTabText, { color: activeTab === 'gecmis' ? colors.primary : colors.textSecondary }]}>Tamamlananlar</Text>
                    </TouchableOpacity>
                </View>

                {talepler.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#1a3a5c' : '#e3f2fd' }]}>
                            <Ionicons name="checkmark-done-circle-outline" size={60} color={colors.primary} />
                        </View>
                        <Text style={[styles.emptyText, { color: colors.text }]}>Atanmış talep yok</Text>
                        <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                            Size atanan talepler burada görünecek
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Tab Content */}
                        {(activeTab === 'aktif' ? aktifTalepler : tamamlananTalepler).length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Text style={[styles.emptyText, { color: colors.text }]}>
                                    {activeTab === 'aktif' ? 'Aktif görev bulunmuyor' : 'Tamamlanmış görev bulunmuyor'}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.section}>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                    {activeTab === 'aktif' ? '🔧 Aktif Talepler' : '✅ Tamamlananlar'} ({(activeTab === 'aktif' ? aktifTalepler : tamamlananTalepler).length})
                                </Text>
                                {(activeTab === 'aktif' ? aktifTalepler : tamamlananTalepler).map((talep) => {
                                    const durum = durumConfig[talep.durum] || durumConfig.yeni;
                                    return (
                                        <TouchableOpacity
                                            key={talep.id}
                                            style={[styles.talepCard, { backgroundColor: colors.card }]}
                                            onPress={() => talepDetayGoster(talep)}
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
                                                        <Text style={[styles.durumText, { color: isDark ? durum.textDark : durum.text }]}>{durum.label}</Text>
                                                    </View>
                                                </View>

                                                <Text style={[styles.talepBaslik, { color: colors.text }]} numberOfLines={1}>{talep.baslik}</Text>
                                                <Text style={[styles.talepAciklama, { color: colors.textSecondary }]} numberOfLines={2}>{talep.aciklama}</Text>

                                                <View style={styles.talepFooter}>
                                                    <View style={styles.footerItem}>
                                                        <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                                                        <Text style={[styles.footerText, { color: colors.textSecondary }]}>{talep.olusturanAd || 'İsimsiz'}</Text>
                                                    </View>
                                                    <View style={styles.footerItem}>
                                                        <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                                                        <Text style={[styles.footerText, { color: colors.textSecondary }]}>{formatTarih(talep.olusturmaTarihi)}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </>
                )}
                <View style={{ height: 30 }} />
            </ScrollView>
            {/* Talep Detay Modal */}
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

                                            {/* Müşteri Bilgisi */}
                                            <View style={[styles.musteriCard, { backgroundColor: isDark ? colors.inputBg : '#f8f9fa' }]}>
                                                <Ionicons name="person-circle-outline" size={40} color={colors.primary} />
                                                <View style={styles.musteriInfo}>
                                                    <Text style={[styles.musteriAdi, { color: colors.text }]}>{seciliTalep.musteriAdi}</Text>
                                                    <TouchableOpacity>
                                                        <Text style={[styles.musteriTelefon, { color: colors.primary }]}>📞 {seciliTalep.musteriTelefon}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {/* Konum */}
                                            <View style={styles.detaySection}>
                                                <Text style={[styles.detaySectionTitle, { color: colors.text }]}>📍 Konum</Text>
                                                <Text style={[styles.detayInfo, { color: colors.textSecondary }]}>
                                                    {seciliTalep.projeAdi} {seciliTalep.blokAdi && `• ${seciliTalep.blokAdi}`} {seciliTalep.daireNo && `• Daire ${seciliTalep.daireNo}`}
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

                                            {/* ------------- SOHBET/MESAJLAR ------------- */}
                                            <View style={styles.detaySection}>
                                                <Text style={[styles.detaySectionTitle, { color: colors.text }]}>💬 Mesajlar</Text>

                                                <View style={[styles.chatContainer, { backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5', borderColor: colors.border }]}>
                                                    {(!seciliTalep.yorumlar || seciliTalep.yorumlar.length === 0) ? (
                                                        <View style={styles.emptyChat}>
                                                            <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>Henüz mesaj yok.</Text>
                                                        </View>
                                                    ) : (
                                                        seciliTalep.yorumlar.map((mesaj, idx) => {
                                                            const isMe = mesaj.yazanId === user?.uid;
                                                            return (
                                                                <View key={idx} style={[
                                                                    styles.messageBubble,
                                                                    isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
                                                                    { backgroundColor: isMe ? colors.primary : (isDark ? '#333' : '#e0e0e0') }
                                                                ]}>
                                                                    <Text style={[styles.messageAuthor, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
                                                                        {mesaj.yazanAdi} ({mesaj.yazanRol === 'teknisyen' ? 'Teknisyen' : 'Müşteri'})
                                                                    </Text>
                                                                    <Text style={[styles.messageText, { color: isMe ? '#fff' : (isDark ? '#fff' : '#000') }]}>
                                                                        {mesaj.mesaj}
                                                                    </Text>
                                                                </View>
                                                            );
                                                        })
                                                    )}
                                                </View>
                                            </View>

                                            {/* Durum Güncelleme */}
                                            {seciliTalep.durum !== 'cozuldu' && (
                                                <View style={styles.detaySection}>
                                                    <Text style={[styles.detaySectionTitle, { color: colors.text }]}>🔄 Durum Güncelle</Text>
                                                    <View style={styles.durumButonlar}>
                                                        {durumSecenekleri.map((secenek) => (
                                                            <TouchableOpacity
                                                                key={secenek.value}
                                                                style={[
                                                                    styles.durumButon,
                                                                    { borderColor: secenek.color },
                                                                    seciliTalep.durum === secenek.value && { backgroundColor: secenek.color }
                                                                ]}
                                                                onPress={() => {
                                                                    if (secenek.value === 'cozuldu') {
                                                                        setCozumModalVisible(true);
                                                                    } else {
                                                                        durumGuncelle(secenek.value);
                                                                    }
                                                                }}
                                                                disabled={islemYukleniyor}
                                                            >
                                                                <Ionicons
                                                                    name={secenek.icon as any}
                                                                    size={18}
                                                                    color={seciliTalep.durum === secenek.value ? '#fff' : secenek.color}
                                                                />
                                                                <Text style={[
                                                                    styles.durumButonText,
                                                                    { color: seciliTalep.durum === secenek.value ? '#fff' : secenek.color }
                                                                ]}>
                                                                    {secenek.label}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </View>
                                            )}

                                            {/* Mesaj Input - Inline */}
                                            {seciliTalep.durum !== 'kapatildi' && (
                                                <View style={styles.inputContainer}>
                                                    <TextInput
                                                        style={[styles.miniInput, { backgroundColor: isDark ? '#333' : '#fff', color: colors.text, borderColor: colors.border }]}
                                                        placeholder="Mesaj yazın..."
                                                        placeholderTextColor={colors.textMuted}
                                                        value={yeniYorum}
                                                        onChangeText={setYeniYorum}
                                                        multiline
                                                    />
                                                    <TouchableOpacity
                                                        style={[styles.sendButton, { backgroundColor: colors.primary, opacity: (!yeniYorum.trim() || islemYukleniyor) ? 0.5 : 1 }]}
                                                        onPress={yorumEkle}
                                                        disabled={!yeniYorum.trim() || islemYukleniyor}
                                                    >
                                                        {islemYukleniyor ? (
                                                            <ActivityIndicator size="small" color="#fff" />
                                                        ) : (
                                                            <Ionicons name="send" size={18} color="#fff" />
                                                        )}
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                            <View style={{ height: 20 }} />
                                        </ScrollView>
                                    </>
                                )}
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Çözüm Modal */}
            <Modal visible={cozumModalVisible} animationType="slide" transparent onRequestClose={() => { setCozumModalVisible(false); setCozumFotograflari([]); }}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.cozumModal, { backgroundColor: colors.card }]}>
                        <View style={[styles.modalHandle, { backgroundColor: isDark ? '#555' : '#ddd' }]} />

                        <Text style={[styles.cozumModalTitle, { color: colors.text }]}>✅ Talebi Tamamla</Text>
                        <Text style={[styles.cozumModalSubtitle, { color: colors.textSecondary }]}>
                            Çözüm fotoğrafları ekleyerek işi belgelendirin
                        </Text>

                        {/* Fotoğraf Önizleme */}
                        <View style={styles.cozumFotoContainer}>
                            {cozumFotograflari.map((foto, index) => (
                                <View key={index} style={styles.cozumFotoWrapper}>
                                    <OptimizedImage source={{ uri: foto }} style={styles.cozumFotoThumb} />
                                    <TouchableOpacity
                                        style={styles.cozumFotoSil}
                                        onPress={() => setCozumFotograflari(prev => prev.filter((_, i) => i !== index))}
                                    >
                                        <Ionicons name="close-circle" size={22} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {cozumFotograflari.length < 3 && (
                                <TouchableOpacity
                                    style={[styles.cozumFotoEkle, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
                                    onPress={pickImage}
                                >
                                    <Ionicons name="camera" size={28} color={colors.primary} />
                                    <Text style={[styles.cozumFotoEkleText, { color: colors.textSecondary }]}>Ekle</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={[styles.infoBubble, { backgroundColor: isDark ? '#1a3a5c' : '#e8f5e9', marginBottom: 15, padding: 10 }]}>
                            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                            <Text style={[styles.infoBubbleText, { color: colors.textSecondary, fontSize: 11, marginLeft: 6 }]}>
                                Resimler Base64 formatında ve otomatik sıkıştırılmış olarak kaydedilir (Maks 1MB toplam limit).
                            </Text>
                        </View>

                        {/* Butonlar */}
                        <View style={styles.cozumButonlar}>
                            <TouchableOpacity
                                style={[styles.cozumIptal, { borderColor: colors.border }]}
                                onPress={() => { setCozumModalVisible(false); setCozumFotograflari([]); }}
                            >
                                <Text style={[styles.cozumIptalText, { color: colors.text }]}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.cozumOnayla, { backgroundColor: '#00796b' }]}
                                onPress={cozumKaydet}
                                disabled={islemYukleniyor}
                            >
                                {islemYukleniyor ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                        <Text style={styles.cozumOnaylaText}>Çözüldü Olarak İşaretle</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
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
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, fontSize: 14 },
    header: {
        paddingTop: 60,
        paddingBottom: 25,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        elevation: 5,
        zIndex: 10,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 0,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
    },

    // Stats Container Refined (Overlay effect)
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginTop: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        padding: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    statItem: { alignItems: 'center', minWidth: 60 },
    statNumber: { fontSize: 26, fontWeight: '800', color: '#fff' },
    statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    statDivider: { width: 1, height: 40 },

    content: { flex: 1, padding: 20, paddingTop: 10 },
    emptyContainer: { alignItems: 'center', paddingVertical: 60 },
    emptyIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    emptyText: { fontSize: 18, fontWeight: '600' },
    emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center' },
    section: { marginBottom: 30 },
    sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, marginLeft: 8 },

    // Card Styling - Premium Look
    talepCard: {
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.02)'
    },
    statusBar: { width: 6 },
    talepContent: { flex: 1, padding: 16 },
    talepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    kategoriBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    kategoriText: { fontSize: 11, fontWeight: '700' },
    durumBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 5 },
    durumText: { fontSize: 11, fontWeight: '700' },
    talepBaslik: { fontSize: 17, fontWeight: '700', marginBottom: 10, lineHeight: 22 },
    talepAciklama: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    infoText: { fontSize: 13, fontWeight: '500' },
    talepFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4, borderTopWidth: 1 },
    footerItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    footerText: { fontSize: 12, fontWeight: '500' },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    tarihText: { fontSize: 11 },
    yorumIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    yorumCount: { fontSize: 11 },
    acilBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: '#c62828', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4, zIndex: 1 },
    acilText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    acilBadgeLarge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#c62828', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 6 },
    acilTextLarge: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    talepCardSmall: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 8, gap: 10 },
    talepBaslikSmall: { flex: 1, fontSize: 14 },
    tarihTextSmall: { fontSize: 11 },
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
    yorumItem: { padding: 12, borderRadius: 10, marginBottom: 8 },
    yorumYazan: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
    yorumMesaj: { fontSize: 14 },
    durumButonlar: { flexDirection: 'row', gap: 10 },
    durumButon: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, borderWidth: 2, gap: 6 },
    durumButonText: { fontSize: 13, fontWeight: '600' },
    yorumEkleButon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, gap: 8, marginTop: 10 },
    yorumEkleText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    yorumModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
    yorumModalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
    yorumInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, height: 120, textAlignVertical: 'top', marginBottom: 16 },
    yorumButonlar: { flexDirection: 'row', gap: 12 },
    yorumIptal: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
    yorumIptalText: { fontSize: 15, fontWeight: '600' },
    yorumGonder: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
    yorumGonderText: { color: '#fff', fontSize: 15, fontWeight: '600' },
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
    // Çözüm Modal Stilleri
    cozumModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
    cozumModalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
    cozumModalSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
    cozumFotoContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
    cozumFotoWrapper: { position: 'relative' },
    cozumFotoThumb: { width: 90, height: 90, borderRadius: 12 },
    cozumFotoSil: { position: 'absolute', top: -8, right: -8, backgroundColor: '#fff', borderRadius: 12 },
    cozumFotoEkle: { width: 90, height: 90, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
    cozumFotoEkleText: { fontSize: 12, marginTop: 4 },
    cozumFotoHint: { fontSize: 12, textAlign: 'center', marginBottom: 20 },
    cozumButonlar: { flexDirection: 'row', gap: 12 },
    cozumIptal: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
    cozumIptalText: { fontSize: 15, fontWeight: '600' },
    cozumOnayla: { flex: 2, flexDirection: 'row', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
    cozumOnaylaText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    infoBubble: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12 },
    infoBubbleText: { flex: 1, fontSize: 12 },
    // TAB STYLES
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 10,
        backgroundColor: 'transparent',
        marginBottom: 10,
    },
    tabButton: {
        marginRight: 20,
        paddingVertical: 10,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    activeTabButton: {
        borderBottomColor: '#2b5876', // Primary Color
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    activeTabText: {
        color: '#2b5876', // Primary Color
        fontWeight: '700',
    },
    // SOHBET STYLES
    chatContainer: {
        borderRadius: 12,
        padding: 12,
        minHeight: 150,
        maxHeight: 250,
        marginBottom: 10,
        borderWidth: 1,
    },
    emptyChat: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.6,
        padding: 20,
    },
    emptyChatText: {
        fontSize: 14,
        fontStyle: 'italic',
    },
    messageBubble: {
        padding: 10,
        borderRadius: 12,
        marginBottom: 8,
        maxWidth: '80%',
    },
    messageBubbleMe: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 2,
    },
    messageBubbleOther: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 2,
    },
    messageAuthor: {
        fontSize: 10,
        marginBottom: 2,
        fontWeight: 'bold',
    },
    messageText: {
        fontSize: 13,
        lineHeight: 18,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    miniInput: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        maxHeight: 80,
    },
    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
