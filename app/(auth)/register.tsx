import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { ScreenContainer } from '../ScreenContainer';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Hata', 'Email ve şifre zorunlu.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalı.');
      return;
    }
    if (password !== password2) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }

    try {
      setLoading(true);
      await signUp(email, password);
    } catch (e) {
      Alert.alert('Kayıt başarısız', (e as any)?.message ?? 'Bilinmeyen hata');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.title}>Kayıt ol</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Şifre"
          placeholderTextColor="#64748b"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Şifre (tekrar)"
          placeholderTextColor="#64748b"
          secureTextEntry
          value={password2}
          onChangeText={setPassword2}
          editable={!loading}
        />

        <TouchableOpacity style={[styles.button, styles.primary]} onPress={handleRegister} disabled={loading}>
          <Text style={styles.primaryText}>{loading ? '...' : 'Kayıt ol'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace({ pathname: '/login' } as any)} disabled={loading}>
          <Text style={styles.link}>Zaten hesabın var mı? Giriş yap</Text>
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
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
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
  link: {
    color: '#22d3ee',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
    fontWeight: '600',
  },
});
