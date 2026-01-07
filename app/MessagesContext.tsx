import React, { createContext, useContext, useState, type ReactNode } from 'react';

export type MobileMessage = {
  id: string;
  fromMe: boolean;
  text: string;
  createdAt: number;
};

export type MobileMessagesState = Record<string, MobileMessage[]>;

type MessagesContextValue = {
  messagesByMatch: MobileMessagesState;
  addMessage: (matchId: string, message: MobileMessage) => void;
};

const MessagesContext = createContext<MessagesContextValue | undefined>(undefined);

export const MessagesProvider = ({ children }: { children: ReactNode }) => {
  const [messagesByMatch, setMessagesByMatch] = useState<MobileMessagesState>({});

  const addMessage = (matchId: string, message: MobileMessage) => {
    setMessagesByMatch((prev) => ({
      ...prev,
      [matchId]: [...(prev[matchId] ?? []), message],
    }));
  };

  return (
    <MessagesContext.Provider value={{ messagesByMatch, addMessage }}>
      {children}
    </MessagesContext.Provider>
  );
};

export const useMessages = () => {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error('useMessages must be used within MessagesProvider');
  return ctx;
};

export default function MessagesContextRoute() {
  return null;
}
