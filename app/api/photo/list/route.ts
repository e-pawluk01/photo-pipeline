import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    console.log('API /photo/list called with sessionId:', sessionId);

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Fetch photos for session
    const { data: photosData, error: photosError } = await supabaseServer
      .from('photos')
      .select('id, storage_path, group_id')
      .eq('session_id', sessionId)
      .order('upload_timestamp', { ascending: false });

    if (photosError) {
      console.error('API /photo/list error fetching photos:', photosError);
      return NextResponse.json({ error: photosError.message }, { status: 500 });
    }

    console.log(`API /photo/list found ${photosData.length} photos for session ${sessionId}`);

    // Fetch groups for session
    const { data: groupsData, error: groupsError } = await supabaseServer
      .from('groups')
      .select('id, item_type, size, notes, cover_photo_id, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (groupsError) {
      return NextResponse.json({ error: groupsError.message }, { status: 500 });
    }

    const photos = photosData.map((record) => ({
      id: record.id,
      group_id: record.group_id,
      url: `${process.env.SUPABASE_URL}/storage/v1/object/public/photo-imports/${record.storage_path}`
    }));

    return NextResponse.json({ success: true, photos, groups: groupsData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
