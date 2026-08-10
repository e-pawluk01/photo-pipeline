import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { appendToGoogleSheet } from '@/lib/google-sheets';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  
  const { data: groups, error } = await supabaseServer
    .from('groups')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  const logged = [];
  const failed = [];
  
  // Exclude SKUs that are already in the screenshot
  const excludeSkus = ['H001', 'B001', 'B002', 'B003', 'H002', 'H004', 'S001', 'B004', 'H006', 'R001'];
  
  for (const group of groups) {
    if (excludeSkus.includes(group.sku)) continue;
    
    try {
      const err = await appendToGoogleSheet(group);
      if (typeof err === 'string') {
         failed.push({ sku: group.sku, error: err });
      } else {
         logged.push(group.sku);
      }
    } catch (e: any) {
      failed.push({ sku: group.sku, error: e.message });
    }
  }
  
  return NextResponse.json({ success: true, logged, failed });
}
