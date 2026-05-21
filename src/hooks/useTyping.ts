import { useCallback, useRef } from 'react';
import { useAppSelector } from './useAuth';
import { typingEmitters } from '@/socket/emitters/typingEmitters';
import { selectTypingUsersForChat } from '@/store/selectors/presenceSelectors';

const TYPING_DEBOUNCE_MS = 3000;

export function useTyping(chatId: string) {
  const typingUsers = useAppSelector(selectTypingUsersForChat(chatId));
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const startTyping = useCallback(() => {
    if (!chatId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      typingEmitters.startTyping(chatId);
    }

    // Reset the stop-typing timer
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, TYPING_DEBOUNCE_MS);
  }, [chatId]);

  const stopTyping = useCallback(() => {
    if (!chatId) return;

    if (isTypingRef.current) {
      isTypingRef.current = false;
      typingEmitters.stopTyping(chatId);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [chatId]);

  const getTypingText = useCallback((): string => {
    if (typingUsers.length === 0) return '';
    if (typingUsers.length === 1) return `Someone is typing...`;
    if (typingUsers.length === 2) return `2 people are typing...`;
    return `${typingUsers.length} people are typing...`;
  }, [typingUsers]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
    getTypingText,
  };
}
