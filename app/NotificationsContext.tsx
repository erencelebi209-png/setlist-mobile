import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface NotificationsContextValue {
  unreadLikes: number;
  setUnreadLikes: (n: number) => void;
  unreadMessages: number;
  setUnreadMessages: (n: number) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [unreadLikes, setUnreadLikes] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  return (
    <NotificationsContext.Provider
      value={{ unreadLikes, setUnreadLikes, unreadMessages, setUnreadMessages }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
};

export default function NotificationsContextRoute() {
  return null;
}
