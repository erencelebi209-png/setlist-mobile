import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ScreenContainer } from '../ScreenContainer';

export default function PhoneLoginScreen() {
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    const cleaned = phone.trim();
    if (!cleaned) {
      Alert.alert('Hata', 'Telefon numarası zorunlu. (Örn: +905xxxxxxxxx)');
      return;
    }

    if (Platform.OS === 'web') {
      Alert.alert('Desteklenmiyor', 'Telefon OTP şu an sadece Android/iOS development build ile destekleniyor.');
      return;
    }

    try {
      setLoading(true);
      const result = await auth().signInWithPhoneNumber(cleaned);
      setConfirmation(result);
      Alert.alert('Kod gönderildi', 'SMS ile gelen kodu gir.');
    } catch (e) {
      Alert.alert('Kod gönderilemedi', (e as any)?.message ?? 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  };

  const confirmCode = async () => {
    if (!confirmation) return;
    if (!code.trim()) {
      Alert.alert('Hata', 'Kod zorunlu.');
      return;
    }

    try {
      setLoading(true);
      await confirmation.confirm(code.trim());
      router.back();
    } catch (e) {
      Alert.alert('Kod doğrulanamadı', (e as any)?.message ?? 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.title}>Telefon ile giriş</Text>
        <Text style={styles.subtitle}>Numarayı başında ülke kodu ile yaz. Örn: +905xxxxxxxxx</Text>

        <TextInput
          style={styles.input}
          placeholder="Telefon (+90...)"
          placeholderTextColor="#64748b"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          editable={!loading && !confirmation}
        />

        {!confirmation ? (
          <TouchableOpacity style={[styles.button, styles.primary]} onPress={sendCode} disabled={loading}>
            <Text style={styles.primaryText}>{loading ? '...' : 'Kod gönder'}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="SMS kodu"
              placeholderTextColor="#64748b"
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
              editable={!loading}
            />

            <TouchableOpacity style={[styles.button, styles.primary]} onPress={confirmCode} disabled={loading}>
              <Text style={styles.primaryText}>{loading ? '...' : 'Doğrula ve giriş yap'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondary]}
              onPress={() => {
                setConfirmation(null);
                setCode('');
              }}
              disabled={loading}
            >
              <Text style={styles.secondaryText}>{loading ? '...' : 'Kod tekrar gönder'}</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={() => router.back()} disabled={loading}>
          <Text style={styles.link}>Geri</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  title: {
    color: '#e5e7eb',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 14,
  },
  input: {
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderColor: 'rgba(148,163,184,0.35)',
    borderWidth: 1,
    borderRadius: 14,
    color: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  button: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primary: {
    backgroundColor: '#22d3ee',
  },
  primaryText: {
    color: '#020617',
    fontSize: 14,
    fontWeight: '700',
  },
  secondary: {
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.9)',
  },
  secondaryText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
  },
  link: {
    color: '#22d3ee',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
    fontWeight: '600',
  },
});
