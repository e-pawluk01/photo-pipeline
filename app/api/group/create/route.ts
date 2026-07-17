import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { item_type, size, notes, photoIds, cover_photo_id, session_id } = await request.json();

    if (!item_type || !size || !photoIds || photoIds.length === 0 || !cover_photo_id || !session_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Create the group
    const { data: groupData, error: groupError } = await supabaseServer
      .from('groups')
      .insert([
        {
          item_type,
          size,
          notes: notes || null,
          cover_photo_id,
          session_id,
        }
      ])
      .select()
      .single();

    if (groupError) {
      console.error('Error creating group:', groupError);
      return NextResponse.json({ error: groupError.message }, { status: 500 });
    }

    // 2. Update the photos to set the group_id
    const { error: photoUpdateError } = await supabaseServer
      .from('photos')
      .update({ group_id: groupData.id })
      .in('id', photoIds);

    if (photoUpdateError) {
      console.error('Error updating photos with group_id:', photoUpdateError);
      return NextResponse.json({ error: photoUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, group: groupData });
  } catch (error: any) {
    console.error('Group creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
