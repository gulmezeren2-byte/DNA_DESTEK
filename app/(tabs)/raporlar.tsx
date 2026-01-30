import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { BarChart, LineChart, PieChart, ProgressChart } from 'react-native-chart-kit';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { db, getAllEkipler } from '../../firebaseConfig';

const screenWidth = Dimensions.get('window').width;

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

    const [yukleniyor, setYukleniyor] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [talepler, setTalepler] = useState<Talep[]>([]);
    const [ekipler, setEkipler] = useState<Ekip[]>([]);

    // Yönetici kontrolü
    useEffect(() => {
        if (user && user.rol !== 'yonetim') {
            router.replace('/');
        }
    }, [user]);

    const verileriYukle = async () => {
        try {
            const talepSnapshot = await getDocs(collection(db, 'talepler'));
            const talepData = talepSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Talep[];
            setTalepler(talepData);

            const ekipResult = await getAllEkipler();
            if (ekipResult.success && ekipResult.ekipler) {
                setEkipler(ekipResult.ekipler as Ekip[]);
            }
        } catch (error) {
            console.error('Veri yükleme hatası:', error);
        }
        setYukleniyor(false);
        setRefreshing(false);
    };

    useEffect(() => {
        verileriYukle();
    }, []);

    // İstatistik Hesaplamaları
    const toplam = talepler.length;
    const acik = talepler.filter(t => !['cozuldu', 'iptal'].includes(t.durum)).length;
    const cozuldu = talepler.filter(t => t.durum === 'cozuldu').length;
    const iptal = talepler.filter(t => t.durum === 'iptal').length;
    const acil = talepler.filter(t => t.oncelik === 'acil').length;

    // Güvenli çözüm oranı hesabı
    let hesaplananOran = 0;
    if (toplam > 0) {
        hesaplananOran = (cozuldu / toplam) * 100;
    }
    const cozumOrani = Number.isFinite(hesaplananOran) ? Math.round(hesaplananOran) : 0;

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

    // Proje Bazlı (Bar Chart)
    const projeSayilari: Record<string, number> = {};
    talepler.forEach(t => {
        if (t.projeAdi) {
            projeSayilari[t.projeAdi] = (projeSayilari[t.projeAdi] || 0) + 1;
        }
    });

    const projeLabels = Object.keys(projeSayilari).slice(0, 5);
    const projeValues = projeLabels.map(p => projeSayilari[p]);

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

    const getEkipRengi = (ekipAdi: string) => {
        const ekip = ekipler.find(e => e.ad === ekipAdi);
        return ekip ? ekip.renk : colors.primary;
    };

    // Son 7 Gün Trend (Line Chart)
    const simdi = Date.now();
    const gunlukTalepler: number[] = [];
    for (let i = 6; i >= 0; i--) {
        const gunBaslangic = simdi - (i + 1) * 24 * 60 * 60 * 1000;
        const gunBitis = simdi - i * 24 * 60 * 60 * 1000;
        const sayi = talepler.filter(t => {
            if (!t.olusturmaTarihi) return false;
            const tarih = t.olusturmaTarihi.seconds * 1000;
            return tarih >= gunBaslangic && tarih < gunBitis;
        }).length;
        gunlukTalepler.push(sayi);
    }

    const lineData = {
        labels: ['6g', '5g', '4g', '3g', '2g', 'Dün', 'Bugün'],
        datasets: [{ data: gunlukTalepler.some(g => g > 0) ? gunlukTalepler : [0, 0, 0, 0, 0, 0, 0] }],
    };

    // Progress Chart Data
    const progressData = {
        labels: ['Çözüm'],
        data: [cozumOrani / 100 || 0],
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
            r: '6',
            strokeWidth: '2',
            stroke: colors.primary,
        },
        propsForBackgroundLines: {
            strokeDasharray: '',
            stroke: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
        },
    };

    if (yukleniyor) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Raporlar yükleniyor...</Text>
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
                        <Text style={styles.headerTitle}>📊 Raporlar</Text>
                        <Text style={styles.headerSubtitle}>Anlık İstatistikler ve Analizler</Text>
                    </View>
                    <TouchableOpacity onPress={() => { setRefreshing(true); verileriYukle(); }}>
                        <Ionicons name="refresh" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); verileriYukle(); }} colors={[colors.primary]} />}
            >
                {/* Özet Kartlar */}
                <View style={styles.summaryContainer}>
                    <View style={[styles.summaryCard, { backgroundColor: '#818cf8' }]}>
                        <Ionicons name="documents" size={28} color="#fff" />
                        <Text style={styles.summaryNumber}>{toplam}</Text>
                        <Text style={styles.summaryLabel}>Toplam Talep</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: '#f59e0b' }]}>
                        <Ionicons name="time" size={28} color="#fff" />
                        <Text style={styles.summaryNumber}>{acik}</Text>
                        <Text style={styles.summaryLabel}>Açık Talep</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: '#10b981' }]}>
                        <Ionicons name="checkmark-circle" size={28} color="#fff" />
                        <Text style={styles.summaryNumber}>{cozuldu}</Text>
                        <Text style={styles.summaryLabel}>Çözüldü</Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: '#ef4444' }]}>
                        <Ionicons name="alert-circle" size={28} color="#fff" />
                        <Text style={styles.summaryNumber}>{acil}</Text>
                        <Text style={styles.summaryLabel}>Acil</Text>
                    </View>
                </View>

                {/* Çözüm Oranı Progress */}
                <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.chartTitle, { color: colors.text }]}>🎯 Çözüm Başarı Oranı</Text>
                    <View style={styles.progressContainer}>
                        <ProgressChart
                            data={progressData}
                            width={screenWidth - 80}
                            height={140}
                            strokeWidth={16}
                            radius={50}
                            chartConfig={{
                                ...chartConfig,
                                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                            }}
                            hideLegend
                            style={styles.chart}
                        />
                        <View style={styles.progressOverlay}>
                            <Text style={[styles.progressPercent, { color: '#10b981' }]}>{cozumOrani}%</Text>
                            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>Başarı</Text>
                        </View>
                    </View>
                </View>

                {/* Son 7 Gün Trend */}
                <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.chartTitle, { color: colors.text }]}>📈 Son 7 Günlük Trend</Text>
                    <LineChart
                        data={lineData}
                        width={screenWidth - 48}
                        height={200}
                        chartConfig={chartConfig}
                        bezier
                        style={styles.chart}
                        withInnerLines={false}
                        withOuterLines={false}
                        withVerticalLabels={true}
                        withHorizontalLabels={true}
                        fromZero
                    />
                </View>

                {/* Durum Dağılımı */}
                {pieData.length > 0 && (
                    <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
                        <Text style={[styles.chartTitle, { color: colors.text }]}>🍕 Durum Dağılımı</Text>
                        <PieChart
                            data={pieData}
                            width={screenWidth - 48}
                            height={200}
                            chartConfig={chartConfig}
                            accessor="population"
                            backgroundColor="transparent"
                            paddingLeft="15"
                            absolute
                            style={styles.chart}
                        />
                    </View>
                )}

                {/* Kategori Dağılımı */}
                {kategoriLabels.length > 0 && (
                    <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
                        <Text style={[styles.chartTitle, { color: colors.text }]}>📊 Kategori Bazlı Arızalar</Text>
                        <BarChart
                            data={barData}
                            width={screenWidth - 48}
                            height={220}
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
                    </View>
                )}

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
                                        <Ionicons name="trophy" size={14} color="#4caf50" />
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
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, fontSize: 14 },
    header: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
    headerTop: { flexDirection: 'row', alignItems: 'center' },
    backButton: { marginRight: 12 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    content: { flex: 1, padding: 16 },

    // Özet Kartlar
    summaryContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
    summaryCard: {
        width: '48%',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    summaryNumber: { fontSize: 32, fontWeight: '800', color: '#fff', marginTop: 8 },
    summaryLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: '500' },

    // Chart Cards
    chartCard: {
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
    chartTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
    emptyText: { textAlign: 'center', fontSize: 14, fontStyle: 'italic', padding: 20 },

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
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    siraText: { fontWeight: 'bold', fontSize: 12 },
    teknisyenAd: { fontWeight: '600', fontSize: 14 },
    teknisyenGorev: { fontSize: 12, marginTop: 2 },
    basariBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    basariText: { fontSize: 12, fontWeight: 'bold', color: '#4caf50' },

    chart: { borderRadius: 16 },

    // Progress Chart
    progressContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
    progressOverlay: { position: 'absolute', alignItems: 'center' },
    progressPercent: { fontSize: 36, fontWeight: '800' },
    progressLabel: { fontSize: 13, marginTop: 2 },

    // Rank List
    rankItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    rankBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    rankNumber: { color: '#fff', fontWeight: '700', fontSize: 13 },
    rankName: { flex: 1, fontSize: 15, fontWeight: '500' },
    rankBarContainer: { flex: 1, height: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4, marginHorizontal: 12, overflow: 'hidden' },
    rankBar: { height: '100%', borderRadius: 4 },
    rankCount: { fontSize: 15, fontWeight: '700', minWidth: 30, textAlign: 'right' },

    // Project Items
    projectItem: { marginBottom: 16 },
    projectHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    projectName: { fontSize: 15, fontWeight: '600' },
    projectCount: { fontSize: 13 },
    projectBarBg: { height: 10, borderRadius: 5, overflow: 'hidden' },
    projectBar: { height: '100%', borderRadius: 5 },
    projectPercent: { fontSize: 12, fontWeight: '600', marginTop: 6 },


});
