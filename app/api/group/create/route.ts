import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { appendToGoogleSheet } from '@/lib/google-sheets';
function getSkuPrefix(categoryName: string) {
  switch (categoryName) {
    case 'Outerwear': return 'O';
    case 'Jumper & sweaters': return 'O';
    case 'Suits & Blazers': return 'O';
    case 'Dresses': return 'D';
    case 'Skirts': return 'S';
    case 'Tops & t-shirts': return 'T';
    case 'Jeans': return 'J';
    case 'Trousers & leggings': return 'J';
    case 'Shorts & cropped trousers': return 'R';
    case 'Lingerie & nightwear': return 'L';
    case 'Activewear': return 'C';
    case 'Shoes': return 'H';
    case 'Bags': return 'B';
    case 'Accessories': return 'A';
    default: return 'X';
  }
}

export async function POST(request: Request) {
  try {
    const { title, category_path, brand, condition, size, notes, measurements, generate_cover, reference_photo_id, photoIds, cover_photo_id, session_id, bought_for_price, sourced } = await request.json();

    if (!title || !category_path || !size || !condition || !photoIds || photoIds.length === 0 || !cover_photo_id || !session_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const categoryName = category_path.split('/')[1] || '';
    const prefix = getSkuPrefix(categoryName);
    
    // Generate SKU
    const { data: skuStr, error: skuError } = await supabaseServer.rpc('generate_next_sku', { sku_prefix: prefix });
    if (skuError) {
      console.error('Error generating SKU:', skuError);
      return NextResponse.json({ error: 'Failed to generate SKU' }, { status: 500 });
    }

    const { data: groupData, error: groupError } = await supabaseServer
      .from('groups')
      .insert([
        {
          title,
          category_path,
          brand: brand || null,
          condition,
          item_type: 'UNUSED',
          size,
          notes: notes || null,
          measurements: measurements || null,
          generate_cover: generate_cover || false,
          reference_photo_id: reference_photo_id || null,
          cover_photo_id,
          session_id,
          bought_for_price: bought_for_price || null,
          sourced: sourced || null,
          sku: skuStr
        }
      ])
      .select()
      .single();

    if (groupError) {
      console.error('Error creating group:', groupError);
      return NextResponse.json({ error: groupError.message }, { status: 500 });
    }

    const { error: photoUpdateError } = await supabaseServer
      .from('photos')
      .update({ group_id: groupData.id })
      .in('id', photoIds);

    if (photoUpdateError) {
      console.error('Error updating photos with group_id:', photoUpdateError);
      return NextResponse.json({ error: photoUpdateError.message }, { status: 500 });
    }

    try {
      await appendToGoogleSheet(groupData);
    } catch (sheetError) {
      console.error('Failed to append to Google Sheets during group creation:', sheetError);
    }

    return NextResponse.json({ success: true, group: groupData });
  } catch (error: any) {
    console.error('Group creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
