import { useState } from 'react';
import { Cloud, CloudOff, LogOut, Pencil } from 'lucide-react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { signOut } from '@/services/sync';
import { Button, SectionTitle } from '@/ui/primitives';
import { Flowy } from '../mascot/Flowy';
import { formatDuration } from '@/lib/time';

export default function AccountPanel() {
  const user = useData((s) => s.user);
  const data = useData((s) => s.data);
  const sync = useData((s) => s.sync);
  const setName = useData((s) => s.setProfileName);
  const setUI = useUI((s) => s.set);
  const [editing, setEditing] = useState(false);
  const [name, setNameLocal] = useState(data.profileName);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="relative">
          {user?.photo ? <img src={user.photo} alt="" referrerPolicy="no-referrer" className="size-24 rounded-full object-cover ring-4 ring-accent-soft" /> : <Flowy mood="love" size={96} />}
        </div>
        {editing ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setName(name);
              setEditing(false);
            }}
          >
            <input autoFocus value={name} maxLength={40} onChange={(e) => setNameLocal(e.target.value)} className="h-10 rounded-2xl bg-line px-3 text-center font-bold outline-none focus:ring-2 focus:ring-accent" />
            <Button type="submit" variant="primary">
              Save
            </Button>
          </form>
        ) : (
          <button onClick={() => setEditing(true)} className="group flex items-center gap-2">
            <span className="font-display text-2xl font-semibold">{data.profileName}</span>
            <Pencil size={14} className="text-muted group-hover:text-ink" />
          </button>
        )}
        <p className="text-sm font-bold text-muted">{user ? user.email : 'Guest — saved on this device'}</p>
        <p className="text-xs font-bold text-faint">
          {formatDuration(data.totalFocusSeconds)} focused · {data.totalSessions} sessions · best streak {data.bestStreak}
        </p>
      </div>

      <section className="space-y-2">
        <SectionTitle>Sync</SectionTitle>
        <div className="flex items-center gap-3 rounded-2xl bg-surface-strong/70 p-3 ring-1 ring-line">
          {user ? <Cloud className="text-good" /> : <CloudOff className="text-muted" />}
          <div className="flex-1">
            <p className="text-sm font-extrabold">{user ? (sync === 'saving' ? 'Syncing…' : sync === 'offline' ? 'Offline — changes will sync later' : sync === 'error' ? 'Sync hiccup, retrying' : 'All synced') : 'Not syncing'}</p>
            <p className="text-xs font-semibold text-muted">{user ? 'Your stats follow you to every device.' : 'Sign in to back up and appear on leaderboards.'}</p>
          </div>
        </div>
      </section>

      {user ? (
        <Button variant="danger" className="w-full" icon={<LogOut size={16} />} onClick={() => void signOut()}>
          Sign out
        </Button>
      ) : (
        <Button variant="primary" size="lg" className="w-full" onClick={() => setUI({ auth: true })}>
          Sign in or create account
        </Button>
      )}
    </div>
  );
}
