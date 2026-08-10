import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

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
    const { categoryName } = await request.json();

    if (!categoryName) {
      return NextResponse.json({ error: 'Missing categoryName' }, { status: 400 });
    }

    const prefix = getSkuPrefix(categoryName);
    
    // Generate SKU
    const { data: skuStr, error: skuError } = await supabaseServer.rpc('generate_next_sku', { sku_prefix: prefix });
    if (skuError) {
      console.error('Error generating SKU:', skuError);
      return NextResponse.json({ error: 'Failed to generate SKU' }, { status: 500 });
    }

    return NextResponse.json({ sku: skuStr });
  } catch (error: any) {
    console.error('SKU generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
