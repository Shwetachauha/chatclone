import { useRef, useEffect, useCallback } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useAppDispatch, useAppSelector } from '@/hooks/useAuth';
import { selectMessagesByChatId, selectMessagesLoading, selectHasMoreMessages } from '@/store/selectors/messageSelectors';
import { fetchMessages, addMessage } from '@/store/slices/messageSlice';
import { messageService } from '@/services/messageService';
import { MessageBubble } from './MessageBubble';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Message } from '@/types';

interface MessageListProps {
  chatId: string;
  onRetry?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
}

export function MessageList({ chatId, onRetry, onDelete, onReply, onEdit }: MessageListProps) {
  const dispatch = useAppDispatch();
  const messages = useAppSelector(selectMessagesByChatId(chatId));
  const isLoading = useAppSelector(selectMessagesLoading(chatId));
  const hasMore = useAppSelector(selectHasMoreMessages(chatId));
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const isAtBottomRef = useRef(true);

  const accessToken = useAppSelector((state) => state.auth.accessToken);

  // Poll for new messages every 10s as fallback for unreliable socket delivery
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(async () => {
      try {
        const response = await messageService.getMessages({ chatId, limit: 20 });
        for (const msg of response.messages) {
          dispatch(addMessage(msg));
        }
      } catch {
        // silent fail - don't trigger logout
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [chatId, dispatch, accessToken]);

  const loadOlderMessages = useCallback(() => {
    if (!hasMore || isLoading) return;
    const chatState = (
      // Access cursor from store directly
      undefined
    );
    void chatState;
    dispatch(fetchMessages({ chatId, limit: 50 }));
  }, [chatId, hasMore, isLoading, dispatch]);

  const handleAtBottomChange = (atBottom: boolean) => {
    isAtBottomRef.current = atBottom;
  };

  if (isLoading && messages.length === 0) {
    return <LoadingSkeleton variant="messages" />;
  }

  if (messages.length === 0) {
    return <EmptyState variant="no-messages" />;
  }

  return (
    <Box flex={1} minHeight={0} overflow="hidden" sx={{ '& ::-webkit-scrollbar': { display: 'none' }, '& *': { scrollbarWidth: 'none' } }}>
      <Virtuoso
        ref={virtuosoRef}
        data={messages as Message[]}
        initialTopMostItemIndex={messages.length - 1}
        followOutput="smooth"
        atBottomStateChange={handleAtBottomChange}
        startReached={loadOlderMessages}
        overscan={200}
        components={{
          Header: () =>
            hasMore ? (
              <Box display="flex" justifyContent="center" py={2}>
                {isLoading ? (
                  <CircularProgress size={20} />
                ) : null}
              </Box>
            ) : null,
        }}
        itemContent={(_index, message) => (
          <MessageBubble
            message={message}
            onRetry={onRetry}
            onDeleteFailed={onDelete}
            onReply={onReply}
            onEdit={onEdit}
          />
        )}
      />
    </Box>
  );
}
