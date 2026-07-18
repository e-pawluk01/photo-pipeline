import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { ensureFolder, uploadToDrive } from '@/lib/drive';

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

      const driveFilename = photo.storage_path.split('/').pop() || `photo-${photo.id}.${ext}`;

      // Upload to Drive
      await uploadToDrive(folderId, driveFilename, buffer, mimeType);
    }

    // 5. Cleanup Supabase Storage
    const pathsToDelete = photos.map(p => p.storage_path);
    const { error: storageError } = await supabaseServer.storage
      .from('photo-imports')
      .remove(pathsToDelete);

    if (storageError) {
      console.error('Failed to cleanup storage after Drive upload:', storageError);
      // We will still proceed to mark as done, but this is a warning.
    }

    // 6. Delete photos from DB
    const idsToDelete = photos.map(p => p.id);
    const { error: dbError } = await supabaseServer
      .from('photos')
      .delete()
      .in('id', idsToDelete);

    if (dbError) {
      throw new Error(`Failed to delete photos from DB: ${dbError.message}`);
    }

    // 7. Update group to done
    await supabaseServer
      .from('groups')
      .update({ 
        status: 'done', 
        drive_folder_link: folderLink 
      })
      .eq('id', groupId);

    return NextResponse.json({ success: true, folderLink });

  } catch (error: any) {
    console.error(`Group ${groupId} processing failed:`, error);
    
    // Attempt to mark as failed
    await supabaseServer
      .from('groups')
      .update({ 
        status: 'failed', 
        error_message: error.message || 'Unknown error' 
      })
      .eq('id', groupId);

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
