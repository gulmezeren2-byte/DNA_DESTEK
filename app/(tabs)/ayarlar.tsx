
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import CustomHeader from '../../components/CustomHeader';
import { APP_CONFIG } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeMode, useTheme } from '../../contexts/ThemeContext';
import { auth, db } from '../../firebaseConfig';
import toast from '../../services/toastService';

const rolEtiketleri: Record<string, { label: string; color: string; icon: string }> = {
    musteri: { label: 'Müşteri', color: '#1565c0', icon: 'person' },
    teknisyen: { label: 'Teknisyen', color: '#ef6c00', icon: 'construct' },
    yonetim: { label: 'Yönetim', color: '#7b1fa2', icon: 'shield-checkmark' },
    yonetim_kurulu: { label: 'Yönetim Kurulu', color: '#c2185b', icon: 'briefcase' },
};

export default function AyarlarScreen() {
    const { user, setUser, logout } = useAuth();
    const { isDark, colors, themeMode, setThemeMode } = useTheme();
    const router = useRouter();

    // Profil düzenleme
    const [profilDuzenleme, setProfilDuzenleme] = useState(false);
    const [ad, setAd] = useState(user?.ad || '');
    const [soyad, setSoyad] = useState(user?.soyad || '');
    const [telefon, setTelefon] = useState(user?.telefon || '');
    const [profilKaydediyor, setProfilKaydediyor] = useState(false);

    // Şifre değiştirme
    const [sifreDegistirme, setSifreDegistirme] = useState(false);
    const [mevcutSifre, setMevcutSifre] = useState('');
    const [yeniSifre, setYeniSifre] = useState('');
    const [yeniSifreTekrar, setYeniSifreTekrar] = useState('');
    const [sifreKaydediyor, setSifreKaydediyor] = useState(false);

    const rolBilgisi = rolEtiketleri[user?.rol || 'musteri'];

    const handleLogout = () => {
        if (Platform.OS === 'web') {
            if (window.confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
                logout();
            }
        } else {
            Alert.alert('Çıkış Yap', 'Çıkış yapmak istediğinizden emin misiniz?', [
                { text: 'İptal', style: 'cancel' },
                { text: 'Çıkış Yap', style: 'destructive', onPress: logout }
            ]);
        }
    };

    const themeOptions: { mode: ThemeMode; label: string; icon: string }[] = [
        { mode: 'light', label: 'Açık', icon: 'sunny-outline' },
        { mode: 'dark', label: 'Koyu', icon: 'moon-outline' },
        { mode: 'system', label: 'Sistem', icon: 'phone-portrait-outline' },
    ];

    // Profil kaydet
    const profilKaydet = async () => {
        if (!user?.uid) {
            toast.error('Oturum bilgisi alınamadı');
            return;
        }
        if (!ad.trim() || !soyad.trim()) {
            toast.warning('Ad ve soyad zorunludur');
            return;
        }

        setProfilKaydediyor(true);
        try {
            console.log('Profil güncelleme başladı:', user.uid);
            const userRef = doc(db, 'users', user.uid);

            await setDoc(userRef, {
                ad: ad.trim(),
                soyad: soyad.trim(),
                telefon: telefon.trim(),
            }, { merge: true });

            setUser({
                ...user,
                ad: ad.trim(),
                soyad: soyad.trim(),
                telefon: telefon.trim()
            });

            toast.success('Profil başarıyla güncellendi!');
            setProfilDuzenleme(false);
        } catch (error: any) {
            console.error('Profil güncelleme hatası:', error.code, error.message);
            let msg = error.message || 'Güncelleme yapılamadı';
            if (error.code === 'permission-denied') msg = 'Bu işlem için yetkiniz yok (Yazma izni reddedildi).';
            toast.error('Hata: ' + msg);
        } finally {
            setProfilKaydediyor(false);
        }
    };

    // Şifre güncelle
    const sifreGuncelle = async () => {
        if (!auth.currentUser) return;
        if (!mevcutSifre || !yeniSifre || !yeniSifreTekrar) {
            toast.warning('Tüm alanları doldurun');
            return;
        }
        if (yeniSifre !== yeniSifreTekrar) {
            toast.error('Yeni şifreler eşleşmiyor');
            return;
        }
        if (yeniSifre.length < 6) {
            toast.warning('Şifre en az 6 karakter olmalı');
            return;
        }

        setSifreKaydediyor(true);
        try {
            const credential = EmailAuthProvider.credential(auth.currentUser.email!, mevcutSifre);
            await reauthenticateWithCredential(auth.currentUser, credential);
            await updatePassword(auth.currentUser, yeniSifre);

            toast.success('Şifreniz başarıyla güncellendi');
            setSifreDegistirme(false);
            setMevcutSifre('');
            setYeniSifre('');
            setYeniSifreTekrar('');
        } catch (error: any) {
            console.error('Şifre güncelleme hatası:', error);
            if (error.code === 'auth/wrong-password') {
                toast.error('Mevcut şifreniz hatalı');
            } else {
                toast.error('Şifre güncellenemedi: ' + error.message);
            }
        } finally {
            setSifreKaydediyor(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <CustomHeader title="Ayarlar" />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* 1. Profil Kartı */}
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                                <Text style={styles.avatarText}>{user?.ad?.charAt(0)}{user?.soyad?.charAt(0)}</Text>
                            </View>
                            <View>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>{user?.ad} {user?.soyad}</Text>
                                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>{user?.email}</Text>
                            </View>
                        </View>
                        {!profilDuzenleme && (
                            <TouchableOpacity onPress={() => setProfilDuzenleme(true)} style={styles.editButton}>
                                <Ionicons name="pencil" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {profilDuzenleme ? (
                        <View style={styles.formContainer}>
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>Ad</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                                    value={ad}
                                    onChangeText={setAd}
                                    placeholder="Adınız"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>Soyad</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                                    value={soyad}
                                    onChangeText={setSoyad}
                                    placeholder="Soyadınız"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>Telefon</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                                    value={telefon}
                                    onChangeText={setTelefon}
                                    placeholder="Telefon numaranız"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="phone-pad"
                                />
                            </View>
                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    style={[styles.button, { backgroundColor: colors.inputBg }]}
                                    onPress={() => setProfilDuzenleme(false)}
                                >
                                    <Text style={{ color: colors.text }}>İptal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.button, { backgroundColor: colors.primary }]}
                                    onPress={profilKaydet}
                                    disabled={profilKaydediyor}
                                >
                                    {profilKaydediyor ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Kaydet</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.badgeContainer}>
                            <View style={[styles.roleBadge, { backgroundColor: isDark ? '#2a3a2a' : '#e8f5e9' }]}>
                                <Ionicons name={rolBilgisi.icon as any} size={14} color={isDark ? '#81c784' : '#2e7d32'} />
                                <Text style={[styles.roleText, { color: isDark ? '#81c784' : '#2e7d32' }]}>{rolBilgisi.label}</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* 2. Tema Ayarları */}
                <View style={[styles.section, { backgroundColor: colors.card }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>🎨 Tema</Text>
                    <View style={styles.themeGrid}>
                        {themeOptions.map((option) => (
                            <TouchableOpacity
                                key={option.mode}
                                style={[
                                    styles.themeOption,
                                    { borderColor: colors.border },
                                    themeMode === option.mode && { borderColor: colors.primary, backgroundColor: isDark ? '#1a2a4a' : '#e3f2fd' },
                                ]}
                                onPress={() => setThemeMode(option.mode)}
                            >
                                <Ionicons
                                    name={option.icon as any}
                                    size={24}
                                    color={themeMode === option.mode ? colors.primary : colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.themeLabel,
                                        { color: themeMode === option.mode ? colors.primary : colors.textSecondary },
                                    ]}
                                >
                                    {option.label}
                                </Text>
                                {themeMode === option.mode && (
                                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} style={styles.checkmark} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* 3. Güvenlik - Şifre Değiştir */}
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => setSifreDegistirme(!sifreDegistirme)}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={[styles.iconBox, { backgroundColor: isDark ? '#333' : '#f5f5f5' }]}>
                                <Ionicons name="lock-closed" size={20} color={colors.text} />
                            </View>
                            <Text style={[styles.cardTitle, { fontSize: 16, color: colors.text }]}>Şifre Değiştir</Text>
                        </View>
                        <Ionicons name={sifreDegistirme ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
                    </TouchableOpacity>

                    {sifreDegistirme && (
                        <View style={[styles.formContainer, { marginTop: 15 }]}>
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>Mevcut Şifre</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                                    value={mevcutSifre}
                                    onChangeText={setMevcutSifre}
                                    placeholder="********"
                                    placeholderTextColor={colors.textMuted}
                                    secureTextEntry
                                />
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>Yeni Şifre</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                                    value={yeniSifre}
                                    onChangeText={setYeniSifre}
                                    placeholder="********"
                                    placeholderTextColor={colors.textMuted}
                                    secureTextEntry
                                />
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: colors.textSecondary }]}>Yeni Şifre (Tekrar)</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                                    value={yeniSifreTekrar}
                                    onChangeText={setYeniSifreTekrar}
                                    placeholder="********"
                                    placeholderTextColor={colors.textMuted}
                                    secureTextEntry
                                />
                            </View>
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: colors.primary, marginTop: 10 }]}
                                onPress={sifreGuncelle}
                                disabled={sifreKaydediyor}
                            >
                                {sifreKaydediyor ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Şifreyi Güncelle</Text>}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* 4. Çıkış Yap */}
                <TouchableOpacity
                    style={[styles.logoutButton, { backgroundColor: isDark ? '#2a0000' : '#ffebee', borderColor: '#ffcdd2' }]}
                    onPress={handleLogout}
                >
                    <Ionicons name="log-out-outline" size={24} color="#d32f2f" />
                    <Text style={styles.logoutText}>Çıkış Yap</Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={[styles.versionText, { color: colors.textMuted }]}>
                        Version {APP_CONFIG.APP_VERSION}
                    </Text>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20 },
    card: { borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    section: { borderRadius: 16, padding: 16, marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    cardTitle: { fontSize: 18, fontWeight: 'bold' },
    cardSubtitle: { fontSize: 14, marginTop: 2 },
    badgeContainer: { flexDirection: 'row', marginTop: 12 },
    roleBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
    roleText: { fontSize: 12, fontWeight: '600' },
    editButton: { padding: 8 },
    formContainer: { marginTop: 16 },
    inputGroup: { marginBottom: 12 },
    label: { fontSize: 13, marginBottom: 6, fontWeight: '500' },
    input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15 },
    actionButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
    button: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    iconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    themeGrid: { flexDirection: 'row', gap: 10 },
    themeOption: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    themeLabel: { fontSize: 12, marginTop: 8, fontWeight: '500' },
    checkmark: { position: 'absolute', top: 6, right: 6 },
    logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 10, marginTop: 10 },
    logoutText: { color: '#d32f2f', fontSize: 16, fontWeight: 'bold' },
    footer: { alignItems: 'center', marginTop: 20 },
    versionText: { fontSize: 12 },
});
