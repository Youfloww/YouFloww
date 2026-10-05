import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { useUI, toast } from '@/store/ui';
import { useData } from '@/store/data';
import { Dialog } from '@/ui/Sheet';
import { Button, Segmented } from '@/ui/primitives';
import { Flowy, type FlowyMood } from '../mascot/Flowy';
import { authErrorMessage, resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from '@/services/sync';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function AuthDialog() {
  const open = useUI((s) => s.auth);
  const setUI = useUI((s) => s.set);
  const user = useData((s) => s.user);
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pwFocus, setPwFocus] = useState(false);

  // close once signed in
  useEffect(() => {
    if (user && open) {
      setUI({ auth: false });
      toast({ emoji: '☁️', title: `Welcome${user.name ? `, ${user.name.split(' ')[0]}` : ''}!`, body: 'Your focus now syncs everywhere.' });
    }
  }, [user, open, setUI]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // The classic YouFloww monkey, reimagined: Flowy covers its eyes when you type a password
  const mood: FlowyMood = error ? 'sad' : pwFocus ? (show ? 'wow' : 'sleepy') : email ? 'happy' : 'idle';

  return (
    <Dialog open={open} onClose={() => setUI({ auth: false })} labelledBy="auth-title">
      <div className="-mt-16 mb-1 flex justify-center">
        <Flowy mood={mood} size={104} />
      </div>
      <h2 id="auth-title" className="font-display text-center text-2xl font-semibold">
        {mode === 'signup' ? 'Save your progress' : 'Welcome back'}
      </h2>
      <p className="mb-4 text-center text-sm font-semibold text-muted">Sync across devices & join the live leaderboards.</p>

      <Button variant="glass" size="lg" className="w-full" icon={<GoogleIcon />} disabled={busy} onClick={() => run(signInWithGoogle)}>
        Continue with Google
      </Button>

      <div className="my-4 flex items-center gap-3 text-xs font-black text-faint uppercase">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <Segmented
        className="mb-3 w-full"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { value: 'signup', label: 'Create account' },
          { value: 'login', label: 'Log in' },
        ]}
      />

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => (mode === 'signup' ? signUpWithEmail(email.trim(), password, name.trim() || undefined) : signInWithEmail(email.trim(), password)));
        }}
      >
        <AnimatePresence initial={false}>
          {mode === 'signup' && (
            <motion.input
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 44 }}
              exit={{ opacity: 0, height: 0 }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name (shown on leaderboards)"
              autoComplete="nickname"
              maxLength={40}
              className="w-full rounded-2xl bg-line px-4 text-sm font-bold outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
            />
          )}
        </AnimatePresence>
        <div className="flex h-11 items-center gap-2 rounded-2xl bg-line px-4 focus-within:ring-2 focus-within:ring-accent">
          <Mail size={16} className="text-muted" />
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-faint" />
        </div>
        <div className="flex h-11 items-center gap-2 rounded-2xl bg-line px-4 focus-within:ring-2 focus-within:ring-accent">
          <input
            type={show ? 'text' : 'password'}
            required
            minLength={6}
            value={password}
            onFocus={() => setPwFocus(true)}
            onBlur={() => setPwFocus(false)}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-faint"
          />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="text-muted hover:text-ink">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center text-sm font-extrabold text-bad" role="alert">
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? 'One sec…' : mode === 'signup' ? 'Create account' : 'Log in'}
        </Button>
      </form>
      {mode === 'login' && (
        <button
          className="mt-3 w-full text-center text-sm font-extrabold text-muted hover:text-ink"
          onClick={() => {
            if (!email.trim()) return setError('Type your email above first.');
            void run(async () => {
              await resetPassword(email.trim());
              toast({ emoji: '📬', title: 'Reset link sent', body: email.trim() });
            });
          }}
        >
          Forgot password?
        </button>
      )}
      <p className="mt-4 text-center text-xs font-semibold text-faint">No account needed to use YouFloww. Guest progress is saved on this device and moves into your account when you sign up.</p>
    </Dialog>
  );
}
