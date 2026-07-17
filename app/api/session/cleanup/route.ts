import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // 1. Fetch all ungrouped photos for this session
    const { data: loosePhotos, error: fetchError } = await supabaseServer
      .from('photos')
      .select('id, storage_path')
      .eq('session_id', sessionId)
      .is('group_id', null);

    if (fetchError) {
      console.error('Error fetching loose photos:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!loosePhotos || loosePhotos.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }

    const idsToDelete = loosePhotos.map(p => p.id);
    const pathsToDelete = loosePhotos.map(p => p.storage_path);

    // 2. Delete from Storage
    const { error: storageError } = await supabaseServer.storage
      .from('photo-imports')
      .remove(pathsToDelete);

    if (storageError) {
      console.error('Error deleting from storage:', storageError);
      // We log but continue to delete DB rows to keep it clean, or fail?
      // Better to fail so we don't leave orphaned files if DB is deleted.
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }

    // 3. Delete from Database
    const { error: dbError } = await supabaseServer
      .from('photos')
      .delete()
      .in('id', idsToDelete);

    if (dbError) {
      console.error('Error deleting from DB:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: idsToDelete.length });
  } catch (error: any) {
    console.error('Session cleanup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
