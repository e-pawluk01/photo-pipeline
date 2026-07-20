import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { id, title, category_path, brand, condition, size, notes, measurements, generate_cover, reference_photo_id, cover_photo_id } = await request.json();

    if (!id || !title || !category_path || !size || !condition || !cover_photo_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: groupData, error: groupError } = await supabaseServer
      .from('groups')
      .update({
        title,
        category_path,
        brand: brand || null,
        condition,
        size,
        notes: notes || null,
        measurements: measurements || null,
        generate_cover: generate_cover || false,
        reference_photo_id: reference_photo_id || null,
        cover_photo_id
      })
      .eq('id', id)
      .select()
      .single();

    if (groupError) {
      console.error('Error updating group:', groupError);
      return NextResponse.json({ error: groupError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, group: groupData });
  } catch (error: any) {
    console.error('Group update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
