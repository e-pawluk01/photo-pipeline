import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { photoIds, groupId } = await request.json();

    if (!photoIds || photoIds.length === 0) {
      return NextResponse.json({ error: 'Missing photoIds' }, { status: 400 });
    }

    const { error: photoUpdateError } = await supabaseServer
      .from('photos')
      .update({ group_id: groupId || null })
      .in('id', photoIds);

    if (photoUpdateError) {
      console.error('Error assigning photos:', photoUpdateError);
      return NextResponse.json({ error: photoUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Photo assign error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
