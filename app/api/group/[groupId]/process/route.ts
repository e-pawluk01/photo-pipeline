import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { ensureFolder, uploadToDrive } from '@/lib/drive';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 300; // 5 mins max duration for processing a group if supported by plan

export async function POST(request: Request, { params }: { params: { groupId: string } }) {
  const { groupId } = params;

  if (!groupId) {
    return NextResponse.json({ error: 'Missing groupId' }, { status: 400 });
  }

  const parentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
  if (!parentId) {
    return NextResponse.json({ error: 'Missing GOOGLE_DRIVE_PARENT_FOLDER_ID env var' }, { status: 500 });
  }

  try {
    // 1. Fetch group
    const { data: group, error: groupError } = await supabaseServer
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      throw new Error(groupError?.message || 'Group not found');
    }

    // Update status to 'filing'
    await supabaseServer
      .from('groups')
      .update({ status: 'filing', error_message: null })
      .eq('id', groupId);

    // 2. Fetch photos
    const { data: photos, error: photosError } = await supabaseServer
      .from('photos')
      .select('id, storage_path')
      .eq('group_id', groupId);

    if (photosError) {
      throw new Error(`Failed to fetch photos: ${photosError.message}`);
    }

    if (!photos || photos.length === 0) {
      throw new Error('No photos found in this group');
    }

    // 3. Sanitize title and create Drive folder
    const safeTitle = (group.title || 'Untitled').replace(/[\\/*?:"<>|]/g, '-').replace(/\s+/g, ' ').trim();
    
    // Create folder in Drive
    const { folderId, folderLink } = await ensureFolder(safeTitle, parentId);

    let aiTitlePromise: Promise<string> | null = null;

    // 4. Download and upload each photo
    for (const photo of photos) {
      // Download from Supabase Storage
      const { data: fileData, error: downloadError } = await supabaseServer.storage
        .from('photo-imports')
        .download(photo.storage_path);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download photo from storage: ${downloadError?.message}`);
      }

      // Convert Blob to Buffer
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Determine mimeType from storage_path
      const ext = photo.storage_path.split('.').pop()?.toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'heic') mimeType = 'image/heic';

      if (photo.id === group.cover_photo_id || (!group.cover_photo_id && photo === photos[0])) {
        const categoryLeaf = (group.category_path || '').split('/').pop() || '';
        const brandStr = group.brand || 'Unbranded';
        const notesStr = group.notes || 'None';

        const promptText = `You are an expert e-commerce copywriter specializing in alternative fashion listings on platforms like Vinted and Depop. Your job is to create one highly optimized listing title based on a provided item photo, the item's category, brand, and descriptive notes.

I will provide you with:
1. An image of the item (the cover photo for the listing)
2. Category (e.g., Maxi dress, Cardigan, Bootcut jeans) — this is the confirmed item type. Use it exactly as given, do not guess a different type from the image.
3. Brand (e.g., Mexx, Gunne Sax, Unbranded)
4. Notes (details about color, style, fabric, condition)

Strict guidelines for the title:
- Output EXACTLY ONE title. No introductory text, no bullet points, no numbered options, no alternative choices — just the single raw text string.
- DO NOT invent, assume, or hallucinate details not clearly present in the notes or image.
- Use the given Category as the item type in the title — do not substitute your own guess at what kind of garment it is.
- NEVER lead with the brand name. The brand must always go at the very end of the title.
- LEAVE THE SIZE OUT of the title entirely.
- Focus heavily on SEO: enrich the title with clear descriptive features, followed by aesthetic keywords that match the item's style (e.g. Coquette, Gorpcore, Whimsigoth, Downtown Girl, Indie Sleaze, Y2K, McBling, 90s Minimalist).

Format your output exactly like this example:
"Vintage Slate Grey Flowy Pleated Floor Length Maxi Skirt Whimsigoth Unbranded"

Category: ${categoryLeaf}
Brand: ${brandStr}
Notes: ${notesStr}`;

        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          aiTitlePromise = ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: [
              promptText,
              { inlineData: { data: buffer.toString('base64'), mimeType } }
            ]
          }).then(res => res.text ? res.text.trim() : (group.title || 'Untitled'))
            .catch(err => {
              console.error('Gemini error:', err);
              return group.title || 'Untitled';
            });
        } catch (initErr) {
          console.error('Failed to init Gemini:', initErr);
          aiTitlePromise = Promise.resolve(group.title || 'Untitled');
        }
      }

      const driveFilename = photo.storage_path.split('/').pop() || `photo-${photo.id}.${ext}`;

      // Upload to Drive
      await uploadToDrive(folderId, driveFilename, buffer, mimeType);
    }

    // 4.5 Generate and upload description file
    const brandStr = group.brand || 'Unbranded';
    const categoryLeaf = (group.category_path || '').split('/').pop()?.toLowerCase() || '';

    let seoTitle = group.title || 'Untitled';
    if (aiTitlePromise) {
      seoTitle = await aiTitlePromise;
    }

    const descriptionText = `${seoTitle}\n\n｡°✩ Item Details ✩°｡⋆
★ Brand: ${brandStr}
★ Size: ${group.size}
★ Condition: ${group.condition}

⋆｡°✩ Please Read Carefully ✩°｡⋆
★ Condition Note: We do our best to thoroughly inspect every piece! Any minor damages, stains, rips, or signs of wear are clearly shown in the photos and reflected in the price. Please swipe through all images before buying!
★ What's included: Please note that this sale includes ONLY the ${categoryLeaf}. All other accessories, clothes, or props are for styling examples only.
★ We have a dog and a bunny! While we do our absolute best to ensure every item is cleaned before shipping, we can't guarantee they are 100% free of stray hairs. Please keep this in mind if you have severe allergies!
★ Shop Policies: For more information on returns, shipping, and other details, please check out the 'about' section on our profile.

˚₊‧꒰ა ☆ ໒꒱ ‧₊˚ Tags: [Add tags here]`;

    const descriptionBuffer = Buffer.from(descriptionText, 'utf-8');
    await uploadToDrive(folderId, 'description.txt', descriptionBuffer, 'text/plain');

    // 5. Save drive_folder_link early to preserve success state
    await supabaseServer
      .from('groups')
      .update({ drive_folder_link: folderLink })
      .eq('id', groupId);

    // 6. Cleanup Supabase Storage FIRST
    const pathsToDelete = photos.map(p => p.storage_path);
    const { error: storageError } = await supabaseServer.storage
      .from('photo-imports')
      .remove(pathsToDelete);

    if (storageError) {
      throw new Error(`CLEANUP_FAILED:Uploaded to Drive successfully, but Supabase cleanup failed — files may remain in storage. (${storageError.message})`);
    }

    // 7. Delete photos from DB
    const idsToDelete = photos.map(p => p.id);
    const { error: dbError } = await supabaseServer
      .from('photos')
      .delete()
      .in('id', idsToDelete);

    if (dbError) {
      throw new Error(`CLEANUP_FAILED:Uploaded to Drive successfully, but Supabase DB cleanup failed. (${dbError.message})`);
    }

    // 8. Update group to done
    await supabaseServer
      .from('groups')
      .update({ 
        status: 'done'
      })
      .eq('id', groupId);

    return NextResponse.json({ success: true, folderLink });

  } catch (error: any) {
    console.error(`Group ${groupId} processing failed:`, error);
    
    let statusToSet = 'failed';
    let msg = error.message || 'Unknown error';

    if (msg.startsWith('CLEANUP_FAILED:')) {
      statusToSet = 'cleanup_failed';
      msg = msg.replace('CLEANUP_FAILED:', '');
    }

    // Attempt to mark as failed or cleanup_failed
    await supabaseServer
      .from('groups')
      .update({ 
        status: statusToSet, 
        error_message: msg 
      })
      .eq('id', groupId);

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
