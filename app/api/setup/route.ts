import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. Create Bucket
    const { data: bucketData, error: bucketError } = await supabaseServer.storage.createBucket('photo-imports', {
      public: true, 
    });

    if (bucketError && !bucketError.message.includes('already exists')) {
      console.error('Bucket creation error:', bucketError);
      return NextResponse.json({ error: bucketError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Bucket created. Please run the SQL manually to create the table since JS client cannot execute raw DDL.',
      sql: `
        CREATE TABLE IF NOT EXISTS photos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          storage_path TEXT NOT NULL,
          upload_timestamp TIMESTAMPTZ DEFAULT now(),
          session_id TEXT NOT NULL
        );
      `
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
