import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { collection, getCountFromServer, getDocs, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    Alert,
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
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { FadeInView } from '../../components/AnimatedList';
import { ReportSkeleton } from '../../components/Skeleton';
import GlassCard from '../../components/ui/GlassCard';
import StatsWidget from '../../components/ui/StatsWidget';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { db } from '../../firebaseConfig';
import { getAllEkipler } from '../../services/ekipService';

interface Talep {
    id: string;
    baslik?: string;
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
    yeni: '#818cf8',
    atandi: '#fbbf24',
    islemde: '#10b981',
    beklemede: '#f472b6',
    cozuldu: '#06b6d4',
    iptal: '#f87171',
};

const kategoriRenkleri = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#6366f1'];

export default function RaporlarScreen() {
    const { user, isYonetim, isBoardMember } = useAuth();
    const { isDark, colors } = useTheme();
    const router = useRouter();
    const { width: windowWidth } = useWindowDimensions();

    if (!isYonetim) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <Ionicons name="lock-closed" size={64} color={colors.textMuted} />
                <Text style={{ marginTop: 16, fontSize: 18, color: colors.textSecondary }}>
                    Bu sayfaya erişim yetkiniz yok
                </Text>
                <TouchableOpacity
                    onPress={() => router.replace('/(tabs)')}
                    style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 12 }}
                >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Ana Sayfaya Dön</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const isWeb = Platform.OS === 'web';
    const containerWidth = isWeb ? Math.min(windowWidth, 1200) : windowWidth;
    const horizontalPadding = 40;
    const chartWidth = containerWidth - horizontalPadding;

    const [yukleniyor, setYukleniyor] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [talepler, setTalepler] = useState<Talep[]>([]);
    const [ekipler, setEkipler] = useState<Ekip[]>([]);
    const [filterDays, setFilterDays] = useState(30);
    const [globalStats, setGlobalStats] = useState({ toplam: 0, acik: 0, cozuldu: 0, acil: 0 });

    const verileriYukle = async () => {
        try {
            const talesRef = collection(db, 'talepler');

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

    // --- Advanced Analytics Calculations ---

    // 1. Technician Performance
    const techStats = talepler.reduce((acc, t) => {
        if (t.atananTeknisyenAdi && t.durum === 'cozuldu') {
            const name = t.atananTeknisyenAdi;
            if (!acc[name]) acc[name] = { count: 0, totalSLA: 0 };
            acc[name].count += 1;
            if (t.olusturmaTarihi && t.cozumTarihi) {
                acc[name].totalSLA += (t.cozumTarihi.seconds - t.olusturmaTarihi.seconds) / 3600;
            }
        }
        return acc;
    }, {} as Record<string, { count: number, totalSLA: number }>);

    const techLeaderboard = Object.entries(techStats)
        .map(([name, data]) => ({ name, count: data.count, avgSLA: data.count > 0 ? (data.totalSLA / data.count).toFixed(1) : "0" }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // 2. Project Hotspots
    const projectStats = talepler.reduce((acc, t) => {
        const pName = t.projeAdi || 'Belirtilmemiş';
        acc[pName] = (acc[pName] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const projectHotspots = Object.entries(projectStats)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // 3. Status Lifespan & Priority Impact
    const priorityVelocity = talepler.reduce((acc, t) => {
        if (t.durum === 'cozuldu' && t.olusturmaTarihi && t.cozumTarihi) {
            const priority = t.oncelik || 'normal';
            if (!acc[priority]) acc[priority] = { count: 0, totalTime: 0 };
            acc[priority].count += 1;
            acc[priority].totalTime += (t.cozumTarihi.seconds - t.olusturmaTarihi.seconds) / 3600;
        }
        return acc;
    }, {} as Record<string, { count: number, totalTime: number }>);

    // 4. Daily Trend Analysis
    const dailyTrend = talepler.reduce((acc, t) => {
        if (t.olusturmaTarihi) {
            const date = new Date(t.olusturmaTarihi.seconds * 1000).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
            acc[date] = (acc[date] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    const trendData = Object.entries(dailyTrend)
        .sort((a, b) => {
            const [d1, m1] = a[0].split('.');
            const [d2, m2] = b[0].split('.');
            return new Date(2026, parseInt(m1) - 1, parseInt(d1)).getTime() - new Date(2026, parseInt(m2) - 1, parseInt(d2)).getTime();
        })
        .slice(-7); // Last 7 unique days with activity

    // --- End Calculations ---

    const cozulmusTarihliTalepler = talepler.filter(t => t.durum === 'cozuldu' && t.olusturmaTarihi && t.cozumTarihi);
    const averageSLA = cozulmusTarihliTalepler.length > 0
        ? cozulmusTarihliTalepler.reduce((acc, t) => {
            const diff = (t.cozumTarihi!.seconds - t.olusturmaTarihi!.seconds) / 3600;
            return acc + diff;
        }, 0) / cozulmusTarihliTalepler.length
        : 0;

    const puanliTalepler = talepler.filter(t => t.puan && t.puan > 0);
    const averageScore = puanliTalepler.length > 0
        ? (puanliTalepler.reduce((acc, t) => acc + (t.puan || 0), 0) / puanliTalepler.length).toFixed(1)
        : "0.0";

    const chartConfig = {
        backgroundGradientFrom: colors.card,
        backgroundGradientTo: colors.card,
        color: (opacity = 1) => isDark ? `rgba(129, 140, 248, ${opacity})` : `rgba(79, 70, 229, ${opacity})`,
        labelColor: () => colors.textSecondary,
        strokeWidth: 2,
        barPercentage: 0.6,
        useShadowColorFromDataset: false,
        decimalPlaces: 0,
    };

    const exportToCSV = async () => {
        try {
            const header = "ID,Baslik,Kategori,Durum,Olusturma,Cozum,Puan\n";
            const rows = talepler.map(t => {
                const created = t.olusturmaTarihi ? new Date(t.olusturmaTarihi.seconds * 1000).toLocaleDateString('tr-TR') : '';
                const solved = t.cozumTarihi ? new Date(t.cozumTarihi.seconds * 1000).toLocaleDateString('tr-TR') : '';
                return `${t.id},"${t.baslik || ''}",${t.kategori},${t.durum},${created},${solved},${t.puan || 0}`;
            }).join("\n");

            const csvContent = header + rows;
            // @ts-ignore
            const fileUri = (FileSystem.documentDirectory || '') + `DNA_RAPOR_${new Date().getTime()}.csv`;
            await FileSystem.writeAsStringAsync(fileUri, csvContent);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
            }
        } catch (err) {
            Alert.alert("Hata", "Rapor dışa aktarılamadı.");
        }
    };

    if (yukleniyor) return <ReportSkeleton />;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="light-content" />

            <LinearGradient
                colors={isDark ? ['#0f172a', '#1e293b'] : ['#1a3a5c', '#2c5364']}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                        <Ionicons name="chevron-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerText}>
                        <Text style={styles.title}>Yönetim Paneli</Text>
                        <Text style={styles.subtitle}>Sistem Analitiği ve Raporlama</Text>
                    </View>
                    <View style={styles.headerActions}>
                        {!isBoardMember && (
                            <TouchableOpacity onPress={exportToCSV} style={styles.iconBtn}>
                                <Ionicons name="share-outline" size={22} color="#fff" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => { setRefreshing(true); verileriYukle(); }} style={styles.iconBtn}>
                            <Ionicons name="refresh-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); verileriYukle(); }} />}
            >
                {/* Time Range Selector */}
                <View style={styles.filterRow}>
                    {[7, 30, 90].map(d => (
                        <TouchableOpacity
                            key={d}
                            onPress={() => setFilterDays(d)}
                            style={[styles.filterBtn, filterDays === d && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        >
                            <Text style={[styles.filterBtnText, { color: filterDays === d ? '#fff' : colors.textSecondary }]}>
                                {d} Gün
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Primary Stats Grid */}
                <View style={styles.statsGrid}>
                    <StatsWidget
                        title="Toplam Talep"
                        value={globalStats.toplam}
                        icon="documents"
                        color="#6366f1"
                        description="Sistemdeki tüm kayıtlar"
                    />
                    <StatsWidget
                        title="Açık İşler"
                        value={globalStats.acik}
                        icon="time"
                        color="#f59e0b"
                        trend={{ value: `${Math.round((globalStats.acik / (globalStats.toplam || 1)) * 100)}%`, isUp: false }}
                    />
                </View>
                <View style={styles.statsGrid}>
                    <StatsWidget
                        title="Çözüldü"
                        value={globalStats.cozuldu}
                        icon="checkmark-done-circle"
                        color="#10b981"
                        trend={{ value: 'Yüksek', isUp: true }}
                    />
                    <StatsWidget
                        title="Memnuniyet"
                        value={averageScore}
                        icon="star"
                        color="#facc15"
                        description={`${puanliTalepler.length} değerlendirme`}
                    />
                </View>

                {/* SLA Highlight - Hidden for Board Members */}
                {!isBoardMember && (
                    <FadeInView delay={200}>
                        <GlassCard style={styles.slaCard}>
                            <View style={styles.slaHeader}>
                                <View style={styles.slaIcon}>
                                    <Ionicons name="flash" size={24} color="#ef4444" />
                                </View>
                                <View>
                                    <Text style={[styles.slaTitle, { color: colors.text }]}>Performans (SLA)</Text>
                                    <Text style={[styles.slaSubtitle, { color: colors.textSecondary }]}>Ortalama müdahale ve çözüm süresi</Text>
                                </View>
                            </View>
                            <View style={styles.slaValueContainer}>
                                <Text style={[styles.slaValue, { color: colors.text }]}>{averageSLA.toFixed(1)}</Text>
                                <Text style={[styles.slaUnit, { color: colors.textMuted }]}>SAAT</Text>
                            </View>
                        </GlassCard>
                    </FadeInView>
                )}

                {/* Daily Trend Chart */}
                <FadeInView delay={250}>
                    <GlassCard style={styles.chartContainer}>
                        <Text style={[styles.chartHeader, { color: colors.text }]}>Günlük Talep Trendi (Son 7 Hareketli Gün)</Text>
                        {trendData.length > 0 ? (
                            <LineChart
                                data={{
                                    labels: trendData.map(d => d[0]),
                                    datasets: [{ data: trendData.map(d => d[1]) }]
                                }}
                                width={chartWidth - 40}
                                height={220}
                                chartConfig={{
                                    ...chartConfig,
                                    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                                    fillShadowGradient: '#6366f1',
                                    fillShadowGradientOpacity: 0.1,
                                }}
                                bezier
                                style={styles.chart}
                            />
                        ) : (
                            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Görüntülenecek veri yok</Text>
                        )}
                    </GlassCard>
                </FadeInView>

                {/* Charts Section */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>İşlem Dağılımı</Text>

                <FadeInView delay={300}>
                    <GlassCard style={styles.chartContainer}>
                        <Text style={[styles.chartHeader, { color: colors.text }]}>Durum Analizi</Text>
                        {talepler.length > 0 ? (
                            <PieChart
                                data={Object.entries(durumRenkleri).map(([k, v]) => ({
                                    name: k.toUpperCase(),
                                    population: talepler.filter(t => t.durum === k).length,
                                    color: v,
                                    legendFontColor: colors.textSecondary,
                                    legendFontSize: 11
                                }))}
                                width={chartWidth - 40}
                                height={200}
                                chartConfig={chartConfig}
                                accessor="population"
                                backgroundColor="transparent"
                                paddingLeft="15"
                                absolute
                            />
                        ) : (
                            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Görüntülenecek veri yok</Text>
                        )}
                    </GlassCard>
                </FadeInView>

                {!isBoardMember && (
                    <>
                        <FadeInView delay={400}>
                            <GlassCard style={styles.chartContainer}>
                                <Text style={[styles.chartHeader, { color: colors.text }]}>Kategori Yoğunluğu</Text>
                                {talepler.length > 0 ? (
                                    <BarChart
                                        data={{
                                            labels: Array.from(new Set(talepler.map(t => t.kategori))).slice(0, 5),
                                            datasets: [{ data: Array.from(new Set(talepler.map(t => t.kategori))).slice(0, 5).map(k => talepler.filter(t => t.kategori === k).length) }]
                                        }}
                                        width={chartWidth - 40}
                                        height={220}
                                        yAxisLabel=""
                                        yAxisSuffix=""
                                        chartConfig={chartConfig}
                                        style={styles.chart}
                                        fromZero
                                    />
                                ) : (
                                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>Görüntülenecek veri yok</Text>
                                )}
                            </GlassCard>
                        </FadeInView>

                        {/* Technician Leaderboard Section */}
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>En Çok Çözüm Üreten Teknisyenler</Text>
                        <FadeInView delay={500}>
                            <GlassCard style={styles.listCard}>
                                {techLeaderboard.length > 0 ? techLeaderboard.map((tech, index) => (
                                    <View key={tech.name} style={[styles.listItem, index === techLeaderboard.length - 1 && { borderBottomWidth: 0 }]}>
                                        <View style={styles.rankContainer}>
                                            <View style={[styles.rankBadge, index === 0 && { backgroundColor: '#ffd700' }, index === 1 && { backgroundColor: '#c0c0c0' }, index === 2 && { backgroundColor: '#cd7f32' }]}>
                                                <Text style={styles.rankText}>{index + 1}</Text>
                                            </View>
                                            <Text style={[styles.itemName, { color: colors.text }]}>{tech.name}</Text>
                                        </View>
                                        <View style={styles.itemValueContainer}>
                                            <Text style={[styles.itemValue, { color: colors.primary }]}>{tech.count} İş</Text>
                                            <Text style={[styles.itemSubValue, { color: colors.textMuted }]}>~{tech.avgSLA}sa</Text>
                                        </View>
                                    </View>
                                )) : (
                                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>Yeterli veri bulunmuyor</Text>
                                )}
                            </GlassCard>
                        </FadeInView>
                    </>
                )}

                {/* Project Hotspots Section */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Arıza Yoğunluğu (Proje Bazlı)</Text>
                <FadeInView delay={600}>
                    <GlassCard style={styles.listCard}>
                        {projectHotspots.length > 0 ? projectHotspots.map((project, index) => (
                            <View key={project.name} style={[styles.listItem, index === projectHotspots.length - 1 && { borderBottomWidth: 0 }]}>
                                <View style={styles.itemInfo}>
                                    <Ionicons name="business" size={18} color={colors.primary} style={{ marginRight: 10 }} />
                                    <Text style={[styles.itemName, { color: colors.text }]}>{project.name}</Text>
                                </View>
                                <View style={styles.itemProgressContainer}>
                                    <View style={styles.progressBarBg}>
                                        <View style={[styles.progressBarFill, {
                                            width: `${(project.count / projectHotspots[0].count) * 100}%`,
                                            backgroundColor: colors.primary
                                        }]} />
                                    </View>
                                    <Text style={[styles.itemValue, { color: colors.textSecondary }]}>{project.count}</Text>
                                </View>
                            </View>
                        )) : (
                            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Yeterli veri bulunmuyor</Text>
                        )}
                    </GlassCard>
                </FadeInView>

                {!isBoardMember && (
                    <>
                        {/* Priority Speed Analysis */}
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Öncelik Bazlı Çözüm Hızı (SLA)</Text>
                        <FadeInView delay={700}>
                            <View style={styles.priorityGrid}>
                                {['acil', 'normal', 'dusuk'].map(p => {
                                    const data = priorityVelocity[p] || { count: 0, totalTime: 0 };
                                    const avgSLA = data.count > 0 ? (data.totalTime / data.count).toFixed(1) : "-";
                                    const colorMap: Record<string, string> = { acil: '#ef4444', normal: '#3b82f6', dusuk: '#10b981' };

                                    return (
                                        <GlassCard key={p} style={styles.priorityCard}>
                                            <View style={[styles.priorityIcon, { backgroundColor: `${colorMap[p]}15` }]}>
                                                <Ionicons name="flash" size={20} color={colorMap[p]} />
                                            </View>
                                            <Text style={[styles.priorityLabel, { color: colors.textMuted }]}>{p.toUpperCase()}</Text>
                                            <Text style={[styles.priorityValue, { color: colors.text }]}>{avgSLA} <Text style={styles.priorityUnit}>saat</Text></Text>
                                            <Text style={[styles.prioritySub, { color: colors.textMuted }]}>{data.count} çözüm</Text>
                                        </GlassCard>
                                    );
                                })}
                            </View>
                        </FadeInView>
                    </>
                )}

                {/* Placeholder for future growth */}
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingTop: 60,
        paddingBottom: 30,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 36,
        borderBottomRightRadius: 36,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerText: {
        flex: 1,
        marginLeft: 15,
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '600',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: { flex: 1 },
    scrollContent: { padding: 20 },
    filterRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    filterBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    filterBtnText: {
        fontSize: 13,
        fontWeight: '700',
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: -6,
    },
    slaCard: {
        marginVertical: 15,
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    slaHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    slaIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#ef444420',
        justifyContent: 'center',
        alignItems: 'center',
    },
    slaTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    slaSubtitle: {
        fontSize: 11,
    },
    slaValueContainer: {
        alignItems: 'flex-end',
    },
    slaValue: {
        fontSize: 32,
        fontWeight: '900',
    },
    slaUnit: {
        fontSize: 10,
        fontWeight: '800',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginTop: 20,
        marginBottom: 15,
    },
    chartContainer: {
        padding: 20,
        marginBottom: 15,
        alignItems: 'center',
    },
    chartHeader: {
        fontSize: 14,
        fontWeight: '700',
        alignSelf: 'flex-start',
        marginBottom: 15,
    },
    chart: {
        borderRadius: 16,
        marginVertical: 10,
    },
    listCard: {
        padding: 15,
        marginBottom: 15,
    },
    listItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    rankContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rankBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#fff',
    },
    itemName: {
        fontSize: 14,
        fontWeight: '700',
    },
    itemValueContainer: {
        alignItems: 'flex-end',
    },
    itemValue: {
        fontSize: 14,
        fontWeight: '800',
    },
    itemSubValue: {
        fontSize: 10,
        fontWeight: '600',
    },
    itemInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    itemProgressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        justifyContent: 'flex-end',
    },
    progressBarBg: {
        height: 6,
        width: 80,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    emptyText: {
        textAlign: 'center',
        padding: 20,
        fontSize: 13,
        fontStyle: 'italic',
    },
    priorityGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
        marginHorizontal: -5,
    },
    priorityCard: {
        flex: 1,
        marginHorizontal: 5,
        padding: 15,
        alignItems: 'center',
    },
    priorityIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    priorityLabel: {
        fontSize: 10,
        fontWeight: '800',
        marginBottom: 4,
    },
    priorityValue: {
        fontSize: 18,
        fontWeight: '900',
    },
    priorityUnit: {
        fontSize: 10,
        fontWeight: '600',
    },
    prioritySub: {
        fontSize: 9,
        marginTop: 2,
    }
});


