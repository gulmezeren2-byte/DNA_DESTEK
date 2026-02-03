import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { collection, getCountFromServer, getDocs, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import { BarChart, LineChart, PieChart, ProgressChart } from 'react-native-chart-kit';
import { FadeInView } from '../../components/AnimatedList';
import Logo from '../../components/Logo';
import { ReportSkeleton } from '../../components/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { db } from '../../firebaseConfig';
import { getAllEkipler } from '../../services/ekipService';

interface Talep {
    id: string;
    durum: string;
    kategori: string;
    oncelik: string;
    projeAdi: string;
    atananTeknisyenAdi?: string;
    atananTeknisyenId?: string;
    atananEkipAdi?: string;
    atananEkipId?: string;
    puan?: number;
    olusturmaTarihi?: { seconds: number };
    cozumTarihi?: { seconds: number };
}

interface Ekip {
    id: string;
    ad: string;
    renk: string;
}

const durumRenkleri: Record<string, string> = {
    yeni: '#42a5f5',
    atandi: '#ffb74d',
    islemde: '#66bb6a',
    beklemede: '#f48fb1',
    cozuldu: '#26a69a',
    iptal: '#ef5350',
};

const kategoriRenkleri = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#6366f1'];

export default function RaporlarScreen() {
    const { user } = useAuth();
    const { isDark, colors } = useTheme();
    const router = useRouter();
    const { width: windowWidth } = useWindowDimensions();

    // Responsive Hesaplama
    // Web'de max-width: 1600px olsun (Büyük ekranlar için)
    const isWeb = Platform.OS === 'web';
    const containerWidth = isWeb ? Math.min(windowWidth, 1600) : windowWidth;

    // Padding Hesaplaması:
    // Content Padding: 16 (sol) + 16 (sağ) = 32
    // Card Padding: 20 (sol) + 20 (sağ) = 40
    // Toplam Padding: 72px
    // Güvenlik Payı: 8px -> Toplam 80px çıkarılmalı
    const chartWidth = containerWidth - 80;

    // Web için yan yana grafiklerin genişliği
    // (Container - Aradaki Boşluk - Paddingler) / 2
    const splitChartWidth = isWeb ? (containerWidth - 16 - 80) / 2 : chartWidth;

    const [yukleniyor, setYukleniyor] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [talepler, setTalepler] = useState<Talep[]>([]);
    const [ekipler, setEkipler] = useState<Ekip[]>([]);
    const [filterDays, setFilterDays] = useState(30);

    // Global Counts State
    const [globalStats, setGlobalStats] = useState({ toplam: 0, acik: 0, cozuldu: 0, acil: 0 });

    // Yönetici kontrolü
    useEffect(() => {
        if (user && user.rol !== 'yonetim') {
            router.replace('/');
        }
    }, [user]);

    const verileriYukle = async () => {
        try {
            const talesRef = collection(db, 'talepler');

            // 1. Global İstatistikleri Çek (Server-Side Count)
            const qTotal = query(talesRef);
            const qOpen = query(talesRef, where('durum', 'in', ['yeni', 'atandi', 'islemde', 'beklemede']));
            const qSolved = query(talesRef, where('durum', '==', 'cozuldu'));
            const qUrgent = query(talesRef, where('oncelik', '==', 'acil'));

            const [snapTotal, snapOpen, snapSolved, snapUrgent] = await Promise.all([
                getCountFromServer(qTotal),
                getCountFromServer(qOpen),
                getCountFromServer(qSolved),
                getCountFromServer(qUrgent)
            ]);

            setGlobalStats({
                toplam: snapTotal.data().count,
                acik: snapOpen.data().count,
                cozuldu: snapSolved.data().count,
                acil: snapUrgent.data().count
            });

            // 2. Grafikler İçin Veri Çek (Date Range Filtered)
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - filterDays);

            const qCharts = query(
                talesRef,
                where('olusturmaTarihi', '>=', cutoffDate),
                orderBy('olusturmaTarihi', 'desc')
            );

            const talepSnapshot = await getDocs(qCharts);
            const talepData = talepSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Talep[];
            setTalepler(talepData);

            // 3. Ekipleri Yükle
            const ekipResult = await getAllEkipler();
            if (ekipResult.success && ekipResult.data) {
                setEkipler(ekipResult.data as Ekip[]);
            }
        } catch (error) {
            console.error('Veri yükleme hatası:', error);
        }
        setYukleniyor(false);
        setRefreshing(false);
    };

    useEffect(() => {
        verileriYukle();
    }, [filterDays]);

    // İstatistik Hesaplamaları 
    const globalCozumOrani = globalStats.toplam > 0 ? Math.round((globalStats.cozuldu / globalStats.toplam) * 100) : 0;
    const toplam = talepler.length;

    // Durum Dağılımı (Pie Chart)
    const durumSayilari: Record<string, number> = {};
    talepler.forEach(t => {
        durumSayilari[t.durum] = (durumSayilari[t.durum] || 0) + 1;
    });

    const pieData = Object.entries(durumSayilari).map(([durum, sayi], index) => ({
        name: durum.charAt(0).toUpperCase() + durum.slice(1),
        population: sayi,
        color: durumRenkleri[durum] || '#999',
        legendFontColor: colors.text,
        legendFontSize: 12,
    }));

    // Kategori Dağılımı (Bar Chart)
    const kategoriSayilari: Record<string, number> = {};
    talepler.forEach(t => {
        if (t.kategori) {
            kategoriSayilari[t.kategori] = (kategoriSayilari[t.kategori] || 0) + 1;
        }
    });

    const kategoriLabels = Object.keys(kategoriSayilari).slice(0, 6);
    const kategoriValues = kategoriLabels.map(k => kategoriSayilari[k]);

    const barData = {
        labels: kategoriLabels.map(l => l.length > 6 ? l.slice(0, 6) + '..' : l),
        datasets: [{ data: kategoriValues.length > 0 ? kategoriValues : [0] }],
    };

    // Proje Bazlı (Liste)
    const projeSayilari: Record<string, number> = {};
    talepler.forEach(t => {
        if (t.projeAdi) {
            projeSayilari[t.projeAdi] = (projeSayilari[t.projeAdi] || 0) + 1;
        }
    });

    const projeLabels = Object.keys(projeSayilari).slice(0, 5);

    // Ekip Performansı
    interface IEkipStats {
        cozulenSayisi: number;
        toplamPuan: number;
        puanlananIsSayisi: number;
    }
    const ekipPerformans: Record<string, IEkipStats> = {};

    talepler.filter(t => t.durum === 'cozuldu' && t.atananEkipAdi).forEach(t => {
        if (!ekipPerformans[t.atananEkipAdi!]) {
            ekipPerformans[t.atananEkipAdi!] = { cozulenSayisi: 0, toplamPuan: 0, puanlananIsSayisi: 0 };
        }
        ekipPerformans[t.atananEkipAdi!].cozulenSayisi += 1;
        if (t.puan) {
            ekipPerformans[t.atananEkipAdi!].toplamPuan += t.puan;
            ekipPerformans[t.atananEkipAdi!].puanlananIsSayisi += 1;
        }
    });

    const siraliEkipler = Object.entries(ekipPerformans)
        .sort((a, b) => b[1].cozulenSayisi - a[1].cozulenSayisi)
        .slice(0, 5);

    // Trend Chart
    const simdi = Date.now();
    const gunlukTalepler: number[] = [];
    const step = Math.ceil(filterDays / 7);

    for (let i = filterDays - 1; i >= 0; i--) {
        const gunBaslangic = simdi - (i + 1) * 24 * 60 * 60 * 1000;
        const gunBitis = simdi - i * 24 * 60 * 60 * 1000;

        const sayi = talepler.filter(t => {
            if (!t.olusturmaTarihi) return false;
            const tarih = t.olusturmaTarihi.seconds * 1000;
            return tarih >= gunBaslangic && tarih < gunBitis;
        }).length;

        gunlukTalepler.push(sayi);
    }

    const chartLabels = gunlukTalepler.map((_, index) => {
        if (index % step === 0 || index === gunlukTalepler.length - 1) {
            const dateVal = new Date(simdi - (filterDays - 1 - index) * 24 * 60 * 60 * 1000);
            return `${dateVal.getDate()}/${dateVal.getMonth() + 1}`;
        }
        return '';
    });

    const lineData = {
        labels: chartLabels,
        datasets: [{ data: gunlukTalepler.length > 0 ? gunlukTalepler : [0] }],
    };

    const chartConfig = {
        backgroundColor: colors.card,
        backgroundGradientFrom: isDark ? '#1e293b' : '#ffffff',
        backgroundGradientTo: isDark ? '#0f172a' : '#f8fafc',
        decimalPlaces: 0,
        color: (opacity = 1) => isDark ? `rgba(129, 140, 248, ${opacity})` : `rgba(99, 102, 241, ${opacity})`,
        labelColor: () => colors.textSecondary,
        style: { borderRadius: 16 },
        propsForDots: {
            r: '5',
            strokeWidth: '2',
            stroke: colors.primary,
        },
        propsForBackgroundLines: {
            strokeDasharray: '',
            stroke: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        },
    };

    if (yukleniyor) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <ReportSkeleton />
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
                <View style={[styles.headerTop, isWeb && { maxWidth: 1600, alignSelf: 'center', width: '100%' }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Logo size="sm" variant="glass" />
                        <View>
                            <Text style={styles.headerTitle}>Raporlar</Text>
                            <Text style={styles.headerSubtitle}>Analiz & İstatistikler</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => { setRefreshing(true); verileriYukle(); }} style={styles.refreshButton}>
                        <Ionicons name="refresh" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.content}
                contentContainerStyle={[styles.scrollContent, isWeb && { maxWidth: 1600, alignSelf: 'center', width: '100%', paddingHorizontal: 0 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); verileriYukle(); }} colors={[colors.primary]} />}
            >
                {/* Filtre Butonları */}
                <View style={styles.filterContainer}>
                    {[7, 30, 90].map((day) => (
                        <TouchableOpacity
                            key={day}
                            style={[
                                styles.filterButton,
                                filterDays === day && { backgroundColor: colors.primary },
                                { borderColor: colors.border }
                            ]}
                            onPress={() => setFilterDays(day)}
                        >
                            <Text style={[
                                styles.filterText,
                                filterDays === day ? { color: '#fff' } : { color: colors.text }
                            ]}>
                                Son {day} Gün
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Özet Kartlar (Global Stats) */}
                <FadeInView delay={0} style={styles.summaryContainer}>
                    <View style={[styles.summaryCard, { backgroundColor: '#818cf8', flexBasis: isWeb ? '23%' : '48%' }]}>
                        <Ionicons name="documents" size={24} color="#fff" />
                        <Text style={styles.summaryNumber}>{globalStats.toplam}</Text>
                        <Text style={styles.summaryLabel}>Toplam</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: '#f59e0b', flexBasis: isWeb ? '23%' : '48%' }]}>
                        <Ionicons name="time" size={24} color="#fff" />
                        <Text style={styles.summaryNumber}>{globalStats.acik}</Text>
                        <Text style={styles.summaryLabel}>Açık</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: '#10b981', flexBasis: isWeb ? '23%' : '48%' }]}>
                        <Ionicons name="checkmark-circle" size={24} color="#fff" />
                        <Text style={styles.summaryNumber}>{globalStats.cozuldu}</Text>
                        <Text style={styles.summaryLabel}>Çözüldü</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: '#ef4444', flexBasis: isWeb ? '23%' : '48%' }]}>
                        <Ionicons name="alert-circle" size={24} color="#fff" />
                        <Text style={styles.summaryNumber}>{globalStats.acil}</Text>
                        <Text style={styles.summaryLabel}>Acil</Text>
                    </View>
                </FadeInView>

                {/* Çözüm Oranı Progress */}
                <FadeInView delay={100} style={[styles.chartCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.chartTitle, { color: colors.text }]}>🎯 Genel Başarı Oranı</Text>
                    <View style={styles.progressContainer}>
                        <ProgressChart
                            data={{ labels: ['Çözüm'], data: [globalCozumOrani / 100 || 0] }}
                            width={chartWidth}
                            height={180}
                            strokeWidth={16}
                            radius={60}
                            chartConfig={{
                                ...chartConfig,
                                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                            }}
                            hideLegend
                            style={styles.chart}
                        />
                        <View style={styles.progressOverlay}>
                            <Text style={[styles.progressPercent, { color: '#10b981' }]}>{globalCozumOrani}%</Text>
                            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>Başarı</Text>
                        </View>
                    </View>
                </FadeInView>

                {/* Son X Gün Trend */}
                <FadeInView delay={200} style={[styles.chartCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.chartTitle, { color: colors.text }]}>📈 Son {filterDays} Günlük Aktivite</Text>
                    {gunlukTalepler.length > 0 ? (
                        <LineChart
                            data={lineData}
                            width={chartWidth}
                            height={280} // Yükseklik biraz daha arttırıldı
                            chartConfig={{
                                ...chartConfig,
                                propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary }
                            }}
                            bezier
                            style={styles.chart}
                            withInnerLines={true}
                            withOuterLines={false}
                            withVerticalLabels={true}
                            withHorizontalLabels={true}
                            fromZero
                            yAxisInterval={1}
                        />
                    ) : (
                        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Veri yok</Text>
                    )}
                </FadeInView>

                {/* Durum Dağılımı ve Kategori Yan Yana (Web) veya Alt Alta (Mobil) */}
                <View style={isWeb ? styles.rowCharts : {}}>
                    {/* Durum Dağılımı */}
                    {pieData.length > 0 && (
                        <FadeInView delay={300} style={[styles.chartCard, { backgroundColor: colors.card, flex: 1, marginRight: isWeb ? 16 : 0 }]}>
                            <Text style={[styles.chartTitle, { color: colors.text }]}>🍕 Durum Dağılımı</Text>
                            <PieChart
                                data={pieData}
                                width={splitChartWidth}
                                height={240}
                                chartConfig={chartConfig}
                                accessor="population"
                                backgroundColor="transparent"
                                paddingLeft="0"
                                center={[10, 0]}
                                absolute
                                style={styles.chart}
                            />
                        </FadeInView>
                    )}

                    {/* Kategori Dağılımı */}
                    {kategoriLabels.length > 0 && (
                        <FadeInView delay={400} style={[styles.chartCard, { backgroundColor: colors.card, flex: 1, marginLeft: isWeb ? 16 : 0 }]}>
                            <Text style={[styles.chartTitle, { color: colors.text }]}>📊 Kategori Bazlı Arızalar</Text>
                            <BarChart
                                data={barData}
                                width={splitChartWidth}
                                height={240}
                                chartConfig={{
                                    ...chartConfig,
                                    color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                                }}
                                style={styles.chart}
                                showValuesOnTopOfBars
                                fromZero
                                yAxisLabel=""
                                yAxisSuffix=""
                            />
                        </FadeInView>
                    )}
                </View>

                {/* Top Ekipler */}
                <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.chartTitle, { color: colors.text }]}>🏆 En Başarılı Ekipler</Text>
                    {siraliEkipler.length > 0 ? (
                        siraliEkipler.map(([ekipAdi, stats], index) => {
                            const ekip = ekipler.find(e => e.ad === ekipAdi);
                            const renk = ekip?.renk || '#42a5f5';
                            const ortalamaPuan = stats.puanlananIsSayisi > 0
                                ? (stats.toplamPuan / stats.puanlananIsSayisi).toFixed(1)
                                : '-';

                            return (
                                <View key={index} style={[styles.teknisyenItem, { borderLeftColor: renk }]}>
                                    <View style={styles.teknisyenSol}>
                                        <View style={[styles.teknisyenSira, { backgroundColor: isDark ? '#333' : '#eee' }]}>
                                            <Text style={[styles.siraText, { color: colors.text }]}>{index + 1}</Text>
                                        </View>
                                        <View>
                                            <Text style={[styles.teknisyenAd, { color: colors.text }]}>{ekipAdi}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Text style={[styles.teknisyenGorev, { color: colors.textSecondary }]}>
                                                    {stats.cozulenSayisi} Çözüm
                                                </Text>
                                                {stats.puanlananIsSayisi > 0 && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#2e3a1a' : '#fff9c4', paddingHorizontal: 4, borderRadius: 4 }}>
                                                        <Ionicons name="star" size={10} color="#fbc02d" />
                                                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDark ? '#dace29' : '#f57f17', marginLeft: 2 }}>
                                                            {ortalamaPuan} <Text style={{ fontWeight: 'normal', fontSize: 10 }}>({stats.puanlananIsSayisi})</Text>
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                    <View style={[styles.basariBadge, { backgroundColor: isDark ? '#1a3a1a' : '#e8f5e9' }]}>
                                        <Ionicons name="trophy" size={12} color="#4caf50" />
                                        <Text style={styles.basariText}>%{(stats.cozulenSayisi / toplam * 100).toFixed(0)}</Text>
                                    </View>
                                </View>
                            );
                        })
                    ) : (
                        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Henüz veri yok</Text>
                    )}
                </View>

                {/* Proje Bazlı Özet */}
                <View style={[styles.chartCard, { backgroundColor: colors.card, marginBottom: 40 }]}>
                    <Text style={[styles.chartTitle, { color: colors.text }]}>🏗️ Proje Bazlı Talepler</Text>
                    {projeLabels.length > 0 ? (
                        projeLabels.map((proje, index) => {
                            const projeToplamTalep = projeSayilari[proje];
                            const projeCozulenTalep = talepler.filter(t => t.projeAdi === proje && t.durum === 'cozuldu').length;
                            const projeOrani = Math.round((projeCozulenTalep / projeToplamTalep) * 100);

                            return (
                                <View key={proje} style={styles.projectItem}>
                                    <View style={styles.projectHeader}>
                                        <Text style={[styles.projectName, { color: colors.text }]}>{proje}</Text>
                                        <Text style={[styles.projectCount, { color: colors.textSecondary }]}>{projeToplamTalep} talep</Text>
                                    </View>
                                    <View style={[styles.projectBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                                        <View style={[styles.projectBar, { width: `${projeOrani}%`, backgroundColor: kategoriRenkleri[index % kategoriRenkleri.length] }]} />
                                    </View>
                                    <Text style={[styles.projectPercent, { color: kategoriRenkleri[index % kategoriRenkleri.length] }]}>{projeOrani}% çözüldü</Text>
                                </View>
                            );
                        })
                    ) : (
                        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Henüz proje verisi yok</Text>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingTop: 50,
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
    headerTop: { flexDirection: 'row', alignItems: 'center' },
    backButton: { marginRight: 12, padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
    refreshButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    content: { flex: 1 },
    scrollContent: { padding: 16 },

    // Filter
    filterContainer: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    filterButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: 'transparent'
    },
    filterText: { fontSize: 13, fontWeight: '600' },

    // Özet Kartlar
    summaryContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16, gap: 10 },
    summaryCard: {
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    summaryNumber: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 8 },
    summaryLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '500' },

    // Chart Cards
    chartCard: {
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        alignItems: 'center',
        overflow: 'hidden'
    },
    chartTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20, alignSelf: 'flex-start' },
    emptyText: { textAlign: 'center', fontSize: 14, fontStyle: 'italic', padding: 20 },
    rowCharts: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },

    // Teknisyen/Ekip Listesi
    teknisyenItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        borderLeftWidth: 4,
        paddingLeft: 12,
        marginBottom: 8,
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderRadius: 8,
    },
    teknisyenSol: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    teknisyenSira: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    siraText: { fontWeight: 'bold', fontSize: 11 },
    teknisyenAd: { fontWeight: '600', fontSize: 14 },
    teknisyenGorev: { fontSize: 11, marginTop: 1 },
    basariBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 3,
    },
    basariText: { fontSize: 11, fontWeight: 'bold', color: '#4caf50' },

    chart: { borderRadius: 16, marginTop: 10 },

    // Progress Chart
    progressContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
    progressOverlay: { position: 'absolute', alignItems: 'center' },
    progressPercent: { fontSize: 32, fontWeight: '800' },
    progressLabel: { fontSize: 12, marginTop: 2 },

    // Project Items
    projectItem: { marginBottom: 16 },
    projectHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    projectName: { fontSize: 15, fontWeight: '600' },
    projectCount: { fontSize: 13 },
    projectBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
    projectBar: { height: '100%', borderRadius: 4 },
    projectPercent: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});
