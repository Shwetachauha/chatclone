import { useState, memo } from 'react';
import { Box, IconButton, Popover, Tooltip, keyframes } from '@mui/material';
import {
  EmojiEmotions,
  Edit,
  Delete,
} from '@mui/icons-material';
import { Message } from '@/types';
import { useAppSelector } from '@/hooks/useAuth';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-50%) scale(0.9); }
  to { opacity: 1; transform: translateY(-50%) scale(1); }
`;

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

interface MessageActionsProps {
  message: Message;
  isMine: boolean;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onForward: () => void;
  onReply: () => void;
}

export const MessageActions = memo(function MessageActions({
  message,
  isMine,
  onReact,
  onEdit,
  onDelete,
  onForward: _onForward,
  onReply: _onReply,
}: MessageActionsProps) {
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLButtonElement | null>(null);
  const user = useAppSelector((state) => state.auth.user);

  const FULL_EMOJI_LIST = [
    '👍', '👎', '❤️', '🔥', '😂', '😮', '😢', '😡',
    '🎉', '✅', '⭐', '🚀', '💯', '🙏', '👏', '🤔',
    '😍', '🥳', '💪', '🤝', '👋', '✨', '💀', '🫡',
  ];

  if (message.isDeleted) return null;

  return (
    <Box
      className="message-actions"
      sx={{
        position: 'absolute',
        top: '50%',
        ...(isMine ? { left: 0 } : { right: 0 }),
        transform: isMine ? 'translate(-100%, -50%)' : 'translate(100%, -50%)',
        display: 'none',
        bgcolor: '#1e1e36',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.1)',
        zIndex: 100,
        p: 0.5,
        '.message-row:hover &': { display: 'flex', animation: `${fadeIn} 0.2s ease-out` },
        flexDirection: 'column',
        gap: 0.3,
      }}
    >
      {/* Quick reactions row */}
      <Box display="flex" alignItems="center" gap={0.2}>
        {QUICK_REACTIONS.map((emoji) => (
          <Box
            key={emoji}
            onClick={() => onReact(emoji)}
            sx={{
              cursor: 'pointer',
              fontSize: 15,
              px: 0.4,
              py: 0.3,
              borderRadius: '8px',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', transform: 'scale(1.3)' },
              transition: 'all 0.15s',
            }}
          >
            {emoji}
          </Box>
        ))}

        <Tooltip title="More reactions">
          <IconButton size="small" onClick={(e) => setEmojiAnchor(e.currentTarget)} sx={{ p: 0.3, color: 'rgba(255,255,255,0.6)' }}>
            <EmojiEmotions sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Action buttons row */}
      <Box display="flex" alignItems="center" gap={0.2} borderTop="1px solid rgba(255,255,255,0.08)" pt={0.3}>
        {/* <Tooltip title="Reply">
          <IconButton size="small" onClick={onReply} sx={{ p: 0.4, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#a78bfa', bgcolor: 'rgba(167,139,250,0.1)' } }}>
            <Reply sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Forward">
          <IconButton size="small" onClick={onForward} sx={{ p: 0.4, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#667eea', bgcolor: 'rgba(102,126,234,0.1)' } }}>
            <Forward sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip> */}

        {isMine && user?.id === message.sender.id && (
          <>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={onEdit} sx={{ p: 0.4, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#4ade80', bgcolor: 'rgba(74,222,128,0.1)' } }}>
                <Edit sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Delete">
              <IconButton size="small" onClick={onDelete} sx={{ p: 0.4, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#f87171', bgcolor: 'rgba(248,113,113,0.1)' } }}>
                <Delete sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      {/* Full emoji picker popover */}
      <Popover
        open={Boolean(emojiAnchor)}
        anchorEl={emojiAnchor}
        onClose={() => setEmojiAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0.5, p: 1.5, maxWidth: 280 }}>
          {FULL_EMOJI_LIST.map((emoji) => (
            <Box
              key={emoji}
              onClick={() => { onReact(emoji); setEmojiAnchor(null); }}
              sx={{
                fontSize: 22,
                cursor: 'pointer',
                textAlign: 'center',
                borderRadius: 1,
                p: 0.3,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {emoji}
            </Box>
          ))}
        </Box>
      </Popover>
    </Box>
  );
});
