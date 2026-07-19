import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request: Request, { params }: { params: { groupId: string } }) {
  const { groupId } = params;

  if (!groupId) {
    return NextResponse.json({ error: 'Missing groupId' }, { status: 400 });
  }

  try {
    // 1. Fetch photos
    const { data: photos, error: photosError } = await supabaseServer
      .from('photos')
      .select('id, storage_path')
      .eq('group_id', groupId);

    if (photosError) {
      throw new Error(`Failed to fetch photos: ${photosError.message}`);
    }

    if (!photos || photos.length === 0) {
      // If no photos remain, it means cleanup might have partially succeeded before
      // We can just mark as done.
    } else {
      // 2. Cleanup Supabase Storage FIRST
      const pathsToDelete = photos.map(p => p.storage_path);
      const { error: storageError } = await supabaseServer.storage
        .from('photo-imports')
        .remove(pathsToDelete);

      if (storageError) {
        throw new Error(`Supabase storage cleanup failed again: ${storageError.message}`);
      }

      // 3. Delete photos from DB
      const idsToDelete = photos.map(p => p.id);
      const { error: dbError } = await supabaseServer
        .from('photos')
        .delete()
        .in('id', idsToDelete);

      if (dbError) {
        throw new Error(`Supabase DB cleanup failed again: ${dbError.message}`);
      }
    }

    // 4. Update group to done
    await supabaseServer
      .from('groups')
      .update({ 
        status: 'done',
        error_message: null
      })
      .eq('id', groupId);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error(`Group ${groupId} retry-cleanup failed:`, error);
    
    // Update the error message but keep it in cleanup_failed
    await supabaseServer
      .from('groups')
      .update({ 
        error_message: error.message || 'Unknown error' 
      })
      .eq('id', groupId);

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
