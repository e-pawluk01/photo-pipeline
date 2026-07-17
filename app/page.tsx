'use client';

import { useEffect, useState, useRef } from 'react';

const PASSCODE_KEY = 'photo-pipeline-passcode';

const TAXONOMY: Record<string, Record<string, string[]>> = {
  "Woman": {
    "Outerwear": ["Capes & ponchos", "Coats", "Gilets & body warmers", "Jackets"],
    "Jumper & sweaters": ["Hoodies & sweatshirts", "Jumpers", "Cardigans", "Boleros", "Other Jumper & sweaters"],
    "Suits & Blazers": ["Blazers", "Trousers suits", "Other suits & blazers"],
    "Dresses": ["Mini-dresses", "Midi-dresses", "Long dresses", "Special-occasion dresses", "Summer dresses", "Winter dresses", "Strapless dresses", "Little black dresses", "Other dresses"],
    "Skirts": ["Mini skirts", "Knee-length skirts", "Midi skirts", "Maxi skirts", "Asymmetrical skirts"],
    "Tops & t-shirts": ["Shirts", "Blouses", "Camis", "T-shirts", "Vest tops", "Crop tops", "Short-sleeved tops", "Long-sleeved tops", "Off-the-shoulder tops", "Other Tops & t-shirts"],
    "Jeans": ["Cropped jeans", "Flared jeans", "High waisted jeans", "Skinny jeans", "Straight jeans", "Other"],
    "Trousers & leggings": ["Cropped trousers & chinos", "Wide-leg trousers", "Skinny trousers", "Straight-leg trousers", "Leggings", "Other trousers"],
    "Shorts & cropped trousers": ["Low-waisted shorts", "High-waisted shorts", "Knee-length shorts", "Denim shorts", "Lace shorts", "Cargo shorts", "Cropped trousers", "Other shorts & cropped trousers"],
    "Lingerie & nightwear": ["Bras", "Panties", "Sets", "Shapewear", "Nightwear", "Lingerie accessories"],
    "Activewear": ["Outerwear", "Shorts", "Skirts", "Tops & t-shirts", "Tracksuits", "Hoodies & sweatshirts", "Other activewear"],
    "Shoes": ["Boots", "Clogs & mules", "Boar shoes, loafers & moccasins", "Flip-flops & slides", "Heels", "Lace-up shoes", "Trainers"],
    "Bags": ["Bum bags", "Clutches", "Handbags", "Hobo bags", "Satchels & messenger bags", "Tote bags", "Wallets & purses"],
    "Accessories": ["Belts", "Hats & caps", "Jewelry", "Other accessories"]
  }
};

const CLOTHING_SIZES = ['XS (UK 4-6)', 'S (UK 8-10)', 'M (UK 12-14)', 'L (UK 16-18)', 'XL (UK 20-22)', 'One Size'];
const SHOE_SIZES = ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'];
const ONE_SIZE = ['One Size'];

function getSizesForCategory(category: string) {
  if (category === 'Shoes') return SHOE_SIZES;
  if (category === 'Bags' || category === 'Accessories') return ONE_SIZE;
  return CLOTHING_SIZES;
}

const CONDITIONS = ['New with tags', 'Very good', 'Good', 'Satisfactory'];

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

  if (checkingGate) return <main className="min-h-[100dvh] bg-black" />;

  if (!unlocked) {
    return <PasscodeGate onUnlock={(code: string) => { setPasscode(code); setUnlocked(true); }} verify={verifyPasscode} />;
  }

  return <AppShell />;
}

type Photo = { id: string; url: string; group_id: string | null };
type Group = { 
  id: string; 
  title: string; 
  category_path: string; 
  brand: string | null; 
  condition: string; 
  size: string; 
  notes: string | null; 
  cover_photo_id: string; 
  created_at: string 
};

