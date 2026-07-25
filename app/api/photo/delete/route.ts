import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { photoId } = await request.json();

    if (!photoId) {
      return NextResponse.json({ error: 'photoId is required' }, { status: 400 });
    }

    // First fetch the storage path
    const { data: photoData, error: fetchError } = await supabaseServer
      .from('photos')
      .select('storage_path')
      .eq('id', photoId)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Delete from DB
    const { error: dbError } = await supabaseServer
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (dbError) {
      console.error('Error deleting photo from DB:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // Optionally delete from storage
    if (photoData?.storage_path) {
      const { error: storageError } = await supabaseServer
        .storage
        .from('photo-imports')
        .remove([photoData.storage_path]);
        
      if (storageError) {
        console.error('Error deleting photo from storage:', storageError);
        // We don't fail the request if storage deletion fails, as the DB record is already gone.
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
