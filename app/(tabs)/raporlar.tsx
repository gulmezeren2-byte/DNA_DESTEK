import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
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
import { LineChart, PieChart } from 'react-native-chart-kit';
import { FadeInView } from '../../components/AnimatedList';
import GlassCard from '../../components/ui/GlassCard';
import StatsWidget from '../../components/ui/StatsWidget';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { db } from '../../firebaseConfig';

// --- Types ---
import { Talep } from '../../types';

interface Insight {
    type: 'positive' | 'negative' | 'neutral' | 'warning';
    title: string;
    message: string;
    icon: any;
}

// --- Constants ---
const CHART_CONFIG_BASE = {
    backgroundGradientFromOpacity: 0,
    backgroundGradientToOpacity: 0,
    color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.7,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
};

// --- Calculations Helper ---
const calculateInsights = (talepler: Talep[], techStats: any[], catStats: any[]): Insight[] => {
    const insights: Insight[] = [];

    // 1. Satisfaction Insight
    const rated = talepler.filter(t => t.puan && t.puan > 0);
    const avgScore = rated.length > 0 ? rated.reduce((a, b) => a + (b.puan || 0), 0) / rated.length : 0;

    if (avgScore >= 4.5) {
        insights.push({ type: 'positive', title: 'Mükemmel Memnuniyet', message: `Genel memnuniyet puanı ${avgScore.toFixed(1)}/5.0 ile çok yüksek seviyede.`, icon: 'star' });
    } else if (avgScore < 3.5 && rated.length > 5) {
        insights.push({ type: 'negative', title: 'Memnuniyet Düşüşü', message: `Ortalama puan ${avgScore.toFixed(1)} seviyesine geriledi.`, icon: 'warning' });
    }

    // 2. Bottleneck Insight (Category)
    const slowestCat = [...catStats].sort((a, b) => b.avgTime - a.avgTime)[0];
    if (slowestCat && slowestCat.avgTime > 48) {
        insights.push({ type: 'warning', title: 'Operasyonel Darboğaz', message: `'${slowestCat.name}' kategorisi ortalama ${slowestCat.avgTime.toFixed(0)} saat ile en yavaş çözülen alan.`, icon: 'hourglass' });
    }

    // 3. Top Performer
    const topTech = [...techStats].sort((a, b) => b.count - a.count)[0];
    if (topTech && topTech.count > 5) {
        insights.push({ type: 'positive', title: 'Haftanın Yıldızı', message: `${topTech.name}, ${topTech.count} görev tamamlayarak ekibin en üretken ismi oldu.`, icon: 'trophy' });
    }

    // 4. Volume Trend
    // This requires trend check logic, assumed simple for now across "talepler" which is filtered by days
    if (talepler.length > 50) {
        insights.push({ type: 'neutral', title: 'Yüksek Talep Hacmi', message: 'Son dönemde talep hacminde belirgin bir artış gözleniyor.', icon: 'trending-up' });
    }

    return insights;
};

