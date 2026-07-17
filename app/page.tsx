'use client';

import { useEffect, useState, useRef } from 'react';

const PASSCODE_KEY = 'photo-pipeline-passcode';

const sizeOptions: Record<string, string[]> = {
  Top: ['XS', 'S', 'M', 'L', 'XL'],
  Bottom: ['XS', 'S', 'M', 'L', 'XL'],
  Shoes: ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'],
  Accessory: ['One Size'],
  Bag: ['One Size']
};

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

type Photo = { id: string; url: string; group_id: string | null };
type Group = { id: string; item_type: string; size: string; notes: string | null; cover_photo_id: string; created_at: string };

function AppShell() {
  const [activeTab, setActiveTab] = useState<'photos' | 'groups' | 'progress'>('photos');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Session
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [uploadStats, setUploadStats] = useState<{ success: number; total: number } | null>(null);
  
  // Data
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  // Selection & Modal
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState({ itemType: 'Top', size: 'M', notes: '' });
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  useEffect(() => {
    let sid = localStorage.getItem('photo-pipeline-session');
    if (!sid) {
      sid = `batch_${Date.now()}`;
      localStorage.setItem('photo-pipeline-session', sid);
    }
    setSessionId(sid);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    async function loadData() {
      try {
        const res = await fetch(`/api/photo/list?sessionId=${sessionId}`);
        const data = await res.json();
        if (res.ok) {
          if (data.photos) setPhotos(data.photos);
          if (data.groups) setGroups(data.groups);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    }
    loadData();
  }, [sessionId]);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!sessionId) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    setProgress(0);
    const totalFiles = files.length;
    let completed = 0;
    let successCount = 0;
    setUploadStats({ success: 0, total: totalFiles });

    const newPhotos: Photo[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const urlRes = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlData.error);
        
        let { signedUrl, storagePath } = urlData;

        const uploadRes = await fetch(signedUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
        });
        
        if (!uploadRes.ok) throw new Error('Upload to Supabase failed');

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

        const recordRes = await fetch('/api/photo/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storagePath, sessionId }),
        });
        const recordData = await recordRes.json();
        if (!recordRes.ok) throw new Error(recordData.error);

        newPhotos.push({
          id: recordData.record.id,
          url: recordData.publicUrl,
          group_id: null
        });
        
        successCount++;
      } catch (err) {
        console.error('Failed to upload file:', file.name, err);
      }

      completed++;
      setProgress(Math.round((completed / totalFiles) * 100));
      setUploadStats({ success: successCount, total: totalFiles });
    }

    setPhotos(prev => [...newPhotos, ...prev]);
    setUploading(false);
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  async function handleCreateGroup() {
    if (selectedPhotoIds.size === 0 || !sessionId) return;
    setIsCreatingGroup(true);
    try {
      const photoIdsArray = Array.from(selectedPhotoIds);
      // Ensure the cover photo is literally the first one they selected (which naturally happens with a Set)
      const coverPhotoId = photoIdsArray[0];
      
      const res = await fetch('/api/group/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: groupForm.itemType,
          size: groupForm.size,
          notes: groupForm.notes,
          photoIds: photoIdsArray,
          cover_photo_id: coverPhotoId,
          session_id: sessionId
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setGroups(prev => [data.group, ...prev]);
      setPhotos(prev => prev.map(p => photoIdsArray.includes(p.id) ? { ...p, group_id: data.group.id } : p));
      
      setShowGroupModal(false);
      setIsSelectionMode(false);
      setSelectedPhotoIds(new Set());
      setGroupForm({ itemType: 'Top', size: sizeOptions['Top'][0], notes: '' });
      
    } catch (err) {
      console.error('Failed to create group:', err);
      alert('Failed to create group');
    } finally {
      setIsCreatingGroup(false);
    }
  }

  const loosePhotos = photos.filter(p => !p.group_id);

  return (
    <main className="flex min-h-[100dvh] flex-col bg-black text-white selection:bg-white selection:text-black pb-[120px]">
      <header className="sticky top-0 z-40 flex flex-col justify-end bg-black/60 px-6 pb-4 pt-16 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-end justify-between">
          <h1 className="text-xl font-medium tracking-wide text-white/90">
            Resale Batch
          </h1>
          {uploading && uploadStats ? (
            <p className="text-xs font-mono text-white/60 mb-1">
              {uploadStats.success} / {uploadStats.total} uploaded
            </p>
          ) : (
            activeTab === 'photos' && (
              <button 
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  setSelectedPhotoIds(new Set());
                }} 
                className="text-xs font-semibold uppercase tracking-widest text-white/80 mb-1 active:opacity-50"
              >
                {isSelectionMode ? 'Cancel' : 'Group'}
              </button>
            )
          )}
        </div>
        <div className="mt-6 flex space-x-6">
          <TabButton active={activeTab === 'photos'} onClick={() => setActiveTab('photos')} label="Photos" />
          <TabButton active={activeTab === 'groups'} onClick={() => setActiveTab('groups')} label="Groups" />
          <TabButton active={activeTab === 'progress'} onClick={() => setActiveTab('progress')} label="Progress" />
        </div>
        
        {uploading && (
          <div className="absolute bottom-0 left-0 h-[2px] bg-white transition-all duration-300 shadow-[0_0_8px_rgba(255,255,255,0.8)]" style={{ width: `${progress}%` }} />
        )}
      </header>

      <div className="flex-1 px-6 pt-6">
        {activeTab === 'photos' && (
          <div className="flex flex-col space-y-4 pb-12">
             {photos.length === 0 && !uploading ? (
               <div className="flex h-[60vh] flex-col items-center justify-center opacity-50">
                 <div className="text-sm font-light tracking-widest text-white/40 uppercase">No Photos Yet</div>
               </div>
             ) : (
               <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                 {/* Render Groups as Folders */}
                 {groups.map(g => {
                   const coverPhoto = photos.find(p => p.id === g.cover_photo_id);
                   const count = photos.filter(p => p.group_id === g.id).length;
                   return (
                     <div key={g.id} className="aspect-square bg-white/10 border border-white/20 rounded-lg overflow-hidden relative group">
                       {coverPhoto && <img src={coverPhoto.url} className="object-cover w-full h-full opacity-60" loading="lazy" />}
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                       <div className="absolute top-2 right-2 bg-white/20 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-mono text-white border border-white/30">
                         {count}
                       </div>
                       <div className="absolute bottom-2 left-2 right-2">
                         <p className="text-[10px] font-semibold uppercase tracking-wider truncate text-white leading-tight">{g.item_type}</p>
                         <p className="text-[9px] text-white/70 truncate">{g.size}</p>
                       </div>
                     </div>
                   );
                 })}

                 {/* Render Loose Photos */}
                 {loosePhotos.map((p) => {
                   const isSelected = selectedPhotoIds.has(p.id);
                   return (
                     <div 
                       key={p.id} 
                       className={`aspect-square bg-white/5 border rounded-lg overflow-hidden relative transition-all ${
                         isSelected ? 'border-white ring-2 ring-white scale-[0.96]' : 'border-white/10'
                       }`}
                       onClick={() => {
                         if (!isSelectionMode) return;
                         const next = new Set(selectedPhotoIds);
                         if (next.has(p.id)) next.delete(p.id);
                         else next.add(p.id);
                         setSelectedPhotoIds(next);
                       }}
                     >
                       <img src={p.url} alt="Uploaded" className={`object-cover w-full h-full transition-opacity ${isSelectionMode && !isSelected ? 'opacity-40' : 'opacity-100'}`} loading="lazy" />
                       {isSelectionMode && (
                         <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 transition-colors ${isSelected ? 'bg-white border-white' : 'border-white/40 bg-black/20'}`}>
                           {isSelected && <span className="absolute inset-0 flex items-center justify-center text-black text-xs">✓</span>}
                         </div>
                       )}
                     </div>
                   );
                 })}
                 
                 {uploading && (
                    <div className="aspect-square bg-white/5 border border-white/10 rounded-lg overflow-hidden relative flex items-center justify-center animate-pulse">
                      <div className="text-[10px] text-white/30 uppercase tracking-widest">Uploading</div>
                    </div>
                 )}
               </div>
             )}
          </div>
        )}
        
        {activeTab === 'groups' && (
          <div className="flex flex-col space-y-4 pb-12">
            {groups.length === 0 ? (
              <div className="flex h-[60vh] flex-col items-center justify-center opacity-50">
                <div className="text-sm font-light tracking-widest text-white/40 uppercase">No Groups Yet</div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                 {groups.map(g => {
                   const coverPhoto = photos.find(p => p.id === g.cover_photo_id);
                   const count = photos.filter(p => p.group_id === g.id).length;
                   return (
                     <div key={g.id} className="aspect-square bg-white/10 border border-white/20 rounded-lg overflow-hidden relative group">
                       {coverPhoto && <img src={coverPhoto.url} className="object-cover w-full h-full opacity-60" loading="lazy" />}
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                       <div className="absolute top-2 right-2 bg-white/20 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-mono text-white border border-white/30">
                         {count}
                       </div>
                       <div className="absolute bottom-2 left-2 right-2">
                         <p className="text-[10px] font-semibold uppercase tracking-wider truncate text-white leading-tight">{g.item_type}</p>
                         <p className="text-[9px] text-white/70 truncate">{g.size}</p>
                       </div>
                     </div>
                   );
                 })}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'progress' && (
          <div className="flex h-[60vh] flex-col items-center justify-center opacity-50">
             <div className="text-sm font-light tracking-widest text-white/40 uppercase">Progress</div>
          </div>
        )}
      </div>

      <input
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFiles}
      />

      <footer className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between bg-black/40 px-6 py-6 backdrop-blur-2xl border-t border-white/10 pb-safe">
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || isSelectionMode}
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

      {/* Floating Action Bar for Selection Mode */}
      {isSelectionMode && (
        <div className="fixed bottom-[100px] left-6 right-6 z-50 flex items-center justify-between bg-white/10 backdrop-blur-xl border border-white/20 px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.8)]">
          <span className="text-xs font-medium tracking-widest uppercase">
            {selectedPhotoIds.size} Selected
          </span>
          <button 
            disabled={selectedPhotoIds.size === 0}
            onClick={() => {
              setGroupForm(f => ({ ...f, size: sizeOptions[f.itemType][0] }));
              setShowGroupModal(true);
            }}
            className="bg-white text-black px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 active:scale-95 transition-transform"
          >
            Create
          </button>
        </div>
      )}

      {/* Group Creation Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-xl p-6 pt-safe animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-8 mt-4">
            <h2 className="text-2xl font-light tracking-wide text-white">New Group</h2>
            <button onClick={() => setShowGroupModal(false)} className="text-white/60 p-2 text-xl">✕</button>
          </div>
          
          <div className="space-y-8 flex-1 overflow-y-auto hide-scrollbar">
            {/* Item Type */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-3">Item Type</label>
              <select 
                value={groupForm.itemType}
                onChange={(e) => setGroupForm({ ...groupForm, itemType: e.target.value, size: sizeOptions[e.target.value][0] })}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-lg outline-none focus:border-white/50 text-white appearance-none"
              >
                {Object.keys(sizeOptions).map(t => <option key={t} value={t} className="bg-zinc-900 text-white">{t}</option>)}
              </select>
            </div>

            {/* Size */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-3">Size</label>
              <select 
                value={groupForm.size}
                onChange={(e) => setGroupForm({ ...groupForm, size: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-lg outline-none focus:border-white/50 text-white appearance-none"
              >
                {sizeOptions[groupForm.itemType].map(s => <option key={s} value={s} className="bg-zinc-900 text-white">{s}</option>)}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-3">Notes (Optional)</label>
              <textarea 
                value={groupForm.notes}
                onChange={(e) => setGroupForm({ ...groupForm, notes: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-white/50 min-h-[100px] resize-none"
                placeholder="Condition, brand, flaws..."
              />
            </div>

            {/* Selected Photos Preview */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-3">
                Selected Photos ({selectedPhotoIds.size})
              </label>
              <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar">
                {Array.from(selectedPhotoIds).map(id => {
                  const p = photos.find(x => x.id === id);
                  if (!p) return null;
                  return (
                    <div key={id} className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden border border-white/10">
                      <img src={p.url} className="object-cover w-full h-full" />
                      <button 
                        onClick={() => {
                          const next = new Set(selectedPhotoIds);
                          next.delete(id);
                          setSelectedPhotoIds(next);
                          if (next.size === 0) setShowGroupModal(false);
                        }}
                        className="absolute top-1.5 right-1.5 bg-black/80 backdrop-blur-md rounded-full w-6 h-6 flex items-center justify-center text-[10px] text-white border border-white/20 active:scale-90"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 pb-safe pt-4 border-t border-white/10">
            <button 
              onClick={handleCreateGroup}
              disabled={isCreatingGroup || selectedPhotoIds.size === 0}
              className="w-full bg-white text-black py-4 rounded-xl text-sm font-bold tracking-widest uppercase disabled:opacity-50 active:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              {isCreatingGroup ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </div>
      )}
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
