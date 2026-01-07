import React, { type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ScreenContainer({ children }: { children: ReactNode }) {
  return <SafeAreaView style={styles.container}>{children}</SafeAreaView>;
}

export default function ScreenContainerRoute() {
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050016',
    paddingTop: 16,
  },
});
