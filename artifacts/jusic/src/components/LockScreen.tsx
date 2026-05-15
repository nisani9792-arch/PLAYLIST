import { Fingerprint, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useBiometricUnlock } from '@/hooks/useBiometricUnlock';
import { APP_LOGO_URL } from '@/lib/brand';
import './LockScreen.css';

type LockScreenProps = {
  onUnlock: () => void;
};

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [password, setPassword] = useState('');
  const logoUrl = APP_LOGO_URL;
  const { available: biometricAvailable, busy: biometricBusy, unlock: unlockWithBiometric } =
    useBiometricUnlock(onUnlock);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
  };

  return (
    <motion.div
      className="lock-screen"
      role="dialog"
      aria-modal="true"
      aria-label="מסך כניסה"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="lock-card"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <img src={logoUrl} className="lock-logo" alt="BUILD PLAY" width={88} height={88} />

        <motion.div
          className="lock-icon-wrap"
          aria-hidden
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Lock size={28} strokeWidth={2} />
        </motion.div>

        <p className="lock-prompt">אנא הכנס סיסמא</p>

        <form className="lock-form" onSubmit={handleSubmit}>
          <input
            className="lock-input"
            type="password"
            inputMode="text"
            autoComplete="off"
            maxLength={20}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••••••••••••"
            aria-label="סיסמא"
          />
        </form>

        {biometricAvailable && (
          <button
            type="button"
            className="lock-biometric"
            onClick={() => void unlockWithBiometric()}
            disabled={biometricBusy}
          >
            <Fingerprint size={22} strokeWidth={2} />
            <span>
              {biometricBusy
                ? 'מאמת...'
                : 'כניסה ביומטרית (טביעת אצבע / Windows Hello)'}
            </span>
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
