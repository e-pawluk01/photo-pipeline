import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { storagePath, sessionId, boughtForPrice } = await request.json();

    if (!storagePath || !sessionId) {
      return NextResponse.json({ error: 'storagePath and sessionId are required' }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('photos')
      .insert([
        {
          storage_path: storagePath,
          session_id: sessionId,
          bought_for_price: boughtForPrice || null,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error inserting DB record:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      record: data,
      publicUrl: `${process.env.SUPABASE_URL}/storage/v1/object/public/photo-imports/${storagePath}`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
