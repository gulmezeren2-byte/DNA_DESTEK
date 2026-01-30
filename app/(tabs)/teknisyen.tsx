import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { arrayUnion, collection, doc, Firestore, getDoc, getDocs, Timestamp, updateDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
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
import { db as dbAny, getAllEkipler, uploadImage } from '../../firebaseConfig';
import { sendPushNotification } from '../../services/notificationService';
import toast from '../../services/toastService';
const db = dbAny as Firestore;

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
    yorumlar?: { yazanAdi: string; mesaj: string; tarih: any }[];
    fotograflar?: string[];
    cozumFotograflari?: string[];
}

const durumConfig: Record<string, { bg: string; bgDark: string; text: string; textDark: string; icon: string; label: string }> = {
    yeni: { bg: '#e3f2fd', bgDark: '#1a3a5c', text: '#1565c0', textDark: '#64b5f6', icon: 'hourglass-outline', label: 'Yeni' },
    atandi: { bg: '#fff3e0', bgDark: '#3a2a1a', text: '#ef6c00', textDark: '#ffb74d', icon: 'person-outline', label: 'Atandı' },
    islemde: { bg: '#e8f5e9', bgDark: '#1a3a1a', text: '#2e7d32', textDark: '#81c784', icon: 'construct-outline', label: 'İşlemde' },
    beklemede: { bg: '#fce4ec', bgDark: '#3a1a2a', text: '#c2185b', textDark: '#f48fb1', icon: 'pause-circle-outline', label: 'Beklemede' },
    cozuldu: { bg: '#e0f2f1', bgDark: '#1a3a3a', text: '#00796b', textDark: '#4db6ac', icon: 'checkmark-circle', label: 'Çözüldü' },
};

const durumSecenekleri = [
    { value: 'islemde', label: 'İşleme Al', icon: 'construct-outline', color: '#2e7d32' },
    { value: 'beklemede', label: 'Beklet', icon: 'pause-circle-outline', color: '#c2185b' },
    { value: 'cozuldu', label: 'Çözüldü', icon: 'checkmark-circle', color: '#00796b' },
];

