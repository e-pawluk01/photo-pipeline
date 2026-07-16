'use client';

import { useEffect, useState, useRef } from 'react';

const PASSCODE_KEY = 'photo-pipeline-passcode';

export default function Page() {
  const [passcode, setPasscode] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [checkingGate, setCheckingGate] = useState(true);
  
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

  return <AppShell />;
}

// Moved main shell logic to separate component so we can use hooks cleanly after unlock
function AppShell() {
  const [activeTab, setActiveTab] = useState<'photos' | 'groups' | 'progress'>('photos');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Upload state
  const [sessionId] = useState(() => `batch_${Date.now()}`);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);

  useEffect(() => {
    async function loadPhotos() {
      try {
        const res = await fetch('/api/photo/list');
        const data = await res.json();
        if (res.ok && data.photos) {
          setPhotos(data.photos);
        }
      } catch (err) {
        console.error('Failed to load photos:', err);
      }
    }
    loadPhotos();
  }, []);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    setProgress(0);
    const totalFiles = files.length;
    let completed = 0;

    const newPhotos: { id: string; url: string }[] = [];

    // Process files one by one or in small batches to avoid overwhelming the browser
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // 1. Get Signed URL
        const urlRes = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlData.error);
        
        let { signedUrl, storagePath } = urlData;

        // 2. Direct upload to Supabase via signed URL
        const uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
        });
        
        if (!uploadRes.ok) {
          throw new Error('Upload to Supabase failed');
        }

        // 3. Process HEIC if necessary
        const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
        if (isHeic) {
          const heicRes = await fetch('/api/process-heic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storagePath }),
          });
          const heicData = await heicRes.json();
          if (!heicRes.ok) throw new Error(heicData.error);
          storagePath = heicData.newStoragePath;
        }

        // 4. Record to DB
        const recordRes = await fetch('/api/photo/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storagePath, sessionId }),
        });
        const recordData = await recordRes.json();
        if (!recordRes.ok) throw new Error(recordData.error);

        // 5. Build public URL for rendering
        // Fetching the public URL requires SUPABASE_URL, but we don't have it in client.
        // We can just construct it via an API call or, simpler, proxy read it from an API
        // or let the record API return the public URL.
        // Since we didn't add that to the API, let's update /api/photo/record to return it.
        // Actually, we can just request the server to give us the public URL in /api/photo/record.
        // I will assume /api/photo/record returns `publicUrl`.
        newPhotos.push({
          id: recordData.record.id,
          url: recordData.publicUrl
        });

      } catch (err) {
        console.error('Failed to upload file:', file.name, err);
      }

      completed++;
      setProgress(Math.round((completed / totalFiles) * 100));
    }

    setPhotos(prev => [...newPhotos, ...prev]);
    setUploading(false);
    
    // Clear input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
        
        {/* Progress Bar */}
        {uploading && (
          <div className="absolute bottom-0 left-0 h-[2px] bg-white transition-all duration-300 shadow-[0_0_8px_rgba(255,255,255,0.8)]" style={{ width: `${progress}%` }} />
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 px-6 pt-6">
        {activeTab === 'photos' && (
          <div className="flex flex-col space-y-4 pb-12">
             {photos.length === 0 && !uploading ? (
               <div className="flex h-[60vh] flex-col items-center justify-center opacity-50">
                 <div className="text-sm font-light tracking-widest text-white/40 uppercase">
                   No Photos Yet
                 </div>
               </div>
             ) : (
               <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                 {photos.map((p) => (
                   <div key={p.id} className="aspect-square bg-white/5 border border-white/10 rounded-lg overflow-hidden relative">
                     {/* Using img tag directly since we don't have next/image domains configured */}
                     <img src={p.url} alt="Uploaded" className="object-cover w-full h-full" loading="lazy" />
                   </div>
                 ))}
                 {uploading && (
                    <div className="aspect-square bg-white/5 border border-white/10 rounded-lg overflow-hidden relative flex items-center justify-center animate-pulse">
                      <div className="text-xs text-white/30 uppercase tracking-widest">
                        Uploading...
                      </div>
                    </div>
                 )}
               </div>
             )}
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

      {/* Hidden File Input */}
      <input
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFiles}
      />

      {/* Sticky Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between bg-black/40 px-6 py-6 backdrop-blur-2xl border-t border-white/10 pb-safe">
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-3xl font-light transition active:scale-95 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] disabled:opacity-50"
        >
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
