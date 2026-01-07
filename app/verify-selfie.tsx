import { Camera, CameraView } from 'expo-camera';
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

export default function VerifySelfieScreen() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  // Expo Camera için basit ref, tipi any bırakıyoruz ki TS sorun çıkarmasın
  const cameraRef = useRef<any>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleTakePicture = async () => {
    if (!cameraRef.current || loading) return;
    try {
      setLoading(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      setPhotoUri(photo.uri ?? null);
    } finally {
      setLoading(false);
    }
  };

  const handleSendSelfie = async () => {
    if (!photoUri) return;
    if (!firebaseUser) {
      Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı. Lütfen tekrar deneyin.');
      return;
    }
    // Burada selfie Firebase Storage'a yüklenecek ve backend tarafında incelemeye alınacak.
    // Şimdilik sadece stub: inceleme isteği gönderildi varsayıyoruz.
    console.log('Selfie upload stub, uri:', photoUri);

    try {
      const ref = doc(db, 'users', firebaseUser.uid);
      await setDoc(
        ref,
        {
          verificationStatus: 'pending',
          verificationUpdatedAt: Date.now(),
        },
        { merge: true },
      );
    } catch (e) {
      console.warn('Failed to mark verification as pending', e);
    }
    Alert.alert('Selfie alındı', 'Doğrulama isteğin incelemeye alındı. 1-2 saat içinde sonuçlanacak.');
    router.back();
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.containerCentered}>
        <ActivityIndicator color="#22d3ee" />
        <Text style={styles.infoText}>Kamera izni kontrol ediliyor...</Text>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.containerCentered}>
        <Text style={styles.errorText}>
          Kamera izni verilmedi. Hesabını doğrulamak için ayarlardan kamera izni vermelisin.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Geri dön</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Hesabını doğrula</Text>
      <Text style={styles.subtitle}>
        Ön kameraya bakarak yüzün net görünecek şekilde bir selfie çek. Bu fotoğraf sadece doğrulama için
        kullanılacaktır.
      </Text>

      <View style={styles.cameraWrapper}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.preview} />
        ) : (
          <CameraView
            style={styles.camera}
            facing="front"
            ref={(ref: any) => {
              cameraRef.current = ref;
            }}
          />
        )}
      </View>

      <View style={styles.buttonsRow}>
        {photoUri ? (
          <>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => setPhotoUri(null)}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Tekrar çek</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleSendSelfie}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>Selfie'yi gönder</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleTakePicture}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>Selfie çek</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050016',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  containerCentered: {
    flex: 1,
    backgroundColor: '#050016',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    color: '#e5e7eb',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 12,
  },
  cameraWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#020617',
  },
  camera: {
    flex: 1,
  },
  preview: {
    flex: 1,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 16,
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryButton: {
    backgroundColor: '#22d3ee',
  },
  primaryButtonText: {
    color: '#020617',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.9)',
  },
  secondaryButtonText: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '500',
  },
  infoText: {
    marginTop: 8,
    color: '#9ca3af',
    fontSize: 13,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#22d3ee',
  },
  backBtnText: {
    color: '#020617',
    fontSize: 13,
    fontWeight: '600',
  },
});
