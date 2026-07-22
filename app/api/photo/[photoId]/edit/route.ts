import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import sharp from 'sharp';

export async function POST(request: Request, { params }: { params: { photoId: string } }) {
  try {
    const photoId = params.photoId;
    const { crop, rotation } = await request.json();

    if (!photoId) {
      return NextResponse.json({ error: 'Photo ID required' }, { status: 400 });
    }

    // 1. Fetch photo info
    const { data: photoData, error: photoError } = await supabaseServer
      .from('photos')
      .select('storage_path')
      .eq('id', photoId)
      .single();

    if (photoError || !photoData) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const storagePath = photoData.storage_path;

    // 2. Download original image buffer
    const { data: fileData, error: downloadError } = await supabaseServer.storage
      .from('photo-imports')
      .download(storagePath);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Failed to download original image' }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // 3. Process image with sharp
    let sharpInstance = sharp(buffer);

    // Rotate first
    if (rotation && rotation !== 0) {
      sharpInstance = sharpInstance.rotate(rotation);
    }

    // Then crop if dimensions provided
    if (crop && typeof crop.width === 'number' && typeof crop.height === 'number') {
      sharpInstance = sharpInstance.extract({
        left: Math.round(crop.x),
        top: Math.round(crop.y),
        width: Math.round(crop.width),
        height: Math.round(crop.height)
      });
    }

    const processedBuffer = await sharpInstance.toBuffer();

    // 4. Upload processed buffer (overwrite existing)
    const { error: uploadError } = await supabaseServer.storage
      .from('photo-imports')
      .upload(storagePath, processedBuffer, {
        upsert: true,
        contentType: fileData.type || 'image/jpeg',
      });

    if (uploadError) {
      console.error('Failed to overwrite edited image:', uploadError);
      return NextResponse.json({ error: 'Failed to save edited image' }, { status: 500 });
    }
    
    // Optionally bump an updated_at column here if we had one to force cache refresh.
    // For now we'll just handle it on the client by appending a timestamp.

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in edit photo route:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
