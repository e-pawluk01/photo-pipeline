import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { filename, contentType } = await request.json();

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    // Generate a unique path to prevent overwrites
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${filename}`;
    const storagePath = `uploads/${uniqueFilename}`;

    // Create a signed upload URL that is valid for 1 hour
    const { data, error } = await supabaseServer.storage
      .from('photo-imports')
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error('Error generating signed URL:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      storagePath: storagePath,
      token: data.token,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
