import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Platform,
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
import { ListSkeleton } from '../../components/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getTalepler, puanlaTalep, subscribeToTalepler, updateTalepDurum } from '../../services/talepService';
import toast from '../../services/toastService';

interface Talep {
    id: string;
    baslik: string;
    aciklama: string;
    kategori: string;
    durum: string;
    projeAdi: string;
    blokAdi?: string;
    daireNo?: string;
    olusturmaTarihi: { seconds: number };
    oncelik: string;
    atananTeknisyenAdi?: string;
    fotograflar?: string[];
    puan?: number;
    degerlendirme?: string;
}

const durumConfig: Record<string, { bg: string; bgDark: string; text: string; textDark: string; icon: string; label: string; message: string }> = {
    yeni: {
        bg: '#e3f2fd', bgDark: '#1a3a5c',
        text: '#1565c0', textDark: '#64b5f6',
        icon: 'hourglass-outline',
        label: 'Sırada',
        message: 'Talebiniz değerlendirme sırasına alındı'
    },
    atandi: {
        bg: '#fff3e0', bgDark: '#3a2a1a',
        text: '#ef6c00', textDark: '#ffb74d',
        icon: 'person-outline',
        label: 'Atandı',
        message: 'Bir teknisyen görevlendirildi'
    },
    islemde: {
        bg: '#e8f5e9', bgDark: '#1a3a1a',
        text: '#2e7d32', textDark: '#81c784',
        icon: 'construct-outline',
        label: 'İşlemde',
        message: 'Sorun üzerinde çalışılıyor'
    },
    beklemede: {
        bg: '#fce4ec', bgDark: '#3a1a2a',
        text: '#c2185b', textDark: '#f48fb1',
        icon: 'pause-circle-outline',
        label: 'Beklemede',
        message: 'Ek bilgi veya malzeme bekleniyor'
    },
    cozuldu: {
        bg: '#e0f2f1', bgDark: '#1a3a3a',
        text: '#00796b', textDark: '#4db6ac',
        icon: 'checkmark-circle',
        label: 'Çözüldü',
        message: 'Sorun başarıyla giderildi'
    },
    iptal: {
        bg: '#ffebee', bgDark: '#3a1a1a',
        text: '#c62828', textDark: '#ef5350',
        icon: 'close-circle',
        label: 'İptal Edildi',
        message: 'Bu talep iptal edildi'
    },
    kapatildi: {
        bg: '#eceff1', bgDark: '#2a2a2a',
        text: '#546e7a', textDark: '#90a4ae',
        icon: 'close-circle-outline',
        label: 'Kapatıldı',
        message: 'Talep kapatıldı'
    },
};

