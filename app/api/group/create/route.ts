import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { title, category_path, brand, condition, size, notes, measurements, generate_cover, reference_photo_id, photoIds, cover_photo_id, session_id, bought_for_price } = await request.json();

    if (!title || !category_path || !size || !condition || !photoIds || photoIds.length === 0 || !cover_photo_id || !session_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: groupData, error: groupError } = await supabaseServer
      .from('groups')
      .insert([
        {
          title,
          category_path,
          brand: brand || null,
          condition,
          item_type: 'UNUSED',
          size,
          notes: notes || null,
          measurements: measurements || null,
          generate_cover: generate_cover || false,
          reference_photo_id: reference_photo_id || null,
          cover_photo_id,
          session_id,
          bought_for_price: bought_for_price || null,
        }
      ])
      .select()
      .single();

    if (groupError) {
      console.error('Error creating group:', groupError);
      return NextResponse.json({ error: groupError.message }, { status: 500 });
    }

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
