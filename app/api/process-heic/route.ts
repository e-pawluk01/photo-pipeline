import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { convertToCompressedPng } from '@/lib/convert';

export async function POST(request: Request) {
  try {
    const { storagePath } = await request.json();

    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath is required' }, { status: 400 });
    }

    // 1. Download the HEIC file from Supabase
    const { data: fileData, error: downloadError } = await supabaseServer.storage
      .from('photo-imports')
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error('Error downloading HEIC:', downloadError);
      return NextResponse.json({ error: downloadError?.message || 'Download failed' }, { status: 500 });
    }

    // Convert Blob to Buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Convert to PNG using the existing library
    const { buffer: pngBuffer, finalBytes } = await convertToCompressedPng(buffer);

    // 3. Upload the new PNG back to Supabase
    // Change extension in storage path
    const newStoragePath = storagePath.replace(/\.heic$/i, '.png').replace(/\.heif$/i, '.png');

    const { error: uploadError } = await supabaseServer.storage
      .from('photo-imports')
      .upload(newStoragePath, pngBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading converted PNG:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // 4. Delete the original HEIC file
    const { error: deleteError } = await supabaseServer.storage
      .from('photo-imports')
      .remove([storagePath]);

    if (deleteError) {
      console.error('Failed to delete original HEIC (non-fatal):', deleteError);
      // We don't fail the request here, but log it.
    }

    return NextResponse.json({
      success: true,
      newStoragePath,
      finalBytes,
    });
  } catch (error: any) {
    console.error('HEIC processing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