function AppShell() {
  const [activeTab, setActiveTab] = useState<'photos' | 'groups' | 'progress'>('photos');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0); 
  const [uploadStats, setUploadStats] = useState<{ success: number; total: number } | null>(null);
  
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  // Selection & Modal
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [showGroupModal, setShowGroupModal] = useState(false);
  
  // Detail View & Adding
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null);

  // Send State
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [readyToProcess, setReadyToProcess] = useState(false);

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
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
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

  async function handleAssignPhotosToGroup() {
    if (!addingToGroupId || selectedPhotoIds.size === 0) return;
    try {
      const ids = Array.from(selectedPhotoIds);
      const res = await fetch('/api/photo/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds: ids, groupId: addingToGroupId })
      });
      if (!res.ok) throw new Error('Failed to assign photos');
      
      setPhotos(prev => prev.map(p => ids.includes(p.id) ? { ...p, group_id: addingToGroupId } : p));
      setSelectedPhotoIds(new Set());
      setIsSelectionMode(false);
      setActiveGroupId(addingToGroupId); // go back to detail view
      setAddingToGroupId(null);
    } catch (err) {
      alert('Error assigning photos');
    }
  }

  async function handleCleanup() {
    if (!sessionId) return;
    setIsCleaningUp(true);
    try {
      const res = await fetch('/api/session/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      if (res.ok) {
        setPhotos(prev => prev.filter(p => p.group_id !== null));
        setShowCleanupModal(false);
        setReadyToProcess(true);
      } else {
        throw new Error('Cleanup failed');
      }
    } catch (err) {
      alert('Failed to cleanup ungrouped photos');
    } finally {
      setIsCleaningUp(false);
    }
  }

  const loosePhotos = photos.filter(p => !p.group_id);

  if (readyToProcess) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#050505] text-white px-6 text-center">
        <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h1 className="text-2xl font-light tracking-wide mb-2">Ready to Process</h1>
        <p className="text-white/40 text-sm tracking-widest uppercase">Groups built and cleaned up successfully.</p>
      </main>
    );
  }

  // If viewing a detail page
  if (activeGroupId) {
    const activeGroup = groups.find(g => g.id === activeGroupId);
    if (activeGroup) {
      return (
        <GroupDetailView 
          group={activeGroup}
          photos={photos}
          onUpdate={(updatedGroup: Group) => {
            setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
          }}
          onBack={() => setActiveGroupId(null)}
          onAddPhotos={() => {
            setAddingToGroupId(activeGroupId);
            setActiveGroupId(null);
            setIsSelectionMode(true);
          }}
          onRemovePhoto={async (photoId: string) => {
             // quick optimistic update
             setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, group_id: null } : p));
             fetch('/api/photo/assign', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ photoIds: [photoId], groupId: null })
             });
          }}
          onSetCover={async (photoId: string) => {
             // quick optimistic update
             setGroups(prev => prev.map(g => g.id === activeGroupId ? { ...g, cover_photo_id: photoId } : g));
             fetch('/api/group/edit', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ ...activeGroup, cover_photo_id: photoId })
             });
          }}
        />
      );
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-black text-white selection:bg-white selection:text-black pb-[120px]">
      <header className="sticky top-0 z-40 flex flex-col justify-end bg-black/60 px-6 pb-4 pt-16 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-end justify-between">
          <h1 className="text-xl font-medium tracking-wide text-white/90">
            Resale Batch
          </h1>
          {uploading && uploadStats && (
            <p className="text-xs font-mono text-white/60 mb-1">
              {uploadStats.success} / {uploadStats.total} uploaded
            </p>
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
                     <div key={g.id} onClick={() => !isSelectionMode && setActiveGroupId(g.id)} className={`aspect-square bg-white/10 border border-white/20 rounded-lg overflow-hidden relative group ${!isSelectionMode ? 'cursor-pointer active:scale-95 transition-transform' : 'opacity-40'}`}>
                       {coverPhoto && <img src={coverPhoto.url} className="object-cover w-full h-full opacity-60" loading="lazy" />}
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                       <div className="absolute top-2 right-2 bg-white/20 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-mono text-white border border-white/30">
                         {count}
                       </div>
                       <div className="absolute bottom-2 left-2 right-2">
                         <p className="text-[10px] font-semibold uppercase tracking-wider truncate text-white leading-tight">{g.title}</p>
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
                     <div key={g.id} onClick={() => setActiveGroupId(g.id)} className="aspect-square bg-white/10 border border-white/20 rounded-lg overflow-hidden relative group cursor-pointer active:scale-95 transition-transform">
                       {coverPhoto && <img src={coverPhoto.url} className="object-cover w-full h-full opacity-60" loading="lazy" />}
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                       <div className="absolute top-2 right-2 bg-white/20 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-mono text-white border border-white/30">
                         {count}
                       </div>
                       <div className="absolute bottom-2 left-2 right-2">
                         <p className="text-[10px] font-semibold uppercase tracking-wider truncate text-white leading-tight">{g.title}</p>
                         <p className="text-[9px] text-white/70 truncate">{g.size}</p>
                       </div>
                     </div>
                   );
                 })}
              </div>
            )}
          </div>
        )}
      </div>

      <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFiles} />

      {/* Single Pill Footer */}
      <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center bg-black/80 backdrop-blur-3xl border border-white/20 rounded-full shadow-[0_0_40px_rgba(0,0,0,0.8)] px-2 py-2 space-x-2">
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || isSelectionMode}
          className="flex h-12 w-16 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition active:scale-90 text-white disabled:opacity-30 disabled:active:scale-100"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14m-7-7h14"/></svg>
        </button>
        
        {activeTab === 'photos' && !uploading && (
          <button 
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              setSelectedPhotoIds(new Set());
              if (addingToGroupId) setAddingToGroupId(null);
            }} 
            className={`flex h-12 w-16 items-center justify-center rounded-full transition active:scale-90 ${isSelectionMode ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {isSelectionMode ? (
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            )}
          </button>
        )}

        <button 
          onClick={() => {
            if (loosePhotos.length > 0) setShowCleanupModal(true);
            else handleCleanup();
          }}
          disabled={groups.length === 0 || uploading || isSelectionMode}
          className="flex h-12 w-16 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition active:scale-90 text-white disabled:opacity-30 disabled:active:scale-100"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </footer>

      {/* Floating Action Bar for Selection Mode */}
      {isSelectionMode && (
        <div className="fixed bottom-[110px] left-6 right-6 z-50 flex items-center justify-between bg-white/10 backdrop-blur-xl border border-white/20 px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.8)]">
          <span className="text-xs font-medium tracking-widest uppercase">
            {selectedPhotoIds.size} Selected
          </span>
          <button 
            disabled={selectedPhotoIds.size === 0}
            onClick={() => {
              if (addingToGroupId) {
                handleAssignPhotosToGroup();
              } else {
                setShowGroupModal(true);
              }
            }}
            className="bg-white text-black px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 active:scale-95 transition-transform"
          >
            {addingToGroupId ? 'Add to Group' : 'Create'}
          </button>
        </div>
      )}

      {/* Cleanup Confirmation Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6">
          <div className="bg-white/10 border border-white/20 p-8 rounded-3xl max-w-sm w-full text-center">
             <h2 className="text-xl font-medium mb-4">Ready to Send?</h2>
             <p className="text-white/60 text-sm mb-8">
               {loosePhotos.length} photos aren't in a group and will be completely deleted from the database. Continue?
             </p>
             <div className="flex space-x-4">
               <button onClick={() => setShowCleanupModal(false)} className="flex-1 bg-white/10 py-3 rounded-full text-sm font-medium">Cancel</button>
               <button onClick={handleCleanup} disabled={isCleaningUp} className="flex-1 bg-red-500/80 text-white py-3 rounded-full text-sm font-medium disabled:opacity-50">
                 {isCleaningUp ? 'Deleting...' : 'Confirm'}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Group Creation Modal */}
      {showGroupModal && sessionId && (
        <GroupModal 
          photos={photos}
          selectedIds={selectedPhotoIds}
          sessionId={sessionId}
          onClose={() => setShowGroupModal(false)}
          onDeselect={(id: string) => {
            const next = new Set(selectedPhotoIds);
            next.delete(id);
            setSelectedPhotoIds(next);
            if (next.size === 0) setShowGroupModal(false);
          }}
          onSuccess={(newGroup: Group) => {
            setGroups(prev => [newGroup, ...prev]);
            const ids = Array.from(selectedPhotoIds);
            setPhotos(prev => prev.map(p => ids.includes(p.id) ? { ...p, group_id: newGroup.id } : p));
            setShowGroupModal(false);
            setIsSelectionMode(false);
            setSelectedPhotoIds(new Set());
          }}
        />
      )}
    </main>
  );
}

// ----------------------------------------------------------------------------------
// Group Modal Component (Create Mode)
// ----------------------------------------------------------------------------------
function GroupModal({ photos, selectedIds, sessionId, onClose, onDeselect, onSuccess }: any) {
  const [dept, setDept] = useState('Woman');
  const [cat, setCat] = useState('Outerwear');
  const [subcat, setSubcat] = useState('Jackets');
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState(CLOTHING_SIZES[2]);
  const [condition, setCondition] = useState('Very good');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Cascading logic
  useEffect(() => {
    const cats = Object.keys(TAXONOMY[dept]);
    if (!cats.includes(cat)) {
      setCat(cats[0]);
    }
  }, [dept]);

  useEffect(() => {
    const subcats = TAXONOMY[dept][cat];
    if (!subcats.includes(subcat)) {
      setSubcat(subcats[0]);
    }
    // Update size options based on category
    const options = getSizesForCategory(cat);
    if (!options.includes(size)) {
      setSize(options[0]);
    }
  }, [cat]);

  async function handleSubmit() {
    setIsSaving(true);
    try {
      const idsArray = Array.from(selectedIds);
      const categoryPath = `${dept}/${cat}/${subcat}`;
      const finalTitle = title.trim() || subcat;

      const res = await fetch('/api/group/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: finalTitle,
          category_path: categoryPath,
          brand,
          condition,
          size,
          notes,
          photoIds: idsArray,
          cover_photo_id: idsArray[0],
          session_id: sessionId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSuccess(data.group);
    } catch (err) {
      alert('Failed to create group');
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-xl p-6 pt-safe animate-in fade-in duration-200">
      <div className="flex items-center justify-between mb-6 mt-4">
        <h2 className="text-2xl font-light tracking-wide text-white">New Group</h2>
        <button onClick={onClose} className="text-white/60 p-2 text-xl">✕</button>
      </div>
      
      <div className="space-y-6 flex-1 overflow-y-auto hide-scrollbar pb-12">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-2">Title</label>
            <input 
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={subcat}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-white/50 text-white placeholder:text-white/20"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-2">Brand</label>
            <input 
              value={brand} onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Zara"
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-white/50 text-white placeholder:text-white/20"
            />
          </div>
        </div>

        <div className="space-y-3 p-4 bg-white/5 border border-white/10 rounded-2xl">
          <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Category</label>
          <select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-3 outline-none text-white appearance-none">
            {Object.keys(TAXONOMY).map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-3 outline-none text-white appearance-none">
            {Object.keys(TAXONOMY[dept]).map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={subcat} onChange={(e) => setSubcat(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-3 outline-none text-white appearance-none">
            {TAXONOMY[dept][cat].map((s: string) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-2">Size</label>
            <select value={size} onChange={(e) => setSize(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none text-white appearance-none">
              {getSizesForCategory(cat).map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-2">Condition</label>
            <select value={condition} onChange={(e) => setCondition(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none text-white appearance-none">
              {CONDITIONS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-2">Notes</label>
          <textarea 
            value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-white/50 min-h-[80px] resize-none"
            placeholder="Condition details..."
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-3">
            Selected ({selectedIds.size})
          </label>
          <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar">
            {Array.from(selectedIds).map(id => {
              const p = photos.find((x: Photo) => x.id === id);
              if (!p) return null;
              return (
                <div key={id as string} className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border border-white/10">
                  <img src={p.url} className="object-cover w-full h-full" />
                  <button onClick={() => onDeselect(id)} className="absolute top-1 right-1 bg-black/80 rounded-full w-5 h-5 flex items-center justify-center text-[10px]">✕</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 pb-safe border-t border-white/10 pt-4">
        <button 
          onClick={handleSubmit} disabled={isSaving || selectedIds.size === 0}
          className="w-full bg-white text-black py-4 rounded-xl text-sm font-bold tracking-widest uppercase disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Create'}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------------
// Detail View Component (Edit Mode)
// ----------------------------------------------------------------------------------
function GroupDetailView({ group, photos, onUpdate, onBack, onAddPhotos, onRemovePhoto, onSetCover }: any) {
  const groupPhotos = photos.filter((p: Photo) => p.group_id === group.id);
  
  const [title, setTitle] = useState(group.title);
  const [brand, setBrand] = useState(group.brand || '');
  
  const parts = group.category_path.split('/');
  const [dept, setDept] = useState(parts[0] || 'Woman');
  const [cat, setCat] = useState(parts[1] || 'Outerwear');
  const [subcat, setSubcat] = useState(parts[2] || 'Jackets');
  
  const [size, setSize] = useState(group.size);
  const [condition, setCondition] = useState(group.condition);
  const [notes, setNotes] = useState(group.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const cats = Object.keys(TAXONOMY[dept]);
    if (!cats.includes(cat)) setCat(cats[0]);
  }, [dept]);

  useEffect(() => {
    const subcats = TAXONOMY[dept][cat];
    if (!subcats.includes(subcat)) setSubcat(subcats[0]);
    const options = getSizesForCategory(cat);
    if (!options.includes(size)) setSize(options[0]);
  }, [cat]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const categoryPath = `${dept}/${cat}/${subcat}`;
      const finalTitle = title.trim() || subcat;
      const updated = {
        ...group,
        title: finalTitle,
        category_path: categoryPath,
        brand,
        condition,
        size,
        notes,
      };
      const res = await fetch('/api/group/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdate(data.group);
      onBack();
    } catch (err) {
      alert('Failed to update group');
      setIsSaving(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-black text-white">
      <header className="sticky top-0 z-40 flex items-center justify-between bg-black/60 px-6 pb-4 pt-16 backdrop-blur-xl border-b border-white/10">
         <button onClick={onBack} className="text-white/60 text-sm font-medium tracking-wide">← Back</button>
         <button onClick={handleSave} disabled={isSaving} className="text-white font-semibold uppercase tracking-widest text-xs">
           {isSaving ? 'Saving' : 'Done'}
         </button>
      </header>
      
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32 space-y-8">
        
        {/* Photos Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Photos ({groupPhotos.length})</h3>
             <button onClick={onAddPhotos} className="bg-white/10 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold">+ Add</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {groupPhotos.map((p: Photo) => {
              const isCover = group.cover_photo_id === p.id;
              return (
                <div key={p.id} className={`aspect-square relative rounded-xl overflow-hidden border ${isCover ? 'border-white' : 'border-white/10'}`}>
                  <img src={p.url} className="object-cover w-full h-full" />
                  <button onClick={() => onRemovePhoto(p.id)} className="absolute top-1 right-1 bg-black/80 rounded-full w-5 h-5 flex items-center justify-center text-[10px]">✕</button>
                  {!isCover && (
                    <button onClick={() => onSetCover(p.id)} className="absolute bottom-1 left-1 right-1 bg-black/80 backdrop-blur-md rounded text-[9px] py-1 text-center font-medium uppercase">Set Cover</button>
                  )}
                  {isCover && (
                    <div className="absolute bottom-0 left-0 right-0 bg-white text-black text-[9px] font-bold text-center py-1 uppercase tracking-widest">Cover</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Edit Form */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-2">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-2">Brand</label>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none text-white" />
            </div>
          </div>

          <div className="space-y-3 p-4 bg-white/5 border border-white/10 rounded-2xl">
            <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Category</label>
            <select value={dept} onChange={(e) => setDept(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-3 outline-none text-white appearance-none">
              {Object.keys(TAXONOMY).map(d => <option key={d}>{d}</option>)}
            </select>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-3 outline-none text-white appearance-none">
              {Object.keys(TAXONOMY[dept]).map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={subcat} onChange={(e) => setSubcat(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-3 outline-none text-white appearance-none">
              {TAXONOMY[dept][cat].map((s: string) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-2">Size</label>
              <select value={size} onChange={(e) => setSize(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none text-white appearance-none">
                {getSizesForCategory(cat).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-2">Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none text-white appearance-none">
                {CONDITIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-2">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none min-h-[80px] resize-none" />
          </div>
        </div>

      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={`relative pb-2 text-[13px] font-medium uppercase tracking-wider transition-colors ${active ? 'text-white' : 'text-white/40'}`}>
      {label}
      {active && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />}
    </button>
  );
}

function PasscodeGate({ onUnlock, verify }: any) {
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
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">System Auth</p>
          <h1 className="text-2xl font-light tracking-wide text-white">Identify</h1>
        </div>
        <div className="relative mb-6">
          <input type="password" inputMode="text" autoFocus value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-none border-b border-white/20 bg-transparent px-4 py-3 text-center text-xl text-white outline-none placeholder:text-white/20 focus:border-white/80 transition-colors font-mono tracking-widest" placeholder="••••••" />
        </div>
        {error && <p className="mb-6 text-center text-xs tracking-widest text-red-500/80">{error}</p>}
        <button type="submit" disabled={checking || value.length === 0} className="w-full rounded-none bg-white py-4 text-xs font-semibold uppercase tracking-[0.2em] text-black transition-transform active:scale-[0.98] disabled:opacity-30 disabled:active:scale-100">
          {checking ? 'Authenticating...' : 'Log In'}
        </button>
      </form>
    </main>
  );
}
