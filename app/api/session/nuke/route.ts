import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // 1. Fetch all photos for this session
    const { data: photos, error: fetchError } = await supabaseServer
      .from('photos')
      .select('id, storage_path')
      .eq('session_id', sessionId);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (photos && photos.length > 0) {
      const pathsToDelete = photos.map(p => p.storage_path);
      // 2. Delete from Storage
      await supabaseServer.storage.from('photo-imports').remove(pathsToDelete);
    }

    // 3. Delete all photos from DB (session_id)
    await supabaseServer.from('photos').delete().eq('session_id', sessionId);

    // 4. Delete all groups from DB (session_id)
    await supabaseServer.from('groups').delete().eq('session_id', sessionId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
