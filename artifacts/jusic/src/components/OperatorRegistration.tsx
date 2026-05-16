import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_LOGO_URL } from '@/lib/brand';
import { getOperatorName } from '@/lib/operator';
import './LockScreen.css';

type OperatorRegistrationProps = {
  onComplete: (operatorName: string) => void | Promise<void>;
};

export function OperatorRegistration({ onComplete }: OperatorRegistrationProps) {
  const [name, setName] = useState(() => getOperatorName() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('הזן שם משתמש (לפחות 2 תווים)');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onComplete(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בשמירה');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="lock-screen"
      role="dialog"
      aria-modal="true"
      aria-label="רישום גורם מטפל"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="lock-card"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        <img src={APP_LOGO_URL} className="lock-logo" alt="BUILD PLAY" width={88} height={88} />
        <div className="lock-icon-wrap" aria-hidden>
          <UserRound size={28} strokeWidth={2} />
        </div>
        <p className="lock-prompt">הזן שם משתמש — גורם מטפל</p>
        <p className="text-xs text-muted-foreground text-center mb-3 px-2">
          נשמר לפי כתובת הרשת שלך. כל שינוי במערכת יירשם על שמך.
        </p>
        <form className="lock-form" onSubmit={(e) => void handleSubmit(e)}>
          <input
            className="lock-input"
            type="text"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם מלא"
            aria-label="שם גורם מטפל"
            disabled={busy}
          />
          {error && (
            <p className="text-xs text-destructive text-center mt-2" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full mt-3" disabled={busy}>
            {busy ? 'שומר...' : 'כניסה למערכת'}
          </Button>
        </form>
      </motion.div>
    </motion.div>
  );
}