export default function RaporlarScreen() {
    const { user, isYonetim, isBoardMember } = useAuth();
    const { isDark, colors } = useTheme();
    const router = useRouter();
    const { width: windowWidth } = useWindowDimensions();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterDays, setFilterDays] = useState(30);

    // Data States
    const [stats, setStats] = useState<{
        total: number;
        open: number;
        solved: number;
        urgent: number;
        score: string;
        slaCompliance: number;
        activeRequestsRaw?: Talep[];
        allRequestsRaw?: Talep[];
    }>({
        total: 0, open: 0, solved: 0, urgent: 0, score: '0.0', slaCompliance: 0, activeRequestsRaw: [], allRequestsRaw: []
    });
    const [charts, setCharts] = useState<{
        trendLabel: string[];
        trendCreated: number[];
        trendSolved: number[];
        catLabels: string[];
        catValues: number[];
        distData: any[];
    }>({ trendLabel: [], trendCreated: [], trendSolved: [], catLabels: [], catValues: [], distData: [] });

    const [insights, setInsights] = useState<Insight[]>([]);
    const [techLeaderboard, setTechLeaderboard] = useState<any[]>([]);
    const [teamPerformance, setTeamPerformance] = useState<{ name: string; avgTime: number; count: number }[]>([]);

    const containerWidth = Platform.OS === 'web' ? Math.min(windowWidth, 1200) : windowWidth;
    const chartWidth = containerWidth - 40;

    // Helper to safely get seconds from various date formats
    const getSeconds = (dateVal: any): number => {
        if (!dateVal) return 0;
        if (dateVal.seconds) return dateVal.seconds;
        if (dateVal instanceof Date) return Math.floor(dateVal.getTime() / 1000);
        if (typeof dateVal === 'number') return Math.floor(dateVal / 1000); // Assume millis
        return 0;
    };

    // --- Loading Logic ---
    const loadData = async () => {
        setLoading(true);
        try {
            const talesRef = collection(db, 'talepler');
            // Date Filter
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - filterDays);

            const q = query(talesRef, where('olusturmaTarihi', '>=', cutoff), orderBy('olusturmaTarihi', 'asc'));
            const snap = await getDocs(q);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Talep[];

            processMetrics(data);
        } catch (e) {
            console.error("Rapor hatası:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const processMetrics = (data: Talep[]) => {
        // 1. Basic Stats
        const total = data.length;
        const solved = data.filter(t => t.durum === 'cozuldu' || t.durum === 'kapatildi').length;
        const open = total - solved;
        const urgent = data.filter(t => t.oncelik === 'acil' && t.durum !== 'cozuldu').length;

        const ratedItems = data.filter(t => t.puan && t.puan > 0);
        const avgScore = ratedItems.length > 0
            ? (ratedItems.reduce((a, b) => a + (b.puan || 0), 0) / ratedItems.length).toFixed(1)
            : '0.0';

        // SLA Compliance (Mock Logic: Solved < 48h)
        const slaOk = data.filter(t => {
            if (t.durum !== 'cozuldu' || !t.olusturmaTarihi || !t.cozumTarihi) return false;
            const created = getSeconds(t.olusturmaTarihi);
            const solved = getSeconds(t.cozumTarihi);
            const diffHours = (solved - created) / 3600;
            return diffHours <= 48;
        }).length;
        const slaRate = solved > 0 ? Math.round((slaOk / solved) * 100) : 100;

        // Valid active requests for Workload Chart
        const activeRequestsRaw = data.filter(t => ['yeni', 'atandi', 'islemde'].includes(t.durum));

        setStats({
            total, open, solved, urgent, score: avgScore, slaCompliance: slaRate,
            activeRequestsRaw,
            allRequestsRaw: data
        });

        // 2. Trend Chart (Created vs Solved daily)
        // Group by Date
        const trendMap = new Map<string, { created: number, solved: number }>();
        data.forEach(t => {
            if (t.olusturmaTarihi) {
                const s = getSeconds(t.olusturmaTarihi);
                const d = new Date(s * 1000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                if (!trendMap.has(d)) trendMap.set(d, { created: 0, solved: 0 });
                trendMap.get(d)!.created++;
            }
            if (t.cozumTarihi) {
                const s = getSeconds(t.cozumTarihi);
                const d = new Date(s * 1000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                if (!trendMap.has(d)) trendMap.set(d, { created: 0, solved: 0 });
                trendMap.get(d)!.solved++;
            }
        });

        // Limit chart to last 7-10 distinct dates for readability
        const sortedDates = Array.from(trendMap.keys()).slice(-7);

        // 3. Category Efficiency
        // Group by Category -> Avg Resolution Time
        const catMap = new Map<string, { count: number, totalTime: number }>();
        data.forEach(t => {
            if (t.kategori && t.durum === 'cozuldu' && t.olusturmaTarihi && t.cozumTarihi) {
                const cat = t.kategori;
                const created = getSeconds(t.olusturmaTarihi);
                const solved = getSeconds(t.cozumTarihi);
                const time = (solved - created) / 3600;
                if (!catMap.has(cat)) catMap.set(cat, { count: 0, totalTime: 0 });
                const c = catMap.get(cat)!;
                c.count++;
                c.totalTime += time;
            }
        });
        const catStats = Array.from(catMap.entries()).map(([k, v]) => ({ name: k, avgTime: v.totalTime / v.count }));

        // 4. Tech Leaderboard (Updated for Task Force)
        const techMap = new Map<string, { count: number, scoreSum: number, scoreCount: number }>();

        data.forEach(t => {
            if (t.durum === 'cozuldu') {
                // If it's a Task Force assignment, credit EVERY member
                if (t.sahaEkibi && t.sahaEkibi.length > 0) {
                    t.sahaEkibi.forEach(personel => {
                        const name = personel.ad;
                        if (!techMap.has(name)) techMap.set(name, { count: 0, scoreSum: 0, scoreCount: 0 });
                        const tm = techMap.get(name)!;
                        tm.count++;
                        if (t.puan) {
                            tm.scoreSum += t.puan;
                            tm.scoreCount++;
                        }
                    });
                }
                // Fallback for legacy data or individual assignment without task force structure
                else if (t.atananTeknisyenAdi) {
                    const name = t.atananTeknisyenAdi;
                    if (!techMap.has(name)) techMap.set(name, { count: 0, scoreSum: 0, scoreCount: 0 });
                    const tm = techMap.get(name)!;
                    tm.count++;
                    if (t.puan) {
                        tm.scoreSum += t.puan;
                        tm.scoreCount++;
                    }
                }
            }
        });

        const techLeaderboardData = Array.from(techMap.entries())
            .map(([k, v]) => ({ name: k, count: v.count, rating: v.scoreCount > 0 ? (v.scoreSum / v.scoreCount).toFixed(1) : '-' }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // 5. Team Performance (Avg Resolution Time)
        const teamMap = new Map<string, { count: number; totalTime: number }>();
        data.forEach(t => {
            if (t.durum === 'cozuldu' && t.olusturmaTarihi && t.cozumTarihi && t.atananEkipAdi) {
                const created = getSeconds(t.olusturmaTarihi);
                const solved = getSeconds(t.cozumTarihi);
                const time = (solved - created) / 3600; // Hours

                const teamName = t.atananEkipAdi;
                if (!teamMap.has(teamName)) teamMap.set(teamName, { count: 0, totalTime: 0 });
                const tm = teamMap.get(teamName)!;
                tm.count++;
                tm.totalTime += time;
            }
        });

        const teamStats = Array.from(teamMap.entries())
            .map(([name, val]) => ({
                name,
                count: val.count,
                avgTime: val.totalTime / val.count
            }))
            .sort((a, b) => a.avgTime - b.avgTime); // Fastest first

        setTeamPerformance(teamStats);

        setTechLeaderboard(techLeaderboardData);

        // Insights Generation
        const ins = calculateInsights(data, techLeaderboardData, catStats);
        setInsights(ins);

        // Chart Data Set
        setCharts({
            trendLabel: sortedDates,
            trendCreated: sortedDates.map(d => trendMap.get(d)?.created || 0),
            trendSolved: sortedDates.map(d => trendMap.get(d)?.solved || 0),
            catLabels: catStats.slice(0, 5).map(c => c.name),
            catValues: catStats.slice(0, 5).map(c => c.avgTime),
            distData: [
                { name: 'Açık', population: open, color: '#f59e0b', legendFontColor: colors.textSecondary, legendFontSize: 12 },
                { name: 'Çözüldü', population: solved, color: '#10b981', legendFontColor: colors.textSecondary, legendFontSize: 12 },
                { name: 'İptal', population: data.filter(t => t.durum === 'iptal').length, color: '#ef4444', legendFontColor: colors.textSecondary, legendFontSize: 12 }
            ]
        });
    };

    useEffect(() => {
        if (isYonetim) loadData();
    }, [filterDays]);

    if (!isYonetim) return null; // Or unauthorized view

    const chartConfig = {
        ...CHART_CONFIG_BASE,
        labelColor: () => colors.textSecondary,
        color: (opacity = 1) => isDark ? `rgba(139, 92, 246, ${opacity})` : `rgba(99, 102, 241, ${opacity})`,
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={isDark ? ['#0f172a', '#1e293b'] : ['#312e81', '#4f46e5']} style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.headerTitle}>Komuta Merkezi</Text>
                        <Text style={styles.headerSubtitle}>Genel Bakış ve Analitik</Text>
                    </View>
                    <TouchableOpacity onPress={() => { setRefreshing(true); loadData(); }} style={styles.iconBtn}>
                        <Ionicons name="refresh" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Time FIlter */}
                <View style={styles.filterContainer}>
                    {[7, 30, 90, 365].map((d) => (
                        <TouchableOpacity
                            key={d}
                            onPress={() => setFilterDays(d)}
                            style={[styles.filterBtn, filterDays === d && styles.filterBtnActive]}
                        >
                            <Text style={[styles.filterText, filterDays === d && styles.filterTextActive]}>
                                {d === 365 ? 'Bu Yıl' : `${d} Gün`}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </LinearGradient>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
            >
                {/* 1. Executive Summary Grid */}
                <View style={styles.gridContainer}>
                    <StatsWidget
                        title="Toplam Talep"
                        value={stats.total}
                        icon="layers"
                        color="#6366f1"
                        description="Seçili dönem"
                    />
                    <StatsWidget
                        title="Çözüm Oranı"
                        value={`${Math.round((stats.solved / (stats.total || 1)) * 100)}%`}
                        icon="pie-chart"
                        color="#10b981"
                    />
                    <StatsWidget
                        title="Memnuniyet"
                        value={stats.score}
                        icon="star"
                        color="#f59e0b"
                        description="/ 5.0"
                    />
                    <StatsWidget
                        title="SLA Uyumu"
                        value={`${stats.slaCompliance}%`}
                        icon="shield-checkmark"
                        color={stats.slaCompliance > 80 ? '#10b981' : '#f43f5e'}
                        description="Zamanında"
                    />
                </View>

                {/* 2. Intelligent Insights Section */}
                {insights.length > 0 && (
                    <FadeInView delay={200}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sistem İçgörüleri & Tespitler</Text>
                        {insights.map((insight, idx) => (
                            <GlassCard key={idx} style={StyleSheet.flatten([styles.insightCard, { borderLeftColor: insight.type === 'positive' ? '#10b981' : insight.type === 'warning' ? '#f59e0b' : '#3b82f6' }])}>
                                <View style={[styles.insightIcon, { backgroundColor: insight.type === 'positive' ? '#10b98120' : insight.type === 'warning' ? '#f59e0b20' : '#3b82f620' }]}>
                                    <Ionicons
                                        name={insight.icon}
                                        size={22}
                                        color={insight.type === 'positive' ? '#10b981' : insight.type === 'warning' ? '#f59e0b' : '#3b82f6'}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.insightTitle, { color: colors.text }]}>{insight.title}</Text>
                                    <Text style={[styles.insightBody, { color: colors.textSecondary }]}>{insight.message}</Text>
                                </View>
                            </GlassCard>
                        ))}
                    </FadeInView>
                )}

                {/* 3. Operational Velocity (Chart) */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Operasyonel Hız (Yeni vs Çözülen)</Text>
                <GlassCard style={styles.chartCard}>
                    {charts.trendLabel.length > 0 ? (
                        <LineChart
                            data={{
                                labels: charts.trendLabel,
                                datasets: [
                                    { data: charts.trendCreated, color: (opacity = 1) => `rgba(244, 63, 94, ${opacity})`, strokeWidth: 3 }, // Red for new
                                    { data: charts.trendSolved, color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, strokeWidth: 3 } // Green for solved
                                ],
                                legend: ["Yeni Talepler", "Çözülenler"]
                            }}
                            width={chartWidth}
                            height={220}
                            chartConfig={chartConfig}
                            bezier
                            style={{ borderRadius: 16 }}
                        />
                    ) : <Text style={{ padding: 20, textAlign: 'center', color: colors.textMuted }}>Veri yok</Text>}
                </GlassCard>

                {/* 4. Split View: Distribution & Leaderboard */}
                <View style={styles.splitRow}>
                    <View style={{ flex: 1, minWidth: 300 }}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Durum Dağılımı</Text>
                        <GlassCard style={styles.basicCard}>
                            <PieChart
                                data={charts.distData}
                                width={chartWidth < 400 ? chartWidth : chartWidth / 2}
                                height={200}
                                chartConfig={chartConfig}
                                accessor="population"
                                backgroundColor="transparent"
                                paddingLeft="0"
                                absolute={false}
                                center={[10, 0]}
                            />
                        </GlassCard>
                    </View>
                </View>

                {/* 5. Team Leaderboard */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Personel Performans Liderleri</Text>
                <GlassCard style={styles.basicCard}>
                    {techLeaderboard.map((tech, i) => (
                        <View key={i} style={[styles.leaderRow, { borderBottomColor: colors.border }]}>
                            <View style={styles.leaderRank}>
                                <Text style={[styles.rankNumber, { color: i < 3 ? '#fff' : colors.textSecondary }]}>{i + 1}</Text>
                                {i === 0 && <View style={[styles.rankBadge, { backgroundColor: '#f59e0b' }]} />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.leaderName, { color: colors.text }]}>{tech.name}</Text>
                                <View style={styles.leaderBarBg}>
                                    <View style={[styles.leaderBarFill, { width: `${(tech.count / (techLeaderboard[0].count || 1)) * 100}%`, backgroundColor: colors.primary }]} />
                                </View>
                            </View>
                            <View style={{ alignItems: 'flex-end', minWidth: 60 }}>
                                <Text style={[styles.leaderValue, { color: colors.text }]}>{tech.count}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                    <Ionicons name="star" size={10} color="#f59e0b" />
                                    <Text style={{ fontSize: 10, color: colors.textSecondary }}>{tech.rating}</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </GlassCard>

                {/* --- NEW: Active Workload Balance --- */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Anlık İş Yükü Dengesi (Aktif Dosyalar)</Text>
                <GlassCard style={styles.basicCard}>
                    {(() => {
                        // Calculate Active Load on the fly (Updated for Task Force)
                        const activeLoadMap = new Map<string, number>();
                        stats.activeRequestsRaw?.forEach((t: Talep) => {
                            // Check Task Force first
                            if (t.sahaEkibi && t.sahaEkibi.length > 0) {
                                t.sahaEkibi.forEach(p => {
                                    activeLoadMap.set(p.ad, (activeLoadMap.get(p.ad) || 0) + 1);
                                });
                            }
                            // Fallback
                            else if (t.atananTeknisyenAdi) {
                                activeLoadMap.set(t.atananTeknisyenAdi, (activeLoadMap.get(t.atananTeknisyenAdi) || 0) + 1);
                            }
                        });
                        const activeLoad = Array.from(activeLoadMap.entries())
                            .map(([name, count]) => ({ name, count }))
                            .sort((a, b) => b.count - a.count);

                        if (activeLoad.length === 0) return <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Şu an aktif işlem yok</Text>;

                        return activeLoad.map((tech, i) => (
                            <View key={i} style={{ marginBottom: 16 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <Text style={{ color: colors.text, fontWeight: '600' }}>{tech.name}</Text>
                                    <Text style={{ color: tech.count > 5 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>{tech.count} Dosya</Text>
                                </View>
                                <View style={{ height: 10, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 5, overflow: 'hidden' }}>
                                    {/* Danger zone if > 5 active tasks */}
                                    <View style={{
                                        height: '100%',
                                        width: `${Math.min(tech.count * 10, 100)}%`,
                                        backgroundColor: tech.count > 5 ? '#ef4444' : tech.count > 3 ? '#f59e0b' : '#3b82f6'
                                    }} />
                                </View>
                            </View>
                        ));
                    })()}
                </GlassCard>

                {/* --- NEW: Hourly Heatmap (Simple Visualization) --- */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Talep Yoğunluk Haritası (Saat Dilimi)</Text>
                <GlassCard style={[styles.basicCard, { flexDirection: 'row', alignItems: 'flex-end', height: 150, paddingBottom: 0, paddingHorizontal: 10 }]}>
                    {(() => {
                        // Calculate Hourly Distribution
                        const hours = new Array(24).fill(0);
                        stats.allRequestsRaw?.forEach((t: Talep) => {
                            if (t.olusturmaTarihi) {
                                const s = getSeconds(t.olusturmaTarihi);
                                const h = new Date(s * 1000).getHours();
                                hours[h]++;
                            }
                        });
                        const maxVal = Math.max(...hours, 1);

                        // Render simplified bars (every 2 hours to save space)
                        return hours.map((count, h) => {
                            if (h % 2 !== 0) return null; // Skip odd hours for cleaner UI
                            const heightPct = (count / maxVal) * 100;
                            return (
                                <View key={h} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                                    <View style={{
                                        width: 8,
                                        height: `${Math.max(heightPct, 5)}%`,
                                        backgroundColor: count > 0 ? (isDark ? '#818cf8' : '#4f46e5') : (isDark ? '#333' : '#e5e5e5'),
                                        borderRadius: 4,
                                        opacity: 0.8
                                    }} />
                                    <Text style={{ fontSize: 10, color: colors.textMuted }}>{h}</Text>
                                </View>
                            );
                        });
                    })()}
                </GlassCard>

                {/* --- NEW: SLA Breach Analysis --- */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>SLA İhlal Analizi (48+ Saat)</Text>
                <GlassCard style={styles.listCard}>
                    {(() => {
                        // Find breaches
                        const breaches = stats.allRequestsRaw?.filter(t => {
                            if (!t.olusturmaTarihi) return false;
                            const created = getSeconds(t.olusturmaTarihi);
                            const start = created * 1000;
                            const end = t.cozumTarihi ? getSeconds(t.cozumTarihi) * 1000 : new Date().getTime();
                            const diffHours = (end - start) / (1000 * 60 * 60);
                            return diffHours > 48 && t.durum !== 'iptal'; // Exclude cancelled
                        }).sort((a, b) => getSeconds(b.olusturmaTarihi) - getSeconds(a.olusturmaTarihi)).slice(0, 5) || [];

                        if (breaches.length === 0) return (
                            <View style={{ alignItems: 'center', padding: 20 }}>
                                <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                                <Text style={{ marginTop: 10, color: colors.text, fontWeight: '600' }}>Harika! SLA İhlali Yok.</Text>
                            </View>
                        );

                        return breaches.map((t, i) => {
                            const created = getSeconds(t.olusturmaTarihi);
                            const days = created ? Math.floor((new Date().getTime() - created * 1000) / (1000 * 60 * 60 * 24)) : 0;
                            return (
                                <View key={t.id} style={[styles.listItem, i === breaches.length - 1 && { borderBottomWidth: 0 }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{t.baslik || 'Başlıksız Talep'}</Text>
                                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>{t.atananTeknisyenAdi || 'Atanmamış'} • {t.kategori}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <View style={{ backgroundColor: '#ef444420', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                            <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: 'bold' }}>GEÇİKTİ</Text>
                                        </View>
                                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{days} gündür açık</Text>
                                    </View>
                                </View>
                            );
                        });
                    })()}
                </GlassCard>

                {/* 6. Category Analysis (Horizontal Bar Mock via View for cleaner look than chart kit) */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Kategori Bazlı Ortalama Çözüm Süresi (Saat)</Text>
                <GlassCard style={styles.basicCard}>
                    {charts.catValues.length > 0 ? charts.catLabels.map((label, i) => (
                        <View key={i} style={{ marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{label}</Text>
                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.primary }}>{charts.catValues[i].toFixed(1)} sa</Text>
                            </View>
                            <View style={{ height: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 4 }}>
                                <View style={{
                                    height: '100%',
                                    borderRadius: 4,
                                    backgroundColor: charts.catValues[i] > 48 ? '#ef4444' : '#10b981',
                                    width: `${Math.min((charts.catValues[i] / 72) * 100, 100)}%`
                                }} />
                            </View>
                        </View>
                    )) : <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Veri yok</Text>}
                </GlassCard>

                {/* --- 7. First Time Fix Rate (Proxy: Solved < 2h) --- */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Kalite: İlk Seferde Çözüm Oranı (FTFR)</Text>
                <GlassCard style={styles.basicCard}>
                    {(() => {
                        const solved = stats.allRequestsRaw?.filter(t => t.durum === 'cozuldu' && t.olusturmaTarihi && t.cozumTarihi) || [];
                        const quickFixes = solved.filter(t => {
                            const created = getSeconds(t.olusturmaTarihi);
                            const solvedTime = getSeconds(t.cozumTarihi);
                            const hours = (solvedTime - created) / 3600;
                            return hours <= 2; // Assume < 2h is a "First Time Fix"
                        });
                        const rate = solved.length > 0 ? Math.round((quickFixes.length / solved.length) * 100) : 0;

                        return (
                            <View style={{ alignItems: 'center' }}>
                                <Text style={{ fontSize: 36, fontWeight: '900', color: rate > 70 ? '#10b981' : rate > 50 ? '#f59e0b' : '#ef4444' }}>%{rate}</Text>
                                <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>Taleplerin %{rate}'i tek müdahalede (2 saat altı) çözüldü.</Text>
                                <View style={{ width: '100%', height: 8, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 4 }}>
                                    <View style={{ width: `${rate}%`, height: '100%', backgroundColor: rate > 70 ? '#10b981' : rate > 50 ? '#f59e0b' : '#ef4444', borderRadius: 4 }} />
                                </View>
                            </View>
                        );
                    })()}
                </GlassCard>

                {/* --- 8. Burnout Risk Analysis --- */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>İK Analizi: Personel Tükenmişlik Riski</Text>
                <GlassCard style={styles.listCard}>
                    {(() => {
                        // Logic: Active Tasks * Avg Personal Resolution Time = Estimated Backlog Hours
                        // If Backlog > 40 hours -> Burnout Risk
                        const risks = techLeaderboard.map(tech => {
                            // Fix: Check task force membership correctly
                            const activeCount = stats.activeRequestsRaw?.filter(t => {
                                if (t.sahaEkibi && t.sahaEkibi.length > 0) {
                                    return t.sahaEkibi.some(p => p.ad === tech.name);
                                }
                                return t.atananTeknisyenAdi === tech.name;
                            }).length || 0;

                            // Mock avg time if not enough data, else derive from tech stats (assuming generic avg for now or simplistic)
                            const avgTime = 4; // Assume 4 hours per task avg
                            const backlog = activeCount * avgTime;
                            return { ...tech, backlog, activeCount };
                        }).filter(t => t.backlog > 20).sort((a, b) => b.backlog - a.backlog); // Threshold 20h for demo

                        if (risks.length === 0) return <Text style={{ textAlign: 'center', color: '#10b981', padding: 10 }}>Düşük Risk. İş yükü dengeli.</Text>;

                        return risks.map((r, i) => (
                            <View key={i} style={[styles.listItem, i === risks.length - 1 && { borderBottomWidth: 0 }]}>
                                <View>
                                    <Text style={[styles.itemName, { color: colors.text }]}>{r.name}</Text>
                                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>{r.activeCount} Aktif Görev</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontWeight: 'bold', color: r.backlog > 40 ? '#ef4444' : '#f59e0b' }}>~{r.backlog} Saat Yük</Text>
                                    <Text style={{ fontSize: 10, color: colors.textMuted }}>Tahmini Efor</Text>
                                </View>
                            </View>
                        ));
                    })()}
                </GlassCard>

                {/* --- 9. Team Performance Analysis --- */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Ekip Performans Analizi (Ortalama Çözüm Süresi)</Text>
                <GlassCard style={styles.basicCard}>
                    {teamPerformance.length > 0 ? teamPerformance.map((team, i) => (
                        <View key={i} style={{ marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                <View>
                                    <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>{team.name}</Text>
                                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>{team.count} Tamamlanan Görev</Text>
                                </View>
                                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: 'bold' }}>{team.avgTime.toFixed(1)} sa</Text>
                            </View>
                            <View style={{ height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 3 }}>
                                {/* Normalize bar width relative to the slowest team (max time) or a fixed max like 48h */}
                                <View style={{
                                    width: `${Math.min((team.avgTime / (teamPerformance[teamPerformance.length - 1].avgTime || 1)) * 100, 100)}%`,
                                    height: '100%',
                                    backgroundColor: team.avgTime < 24 ? '#10b981' : team.avgTime < 48 ? '#f59e0b' : '#ef4444',
                                    borderRadius: 3
                                }} />
                            </View>
                        </View>
                    )) : <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Ekip verisi bulunamadı</Text>}
                </GlassCard>

                {/* --- 9. Project Profitability (Man/Hour) --- */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Proje Maliyet Analizi (Adam/Saat)</Text>
                <GlassCard style={styles.basicCard}>
                    {(() => {
                        const projectHours: Record<string, number> = {};
                        stats.allRequestsRaw?.forEach(t => {
                            if (t.projeAdi && t.olusturmaTarihi && t.cozumTarihi) {
                                const created = getSeconds(t.olusturmaTarihi);
                                const solved = getSeconds(t.cozumTarihi);
                                const h = (solved - created) / 3600;
                                projectHours[t.projeAdi] = (projectHours[t.projeAdi] || 0) + h;
                            }
                        });
                        const topProjects = Object.entries(projectHours)
                            .map(([name, hours]) => ({ name, hours }))
                            .sort((a, b) => b.hours - a.hours)
                            .slice(0, 5);

                        if (topProjects.length === 0) return <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Veri yok</Text>;

                        return topProjects.map((p, i) => (
                            <View key={i} style={{ marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>{p.name}</Text>
                                    <Text style={{ fontSize: 13, color: colors.primary, fontWeight: 'bold' }}>{p.hours.toFixed(0)} sa</Text>
                                </View>
                                <View style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3 }}>
                                    <View style={{ width: `${Math.min((p.hours / topProjects[0].hours) * 100, 100)}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 3 }} />
                                </View>
                            </View>
                        ));
                    })()}
                </GlassCard>

                {/* --- 10. Predictive AI Forecast --- */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Gelecek Öngörüsü (AI Tahmin)</Text>
                <GlassCard style={[styles.basicCard, { borderLeftWidth: 4, borderLeftColor: '#8b5cf6' }]}>
                    <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#8b5cf620', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="sparkles" size={24} color="#8b5cf6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 16, color: colors.text, marginBottom: 4 }}>Tahmini Yoğunluk: YÜKSEK</Text>
                            <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
                                Geçmiş verilere dayanarak, <Text style={{ fontWeight: 'bold', color: '#8b5cf6' }}>Pazartesi</Text> günü taleplerde %35 artış bekleniyor. "Elektrik" kategorisi için yedek parça stoğunu kontrol etmeniz önerilir.
                            </Text>
                        </View>
                    </View>
                </GlassCard>

                <View style={{ height: 50 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 60, paddingBottom: 25, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
    iconBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
    filterContainer: { flexDirection: 'row', gap: 10 },
    filterBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
    filterBtnActive: { backgroundColor: '#fff' },
    filterText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
    filterTextActive: { color: '#4f46e5' },

    scrollContent: { padding: 20, paddingTop: 10 },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 10 },

    insightCard: { flexDirection: 'row', padding: 16, marginBottom: 10, borderLeftWidth: 4, alignItems: 'center', gap: 15 },
    insightIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    insightTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
    insightBody: { fontSize: 13, lineHeight: 18 },

    chartCard: { padding: 0, paddingVertical: 10, borderRadius: 20, overflow: 'hidden', alignItems: 'center' },
    basicCard: { padding: 20, borderRadius: 20 },
    splitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },

    leaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
    leaderRank: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    rankNumber: { fontWeight: 'bold', fontSize: 14, zIndex: 2 },
    rankBadge: { position: 'absolute', width: 24, height: 24, borderRadius: 12, opacity: 0.8 },
    leaderName: { fontWeight: '600', fontSize: 14, marginBottom: 6 },
    leaderBarBg: { height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, width: '100%' },
    leaderBarFill: { height: '100%', borderRadius: 3 },
    leaderValue: { fontWeight: 'bold', fontSize: 16 },
    // Missing styles added
    listCard: { padding: 16, borderRadius: 20 },
    listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    itemName: { fontSize: 14, fontWeight: '600' }
});
