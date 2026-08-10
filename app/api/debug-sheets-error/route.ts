import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseServer
    .from('groups')
    .select('id, title, sku, error_message, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
