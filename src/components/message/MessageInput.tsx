import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import {
  Box,
  TextField,
  IconButton,
  CircularProgress,
  Typography,
  Paper,
  Popover,
  LinearProgress,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  AttachFile,
  Image as ImageIcon,
  Close,
  EmojiEmotions,
  CameraAlt,
  Reply,
  Edit,
} from '@mui/icons-material';
import { useTyping } from '@/hooks/useTyping';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useMessages } from '@/hooks/useMessages';
import { sanitizeInput } from '@/utils/sanitize';
import { CameraCaptureDialog } from './CameraCaptureDialog';
import { Message } from '@/types';
import { useAppDispatch } from '@/hooks/useAuth';
import { editMessageContent } from '@/store/slices/messageSlice';
import { messageEmitters } from '@/socket/emitters/messageEmitters';
import { addToast } from '@/store/slices/uiSlice';

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

interface MessageInputProps {
  chatId: string;
  replyToMessage?: Message | null;
  onCancelReply?: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
}

export function MessageInput({ chatId, replyToMessage, onCancelReply, editingMessage, onCancelEdit }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLButtonElement | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { startTyping, stopTyping } = useTyping(chatId);
  const { isUploading, progress, error: uploadError, resetUpload } = useFileUpload();
  const { sendMessage, uploadProgress, isUploading: isSendingFile } = useMessages(chatId);
  const appDispatch = useAppDispatch();

  // When editingMessage changes, populate the input (WhatsApp style)
  useEffect(() => {
    if (editingMessage) {
      setContent(editingMessage.content);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editingMessage]);

  const EMOJI_LIST = [
    '😀', '😂', '😍', '🥰', '😎', '🤔', '😮', '😢',
    '😡', '👍', '👎', '❤️', '🔥', '🎉', '✅', '⭐',
    '👋', '🙏', '💪', '🤝', '👏', '🫡', '💯', '🚀',
    '😊', '🥺', '😏', '🤣', '😴', '🤯', '🥳', '😇',
    '🤗', '🫶', '💔', '✨', '🌟', '💀', '👀', '🙌',
  ];

  const handleEmojiSelect = (emoji: string) => {
    setContent((prev) => prev + emoji);
    setEmojiAnchor(null);
  };

  const handleSend = useCallback(async () => {
    const trimmedContent = content.trim();

    // Handle edit mode
    if (editingMessage) {
      if (trimmedContent && trimmedContent !== editingMessage.content) {
        appDispatch(editMessageContent({
          chatId: editingMessage.chatId,
          messageId: editingMessage.id,
          content: trimmedContent,
        }));
        messageEmitters.editMessage(editingMessage.id, trimmedContent);
      }
      setContent('');
      onCancelEdit?.();
      return;
    }

    if (!trimmedContent && !selectedFile) return;

    stopTyping();
    const replyId = replyToMessage?.id;

    if (selectedFile) {
      const fileType = selectedFile.type.startsWith('image/') ? 'IMAGE' : 'FILE';
      sendMessage(trimmedContent || selectedFile.name, fileType, selectedFile, replyId);
      clearFile();
    } else {
      sendMessage(sanitizeInput(trimmedContent), 'TEXT', undefined, replyId);
    }

    setContent('');
    onCancelReply?.();
  }, [content, selectedFile, stopTyping, sendMessage, replyToMessage, onCancelReply, editingMessage, onCancelEdit, appDispatch]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape' && editingMessage) {
      e.preventDefault();
      setContent('');
      onCancelEdit?.();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);
    startTyping();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'file' | 'image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > MAX_UPLOAD_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      appDispatch(addToast({
        id: Date.now().toString(),
        message: `File too large (${sizeMB}MB). Maximum allowed size is 10MB.`,
        type: 'error',
      }));
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    resetUpload();

    if (type === 'image' && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }

    // Reset the input
    e.target.value = '';
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    resetUpload();
  };

  return (
    <Box sx={{ borderTop: '1px solid rgba(200,180,255,0.2)', bgcolor: '#e8dff5' }}>
      {/* Reply preview */}
      {replyToMessage && !editingMessage && (
        <Box px={2} pt={1}>
          <Paper
            variant="outlined"
            sx={{
              p: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              borderLeft: 3,
              borderColor: 'primary.main',
            }}
          >
            <Reply sx={{ fontSize: 18, color: 'primary.main' }} />
            <Box flex={1} overflow="hidden">
              <Typography variant="caption" fontWeight={600} color="primary.main" display="block">
                {replyToMessage.sender.name}
              </Typography>
              <Typography variant="body2" noWrap color="text.secondary">
                {replyToMessage.content}
              </Typography>
            </Box>
            <IconButton size="small" onClick={onCancelReply}>
              <Close fontSize="small" />
            </IconButton>
          </Paper>
        </Box>
      )}

      {/* Editing banner (WhatsApp style) */}
      {editingMessage && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 0.8,
            bgcolor: 'rgba(102,126,234,0.06)',
            borderBottom: '1px solid rgba(102,126,234,0.1)',
          }}
        >
          <Edit sx={{ fontSize: 15, color: '#667eea' }} />
          <Box flex={1} overflow="hidden">
            <Typography variant="caption" sx={{ color: '#667eea', fontWeight: 600, fontSize: '0.72rem' }}>
              Edit message
            </Typography>
            <Typography variant="body2" noWrap sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.78rem', lineHeight: 1.3 }}>
              {editingMessage.content}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => { setContent(''); onCancelEdit?.(); }}
            sx={{ color: 'rgba(0,0,0,0.4)', p: 0.3, '&:hover': { color: '#667eea' } }}
          >
            <Close sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      )}

      {/* File preview */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Box px={2} pt={1}>
              <Paper variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                  />
                )}
                <Box flex={1} overflow="hidden">
                  <Typography variant="body2" noWrap>
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </Typography>
                </Box>
                {isUploading && <CircularProgress size={20} variant="determinate" value={progress} />}
                <IconButton size="small" onClick={clearFile}>
                  <Close fontSize="small" />
                </IconButton>
              </Paper>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {uploadError && (
        <Typography variant="caption" color="error" px={2}>
          {uploadError}
        </Typography>
      )}

      {/* Upload progress bar */}
      <AnimatePresence>
        {isSendingFile && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Box px={2} pt={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <LinearProgress
                  variant="determinate"
                  value={uploadProgress}
                  sx={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    bgcolor: 'rgba(124,92,191,0.1)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                    },
                  }}
                />
                <Typography variant="caption" fontWeight={600} sx={{ color: '#7c5cbf', minWidth: 36 }}>
                  {uploadProgress}%
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'rgba(0,0,0,0.5)', fontSize: '0.7rem' }}>
                Uploading attachment...
              </Typography>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <Box display="flex" alignItems="flex-end" gap={0.5} p={1.5} px={2}>
        <Box display="flex" gap={0.3}>
          <IconButton
            size="small"
            onClick={(e) => setEmojiAnchor(e.currentTarget)}
            disabled={isUploading}
            sx={{ color: '#7c5cbf', '&:hover': { color: '#667eea' } }}
          >
            <EmojiEmotions fontSize="small" />
          </IconButton>

          <IconButton
            size="small"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            sx={{ color: '#7c5cbf', '&:hover': { color: '#667eea' } }}
          >
            <AttachFile fontSize="small" />
          </IconButton>

          <IconButton
            size="small"
            onClick={() => imageInputRef.current?.click()}
            disabled={isUploading}
            sx={{ color: '#7c5cbf', '&:hover': { color: '#667eea' } }}
          >
            <ImageIcon fontSize="small" />
          </IconButton>

          <IconButton
            size="small"
            onClick={() => setCameraOpen(true)}
            disabled={isUploading}
            sx={{ color: '#7c5cbf', '&:hover': { color: '#667eea' } }}
          >
            <CameraAlt fontSize="small" />
          </IconButton>
        </Box>

        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          placeholder="Type a message..."
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isUploading}
          inputRef={inputRef}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '20px',
              backgroundColor: '#ffffff',
              color: '#1a1a2e',
              '& fieldset': { borderColor: 'rgba(102,126,234,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(102,126,234,0.4)' },
              '&.Mui-focused fieldset': { borderColor: '#667eea', borderWidth: 1.5 },
            },
            '& .MuiInputBase-input, & textarea': { color: '#1a1a2e' },
            '& input::placeholder, & textarea::placeholder': { color: 'rgba(0,0,0,0.4)', opacity: 1 },
          }}
        />

        <IconButton
          onClick={handleSend}
          disabled={!content.trim() && !selectedFile && !editingMessage}
          sx={{
            width: 38,
            height: 38,
            background: !content.trim() && !selectedFile
              ? 'transparent'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: !content.trim() && !selectedFile ? 'rgba(255,255,255,0.3)' : 'white',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a6fe0 0%, #6a3d96 100%)',
              transform: 'scale(1.05)',
            },
            transition: 'all 0.2s ease',
          }}
        >
          <Send fontSize="small" />
        </IconButton>
      </Box>

      {/* Emoji Picker Popover */}
      <Popover
        open={Boolean(emojiAnchor)}
        anchorEl={emojiAnchor}
        onClose={() => setEmojiAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 0.5,
            p: 1.5,
            maxWidth: 320,
          }}
        >
          {EMOJI_LIST.map((emoji) => (
            <Box
              key={emoji}
              onClick={() => handleEmojiSelect(emoji)}
              sx={{
                fontSize: 24,
                cursor: 'pointer',
                textAlign: 'center',
                borderRadius: 1,
                p: 0.5,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {emoji}
            </Box>
          ))}
        </Box>
      </Popover>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={(e) => handleFileSelect(e, 'file')}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.mp4,.webm,.mp3,.wav"
      />
      <input
        ref={imageInputRef}
        type="file"
        hidden
        onChange={(e) => handleFileSelect(e, 'image')}
        accept="image/*"
      />

      {/* Camera Capture Dialog */}
      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => {
          setSelectedFile(file);
          const url = URL.createObjectURL(file);
          setPreviewUrl(url);
          resetUpload();
        }}
      />
    </Box>
  );
}