export default function TeknisyenScreen() {
    const { user } = useAuth();
    const { isDark, colors } = useTheme();
    const router = useRouter();

    const [talepler, setTalepler] = useState<Talep[]>([]);
    const [yukleniyor, setYukleniyor] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [seciliTalep, setSeciliTalep] = useState<Talep | null>(null);
    const [detayModalVisible, setDetayModalVisible] = useState(false);
    const [yorumModalVisible, setYorumModalVisible] = useState(false);
    const [yeniYorum, setYeniYorum] = useState('');
    const [islemYukleniyor, setIslemYukleniyor] = useState(false);
    const [tamEkranFoto, setTamEkranFoto] = useState<string | null>(null);

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
            quality: 0.5,
        });

        if (!result.canceled) {
            const manipResult = await ImageManipulator.manipulateAsync(
                result.assets[0].uri,
                [{ resize: { width: 800 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            setCozumFotograflari([...cozumFotograflari, manipResult.uri]);
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
            const yuklenenFotoUrls: string[] = [];

            // Fotoğrafları Firebase Storage'a yükle
            for (let i = 0; i < cozumFotograflari.length; i++) {
                const uri = cozumFotograflari[i];
                const filename = `cozum_${seciliTalep.id}_${Date.now()}_${i}.jpg`;
                const path = `cozumler/${seciliTalep.id}/${filename}`;

                const result = await uploadImage(uri!, path);
                if (result.success) {
                    yuklenenFotoUrls.push(result.downloadURL!);
                } else {
                    toast.error('Bazı fotoğraflar yüklenemedi');
                }
            }

            await updateDoc(doc(db as Firestore, 'talepler', seciliTalep.id), {
                durum: 'cozuldu',
                cozumTarihi: Timestamp.now(),
                cozumFotograflari: yuklenenFotoUrls
            });

            // Bildirim Gönder
            if (seciliTalep.musteriId) {
                const musteriDoc = await getDoc(doc(db as Firestore, 'users', seciliTalep.musteriId));
                if (musteriDoc.exists()) {
                    const musteriData = musteriDoc.data();
                    if (musteriData?.pushToken) {
                        const fotoMesaj = yuklenenFotoUrls.length > 0 ? ' 📸 (Fotoğraflı Çözüm)' : '';
                        await sendPushNotification(
                            musteriData.pushToken,
                            'Talep Çözüldü ✅',
                            `Sayın ${seciliTalep.musteriAdi}, talebiniz çözüldü olarak işaretlendi.${fotoMesaj}`
                        );
                    }
                }
            }

            toast.success('Talep çözüldü olarak işaretlendi!');
            setCozumModalVisible(false);
            setDetayModalVisible(false);
            setCozumFotograflari([]);
            talepleriYukle();
        } catch (error: any) {
            toast.error('Hata: ' + error.message);
        } finally {
            setIslemYukleniyor(false);
            setYukleniyorFoto(false);
        }
    };

    const talepleriYukle = async () => {
        if (!user) return;

        try {
            // Önce kullanıcının üyesi olduğu ekipleri bul
            const ekipResult = await getAllEkipler();
            let kullaniciEkipIds: string[] = [];

            if (ekipResult.success && ekipResult.ekipler) {
                kullaniciEkipIds = ekipResult.ekipler
                    .filter((ekip: any) => ekip.uyeler?.includes(user.uid) && ekip.aktif)
                    .map((ekip: any) => ekip.id);
            }

            // Eğer kullanıcı hiçbir ekipte değilse, boş liste dön
            if (kullaniciEkipIds.length === 0) {
                setTalepler([]);
                setYukleniyor(false);
                setRefreshing(false);
                return;
            }

            // Tüm talepleri çek ve filtrele (Firestore 'in' sorgusu max 10 eleman destekliyor)
            const snapshot = await getDocs(collection(db as Firestore, 'talepler'));
            const allTalepler = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Talep[];

            // Kullanıcının ekiplerine atanmış talepleri filtrele
            const filteredTalepler = allTalepler.filter(talep =>
                talep.atananEkipId && kullaniciEkipIds.includes(talep.atananEkipId)
            );

            // Önceliğe göre sırala (acil önce)
            filteredTalepler.sort((a, b) => {
                if (a.oncelik === 'acil' && b.oncelik !== 'acil') return -1;
                if (b.oncelik === 'acil' && a.oncelik !== 'acil') return 1;
                return 0;
            });

            setTalepler(filteredTalepler);
        } catch (error) {
            console.error('Talepler yüklenemedi:', error);
        }

        setYukleniyor(false);
        setRefreshing(false);
    };

    useEffect(() => {
        talepleriYukle();
    }, [user]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        talepleriYukle();
    }, []);

    const formatTarih = (timestamp: { seconds: number }) => {
        if (!timestamp?.seconds) return '-';
        const date = new Date(timestamp.seconds * 1000);
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

            // Bildirim Gönder
            if (seciliTalep.musteriId) {
                try {
                    const musteriDoc = await getDoc(doc(db as Firestore, 'users', seciliTalep.musteriId));
                    if (musteriDoc.exists()) {
                        const musteriData = musteriDoc.data();
                        if (musteriData?.pushToken) {
                            const durumEtiket = durumConfig[yeniDurum]?.label || yeniDurum;
                            await sendPushNotification(
                                musteriData.pushToken,
                                'Talep Durumu Güncellendi 🔔',
                                `Talebinizin durumu "${durumEtiket}" olarak güncellendi.`
                            );
                        }
                    }
                } catch (err) {
                    console.error('Bildirim hatası:', err);
                }
            }

            toast.success('Durum güncellendi!');

            setDetayModalVisible(false);
            setCozumModalVisible(false);
            setCozumFotograflari([]);
            talepleriYukle();
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
                    [{ resize: { width: 800 } }],
                    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
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
            setYorumModalVisible(false);
            talepleriYukle();
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
                <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
                    <View style={styles.headerTop}>
                        <View>
                            <Text style={styles.headerTitle}>Teknisyen Paneli</Text>
                            <Text style={styles.headerSubtitle}>Yükleniyor...</Text>
                        </View>
                    </View>
                </View>
                <ListSkeleton count={4} type="talep" />
            </View>
        );
    }

    const aktifTalepler = talepler.filter(t => t.durum !== 'cozuldu' && t.durum !== 'kapatildi');
    const tamamlananTalepler = talepler.filter(t => t.durum === 'cozuldu' || t.durum === 'kapatildi');

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.headerTitle}>Teknisyen Paneli</Text>
                        <Text style={styles.headerSubtitle}>{user?.ad} {user?.soyad}</Text>
                    </View>
                    <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/ayarlar')}>
                        <Ionicons name="settings-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* İstatistikler */}
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{aktifTalepler.length}</Text>
                        <Text style={styles.statLabel}>Aktif</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{tamamlananTalepler.length}</Text>
                        <Text style={styles.statLabel}>Tamamlanan</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: '#ffcdd2' }]}>
                            {talepler.filter(t => t.oncelik === 'acil').length}
                        </Text>
                        <Text style={styles.statLabel}>Acil</Text>
                    </View>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            >
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
                        {/* Aktif Talepler */}
                        {aktifTalepler.length > 0 && (
                            <View style={styles.section}>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                                    🔧 Aktif Talepler ({aktifTalepler.length})
                                </Text>
                                {aktifTalepler.map((talep) => {
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
                                                        <Ionicons name={durum.icon as any} size={12} color={isDark ? durum.textDark : durum.text} />
                                                        <Text style={[styles.durumText, { color: isDark ? durum.textDark : durum.text }]}>{durum.label}</Text>
                                                    </View>
                                                </View>

                                                <Text style={[styles.talepBaslik, { color: colors.text }]}>{talep.baslik}</Text>

                                                <View style={styles.infoRow}>
                                                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                                                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                                        {talep.projeAdi} {talep.blokAdi && `• ${talep.blokAdi}`} {talep.daireNo && `• D.${talep.daireNo}`}
                                                    </Text>
                                                </View>

                                                <View style={styles.infoRow}>
                                                    <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                                                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>{talep.musteriAdi}</Text>
                                                </View>

                                                <View style={[styles.talepFooter, { borderTopColor: colors.border }]}>
                                                    <View style={styles.footerLeft}>
                                                        <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                                                        <Text style={[styles.tarihText, { color: colors.textMuted }]}>{formatTarih(talep.olusturmaTarihi)}</Text>
                                                    </View>
                                                    {talep.yorumlar && talep.yorumlar.length > 0 && (
                                                        <View style={styles.yorumIndicator}>
                                                            <Ionicons name="chatbubble-outline" size={12} color={colors.textSecondary} />
                                                            <Text style={[styles.yorumCount, { color: colors.textSecondary }]}>{talep.yorumlar.length}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {/* Tamamlanan Talepler */}
                        {tamamlananTalepler.length > 0 && (
                            <View style={styles.section}>
                                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                                    ✅ Tamamlanan ({tamamlananTalepler.length})
                                </Text>
                                {tamamlananTalepler.slice(0, 5).map((talep) => (
                                    <TouchableOpacity
                                        key={talep.id}
                                        style={[styles.talepCardSmall, { backgroundColor: colors.card, opacity: 0.7 }]}
                                        onPress={() => talepDetayGoster(talep)}
                                    >
                                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                                        <Text style={[styles.talepBaslikSmall, { color: colors.text }]} numberOfLines={1}>{talep.baslik}</Text>
                                        <Text style={[styles.tarihTextSmall, { color: colors.textMuted }]}>{formatTarih(talep.olusturmaTarihi)}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </>
                )}

                <View style={{ height: 30 }} />
            </ScrollView>

            {/* Detay Modal */}
            <Modal visible={detayModalVisible} animationType="slide" transparent onRequestClose={() => setDetayModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.detayModal, { backgroundColor: colors.card }]}>
                        <View style={[styles.modalHandle, { backgroundColor: isDark ? '#555' : '#ddd' }]} />

                        {seciliTalep && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Header */}
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
                                                    <Image source={{ uri: foto }} style={styles.detayFoto} />
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                {/* Yorumlar */}
                                {seciliTalep.yorumlar && seciliTalep.yorumlar.length > 0 && (
                                    <View style={styles.detaySection}>
                                        <Text style={[styles.detaySectionTitle, { color: colors.text }]}>💬 Yorumlar</Text>
                                        {seciliTalep.yorumlar.map((yorum, idx) => (
                                            <View key={idx} style={[styles.yorumItem, { backgroundColor: isDark ? colors.inputBg : '#f8f9fa' }]}>
                                                <Text style={[styles.yorumYazan, { color: colors.primary }]}>{yorum.yazanAdi}</Text>
                                                <Text style={[styles.yorumMesaj, { color: colors.text }]}>{yorum.mesaj}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

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

                                {/* Yorum Ekle Butonu */}
                                <TouchableOpacity
                                    style={[styles.yorumEkleButon, { backgroundColor: colors.primary }]}
                                    onPress={() => setYorumModalVisible(true)}
                                >
                                    <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
                                    <Text style={styles.yorumEkleText}>Yorum Ekle</Text>
                                </TouchableOpacity>

                                <View style={{ height: 20 }} />
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Yorum Modal */}
            <Modal visible={yorumModalVisible} animationType="slide" transparent onRequestClose={() => setYorumModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.yorumModal, { backgroundColor: colors.card }]}>
                        <Text style={[styles.yorumModalTitle, { color: colors.text }]}>💬 Yorum Ekle</Text>
                        <TextInput
                            style={[styles.yorumInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                            placeholder="Yorumunuzu yazın..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={4}
                            value={yeniYorum}
                            onChangeText={setYeniYorum}
                        />
                        <View style={styles.yorumButonlar}>
                            <TouchableOpacity
                                style={[styles.yorumIptal, { borderColor: colors.border }]}
                                onPress={() => { setYorumModalVisible(false); setYeniYorum(''); }}
                            >
                                <Text style={[styles.yorumIptalText, { color: colors.textSecondary }]}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.yorumGonder, { backgroundColor: colors.primary }]}
                                onPress={yorumEkle}
                                disabled={islemYukleniyor || !yeniYorum.trim()}
                            >
                                {islemYukleniyor ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.yorumGonderText}>Gönder</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
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
                                    <Image source={{ uri: foto }} style={styles.cozumFotoThumb} />
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

                        <Text style={[styles.cozumFotoHint, { color: colors.textMuted }]}>
                            📷 En fazla 3 fotoğraf ekleyebilirsiniz (isteğe bağlı)
                        </Text>

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
    statNumber: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    statDivider: { width: 1, height: '100%' },
    content: { flex: 1, padding: 16 },
    emptyContainer: { alignItems: 'center', paddingVertical: 60 },
    emptyIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    emptyText: { fontSize: 18, fontWeight: '600' },
    emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center' },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
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
    talepFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginTop: 8, borderTopWidth: 1 },
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
    cozumOnaylaText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
