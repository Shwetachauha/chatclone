import { useState } from 'react';
import { Box } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Chat, Message } from '@/types';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList } from '@/components/message/MessageList';
import { MessageInput } from '@/components/message/MessageInput';
import { TypingIndicator } from '@/components/presence/TypingIndicator';
import { EmptyState } from '@/components/common/EmptyState';
import { UserProfilePanel } from '@/components/chat/UserProfilePanel';
import { GroupInfoPanel } from '@/components/chat/GroupInfoPanel';
import { useAppSelector } from '@/hooks/useAuth';
import { getOtherUserId } from '@/utils/helpers';

interface ChatWindowProps {
  chat: Chat | null;
  onBack?: () => void;
}

export function ChatWindow({ chat, onBack }: ChatWindowProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const currentUser = useAppSelector((state) => state.auth.user);

  if (!chat) {
    return <EmptyState variant="no-chat-selected" />;
  }

  const otherUserId = !chat.isGroupChat ? getOtherUserId(chat, currentUser?.id || '') : null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={chat.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
      >
        <Box
          display="flex"
          flexDirection="column"
          flex={1}
          minHeight={0}
          overflow="hidden"
          sx={{
            bgcolor: '#1a1a2e',
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(102, 126, 234, 0.04) 0%, transparent 50%),
                              radial-gradient(circle at 80% 50%, rgba(118, 75, 162, 0.04) 0%, transparent 50%)`,
          }}
        >      <ChatHeader
        chat={chat}
        onBack={onBack}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenGroupInfo={() => setGroupInfoOpen(true)}
      />
      <MessageList chatId={chat.id} onReply={setReplyToMessage} onEdit={setEditingMessage} />
      <TypingIndicator chatId={chat.id} />
      <MessageInput
        chatId={chat.id}
        replyToMessage={replyToMessage}
        onCancelReply={() => setReplyToMessage(null)}
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
      />

      {/* Side panels */}
      <UserProfilePanel
        open={profileOpen}
        userId={otherUserId}
        onClose={() => setProfileOpen(false)}
      />
      <GroupInfoPanel
        open={groupInfoOpen}
        chat={chat}
        onClose={() => setGroupInfoOpen(false)}
      />
    </Box>
      </motion.div>
    </AnimatePresence>
  );
}
