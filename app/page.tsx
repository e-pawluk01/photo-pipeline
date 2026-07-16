'use client';

import { useEffect, useState } from 'react';

const PASSCODE_KEY = 'photo-pipeline-passcode';

export default function Page() {
  const [passcode, setPasscode] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [checkingGate, setCheckingGate] = useState(true);
  const [activeTab, setActiveTab] = useState<'photos' | 'groups' | 'progress'>('photos');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem(PASSCODE_KEY) : null;
    if (stored) {
      verifyPasscode(stored).then((ok) => {
        if (ok) {
          setPasscode(stored);
          setUnlocked(true);
        }
        setCheckingGate(false);
      });
    } else {
      setCheckingGate(false);
    }
  }, []);

  async function verifyPasscode(code: string): Promise<boolean> {
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: code }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  if (checkingGate) {
    return <main className="min-h-[100dvh] bg-black" />;
  }

  if (!unlocked) {
    return (
      <PasscodeGate
        onUnlock={(code) => {
          setPasscode(code);
          setUnlocked(true);
        }}
        verify={verifyPasscode}
      />
    );
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-black text-white selection:bg-white selection:text-black pb-[96px]">
      {/* Header / Tabs */}
      <header className="sticky top-0 z-50 flex flex-col justify-end bg-black/60 px-6 pb-4 pt-16 backdrop-blur-xl border-b border-white/10">
        <h1 className="text-xl font-medium tracking-wide text-white/90">
          Resale Batch
        </h1>
        <div className="mt-6 flex space-x-6">
          <TabButton 
            active={activeTab === 'photos'} 
            onClick={() => setActiveTab('photos')}
            label="Photos" 
          />
          <TabButton 
            active={activeTab === 'groups'} 
            onClick={() => setActiveTab('groups')}
            label="Groups" 
          />
          <TabButton 
            active={activeTab === 'progress'} 
            onClick={() => setActiveTab('progress')}
            label="Progress" 
          />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 px-6 pt-6">
        {activeTab === 'photos' && (
          <div className="flex h-[60vh] flex-col items-center justify-center opacity-50">
             <div className="text-sm font-light tracking-widest text-white/40 uppercase">
               Photos
             </div>
          </div>
        )}
        {activeTab === 'groups' && (
          <div className="flex h-[60vh] flex-col items-center justify-center opacity-50">
             <div className="text-sm font-light tracking-widest text-white/40 uppercase">
               Groups
             </div>
          </div>
        )}
        {activeTab === 'progress' && (
          <div className="flex h-[60vh] flex-col items-center justify-center opacity-50">
             <div className="text-sm font-light tracking-widest text-white/40 uppercase">
               Progress
             </div>
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between bg-black/40 px-6 py-6 backdrop-blur-2xl border-t border-white/10 pb-safe">
        <button className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-3xl font-light transition active:scale-95 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]">
          +
        </button>
        <button 
          disabled 
          className="flex h-14 w-32 items-center justify-center rounded-full bg-white/5 border border-white/10 text-sm font-medium uppercase tracking-widest text-white/30 transition disabled:opacity-50"
        >
          Send
        </button>
      </footer>
    </main>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`relative pb-2 text-[13px] font-medium uppercase tracking-wider transition-colors ${
        active ? 'text-white' : 'text-white/40'
      }`}
    >
      {label}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
      )}
    </button>
  );
}

function PasscodeGate({
  onUnlock,
  verify,
}: {
  onUnlock: (code: string) => void;
  verify: (code: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    const ok = await verify(value);
    setChecking(false);
    if (ok) {
      sessionStorage.setItem(PASSCODE_KEY, value);
      onUnlock(value);
    } else {
      setError('ACCESS DENIED');
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#050505] px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-white/5 via-black to-black" />
      <form onSubmit={submit} className="relative z-10 w-full max-w-sm rounded-2xl bg-white/5 p-8 backdrop-blur-xl border border-white/10 shadow-2xl">
        <div className="mb-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">
            System Auth
          </p>
          <h1 className="text-2xl font-light tracking-wide text-white">
            Identify
          </h1>
        </div>
        
        <div className="relative mb-6">
          <input
            type="password"
            inputMode="text"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-none border-b border-white/20 bg-transparent px-4 py-3 text-center text-xl text-white outline-none placeholder:text-white/20 focus:border-white/80 transition-colors font-mono tracking-widest"
            placeholder="••••••"
          />
        </div>
        
        {error && <p className="mb-6 text-center text-xs tracking-widest text-red-500/80">{error}</p>}
        
        <button
          type="submit"
          disabled={checking || value.length === 0}
          className="w-full rounded-none bg-white py-4 text-xs font-semibold uppercase tracking-[0.2em] text-black transition-transform active:scale-[0.98] disabled:opacity-30 disabled:active:scale-100"
        >
          {checking ? 'Authenticating...' : 'Log In'}
        </button>
      </form>
    </main>
  );
}
