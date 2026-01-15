import firestore from '@react-native-firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../AuthContext';
import { useMessages, type MobileMessage } from '../MessagesContext';
import { useNotifications } from '../NotificationsContext';
import { ScreenContainer } from '../ScreenContainer';

type MatchItem = {
  id: string;
  name: string;
  otherUid?: string;
  lastMessageAt?: number;
};

const MOCK_NAME_BY_UID: Record<string, string> = {
  'mock-1': 'Luna',
  'mock-2': 'Rian',
  'mock-3': 'Maya',
  'mock-4': 'Alex',
  'mock-5': 'Elif',
};

export default function MessagesScreen() {
  const [selectedId, setSelectedId] = useState<string>('');
  const [userSelected, setUserSelected] = useState(false);
  const { messagesByMatch } = useMessages();
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<MobileMessage> | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { unreadMessages, setUnreadMessages } = useNotifications();
  const [readMatches, setReadMatches] = useState<Record<string, boolean>>({});
  const { firebaseUser } = useAuth();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [remoteMessages, setRemoteMessages] = useState<MobileMessage[]>([]);
  const [readReceiptByMatch, setReadReceiptByMatch] = useState<Record<string, number>>({});
  const warnedRef = useRef<Record<string, boolean>>({});
  const DEBUG_LOGS = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_LOGS === '1';

  // Firestore'dan bu kullanıcının eşleşmelerini dinle
  useEffect(() => {
    if (!firebaseUser) return;

    const matchesRef = firestore().collection('matches');
    const qUsers = matchesRef.where('users', 'array-contains', firebaseUser.uid);
    const qUserIds = matchesRef.where('userIds', 'array-contains', firebaseUser.uid);
    const qUserA = matchesRef.where('userA', '==', firebaseUser.uid);
    const qUserB = matchesRef.where('userB', '==', firebaseUser.uid);

    const mapDocToItem = (docSnap: any): MatchItem => {
      const data = docSnap.data() as {
        name?: string;
        lastMessageAt?: number;
        userNames?: Record<string, string>;
        users?: string[];
        userIds?: string[];
        userA?: string;
        userB?: string;
      };

      const otherUid =
        (Array.isArray(data.users) ? data.users.find((uid) => uid !== firebaseUser.uid) : null) ??
        (Array.isArray(data.userIds) ? data.userIds.find((uid) => uid !== firebaseUser.uid) : null) ??
        (data.userA && data.userB
          ? data.userA === firebaseUser.uid
            ? data.userB
            : data.userA
          : null);

      // Şimdilik basit: eğer userNames varsa, current user dışındaki adı al; yoksa generic name kullan
      let name = 'Match';
      if (data.userNames && firebaseUser.uid in data.userNames) {
        const others = Object.entries(data.userNames).filter(([uid]) => uid !== firebaseUser.uid);
        if (others[0]?.[1]) name = others[0][1];
      } else if (data.name) {
        name = data.name;
      } else if (data.userA && data.userB) {
        const otherUid = data.userA === firebaseUser.uid ? data.userB : data.userA;
        name = MOCK_NAME_BY_UID[otherUid] ?? otherUid;
      }
      return {
        id: docSnap.id,
        name,
        otherUid: otherUid ?? undefined,
        lastMessageAt: data.lastMessageAt,
      };
    };

    const upsertFromSnapshot = (snap: any, label: string) => {
      if (DEBUG_LOGS) {
        // eslint-disable-next-line no-console
        console.log('[matches] snapshot', {
          label,
          uid: firebaseUser.uid,
          size: snap.size,
          ids: snap.docs.map((d: any) => d.id),
        });
      }
      setMatches((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        snap.docs.forEach((d: any) => {
          byId.set(d.id, mapDocToItem(d));
        });
        return Array.from(byId.values());
      });
    };

    let cancelled = false;
    const unsubs: Array<() => void> = [];

    const subscribeQuery = (qAny: any, label: string) => {
      const unsub = qAny.onSnapshot(
        (snap: any) => upsertFromSnapshot(snap, label),
        (err: any) => {
          const code = String((err as any)?.code ?? 'unknown');
          const warnKey = `matches:${code}:${label}`;
          if (cancelled) return;

          if (DEBUG_LOGS && !warnedRef.current[warnKey]) {
            warnedRef.current[warnKey] = true;
            console.warn('matches listener failed', {
              label,
              code,
              message: (err as any)?.message,
              uid: firebaseUser.uid,
            });
          }
        },
      );
      unsubs.push(unsub);
    };

    // Some legacy docs may not have `users` but do have `userIds` or `userA/userB`.
    // Subscribe to all variants and merge snapshots by id.
    subscribeQuery(qUsers, 'users');
    subscribeQuery(qUserIds, 'userIds');
    subscribeQuery(qUserA, 'userA');
    subscribeQuery(qUserB, 'userB');

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [firebaseUser]);

  // Her match için read receipt dinle ve unread sayacını canlı hesapla
  useEffect(() => {
    if (!firebaseUser) return;
    if (!matches.length) {
      setReadReceiptByMatch({});
      setUnreadMessages(0);
      return;
    }

    const unsubs: Array<() => void> = [];

    matches.forEach((m) => {
      const receiptRef = firestore().collection('matches').doc(m.id).collection('readReceipts').doc(firebaseUser.uid);
      const unsub = receiptRef.onSnapshot(
        (snap: any) => {
          const data = snap.data() as { lastReadAt?: any } | undefined;
          const ms =
            typeof data?.lastReadAt?.toMillis === 'function'
              ? data?.lastReadAt.toMillis()
              : typeof data?.lastReadAt === 'number'
                ? data.lastReadAt
                : 0;
          setReadReceiptByMatch((prev) => ({ ...prev, [m.id]: ms }));
        },
        () => {
          setReadReceiptByMatch((prev) => ({ ...prev, [m.id]: prev[m.id] ?? 0 }));
        },
      );
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseUser, matches, setUnreadMessages]);

  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const count = matches.reduce((acc, m) => {
      const lastMessageAt = m.lastMessageAt ?? 0;
      const lastReadAt = readReceiptByMatch[m.id] ?? 0;
      const lastFrom = (m as any).lastMessageFrom as string | undefined;
      const unread = lastMessageAt > lastReadAt && !!lastFrom && lastFrom !== uid;
      return acc + (unread ? 1 : 0);
    }, 0);
    setUnreadMessages(count);
  }, [firebaseUser, matches, readReceiptByMatch, setUnreadMessages]);

  // Eşleşmeleri son mesaja göre sırala (backend'deki lastMessageAt veya local mesajlar)
  const sortedMatches = [...matches].sort((a, b) => {
    const backendALast = a.lastMessageAt ?? 0;
    const backendBLast = b.lastMessageAt ?? 0;

    // Eğer backend'de timestamp yoksa, local mesajlardan tahmin et
    const aMsgs = messagesByMatch[a.id] ?? [];
    const bMsgs = messagesByMatch[b.id] ?? [];
    const localALast = aMsgs[aMsgs.length - 1]?.createdAt ?? 0;
    const localBLast = bMsgs[bMsgs.length - 1]?.createdAt ?? 0;

    const aLast = backendALast || localALast;
    const bLast = backendBLast || localBLast;
    return bLast - aLast;
  });

  // Kullanıcı manuel seçim yapmadıysa en güncel sohbeti otomatik seç
  useEffect(() => {
    if (!firebaseUser) return;
    if (!sortedMatches.length) return;
    if (userSelected && selectedId) return;
    if (selectedId === sortedMatches[0].id) return;
    setSelectedId(sortedMatches[0].id);
  }, [firebaseUser, selectedId, sortedMatches, userSelected]);

  const currentMatch = sortedMatches.find((m) => m.id === selectedId) ?? null;
  const currentMessages = remoteMessages;

  // Seçili match'in mesajlarını Firestore'dan canlı dinle
  useEffect(() => {
    if (!firebaseUser || !selectedId) {
      setRemoteMessages([]);
      return;
    }

    const qMsgs = firestore()
      .collection('matches')
      .doc(selectedId)
      .collection('messages')
      .orderBy('createdAt', 'asc');

    const unsub = qMsgs.onSnapshot(
      (snap: any) => {
        const docs: MobileMessage[] = snap.docs.map((d: any) => {
          const data = d.data() as { from?: string; text?: string; createdAt?: any };
          const createdAtMs =
            typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : Date.now();
          return {
            id: d.id,
            fromMe: (data.from ?? '') === firebaseUser.uid,
            text: String(data.text ?? ''),
            createdAt: createdAtMs,
          };
        });
        setRemoteMessages(docs);

        // Bu sohbeti okundu say
        const receiptRef = firestore()
          .collection('matches')
          .doc(selectedId)
          .collection('readReceipts')
          .doc(firebaseUser.uid);
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        receiptRef.set({ lastReadAt: Date.now() }, { merge: true }).catch((e: any) => {
          if (DEBUG_LOGS) {
            console.warn('Failed to write readReceipt', {
              code: e?.code,
              message: e?.message,
              matchId: selectedId,
              uid: firebaseUser.uid,
            });
          }
        });
      },
      (err: any) => {
        if (DEBUG_LOGS) {
          const code = String(err?.code ?? 'unknown');
          const warnKey = `messages:${selectedId}:${code}`;
          if (!warnedRef.current[warnKey]) {
            warnedRef.current[warnKey] = true;
            console.warn('messages listener failed', {
              code,
              message: err?.message,
              uid: firebaseUser.uid,
              matchId: selectedId,
            });
          }
        }
      },
    );

    return () => unsub();
  }, [firebaseUser, selectedId]);

  const handleSend = () => {
    if (!input.trim() || !selectedId || !firebaseUser) return;

    const text = input.trim();
    setInput('');
    setIsTyping(false);

    // Firestore'a yaz
    (async () => {
      try {
        const myUid = firebaseUser.uid;
        const otherUid = currentMatch?.otherUid ?? null;
        if (!otherUid) throw new Error('MATCH_OTHER_UID_NOT_FOUND');

        const matchRef = firestore().collection('matches').doc(selectedId);
        const msgRef = matchRef.collection('messages').doc();
        const batch = firestore().batch();

        batch.set(
          matchRef,
          {
            userA: myUid,
            userB: otherUid,
            users: [myUid, otherUid],
            userIds: [myUid, otherUid],
            userNames: {
              [myUid]: 'You',
              [otherUid]: String(currentMatch?.name ?? 'Match'),
            },
            createdAt: firestore.FieldValue.serverTimestamp(),
            lastMessageAt: Date.now(),
            lastMessageFrom: myUid,
          },
          { merge: true },
        );

        batch.set(msgRef, {
          from: myUid,
          text,
          users: [myUid, otherUid],
          userIds: [myUid, otherUid],
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

        await batch.commit();
      } catch (e) {
        if (DEBUG_LOGS) {
          console.warn('Failed to send message', {
            code: (e as any)?.code,
            message: (e as any)?.message,
            matchId: selectedId,
            uid: firebaseUser.uid,
          });
        }
      }
    })();
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={styles.innerRow}>
          {/* Sol: matches sütunu */}
          <View style={styles.matchesColumn}>
          <Text style={styles.matchesTitle}>Matches</Text>
          <FlatList
            data={sortedMatches}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const active = item.id === selectedId;
              return (
                <TouchableOpacity
                  style={[styles.matchItem, active && styles.matchItemActive]}
                  onPress={() => {
                    // Bu kullanıcı için unread'i ilk kez temizle
                    if (!readMatches[item.id]) {
                      const msgs = messagesByMatch[item.id] ?? [];
                      const unreadForThis = msgs.filter((m) => !m.fromMe).length;
                      if (unreadForThis > 0) {
                        const next = Math.max(0, unreadMessages - unreadForThis);
                        setUnreadMessages(next);
                      }
                      setReadMatches((prev) => ({ ...prev, [item.id]: true }));
                    }
                    setUserSelected(true);
                    setSelectedId(item.id);
                  }}
                >
                  <View style={styles.matchAvatar}>
                    <Text style={styles.matchAvatarText}>{item.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.matchTextCol}>
                    <Text style={styles.matchName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.matchSub} numberOfLines={1}>
                      Istanbul, TR
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Sağ: sohbet alanı */}
        <View style={styles.chatColumn}>
          {!currentMatch ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                Sohbetleri görmek için soldan bir eşleşme seç.
              </Text>
            </View>
          ) : (
            <>
              {/* header */}
              <View style={styles.chatHeader}>
                <Text style={styles.chatTitle}>{currentMatch.name}</Text>
                <Text style={styles.chatSubtitle}>Istanbul, TR</Text>
              </View>

              {/* messages */}
              <FlatList
                ref={listRef}
                style={styles.messagesList}
                contentContainerStyle={styles.messagesContent}
                data={currentMessages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.bubbleRow,
                      item.fromMe ? styles.bubbleRowMe : styles.bubbleRowThem,
                    ]}
                  >
                    <View
                      style={[styles.bubble, item.fromMe ? styles.bubbleMe : styles.bubbleThem]}
                    >
                      <Text style={styles.bubbleText}>{item.text}</Text>
                      <Text style={styles.bubbleMeta}>{new Date(item.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                  </View>
                )}
                onContentSizeChange={() => {
                  if (listRef.current) {
                    listRef.current.scrollToEnd({ animated: true });
                  }
                }}
              />

              {/* input */}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={(text) => {
                    setInput(text);
                    setIsTyping(true);
                    if (typingTimeoutRef.current) {
                      clearTimeout(typingTimeoutRef.current);
                    }
                    typingTimeoutRef.current = setTimeout(() => {
                      setIsTyping(false);
                    }, 1500);
                  }}
                  placeholder="Mesaj yaz..."
                  placeholderTextColor="#6b7280"
                />
                <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                  <Text style={styles.sendText}>Gönder</Text>
                </TouchableOpacity>
              </View>
              {isTyping && (
                <View style={styles.typingRow}>
                  <Text style={styles.typingText}>Yazıyor...</Text>
                </View>
              )}
            </>
          )}
        </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerRow: {
    flex: 1,
    flexDirection: 'row',
  },
  matchesColumn: {
    width: 80,
    paddingVertical: 4,
    paddingHorizontal: 3,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(88,28,135,0.6)',
  },
  matchesTitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#9ca3af',
    marginBottom: 6,
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  matchItemActive: {
    backgroundColor: 'rgba(139,92,246,0.35)',
  },
  matchAvatar: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  matchAvatarText: {
    color: '#e5e7eb',
    fontWeight: '600',
    fontSize: 12,
  },
  matchTextCol: {
    flex: 1,
    minWidth: 0,
  },
  matchName: {
    color: '#e5e7eb',
    fontSize: 11,
    fontWeight: '600',
  },
  matchSub: {
    color: '#9ca3af',
    fontSize: 10,
  },
  chatColumn: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  chatHeader: {
    paddingBottom: 3,
    marginBottom: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(88,28,135,0.6)',
  },
  chatTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  chatSubtitle: {
    fontSize: 11,
    color: '#9ca3af',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  bubbleRow: {
    marginBottom: 4,
    flexDirection: 'row',
  },
  bubbleRowMe: {
    justifyContent: 'flex-end',
  },
  bubbleRowThem: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '55%',
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 8,
  },
  bubbleMe: {
    backgroundColor: '#ec4899',
  },
  bubbleThem: {
    backgroundColor: '#111827',
  },
  bubbleText: {
    color: '#f9fafb',
    fontSize: 12,
  },
  bubbleMeta: {
    marginTop: 1,
    color: '#9ca3af',
    fontSize: 9,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.4)',
    backgroundColor: '#02010b',
  },
  input: {
    flex: 1,
    height: 26,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: '#020617',
    color: '#e5e7eb',
    fontSize: 13,
    marginRight: 8,
  },
  sendButton: {
    paddingHorizontal: 8,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#22d3ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    color: '#020617',
    fontSize: 13,
    fontWeight: '600',
  },
  typingRow: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 4,
  },
  typingText: {
    fontSize: 10,
    color: '#9ca3af',
  },
});
