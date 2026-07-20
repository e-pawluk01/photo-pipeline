import { NextResponse } from 'next/server';
import { listFolderContents } from '@/lib/drive';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId') || process.env.GOOGLE_DRIVE_REFERENCE_FOLDER_ID;

    if (!folderId) {
      return NextResponse.json({ error: 'Missing folderId or GOOGLE_DRIVE_REFERENCE_FOLDER_ID' }, { status: 400 });
    }

    const contents = await listFolderContents(folderId);
    return NextResponse.json({ contents });
  } catch (error: any) {
    console.error('Failed to browse Drive:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
