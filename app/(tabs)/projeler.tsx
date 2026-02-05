import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { AnimatedItem } from '../../components/AnimatedList';
import { ListSkeleton } from '../../components/Skeleton';
import GlassCard from '../../components/ui/GlassCard';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { createProje, deleteProje, getProjeler, updateProje } from '../../services/projeService'; // Updated Check
import toast from '../../services/toastService';
import { Proje } from '../../types';

export default function ProjelerScreen() {
    // 1. Setup & Hooks
    const { isYonetim, isBoardMember } = useAuth(); // Both can access
    const { colors, isDark } = useTheme();
    const router = useRouter();

    const [projeler, setProjeler] = useState<Proje[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [editingProje, setEditingProje] = useState<Proje | null>(null);
    const [formAd, setFormAd] = useState('');
    const [formBloklar, setFormBloklar] = useState<{ ad: string; daireSayisi: string }[]>([]);
    const [saving, setSaving] = useState(false);

    // 2. Data Loading
    const loadData = async () => {
        try {
            const res = await getProjeler();
            if (res.success && res.data) {
                setProjeler(res.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // 3. Permission Check
    if (!isYonetim && !isBoardMember) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <Ionicons name="lock-closed" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.text, marginTop: 10 }}>Yetkiniz bulunmamaktadır.</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, padding: 10, backgroundColor: colors.primary, borderRadius: 8 }}>
                    <Text style={{ color: '#fff' }}>Geri Dön</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // 4. Handlers
    const handleAddNewBlock = () => {
        setFormBloklar([...formBloklar, { ad: '', daireSayisi: '' }]);
    };

    const handleRemoveBlock = (index: number) => {
        const newBloklar = [...formBloklar];
        newBloklar.splice(index, 1);
        setFormBloklar(newBloklar);
    };

    const handleBlockChange = (index: number, field: 'ad' | 'daireSayisi', value: string) => {
        const newBloklar = [...formBloklar];
        newBloklar[index][field] = value;
        setFormBloklar(newBloklar);
    };

    const handleEdit = (p: Proje) => {
        setEditingProje(p);
        setFormAd(p.ad);
        // Map existing apartments count to the input
        setFormBloklar(p.bloklar.map(b => ({ ad: b.ad, daireSayisi: b.daireler.length.toString() })));
        setModalVisible(true);
    };

    const handleNew = () => {
        setEditingProje(null);
        setFormAd('');
        setFormBloklar([{ ad: 'A Blok', daireSayisi: '10' }]); // Default example
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!formAd.trim()) {
            toast.warning("Proje adı giriniz.");
            return;
        }

        setSaving(true);
        // Convert UI blocks (count) to Data blocks (array)
        const finalBloklar = formBloklar.map(b => {
            const count = parseInt(b.daireSayisi) || 0;
            // Generate array ["1", "2", ..., "count"]
            const daireler = Array.from({ length: count }, (_, i) => (i + 1).toString());

            return {
                ad: b.ad.trim(),
                daireler: daireler
            };
        }).filter(b => b.ad.length > 0 && b.daireler.length > 0);

        if (finalBloklar.length === 0) {
            toast.warning("En az bir blok ve daire sayısı girmelisiniz.");
            setSaving(false);
            return;
        }

        let result;
        if (editingProje) {
            result = await updateProje(editingProje.id, { ad: formAd, bloklar: finalBloklar });
        } else {
            result = await createProje({ ad: formAd, bloklar: finalBloklar });
        }

        setSaving(false);
        if (result.success) {
            toast.success(editingProje ? "Proje güncellendi" : "Proje oluşturuldu");
            setModalVisible(false);
            loadData();
        } else {
            toast.error("Hata oluştu: " + result.message);
        }
    };

    const handleDelete = (p: Proje) => {
        Alert.alert("Projeyi Sil", `${p.ad} silinecek. Emin misiniz?`, [
            { text: "İptal", style: "cancel" },
            {
                text: "Sil",
                style: "destructive",
                onPress: async () => {
                    const res = await deleteProje(p.id);
                    if (res.success) {
                        toast.success("Silindi");
                        loadData();
                    } else {
                        toast.error("Silinemedi: " + res.message);
                    }
                }
            }
        ]);
    };

    // 5. Render
    if (loading) return <View style={[styles.container, { backgroundColor: colors.background }]}><ListSkeleton count={4} /></View>;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="light-content" />
            <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Proje Yönetimi</Text>
                    <TouchableOpacity onPress={handleNew} style={styles.addBtn}>
                        <Ionicons name="add" size={26} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={projeler}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 20 }}
                refreshing={refreshing}
                onRefresh={loadData}
                renderItem={({ item, index }) => (
                    <AnimatedItem index={index}>
                        <GlassCard style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={[styles.iconBox, { backgroundColor: colors.primary + '20' }]}>
                                        <Ionicons name="business" size={24} color={colors.primary} />
                                    </View>
                                    <View style={{ marginLeft: 12 }}>
                                        <Text style={[styles.cardTitle, { color: colors.text }]}>{item.ad}</Text>
                                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.bloklar.length} Blok</Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row' }}>
                                    <TouchableOpacity onPress={() => handleEdit(item)} style={{ padding: 8 }}>
                                        <Ionicons name="pencil" size={20} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDelete(item)} style={{ padding: 8 }}>
                                        <Ionicons name="trash-outline" size={20} color="#f44336" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            {/* Short preview of blocks */}
                            <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {item.bloklar.slice(0, 4).map((b, i) => (
                                    <View key={i} style={{ backgroundColor: colors.border, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                                        <Text style={{ fontSize: 11, color: colors.textMuted }}>{b.ad} ({b.daireler.length} Daire)</Text>
                                    </View>
                                ))}
                                {item.bloklar.length > 4 && <Text style={{ fontSize: 11, color: colors.textMuted, alignSelf: 'center' }}>+ {item.bloklar.length - 4}</Text>}
                            </View>
                        </GlassCard>
                    </AnimatedItem>
                )}
                ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 50 }}>Henüz proje eklenmemiş.</Text>}
            />

            {/* Edit/Create Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>{editingProje ? 'Projeyi Düzenle' : 'Yeni Proje'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Proje Adı</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                                value={formAd}
                                onChangeText={setFormAd}
                                placeholder="Örn: Vadi İstanbul"
                                placeholderTextColor={colors.textMuted}
                            />

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 10 }}>
                                <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>Bloklar</Text>
                                <TouchableOpacity onPress={handleAddNewBlock} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="add-circle" size={20} color={colors.primary} />
                                    <Text style={{ color: colors.primary, marginLeft: 4, fontWeight: '600' }}>Blok Ekle</Text>
                                </TouchableOpacity>
                            </View>

                            {formBloklar.map((blok, index) => (
                                <View key={index} style={[styles.blockRow, { borderColor: colors.border }]}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <TextInput
                                            style={[styles.input, { flex: 0.4, marginBottom: 0, color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                                            value={blok.ad}
                                            onChangeText={(t) => handleBlockChange(index, 'ad', t)}
                                            placeholder="Blok Adı (A Blok)"
                                            placeholderTextColor={colors.textMuted}
                                        />
                                        <TouchableOpacity onPress={() => handleRemoveBlock(index)} style={{ padding: 8 }}>
                                            <Ionicons name="trash-outline" size={20} color="#f44336" />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Daire Sayısı</Text>
                                    <TextInput
                                        style={[styles.input, { marginBottom: 0, color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                                        value={blok.daireSayisi}
                                        onChangeText={(t) => handleBlockChange(index, 'daireSayisi', t)}
                                        placeholder="Örn: 20 (Sistem 1'den 20'ye kadar oluşturur)"
                                        keyboardType="numeric"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>
                            ))}
                        </ScrollView>
                        <View style={{ padding: 20 }}>
                            <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: colors.primary }]} disabled={saving}>
                                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Kaydet</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backBtn: { padding: 8 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    addBtn: { padding: 8 },
    card: { padding: 16, marginBottom: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cardTitle: { fontSize: 16, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { height: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    modalBody: { padding: 20 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
    input: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
    blockRow: { padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 12, borderStyle: 'dashed' },
    saveBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