export default function TaleplerimScreen() {
    const { user, logout } = useAuth();
    const { isDark, colors } = useTheme();
    const router = useRouter();
    const [talepler, setTalepler] = useState<Talep[]>([]);
    const [yukleniyor, setYukleniyor] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [seciliTalep, setSeciliTalep] = useState<Talep | null>(null);
    const [detayModalVisible, setDetayModalVisible] = useState(false);
    const [tamEkranFoto, setTamEkranFoto] = useState<string | null>(null);
    const [iptalYukleniyor, setIptalYukleniyor] = useState(false);

    // Pagination State
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // Puanlama State
    const [puanModalVisible, setPuanModalVisible] = useState(false);
    const [secilenPuan, setSecilenPuan] = useState(0);
    const [yorum, setYorum] = useState('');
    const [puanYukleniyor, setPuanYukleniyor] = useState(false);



    const talepleriYukle = async (isRefresh = false) => {
        if (!user) return;

        if (!isRefresh) setYukleniyor(true);
        if (isRefresh) {
            setHasMore(true);
            setLastDoc(null);
        }

        try {
            // isRefresh ise null, değilse lastDoc kullan? Hayır, talepleriYukle her zaman initial load'dur (refresh veya ilk açılış).
            // Daha fazla yükle ayrı fonksiyondur.
            const result = await getTalepler(user.uid, user.rol, {}, null, 15);
            if (result.success) {
                setTalepler(result.talepler as Talep[]);
                setLastDoc(result.lastVisible);
                if (!result.lastVisible || (result.talepler && result.talepler.length < 15)) setHasMore(false);
                else setHasMore(true);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setYukleniyor(false);
            setRefreshing(false);
        }
    };

    const dahaFazlaYukle = async () => {
        if (!user || loadingMore || !hasMore || !lastDoc) return;

        setLoadingMore(true);
        try {
            const result = await getTalepler(user.uid, user.rol, {}, lastDoc, 15);
            if (result.success && result.talepler && result.talepler.length > 0) {
                setTalepler(prev => [...prev, ...result.talepler]);
                setLastDoc(result.lastVisible);
                if (!result.lastVisible || result.talepler.length < 15) setHasMore(false);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        if (!user) return;

        // İlk yükleme (Subscription)
        // Hibrit: İlk sayfa Realtime, kalanı Pagination
        setYukleniyor(true);
        const unsubscribe = subscribeToTalepler(user.uid, user.rol, {}, (result) => {
            if (result.success && result.talepler) {
                // Eğer sayfalama ile daha fazla veri yüklendiyse, realtime güncellemeyi
                // mevcut listenin başına eklemeli veya birleştirmeliyiz.
                // Basitlik için: Realtime sadece "başlangıç listesini" günceller.
                // Eğer kullanıcı çok aşağı indiyse ve yeni veri gelirse liste resetlenebilir veya
                // yeni veri yukarıda belirir.

                // Burada basit strateji: Gelen veri (ilk 50) her zaman üstüne yazar.
                // Ancak "dahaFazlaYukle" ile gelen eski verileri korumak lazım mı?
                // Genellikle realtime + infinite scroll zordur.
                // Çözüm: Realtime sadece "yeni" veri geldiğinde `talepler` state'inin başını günceller.
                // Ama `onSnapshot` tüm seti (50) döndürür.

                setTalepler(prev => {
                    // Eğer sayfalama yapılmadıysa (sadece ilk set varsa), direk değiştir.
                    if (!lastDoc) return result.talepler as Talep[];

                    // Eğer sayfalama yapıldıysa, ilk 50'yi güncelle, gerisini koru?
                    // Bu ID çakışması yapabilir.
                    // En temiz hibrit: Sayfalamayı sadece "geçmiş" için kullan, realtime'ı "güncel" için.
                    // Şimdilik: Realtime veriyi bas, lastDoc'u güncelleme (çünkü snapshot'tan lastDoc almak zor).
                    // Aslında snapshot.docs son elemanı verir ama burada map lenmiş veri dönüyor.
                    // İdeal çözüm için subscribeToTalepler'in snapshot da dönmesi lazım.

                    // Kestirme: Realtime sarmalayıcı sadece ilk seti (50) yönetir. 
                    // Sayfalama (load more) yapıldığında, kullanıcı en alta inmiştir.
                    // Yeni veri gelirse yukarıda belirir.
                    // Bu durumda 'prev' ile birleştirme yapmayalım, çünkü snapshot zaten "son halini" verir (ilk 50 için).
                    // Eğer 50'den fazla veri varsa ve biz onları loadMore ile yüklediysek, onları korumalıyız.
                    // Ama snapshot 50 tane döndürecek.

                    // Basit Mod: Realtime çalışırken infinite scroll'u "manuel" tutalım.
                    // Snapshot gelince sadece ilk 50'yi set edelim.
                    return result.talepler as Talep[];
                });

                if (result.talepler.length < 50) setHasMore(false);
                else setHasMore(true);

                // Not: Snapshot her tetiklendiğinde yukleniyor false olur.
                setYukleniyor(false);
            }
        });

        return () => {
            if (unsubscribe) unsubscribe();
        }
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
        talepleriYukle(true);
    };

    const formatTarih = (timestamp: { seconds: number }) => {
        if (!timestamp?.seconds) return '-';
        const date = new Date(timestamp.seconds * 1000);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return 'Bugün ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Dün ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        } else if (days < 7) {
            return `${days} gün önce`;
        } else {
            return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
        }
    };

    const talepDetayGoster = (talep: Talep) => {
        setSeciliTalep(talep);
        setDetayModalVisible(true);
    };

    // Talep iptal et
    const talepIptalEt = async () => {
        if (!seciliTalep) return;

        const confirmed = Platform.OS === 'web'
            ? window.confirm('Bu talebi iptal etmek istediğinizden emin misiniz?')
            : await new Promise((resolve) => {
                // Alert için mobil
                resolve(true);
            });

        if (confirmed) {
            setIptalYukleniyor(true);
            try {
                await updateTalepDurum(seciliTalep.id, 'iptal');
                toast.success('Talep iptal edildi');
                setDetayModalVisible(false);
                talepleriYukle();
            } catch (error: any) {
                toast.error('Hata: ' + error.message);
            } finally {
                setIptalYukleniyor(false);
            }
        }
    }


    // Puanlama İşlemleri
    const puanlamayiBaslat = () => {
        setSecilenPuan(5);
        setYorum('');
        setPuanModalVisible(true);
    };

    const puanlamayiKaydet = async () => {
        if (!seciliTalep || secilenPuan === 0) return;

        setPuanYukleniyor(true);
        try {
            const result = await puanlaTalep(seciliTalep.id, secilenPuan, yorum);
            if (result.success) {
                toast.success('Değerlendirmeniz için teşekkürler! ⭐');
                setPuanModalVisible(false);
                setDetayModalVisible(false);
                talepleriYukle();
            } else {
                toast.error('Hata: ' + result.message);
            }
        } catch (error: any) {
            toast.error('Hata: ' + error.message);
        } finally {
            setPuanYukleniyor(false);
        }
    };

    // İptal edilebilir mi kontrol et (sadece yeni olanlar)
    const iptalEdilebilir = (talep: Talep) => {
        return talep.durum === 'yeni';
    };

    if (yukleniyor) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

                {/* Premium Header */}
                <LinearGradient
                    colors={['#1a3a5c', '#203a43', '#2c5364']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.header}
                >
                    <View style={styles.headerTop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Logo size="md" variant="glass" />
                            <View>
                                <Text style={styles.headerTitle}>Taleplerim</Text>
                                <Text style={styles.headerSubtitle}>Destek Geçmişi</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.refreshButton} onPress={() => talepleriYukle(true)}>
                            <Ionicons name="refresh" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
                <ListSkeleton count={5} type="talep" />
            </View>
        );
    }

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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Logo size="md" variant="glass" />
                        <View>
                            <Text style={styles.headerTitle}>Taleplerim</Text>
                            <Text style={styles.headerSubtitle}>
                                {talepler.length} talep • {talepler.filter(t => t.durum === 'islemde' || t.durum === 'atandi').length} aktif
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.refreshButton} onPress={() => talepleriYukle(true)}>
                        <Ionicons name="refresh" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <FlashList
                contentContainerStyle={styles.content}
                data={talepler}
                // @ts-ignore
                estimatedItemSize={200}
                keyExtractor={(item) => item.id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                }
                onEndReached={dahaFazlaYukle}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    loadingMore ?
                        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} /> :
                        <View style={{ height: 90 }} /> // Extra padding for FAB/Bottom Tab
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <View style={[styles.emptyIconContainer, { backgroundColor: isDark ? '#1a3a5c' : '#e3f2fd' }]}>
                            <Ionicons name="document-text-outline" size={60} color={colors.primary} />
                        </View>
                        <Text style={[styles.emptyText, { color: colors.text }]}>Henüz talebiniz yok</Text>
                        <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                            Yeni bir destek talebi oluşturmak için{'\n'}"Yeni Talep" sekmesine gidin
                        </Text>
                    </View>
                }
                renderItem={({ item, index }: { item: Talep; index: number }) => {
                    const talep = item;
                    const durum = durumConfig[talep.durum] || durumConfig.yeni;
                    const hasFoto = talep.fotograflar && talep.fotograflar.length > 0;

                    return (
                        <AnimatedItem index={index}>
                            <TouchableOpacity
                                style={[styles.talepCard, { backgroundColor: colors.card }]}
                                activeOpacity={0.7}
                                onPress={() => talepDetayGoster(talep)}
                            >
                                {/* ... content ... */}
                                {/* Sol kenar renk göstergesi */}
                                <View style={[styles.statusIndicator, { backgroundColor: isDark ? durum.textDark : durum.text }]} />

                                <View style={styles.talepContent}>
                                    {/* Üst kısım */}
                                    <View style={styles.talepHeader}>
                                        <View style={[styles.kategoriContainer, { backgroundColor: isDark ? colors.inputBg : '#f5f5f5' }]}>
                                            <Text style={[styles.kategoriText, { color: colors.textSecondary }]}>{talep.kategori}</Text>
                                        </View>
                                        <View style={[styles.durumBadge, { backgroundColor: isDark ? durum.bgDark : durum.bg }]}>
                                            <Ionicons name={durum.icon as any} size={12} color={isDark ? durum.textDark : durum.text} />
                                            <Text style={[styles.durumText, { color: isDark ? durum.textDark : durum.text }]}>
                                                {durum.label}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Başlık */}
                                    <Text style={[styles.talepBaslik, { color: colors.text }]}>{talep.baslik}</Text>

                                    {/* Konum */}
                                    <View style={styles.infoRow}>
                                        <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                            {talep.projeAdi}
                                            {talep.blokAdi ? ` • ${talep.blokAdi}` : ''}
                                            {talep.daireNo ? ` • D.${talep.daireNo}` : ''}
                                        </Text>
                                    </View>

                                    {/* Teknisyen bilgisi veya durum mesajı */}
                                    {talep.atananTeknisyenAdi ? (
                                        <View style={[styles.teknisyenContainer, { backgroundColor: isDark ? '#1a3a5c' : '#e3f2fd' }]}>
                                            <View style={[styles.teknisyenAvatar, { backgroundColor: isDark ? '#0d47a1' : '#fff' }]}>
                                                <Ionicons name="person" size={14} color={colors.primary} />
                                            </View>
                                            <Text style={[styles.teknisyenText, { color: isDark ? '#64b5f6' : '#1565c0' }]}>
                                                <Text style={{ fontWeight: '400', color: colors.textSecondary }}>Teknisyen: </Text>
                                                {talep.atananTeknisyenAdi}
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={styles.statusMessageContainer}>
                                            <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
                                            <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>{durum.message}</Text>
                                        </View>
                                    )}

                                    {/* Alt kısım - Tarih */}
                                    <View style={[styles.talepFooter, { borderTopColor: isDark ? '#333' : '#f5f5f5' }]}>
                                        <View style={styles.footerLeft}>
                                            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                                            <Text style={[styles.tarihText, { color: colors.textMuted }]}>{formatTarih(talep.olusturmaTarihi)}</Text>
                                        </View>
                                        {hasFoto && (
                                            <View style={styles.fotoIndicator}>
                                                <Ionicons name="image-outline" size={12} color={colors.textSecondary} />
                                                <Text style={[styles.fotoCount, { color: colors.textSecondary }]}>{talep.fotograflar?.length}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </AnimatedItem>
                    );
                }}
            />

            {/* Talep Detay Modal */}
            <Modal
                visible={detayModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setDetayModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.detayModalContent, { backgroundColor: colors.card }]}>
                        <View style={[styles.modalHandle, { backgroundColor: isDark ? '#555' : '#ddd' }]} />

                        {seciliTalep && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Başlık */}
                                <View style={styles.detayHeader}>
                                    <Text style={[styles.detayBaslik, { color: colors.text }]}>{seciliTalep.baslik}</Text>
                                    <TouchableOpacity onPress={() => setDetayModalVisible(false)}>
                                        <Ionicons name="close-circle" size={28} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                {/* Durum */}
                                {(() => {
                                    const d = durumConfig[seciliTalep.durum] || durumConfig.yeni;
                                    return (
                                        <View style={[styles.detayDurum, { backgroundColor: isDark ? d.bgDark : d.bg }]}>
                                            <Ionicons name={d.icon as any} size={20} color={isDark ? d.textDark : d.text} />
                                            <View style={styles.detayDurumText}>
                                                <Text style={[styles.detayDurumLabel, { color: isDark ? d.textDark : d.text }]}>{d.label}</Text>
                                                <Text style={[styles.detayDurumMessage, { color: colors.textSecondary }]}>{d.message}</Text>
                                            </View>
                                        </View>
                                    );
                                })()}

                                {/* Teknisyen */}
                                {seciliTalep.atananTeknisyenAdi && (
                                    <View style={styles.detaySection}>
                                        <Text style={[styles.detaySectionTitle, { color: colors.text }]}>👷 Atanan Teknisyen</Text>
                                        <View style={[styles.teknisyenCard, { backgroundColor: isDark ? '#1a3a5c' : '#e3f2fd' }]}>
                                            <View style={[styles.teknisyenAvatarLarge, { backgroundColor: isDark ? '#0d47a1' : '#fff' }]}>
                                                <Ionicons name="person" size={24} color={colors.primary} />
                                            </View>
                                            <Text style={[styles.teknisyenName, { color: isDark ? '#64b5f6' : '#1565c0' }]}>{seciliTalep.atananTeknisyenAdi}</Text>
                                        </View>
                                    </View>
                                )}

                                {/* Konum */}
                                <View style={styles.detaySection}>
                                    <Text style={[styles.detaySectionTitle, { color: colors.text }]}>📍 Konum</Text>
                                    <Text style={[styles.detayInfo, { color: colors.textSecondary }]}>
                                        {seciliTalep.projeAdi}
                                        {seciliTalep.blokAdi && ` • ${seciliTalep.blokAdi}`}
                                        {seciliTalep.daireNo && ` • Daire ${seciliTalep.daireNo}`}
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

                                {/* Tarih */}
                                <View style={styles.detaySection}>
                                    <Text style={[styles.detaySectionTitle, { color: colors.text }]}>📅 Oluşturulma</Text>
                                    <Text style={[styles.detayInfo, { color: colors.textSecondary }]}>
                                        {formatTarih(seciliTalep.olusturmaTarihi)}
                                    </Text>
                                </View>

                                {/* İptal Butonu */}
                                {iptalEdilebilir(seciliTalep) && (
                                    <TouchableOpacity
                                        style={[styles.iptalButton, { backgroundColor: isDark ? '#3a1a1a' : '#ffebee' }]}
                                        onPress={talepIptalEt}
                                        disabled={iptalYukleniyor}
                                    >
                                        {iptalYukleniyor ? (
                                            <ActivityIndicator color="#c62828" />
                                        ) : (
                                            <>
                                                <Ionicons name="close-circle-outline" size={20} color="#c62828" />
                                                <Text style={styles.iptalButtonText}>Talebi İptal Et</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}

                                {/* Puanlama Butonu */}
                                {seciliTalep.durum === 'cozuldu' && !seciliTalep.puan && (
                                    <TouchableOpacity
                                        style={[styles.puanlaButton, { backgroundColor: colors.primary }]}
                                        onPress={puanlamayiBaslat}
                                    >
                                        <Ionicons name="star" size={20} color="#fff" />
                                        <Text style={styles.puanlaButtonText}>Hizmeti Değerlendir</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Puanlanmışsa Göster */}
                                {seciliTalep.puan && (
                                    <View style={[styles.puanBilgiContainer, { backgroundColor: isDark ? '#2e3a1a' : '#f9fbe7', borderColor: '#c0ca33' }]}>
                                        <View style={styles.puanHeader}>
                                            <Text style={[styles.puanBaslik, { color: isDark ? '#dace29' : '#827717' }]}>Değerlendirmeniz</Text>
                                            <View style={styles.yildizRowSmall}>
                                                {[...Array(5)].map((_, i) => (
                                                    <Ionicons
                                                        key={i}
                                                        name={i < seciliTalep.puan! ? "star" : "star-outline"}
                                                        size={14}
                                                        color="#fbc02d"
                                                    />
                                                ))}
                                            </View>
                                        </View>
                                        {seciliTalep.degerlendirme && (
                                            <Text style={[styles.puanYorum, { color: colors.textSecondary }]}>"{seciliTalep.degerlendirme}"</Text>
                                        )}
                                    </View>
                                )}

                                <View style={{ height: 20 }} />
                            </ScrollView>
                        )}

                    </View>
                </View>
            </Modal>

            {/* Puanlama Modal */}
            <Modal
                visible={puanModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setPuanModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.puanModalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.puanModalTitle, { color: colors.text }]}>Hizmetimizi Puanlayın</Text>
                        <Text style={[styles.puanModalSubtitle, { color: colors.textSecondary }]}>
                            Aldığınız hizmetten memnun kaldınız mı?
                        </Text>

                        <View style={styles.yildizContainer}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity key={star} onPress={() => setSecilenPuan(star)}>
                                    <Ionicons
                                        name={star <= secilenPuan ? "star" : "star-outline"}
                                        size={40}
                                        color="#fbc02d"
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={[styles.yorumInput, {
                                backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
                                color: colors.text,
                                borderColor: colors.border
                            }]}
                            placeholder="Yorumunuz (opsiyonel)"
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={3}
                            value={yorum}
                            onChangeText={setYorum}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: isDark ? '#333' : '#eee' }]}
                                onPress={() => setPuanModalVisible(false)}
                                disabled={puanYukleniyor}
                            >
                                <Text style={[styles.modalButtonText, { color: colors.text }]}>Vazgeç</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                                onPress={puanlamayiKaydet}
                                disabled={puanYukleniyor}
                            >
                                {puanYukleniyor ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>Gönder</Text>
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
                        <Image source={{ uri: tamEkranFoto }} style={styles.fullScreenImage} resizeMode="contain" />
                    )}
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 25,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 1,
    },
    headerSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    refreshButton: {
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
    },
    settingsButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
    },
    emptySubtext: {
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 22,
    },
    talepCard: {
        flexDirection: 'row',
        borderRadius: 14,
        marginBottom: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    statusIndicator: {
        width: 4,
    },
    talepContent: {
        flex: 1,
        padding: 14,
    },
    talepHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    kategoriContainer: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    kategoriText: {
        fontSize: 11,
        fontWeight: '600',
    },
    durumBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        gap: 4,
    },
    durumText: {
        fontSize: 11,
        fontWeight: '600',
    },
    talepBaslik: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 8,
    },
    infoText: {
        fontSize: 12,
    },
    teknisyenContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
        marginBottom: 10,
    },
    teknisyenAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    teknisyenText: {
        fontSize: 12,
    },
    statusMessageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
    },
    statusMessage: {
        fontSize: 12,
        fontStyle: 'italic',
    },
    talepFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
        borderTopWidth: 1,
    },
    footerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    tarihText: {
        fontSize: 11,
    },
    fotoIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    fotoCount: {
        fontSize: 11,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    detayModalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        padding: 20,
    },
    modalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    detayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    detayBaslik: {
        fontSize: 20,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 12,
    },
    detayDurum: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        marginBottom: 20,
        gap: 12,
    },
    detayDurumText: {
        flex: 1,
    },
    detayDurumLabel: {
        fontSize: 15,
        fontWeight: '600',
    },
    detayDurumMessage: {
        fontSize: 12,
        marginTop: 2,
    },
    detaySection: {
        marginBottom: 18,
    },
    detaySectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    detayInfo: {
        fontSize: 15,
        lineHeight: 22,
    },
    detayAciklama: {
        fontSize: 15,
        lineHeight: 22,
    },
    detayFotoScroll: {
        paddingRight: 20,
    },
    detayFoto: {
        width: 120,
        height: 120,
        borderRadius: 12,
        marginRight: 10,
        resizeMode: 'cover',
    },
    iptalButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        marginTop: 10,
        gap: 8,
    },
    iptalButtonText: {
        color: '#c62828',
        fontWeight: '600',
        fontSize: 15,
    },
    puanlaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        marginTop: 10,
        gap: 8,
    },
    puanlaButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
    puanBilgiContainer: {
        padding: 16,
        borderRadius: 12,
        marginTop: 10,
        borderWidth: 1,
    },
    puanHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    puanBaslik: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    yildizRowSmall: {
        flexDirection: 'row',
        gap: 2,
    },
    puanYorum: {
        fontStyle: 'italic',
        fontSize: 14,
    },
    puanModalContent: {
        padding: 24,
        margin: 20,
        borderRadius: 20,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    puanModalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    puanModalSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
    },
    yildizContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    yorumInput: {
        width: '100%',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        marginBottom: 20,
        textAlignVertical: 'top',
        height: 80,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonText: {
        fontWeight: '600',
        fontSize: 15,
    },
    teknisyenCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
    },
    teknisyenAvatarLarge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    teknisyenName: {
        fontSize: 16,
        fontWeight: '600',
    },
    fullScreenModal: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        padding: 10,
    },
    fullScreenImage: {
        width: '100%',
        height: '100%',
    },
});


