import { useState } from 'react';
import { Box, Typography, keyframes } from '@mui/material';
import { ChatBubble, Group, Lock } from '@mui/icons-material';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { useAppDispatch } from '@/hooks/useAuth';
import { clearError } from '@/store/slices/authSlice';

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
`;

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.05); opacity: 1; }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
`;

export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const dispatch = useAppDispatch();

  const switchToRegister = () => {
    dispatch(clearError());
    setIsLogin(false);
  };

  const switchToLogin = () => {
    dispatch(clearError());
    setIsLogin(true);
  };

  return (
    <Box
      display="flex"
      minHeight="100vh"
      sx={{ overflow: 'hidden' }}
    >
      {/* Left illustration panel */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
          position: 'relative',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 6,
          overflow: 'hidden',
        }}
      >
        {/* Floating decorative circles */}
        <Box
          sx={{
            position: 'absolute',
            top: '10%',
            left: '10%',
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            animation: `${float} 6s ease-in-out infinite`,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '15%',
            right: '10%',
            width: 150,
            height: 150,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            animation: `${float} 8s ease-in-out infinite 1s`,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            right: '25%',
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            animation: `${float} 5s ease-in-out infinite 0.5s`,
          }}
        />

        {/* Main illustration content */}
        <Box sx={{ animation: `${fadeInUp} 1s ease-out`, textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Icon cluster */}
          <Box display="flex" justifyContent="center" gap={3} mb={4}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '16px',
                bgcolor: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: `${float} 4s ease-in-out infinite`,
              }}
            >
              <ChatBubble sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '16px',
                bgcolor: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: `${float} 4s ease-in-out infinite 0.5s`,
                mt: -2,
              }}
            >
              <Group sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '16px',
                bgcolor: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: `${float} 4s ease-in-out infinite 1s`,
              }}
            >
              <Lock sx={{ fontSize: 32, color: 'white' }} />
            </Box>
          </Box>

          <Typography
            variant="h3"
            fontWeight={800}
            color="white"
            sx={{ letterSpacing: '-0.03em', mb: 2 }}
          >
            Connect & Chat
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 400, maxWidth: 360, mx: 'auto', lineHeight: 1.6 }}
          >
            Real-time messaging with your team. Secure, fast, and beautifully designed.
          </Typography>

          {/* Feature pills */}
          <Box display="flex" gap={1.5} justifyContent="center" mt={4} flexWrap="wrap">
            {['End-to-end secure', 'Real-time sync', 'Group chats'].map((feature, i) => (
              <Box
                key={feature}
                sx={{
                  px: 2,
                  py: 0.8,
                  borderRadius: '20px',
                  bgcolor: 'rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  animation: `${pulse} 3s ease-in-out infinite ${i * 0.5}s`,
                }}
              >
                <Typography variant="caption" sx={{ color: 'white', fontWeight: 500, fontSize: 12 }}>
                  {feature}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Right form panel */}
      <Box
        sx={{
          flex: { xs: 1, md: '0 0 480px' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#fafbfc',
          px: { xs: 3, sm: 6 },
          py: 4,
        }}
      >
        <Box
          key={isLogin ? 'login' : 'register'}
          sx={{
            width: '100%',
            maxWidth: 380,
            animation: `${slideIn} 0.4s ease-out`,
          }}
        >
          {isLogin ? (
            <LoginForm onSwitchToRegister={switchToRegister} />
          ) : (
            <RegisterForm onSwitchToLogin={switchToLogin} />
          )}
        </Box>
      </Box>
    </Box>
  );
}
