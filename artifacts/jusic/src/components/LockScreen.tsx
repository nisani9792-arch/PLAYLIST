import { Fingerprint, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useBiometricUnlock } from '@/hooks/useBiometricUnlock';
import { APP_LOGO_URL } from '@/lib/brand';
import './LockScreen.css';

const JUSIC_CODE = 'JUSIC';

type LockScreenProps = {
  onUnlock: () => void;
  knownOperatorName?: string | null;
};

export function LockScreen({ onUnlock, knownOperatorName }: LockScreenProps) {
  const [password, setPassword] = useState('');
  const [wrongCode, setWrongCode] = useState(false);
  const logoUrl = APP_LOGO_URL;
  const { available: biometricAvailable, busy: biometricBusy, unlock: unlockWithBiometric } =
    useBiometricUnlock(onUnlock);

  const tryJusicCode = (value: string) => {
    if (value.trim().toUpperCase() === JUSIC_CODE) {
      setWrongCode(false);
      onUnlock();
      return true;
    }
    return false;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!tryJusicCode(password) && password.trim().length > 0) {
      setWrongCode(true);
    }
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
        {knownOperatorName && (
          <p className="text-xs text-emerald-400/90 text-center -mt-2 mb-1">
            שלום {knownOperatorName} — הזן סיסמה או טביעת אצבע לכניסה
          </p>
        )}

        <form className="lock-form" onSubmit={handleSubmit}>
          <input
            className="lock-input"
            type="password"
            inputMode="text"
            autoComplete="off"
            maxLength={20}
            value={password}
            onChange={(event) => {
              const next = event.target.value;
              setPassword(next);
              setWrongCode(false);
              tryJusicCode(next);
            }}
            placeholder="••••••••••••••••••••"
            aria-label="סיסמא"
            aria-invalid={wrongCode}
          />
          {wrongCode && (
            <p className="text-xs text-destructive text-center mt-2" role="alert">
              קוד שגוי
            </p>
          )}
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
