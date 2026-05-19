import { memo, useState, useCallback } from 'react';
import { Box, Typography, IconButton, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import { Replay, Delete, Forward as ForwardIcon } from '@mui/icons-material';
import { Message } from '@/types';
import { MessageStatus } from './MessageStatus';
import { FilePreview } from './FilePreview';
import { MessageActions } from './MessageActions';
import { MessageReactions } from './MessageReactions';
import { EditMessageDialog } from './EditMessageDialog';
import { DeleteMessageDialog } from './DeleteMessageDialog';
import { ForwardMessageDialog } from './ForwardMessageDialog';
import { formatMessageTime } from '@/utils/helpers';
import { useAppSelector, useAppDispatch } from '@/hooks/useAuth';
import { addReaction, removeReaction, editMessageContent, deleteMessage } from '@/store/slices/messageSlice';
import { addMessage } from '@/store/slices/messageSlice';
import { messageEmitters } from '@/socket/emitters/messageEmitters';
import { messageService } from '@/services/messageService';
import { selectMessageById } from '@/store/selectors/messageSelectors';

interface MessageBubbleProps {
  message: Message;
  onRetry?: (messageId: string) => void;
  onDeleteFailed?: (messageId: string) => void;
  onReply?: (message: Message) => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  onRetry,
  onDeleteFailed,
  onReply,
}: MessageBubbleProps) {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const isMine = message.sender.id === currentUser?.id;
  const repliedMessage = useAppSelector(selectMessageById(message.chatId, message.replyTo));

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);

  const handleReact = useCallback((emoji: string) => {
    if (!currentUser) return;
    // Toggle: if user already reacted with same emoji, remove it
    const existing = message.reactions?.find(
      (r) => r.emoji === emoji && r.userId === currentUser.id
    );
    if (existing) {
      dispatch(removeReaction({
        chatId: message.chatId,
        messageId: message.id,
        userId: currentUser.id,
        emoji,
      }));
    } else {
      dispatch(addReaction({
        chatId: message.chatId,
        messageId: message.id,
        emoji,
        userId: currentUser.id,
        username: currentUser.name,
      }));
    }
    // Emit to server for real-time sync
    messageEmitters.reactMessage(message.id, emoji);
  }, [dispatch, currentUser, message.chatId, message.id, message.reactions]);

  const handleEdit = useCallback((newContent: string) => {
    dispatch(editMessageContent({
      chatId: message.chatId,
      messageId: message.id,
      content: newContent,
    }));
    // Emit to server for real-time sync
    messageEmitters.editMessage(message.id, newContent);
  }, [dispatch, message.chatId, message.id]);

  const handleDelete = useCallback(async () => {
    dispatch(deleteMessage({ chatId: message.chatId, messageId: message.id }));
    setDeleteOpen(false);
    try {
      messageEmitters.deleteMessage(message.id);
      await messageService.deleteMessage(message.id);
    } catch {
      // API failed - message already marked deleted locally
    }
  }, [dispatch, message.chatId, message.id]);

  const handleForward = useCallback((targetChatId: string) => {
    if (!currentUser) return;
    const forwardedMsg: Message = {
      id: `msg-fwd-${Date.now()}`,
      chatId: targetChatId,
      sender: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar },
      content: message.content,
      type: message.type,
      status: 'sent',
      readBy: [],
      createdAt: new Date().toISOString(),
      forwardedFrom: {
        chatId: message.chatId,
        chatName: '',
        messageId: message.id,
      },
    };
    dispatch(addMessage(forwardedMsg));
  }, [dispatch, currentUser, message]);

  if (message.isDeleted) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Box
          display="flex"
          justifyContent={isMine ? 'flex-end' : 'flex-start'}
          px={2}
          py={0.5}
        >
          <Typography
            variant="body2"
            fontStyle="italic"
            sx={{ px: 2, py: 1, color: 'rgba(255,255,255,0.35)' }}
          >
            This message was deleted
          </Typography>
        </Box>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <Box
        className="message-row"
        display="flex"
        justifyContent={isMine ? 'flex-end' : 'flex-start'}
        px={2}
        py={0.3}
        sx={{ position: 'relative', overflow: 'visible' }}
      >
      <Box sx={{ position: 'relative', maxWidth: '65%', overflow: 'visible' }}>
        {/* Hover actions bar */}
        <MessageActions
          message={message}
          isMine={isMine}
          onReact={handleReact}
          onEdit={() => setEditOpen(true)}
          onDelete={() => setDeleteOpen(true)}
          onForward={() => setForwardOpen(true)}
          onReply={() => onReply?.(message)}
        />

        <Paper
          elevation={0}
          sx={{
            minWidth: 80,
            px: 1.5,
            py: 1,
            borderRadius: '18px',
            borderTopLeftRadius: isMine ? '18px' : '4px',
            borderTopRightRadius: isMine ? '4px' : '18px',
            bgcolor: isMine
              ? 'transparent'
              : 'rgba(255,255,255,0.06)',
            background: isMine
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : 'rgba(255,255,255,0.06)',
            color: isMine ? '#ffffff' : 'rgba(255,255,255,0.9)',
            position: 'relative',
            opacity: message.status === 'sending' ? 0.7 : 1,
            boxShadow: isMine
              ? '0 4px 15px rgba(102, 126, 234, 0.3)'
              : '0 2px 8px rgba(0, 0, 0, 0.2)',
            border: isMine ? 'none' : '1px solid rgba(255,255,255,0.08)',
            transition: 'transform 0.1s ease',
            '&:hover': {
              transform: 'scale(1.01)',
            },
          }}
        >
          {/* Forwarded indicator */}
          {message.forwardedFrom && (
            <Box display="flex" alignItems="center" gap={0.3} mb={0.5} sx={{ opacity: 0.7 }}>
              <ForwardIcon sx={{ fontSize: 12 }} />
              <Typography variant="caption" fontSize={10}>
                Forwarded
              </Typography>
            </Box>
          )}

          {/* Reply-to preview */}
          {repliedMessage && (
            <Box
              sx={{
                borderLeft: 3,
                borderColor: isMine ? 'rgba(255,255,255,0.6)' : 'primary.main',
                pl: 1,
                mb: 0.8,
                py: 0.3,
                bgcolor: isMine ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)',
                borderRadius: '0 4px 4px 0',
              }}
            >
              <Typography variant="caption" fontWeight={600} display="block" sx={{ opacity: 0.85 }}>
                {repliedMessage.sender.name}
              </Typography>
              <Typography variant="caption" noWrap display="block" sx={{ opacity: 0.7, maxWidth: 200 }}>
                {repliedMessage.isDeleted ? 'This message was deleted' : repliedMessage.content}
              </Typography>
            </Box>
          )}

          {!isMine && message.sender.name && (
            <Typography
              variant="caption"
              fontWeight={600}
              sx={{ color: '#a78bfa' }}
              display="block"
              mb={0.3}
            >
              {message.sender.name}
            </Typography>
          )}

          {(message.type === 'IMAGE' || message.type === 'FILE') && message.fileUrl && (
            <FilePreview
              type={message.type}
              url={message.fileUrl}
              fileName={message.fileName}
              fileSize={message.fileSize}
              thumbnailUrl={message.thumbnailUrl}
            />
          )}

          {message.content && message.type === 'TEXT' && (
            <Typography variant="body2" sx={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
              {message.content}
            </Typography>
          )}

          <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.3} mt={0.3}>
            {message.isEdited && (
              <Typography variant="caption" fontSize={10} sx={{ opacity: 0.7 }}>
                edited
              </Typography>
            )}
            <Typography
              variant="caption"
              fontSize={10}
              sx={{ opacity: 0.7 }}
            >
              {formatMessageTime(message.createdAt)}
            </Typography>
            {isMine && message.status && <MessageStatus status={message.status} />}
          </Box>

          {message.status === 'failed' && (
            <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
              <Typography variant="caption" color="error">
                Failed to send
              </Typography>
              {onRetry && (
                <IconButton size="small" onClick={() => onRetry(message.id)}>
                  <Replay sx={{ fontSize: 14 }} />
                </IconButton>
              )}
              {onDeleteFailed && (
                <IconButton size="small" onClick={() => onDeleteFailed(message.id)}>
                  <Delete sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Box>
          )}
        </Paper>

        {/* Reactions below the bubble */}
        <MessageReactions
          reactions={message.reactions || []}
          currentUserId={currentUser?.id || ''}
          onToggleReaction={handleReact}
        />
      </Box>

      {/* Dialogs */}
      <EditMessageDialog
        open={editOpen}
        currentContent={message.content}
        onClose={() => setEditOpen(false)}
        onSave={handleEdit}
      />
      <DeleteMessageDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDelete={handleDelete}
      />
      <ForwardMessageDialog
        open={forwardOpen}
        messageContent={message.content}
        onClose={() => setForwardOpen(false)}
        onForward={handleForward}
      />
    </Box>
    </motion.div>
  );
});
