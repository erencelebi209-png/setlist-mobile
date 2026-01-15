import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenContainer } from '../ScreenContainer';

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    Alert.alert('Yakında', 'Google ile giriş sonraki adım. Önce telefon OTP’yi bitirelim.');
  };

  const handleApple = async () => {
    Alert.alert('Yakında', 'Apple ile giriş sonraki adım. Önce telefon OTP’yi bitirelim.');
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.title}>Giriş</Text>

        <TouchableOpacity
          style={[styles.button, styles.primary]}
          onPress={() => router.push({ pathname: '/phone' } as any)}
          disabled={loading}
        >
          <Text style={styles.primaryText}>{loading ? '...' : 'Telefon numarası ile giriş'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.secondary]} onPress={handleGoogle} disabled={loading}>
          <Text style={styles.secondaryText}>{loading ? '...' : 'Google ile giriş'}</Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && (
          <TouchableOpacity style={[styles.button, styles.secondary]} onPress={handleApple} disabled={loading}>
            <Text style={styles.secondaryText}>{loading ? '...' : 'Apple ile giriş'}</Text>
          </TouchableOpacity>
        )}
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
});
