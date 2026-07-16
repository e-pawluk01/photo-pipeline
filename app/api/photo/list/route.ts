import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('photos')
      .select('id, storage_path')
      .order('upload_timestamp', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const photos = data.map((record) => ({
      id: record.id,
      url: `${process.env.SUPABASE_URL}/storage/v1/object/public/photo-imports/${record.storage_path}`
    }));

    return NextResponse.json({ success: true, photos });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
