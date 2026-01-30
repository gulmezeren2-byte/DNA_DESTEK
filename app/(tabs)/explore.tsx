import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, getDocs, Timestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebaseConfig';

interface Blok {
  ad: string;
  daireler: string[];
}

interface Proje {
  id: string;
  ad: string;
  bloklar: Blok[];
  aktif: boolean;
}

export default function ProjeYonetimi() {
  const { user, isYonetim, logout } = useAuth();
  const router = useRouter();

  const [projeler, setProjeler] = useState<Proje[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  // Modal states
  const [projeModalVisible, setProjeModalVisible] = useState(false);
  const [blokModalVisible, setBlokModalVisible] = useState(false);
  const [daireModalVisible, setDaireModalVisible] = useState(false);

  // Form states
  const [yeniProjeAdi, setYeniProjeAdi] = useState('');
  const [yeniBlokAdi, setYeniBlokAdi] = useState('');
  const [daireBas, setDaireBas] = useState('1');
  const [daireSon, setDaireSon] = useState('10');

  // Seçili öğeler
  const [seciliProje, setSeciliProje] = useState<Proje | null>(null);
  const [seciliBlok, setSeciliBlok] = useState<Blok | null>(null);
  const [expandedProje, setExpandedProje] = useState<string | null>(null);

  // Yönetim değilse yönlendir
  useEffect(() => {
    if (!isYonetim && !yukleniyor) {
      Alert.alert('Yetkisiz Erişim', 'Bu sayfaya erişim yetkiniz yok.');
      router.replace('/(tabs)');
    }
  }, [isYonetim, yukleniyor]);

  // Projeleri yükle
  const projeleriYukle = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'projeler'));
      const data: Proje[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Proje);
      });
      setProjeler(data);
    } catch (error) {
      console.error('Proje yükleme hatası:', error);
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    projeleriYukle();
  }, []);

  // Yeni proje ekle
  const projeEkle = async () => {
    if (!yeniProjeAdi.trim()) {
      Alert.alert('Hata', 'Proje adı boş olamaz');
      return;
    }

    try {
      await addDoc(collection(db, 'projeler'), {
        ad: yeniProjeAdi.trim(),
        bloklar: [],
        aktif: true,
        olusturmaTarihi: Timestamp.now()
      });

      Alert.alert('Başarılı', 'Proje eklendi');
      setYeniProjeAdi('');
      setProjeModalVisible(false);
      projeleriYukle();
    } catch (error: any) {
      Alert.alert('Hata', error.message);
    }
  };

  // Proje sil
  const projeSil = async (proje: Proje) => {
    // Web için window.confirm, mobil için Alert
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`"${proje.ad}" projesini silmek istediğinizden emin misiniz?`)
      : await new Promise((resolve) => {
        Alert.alert(
          'Proje Sil',
          `"${proje.ad}" projesini silmek istediğinizden emin misiniz?`,
          [
            { text: 'İptal', onPress: () => resolve(false) },
            { text: 'Sil', style: 'destructive', onPress: () => resolve(true) }
          ]
        );
      });

    if (confirmed) {
      try {
        await deleteDoc(doc(db, 'projeler', proje.id));
        projeleriYukle();
        if (Platform.OS === 'web') {
          alert('Proje silindi!');
        }
      } catch (error: any) {
        if (Platform.OS === 'web') {
          alert('Hata: ' + error.message);
        } else {
          Alert.alert('Hata', error.message);
        }
      }
    }
  };

  // Blok ekle
  const blokEkle = async () => {
    if (!yeniBlokAdi.trim() || !seciliProje) {
      Alert.alert('Hata', 'Blok adı boş olamaz');
      return;
    }

    try {
      const yeniBloklar = [...seciliProje.bloklar, { ad: yeniBlokAdi.trim(), daireler: [] }];
      await updateDoc(doc(db, 'projeler', seciliProje.id), { bloklar: yeniBloklar });

      Alert.alert('Başarılı', 'Blok eklendi');
      setYeniBlokAdi('');
      setBlokModalVisible(false);
      projeleriYukle();
    } catch (error: any) {
      Alert.alert('Hata', error.message);
    }
  };

  // Blok sil
  const blokSil = async (proje: Proje, blokAdi: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`"${blokAdi}" bloğunu silmek istediğinizden emin misiniz?`)
      : await new Promise((resolve) => {
        Alert.alert(
          'Blok Sil',
          `"${blokAdi}" bloğunu silmek istediğinizden emin misiniz?`,
          [
            { text: 'İptal', onPress: () => resolve(false) },
            { text: 'Sil', style: 'destructive', onPress: () => resolve(true) }
          ]
        );
      });

    if (confirmed) {
      try {
        const yeniBloklar = proje.bloklar.filter(b => b.ad !== blokAdi);
        await updateDoc(doc(db, 'projeler', proje.id), { bloklar: yeniBloklar });
        projeleriYukle();
      } catch (error: any) {
        if (Platform.OS === 'web') {
          alert('Hata: ' + error.message);
        } else {
          Alert.alert('Hata', error.message);
        }
      }
    }
  };

  // Daire ekle (aralık olarak)
  const daireEkle = async () => {
    if (!seciliProje || !seciliBlok) return;

    const bas = parseInt(daireBas);
    const son = parseInt(daireSon);

    if (isNaN(bas) || isNaN(son) || bas > son) {
      Alert.alert('Hata', 'Geçerli daire numaraları girin');
      return;
    }

    try {
      // Yeni daireleri oluştur
      const yeniDaireler: string[] = [];
      for (let i = bas; i <= son; i++) {
        yeniDaireler.push(i.toString());
      }

      // Mevcut dairelerle birleştir (tekrar olmayanları)
      const mevcutDaireler = seciliBlok.daireler || [];
      const tumDaireler = [...new Set([...mevcutDaireler, ...yeniDaireler])].sort((a, b) => parseInt(a) - parseInt(b));

      // Blokları güncelle
      const yeniBloklar = seciliProje.bloklar.map(b =>
        b.ad === seciliBlok.ad ? { ...b, daireler: tumDaireler } : b
      );

      await updateDoc(doc(db, 'projeler', seciliProje.id), { bloklar: yeniBloklar });

      Alert.alert('Başarılı', `${yeniDaireler.length} daire eklendi`);
      setDaireModalVisible(false);
      projeleriYukle();
    } catch (error: any) {
      Alert.alert('Hata', error.message);
    }
  };

  // Çıkış yap
  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Çıkış yapmak istediğinizden emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => logout() }
    ]);
  };

  if (yukleniyor) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a73e8" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Proje Yönetimi</Text>
            <Text style={styles.headerSubtitle}>Proje, Blok ve Daire Ekle</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Proje Ekle Butonu */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setProjeModalVisible(true)}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Yeni Proje Ekle</Text>
        </TouchableOpacity>

        {/* Projeler Listesi */}
        {projeler.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>Henüz proje eklenmemiş</Text>
          </View>
        ) : (
          projeler.map((proje) => (
            <View key={proje.id} style={styles.projeCard}>
              {/* Proje Başlığı */}
              <TouchableOpacity
                style={styles.projeHeader}
                onPress={() => setExpandedProje(expandedProje === proje.id ? null : proje.id)}
              >
                <View style={styles.projeInfo}>
                  <Ionicons name="business" size={24} color="#1a73e8" />
                  <Text style={styles.projeAdi}>{proje.ad}</Text>
                </View>
                <View style={styles.projeActions}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => {
                      setSeciliProje(proje);
                      setBlokModalVisible(true);
                    }}
                  >
                    <Ionicons name="add" size={20} color="#1a73e8" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => projeSil(proje)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                  </TouchableOpacity>
                  <Ionicons
                    name={expandedProje === proje.id ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#666"
                  />
                </View>
              </TouchableOpacity>

              {/* Bloklar */}
              {expandedProje === proje.id && (
                <View style={styles.bloklarContainer}>
                  {proje.bloklar.length === 0 ? (
                    <Text style={styles.blokEmpty}>Blok eklenmemiş</Text>
                  ) : (
                    proje.bloklar.map((blok, index) => (
                      <View key={index} style={styles.blokItem}>
                        <View style={styles.blokInfo}>
                          <Ionicons name="cube-outline" size={18} color="#666" />
                          <Text style={styles.blokAdi}>{blok.ad}</Text>
                          <Text style={styles.daireSayisi}>({blok.daireler?.length || 0} daire)</Text>
                        </View>
                        <View style={styles.blokActions}>
                          <TouchableOpacity
                            style={styles.miniButton}
                            onPress={() => {
                              setSeciliProje(proje);
                              setSeciliBlok(blok);
                              setDaireModalVisible(true);
                            }}
                          >
                            <Text style={styles.miniButtonText}>+ Daire</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => blokSil(proje, blok.ad)}>
                            <Ionicons name="close-circle" size={22} color="#e74c3c" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          ))
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Proje Ekleme Modal */}
      <Modal visible={projeModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Yeni Proje Ekle</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Proje adı (örn: DNA Residence)"
              value={yeniProjeAdi}
              onChangeText={setYeniProjeAdi}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setProjeModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={projeEkle}
              >
                <Text style={styles.modalButtonConfirmText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Blok Ekleme Modal */}
      <Modal visible={blokModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Blok Ekle</Text>
            <Text style={styles.modalSubtitle}>{seciliProje?.ad}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Blok adı (örn: A Blok)"
              value={yeniBlokAdi}
              onChangeText={setYeniBlokAdi}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setBlokModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={blokEkle}
              >
                <Text style={styles.modalButtonConfirmText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Daire Ekleme Modal */}
      <Modal visible={daireModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Daire Ekle</Text>
            <Text style={styles.modalSubtitle}>{seciliProje?.ad} - {seciliBlok?.ad}</Text>
            <Text style={styles.modalLabel}>Daire numaraları aralığı:</Text>
            <View style={styles.rangeInputs}>
              <TextInput
                style={[styles.modalInput, styles.rangeInput]}
                placeholder="Başlangıç"
                value={daireBas}
                onChangeText={setDaireBas}
                keyboardType="number-pad"
              />
              <Text style={styles.rangeSeparator}>-</Text>
              <TextInput
                style={[styles.modalInput, styles.rangeInput]}
                placeholder="Bitiş"
                value={daireSon}
                onChangeText={setDaireSon}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setDaireModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={daireEkle}
              >
                <Text style={styles.modalButtonConfirmText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#1a73e8',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
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
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27ae60',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    marginTop: 10,
  },
  projeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  projeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  projeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projeAdi: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  projeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginRight: 5,
  },
  bloklarContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 15,
    backgroundColor: '#fafafa',
  },
  blokEmpty: {
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  blokItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  blokInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blokAdi: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  daireSayisi: {
    fontSize: 12,
    color: '#888',
    marginLeft: 5,
  },
  blokActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniButton: {
    backgroundColor: '#e8f4fc',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 10,
  },
  miniButtonText: {
    color: '#1a73e8',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 25,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 15,
  },
  rangeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rangeInput: {
    flex: 1,
    textAlign: 'center',
  },
  rangeSeparator: {
    fontSize: 20,
    color: '#666',
    marginHorizontal: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    marginLeft: 10,
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonConfirm: {
    backgroundColor: '#1a73e8',
  },
  modalButtonCancelText: {
    color: '#666',
    fontWeight: '600',
  },
  modalButtonConfirmText: {
    color: '#fff',
    fontWeight: '600',
  },
});
