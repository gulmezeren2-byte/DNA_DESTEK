import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Talep } from '../types';

interface ChatSectionProps {
    talepId: string;
    yorumlar?: Talep['yorumlar'];
    currentUserId?: string;
    userRole?: string; // 'yonetim' | 'teknisyen' | 'musteri'
    isClosed?: boolean;
    onSend: (mesaj: string) => Promise<void>;
}

export default function ChatSection({
    talepId,
    yorumlar,
    currentUserId,
    userRole,
    isClosed,
    onSend
}: ChatSectionProps) {
    const { colors, isDark } = useTheme();
    const [yeniYorum, setYeniYorum] = useState('');
    const [islemYukleniyor, setIslemYukleniyor] = useState(false);

    const handleSend = async () => {
        if (!yeniYorum.trim()) return;
        setIslemYukleniyor(true);
        try {
            await onSend(yeniYorum);
            setYeniYorum('');
        } catch (error) {
            console.error("Mesaj gönderme hatası:", error);
        } finally {
            setIslemYukleniyor(false);
        }
    };

    const formatDate = (dateVal: any) => {
        if (!dateVal) return '';
        try {
            // Handle Firestore Timestamp or Date
            const date = dateVal.seconds ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
            return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    };

    return (
        <View style={styles.container}>
            <Text style={[styles.title, { color: colors.text }]}>💬 Mesajlar</Text>

            <View style={[styles.chatContainer, { backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5', borderColor: colors.border }]}>
                {(!yorumlar || yorumlar.length === 0) ? (
                    <View style={styles.emptyChat}>
                        <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>Henüz mesaj yok.</Text>
                    </View>
                ) : (
                    yorumlar.map((mesaj, idx) => {
                        const isMe = mesaj.yazanId === currentUserId;
                        // Technician and Admin are considered "Staff" for styling purposes usually, 
                        // but here we strictly check "isMe" for alignment.
                        // However, usually right side is "Me". 

                        return (
                            <View key={idx} style={[
                                styles.messageBubble,
                                isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
                                { backgroundColor: isMe ? colors.primary : (isDark ? '#333' : '#e0e0e0') }
                            ]}>
                                <View style={styles.messageHeader}>
                                    <Text style={[styles.messageAuthor, { color: isMe ? 'rgba(255,255,255,0.9)' : colors.textSecondary }]}>
                                        {mesaj.yazanAdi}
                                    </Text>
                                    {mesaj.yazanRol && (
                                        <Text style={[
                                            styles.messageRoleBadge,
                                            {
                                                backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : (isDark ? '#00000040' : '#00000010'),
                                                color: isMe ? '#fff' : colors.textMuted,
                                                fontSize: 9
                                            }
                                        ]}>
                                            {mesaj.yazanRol.toUpperCase()}
                                        </Text>
                                    )}
                                </View>

                                <Text style={[styles.messageText, { color: isMe ? '#fff' : (isDark ? '#fff' : '#000') }]}>
                                    {mesaj.mesaj}
                                </Text>

                                <Text style={[styles.messageTime, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.textMuted }]}>
                                    {formatDate(mesaj.tarih)}
                                </Text>
                            </View>
                        );
                    })
                )}
            </View>

            {/* Mesaj Input - Inline */}
            {!isClosed && (
                <View style={styles.inputContainer}>
                    <TextInput
                        style={[styles.miniInput, { backgroundColor: isDark ? '#333' : '#fff', color: colors.text, borderColor: colors.border }]}
                        placeholder="Mesaj yazın..."
                        placeholderTextColor={colors.textMuted}
                        value={yeniYorum}
                        onChangeText={setYeniYorum}
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, { backgroundColor: colors.primary, opacity: (!yeniYorum.trim() || islemYukleniyor) ? 0.5 : 1 }]}
                        onPress={handleSend}
                        disabled={!yeniYorum.trim() || islemYukleniyor}
                    >
                        {islemYukleniyor ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="send" size={18} color="#fff" />
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Gönder</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 20
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12
    },
    chatContainer: {
        minHeight: 150,
        maxHeight: 300,
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        marginBottom: 12,
        // ScrollView handled by parent usually, but here we might need a nested scroll or just map. 
        // Mapping is safer for nested Modals.
    },
    emptyChat: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
    },
    emptyChatText: {
        fontStyle: 'italic'
    },
    messageBubble: {
        padding: 10,
        borderRadius: 12,
        marginBottom: 8,
        maxWidth: '85%',
        alignSelf: 'flex-start'
    },
    messageBubbleMe: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 2
    },
    messageBubbleOther: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 2
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
        gap: 8
    },
    messageAuthor: {
        fontSize: 11,
        fontWeight: 'bold'
    },
    messageRoleBadge: {
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
        overflow: 'hidden'
    },
    messageText: {
        fontSize: 14,
        lineHeight: 20
    },
    messageTime: {
        fontSize: 10,
        alignSelf: 'flex-end',
        marginTop: 4
    },
    inputContainer: {
        flexDirection: 'column', // Changed to column as per recent design requests
        gap: 10
    },
    miniInput: {
        height: 80, // Taller for multiline
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        textAlignVertical: 'top'
    },
    sendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12
    }
});
