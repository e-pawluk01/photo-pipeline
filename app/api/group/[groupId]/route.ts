import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function DELETE(request: Request, { params }: { params: { groupId: string } }) {
  const { groupId } = params;

  if (!groupId) {
    return NextResponse.json({ error: 'Missing groupId' }, { status: 400 });
  }

  try {
    const { error } = await supabaseServer
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`Group ${groupId} deletion failed:`, error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
