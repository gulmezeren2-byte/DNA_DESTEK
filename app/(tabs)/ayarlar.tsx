import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import CustomHeader from '../../components/CustomHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { auth, db, logoutUser } from '../../firebaseConfig';
import toast from '../../services/toastService';

const rolEtiketleri: Record<string, { label: string; color: string; icon: string }> = {
    musteri: { label: 'Müşteri', color: '#1565c0', icon: 'person' },
    teknisyen: { label: 'Teknisyen', color: '#ef6c00', icon: 'construct' },
    yonetim: { label: 'Yönetim', color: '#7b1fa2', icon: 'shield-checkmark' },
};

export default function AyarlarScreen() {
    const { user, setUser } = useAuth();
    const { isDark, colors, toggleTheme } = useTheme();
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

    // Profil kaydet
    const profilKaydet = async () => {
        if (!ad.trim() || !soyad.trim()) {
            toast.warning('Ad ve soyad zorunludur');
            return;
        }

        setProfilKaydediyor(true);
        try {
            await updateDoc(doc(db, 'users', user!.uid), {
                ad: ad.trim(),
                soyad: soyad.trim(),
                telefon: telefon.trim(),
            });

            // Context'i güncelle
            setUser({ ...user!, ad: ad.trim(), soyad: soyad.trim(), telefon: telefon.trim() });

            toast.success('Profil güncellendi!');

            setProfilDuzenleme(false);
        } catch (error: any) {
            toast.error('Hata: ' + error.message);
        }
        setProfilKaydediyor(false);
    };

    // Şifre değiştir
    const sifreDegistir = async () => {
        if (!mevcutSifre || !yeniSifre || !yeniSifreTekrar) {
            toast.warning('Tüm alanları doldurun');
            return;
        }

        if (yeniSifre !== yeniSifreTekrar) {
            toast.warning('Yeni şifreler eşleşmiyor');
            return;
        }

        if (yeniSifre.length < 6) {
            toast.warning('Şifre en az 6 karakter olmalıdır');
            return;
        }

        setSifreKaydediyor(true);
        try {
            const currentUser = auth.currentUser;
            if (!currentUser || !currentUser.email) throw new Error('Oturum bulunamadı');

            // Mevcut şifre ile yeniden kimlik doğrula
            const credential = EmailAuthProvider.credential(currentUser.email, mevcutSifre);
            await reauthenticateWithCredential(currentUser, credential);

            // Yeni şifreyi ayarla
            await updatePassword(currentUser, yeniSifre);

            toast.success('Şifreniz başarıyla değiştirildi!');

            setSifreDegistirme(false);
            setMevcutSifre('');
            setYeniSifre('');
            setYeniSifreTekrar('');
        } catch (error: any) {
            let mesaj = 'Şifre değiştirilemedi.';
            if (error.code === 'auth/wrong-password') {
                mesaj = 'Mevcut şifreniz hatalı.';
            } else if (error.code === 'auth/weak-password') {
                mesaj = 'Yeni şifre çok zayıf.';
            }
            toast.error(mesaj);
        }
        setSifreKaydediyor(false);
    };

    // Çıkış yap
    const cikisYap = async () => {
        const onay = Platform.OS === 'web'
            ? confirm('Çıkış yapmak istediğinize emin misiniz?')
            : await new Promise(resolve => {
                Alert.alert('Çıkış', 'Çıkış yapmak istediğinize emin misiniz?', [
                    { text: 'İptal', onPress: () => resolve(false) },
                    { text: 'Çıkış Yap', onPress: () => resolve(true), style: 'destructive' },
                ]);
            });

        if (onay) {
            await logoutUser();
            router.replace('/login');
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="light-content" />

            {/* Premium Header */}
            <CustomHeader
                title="Profil ve Ayarlar"
                subtitle="Hesabınızı yönetin"
                showSettings={false}
                showBackButton={true}
            />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

                    {/* Profil Kartı */}
                    <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
                        <View style={[styles.avatarContainer, { backgroundColor: rolBilgisi.color + '20' }]}>
                            <Ionicons name={rolBilgisi.icon as any} size={40} color={rolBilgisi.color} />
                        </View>

                        {profilDuzenleme ? (
                            <View style={styles.editForm}>
                                <View style={styles.inputRow}>
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Ad</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                            value={ad}
                                            onChangeText={setAd}
                                            placeholder="Adınız"
                                            placeholderTextColor={colors.textMuted}
                                        />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 8 }}>
                                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Soyad</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                            value={soyad}
                                            onChangeText={setSoyad}
                                            placeholder="Soyadınız"
                                            placeholderTextColor={colors.textMuted}
                                        />
                                    </View>
                                </View>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Telefon</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                    value={telefon}
                                    onChangeText={setTelefon}
                                    placeholder="0532 123 4567"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="phone-pad"
                                />
                                <View style={styles.editButtons}>
                                    <TouchableOpacity
                                        style={[styles.cancelButton, { borderColor: colors.border }]}
                                        onPress={() => {
                                            setProfilDuzenleme(false);
                                            setAd(user?.ad || '');
                                            setSoyad(user?.soyad || '');
                                            setTelefon(user?.telefon || '');
                                        }}
                                    >
                                        <Text style={[styles.cancelButtonText, { color: colors.text }]}>İptal</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.saveButton, { backgroundColor: colors.primary }]}
                                        onPress={profilKaydet}
                                        disabled={profilKaydediyor}
                                    >
                                        {profilKaydediyor ? (
                                            <ActivityIndicator color="#fff" size="small" />
                                        ) : (
                                            <Text style={styles.saveButtonText}>Kaydet</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <>
                                <Text style={[styles.profileName, { color: colors.text }]}>
                                    {user?.ad} {user?.soyad}
                                </Text>
                                <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
                                <View style={[styles.rolBadge, { backgroundColor: rolBilgisi.color + '20' }]}>
                                    <Text style={[styles.rolText, { color: rolBilgisi.color }]}>{rolBilgisi.label}</Text>
                                </View>
                                {user?.telefon && (
                                    <View style={styles.infoRow}>
                                        <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
                                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>{user.telefon}</Text>
                                    </View>
                                )}
                                <TouchableOpacity
                                    style={[styles.editProfileButton, { borderColor: colors.primary }]}
                                    onPress={() => setProfilDuzenleme(true)}
                                >
                                    <Ionicons name="pencil" size={16} color={colors.primary} />
                                    <Text style={[styles.editProfileText, { color: colors.primary }]}>Profili Düzenle</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>

                    {/* Ayarlar Bölümü */}
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>AYARLAR</Text>

                    <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
                        {/* Tema */}
                        <TouchableOpacity style={styles.settingsItem} onPress={toggleTheme}>
                            <View style={styles.settingsLeft}>
                                <View style={[styles.settingsIcon, { backgroundColor: isDark ? '#6366f1' : '#f59e0b' }]}>
                                    <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color="#fff" />
                                </View>
                                <Text style={[styles.settingsText, { color: colors.text }]}>Karanlık Mod</Text>
                            </View>
                            <View style={[styles.toggle, { backgroundColor: isDark ? '#6366f1' : '#e5e7eb' }]}>
                                <View style={[styles.toggleCircle, { transform: [{ translateX: isDark ? 20 : 0 }] }]} />
                            </View>
                        </TouchableOpacity>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        {/* Şifre Değiştir */}
                        <TouchableOpacity style={styles.settingsItem} onPress={() => setSifreDegistirme(!sifreDegistirme)}>
                            <View style={styles.settingsLeft}>
                                <View style={[styles.settingsIcon, { backgroundColor: '#10b981' }]}>
                                    <Ionicons name="lock-closed" size={20} color="#fff" />
                                </View>
                                <Text style={[styles.settingsText, { color: colors.text }]}>Şifre Değiştir</Text>
                            </View>
                            <Ionicons name={sifreDegistirme ? 'chevron-up' : 'chevron-forward'} size={20} color={colors.textMuted} />
                        </TouchableOpacity>

                        {sifreDegistirme && (
                            <View style={styles.passwordForm}>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                    placeholder="Mevcut Şifre"
                                    placeholderTextColor={colors.textMuted}
                                    value={mevcutSifre}
                                    onChangeText={setMevcutSifre}
                                    secureTextEntry
                                />
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                    placeholder="Yeni Şifre"
                                    placeholderTextColor={colors.textMuted}
                                    value={yeniSifre}
                                    onChangeText={setYeniSifre}
                                    secureTextEntry
                                />
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                                    placeholder="Yeni Şifre (Tekrar)"
                                    placeholderTextColor={colors.textMuted}
                                    value={yeniSifreTekrar}
                                    onChangeText={setYeniSifreTekrar}
                                    secureTextEntry
                                />
                                <TouchableOpacity
                                    style={[styles.changePasswordButton, { backgroundColor: '#10b981' }]}
                                    onPress={sifreDegistir}
                                    disabled={sifreKaydediyor}
                                >
                                    {sifreKaydediyor ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.changePasswordText}>Şifreyi Güncelle</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        {/* Bildirimler */}
                        <View style={styles.settingsItem}>
                            <View style={styles.settingsLeft}>
                                <View style={[styles.settingsIcon, { backgroundColor: '#8b5cf6' }]}>
                                    <Ionicons name="notifications" size={20} color="#fff" />
                                </View>
                                <Text style={[styles.settingsText, { color: colors.text }]}>Bildirimler</Text>
                            </View>
                            <View style={[styles.toggle, { backgroundColor: '#8b5cf6' }]}>
                                <View style={[styles.toggleCircle, { transform: [{ translateX: 20 }] }]} />
                            </View>
                        </View>
                    </View>

                    {/* Çıkış */}
                    <TouchableOpacity style={[styles.logoutButton, { backgroundColor: '#ef4444' }]} onPress={cikisYap}>
                        <Ionicons name="log-out-outline" size={22} color="#fff" />
                        <Text style={styles.logoutText}>Çıkış Yap</Text>
                    </TouchableOpacity>

                    {/* Uygulama Bilgisi */}
                    <View style={styles.appInfo}>
                        <Text style={[styles.appName, { color: colors.textMuted }]}>DNA DESTEK</Text>
                        <Text style={[styles.appVersion, { color: colors.textMuted }]}>Versiyon 1.0.0</Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    // header: ... (removed as it is in CustomHeader)
    content: { flex: 1, padding: 20 },

    // Profil Kartı
    profileCard: {
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        marginBottom: 24,
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    profileName: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
    profileEmail: { fontSize: 14, marginBottom: 12 },
    rolBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
    rolText: { fontSize: 13, fontWeight: '600' },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    infoText: { marginLeft: 8, fontSize: 14 },
    editProfileButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        marginTop: 16,
    },
    editProfileText: { marginLeft: 8, fontSize: 14, fontWeight: '600' },

    // Profil Düzenleme
    editForm: { width: '100%', marginTop: 16 },
    inputRow: { flexDirection: 'row' },
    inputLabel: { fontSize: 12, fontWeight: '500', marginBottom: 6 },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        marginBottom: 12,
    },
    editButtons: { flexDirection: 'row', marginTop: 8 },
    cancelButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        marginRight: 8,
    },
    cancelButtonText: { fontWeight: '600' },
    saveButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginLeft: 8,
    },
    saveButtonText: { color: '#fff', fontWeight: '600' },

    // Ayarlar
    sectionTitle: { fontSize: 12, fontWeight: '600', marginBottom: 12, marginLeft: 4, letterSpacing: 1 },
    settingsCard: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: 24,
    },
    settingsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    settingsLeft: { flexDirection: 'row', alignItems: 'center' },
    settingsIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    settingsText: { fontSize: 16, fontWeight: '500' },
    toggle: {
        width: 48,
        height: 28,
        borderRadius: 14,
        padding: 4,
    },
    toggleCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#fff',
    },
    divider: { height: 1, marginHorizontal: 16 },

    // Şifre formu
    passwordForm: { paddingHorizontal: 16, paddingBottom: 16 },
    changePasswordButton: {
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 4,
    },
    changePasswordText: { color: '#fff', fontWeight: '600', fontSize: 15 },

    // Çıkış
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 14,
        marginBottom: 24,
    },
    logoutText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 10 },

    // Uygulama bilgisi
    appInfo: { alignItems: 'center', paddingBottom: 40 },
    appName: { fontSize: 14, fontWeight: '600' },
    appVersion: { fontSize: 12, marginTop: 4 },
});
