import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { photoIds, groupId } = await request.json();

    if (!photoIds || photoIds.length === 0) {
      return NextResponse.json({ error: 'Missing photoIds' }, { status: 400 });
    }

    let affectedGroupIds: string[] = [];

    // If removing photos from a group (groupId is null), track which groups are affected
    if (!groupId) {
      const { data: affectedPhotos } = await supabaseServer
        .from('photos')
        .select('group_id')
        .in('id', photoIds)
        .not('group_id', 'is', null);

      if (affectedPhotos) {
        affectedGroupIds = Array.from(new Set(affectedPhotos.map(p => p.group_id).filter(Boolean))) as string[];
      }
    }

    const { error: photoUpdateError } = await supabaseServer
      .from('photos')
      .update({ group_id: groupId || null })
      .in('id', photoIds);

    if (photoUpdateError) {
      console.error('Error assigning photos:', photoUpdateError);
      return NextResponse.json({ error: photoUpdateError.message }, { status: 500 });
    }

    // Check affected groups to see if any are now empty
    if (!groupId && affectedGroupIds.length > 0) {
      for (const gid of affectedGroupIds) {
        const { count, error: countError } = await supabaseServer
          .from('photos')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', gid);

        if (!countError && count === 0) {
          await supabaseServer.from('groups').delete().eq('id', gid);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Photo assign error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
