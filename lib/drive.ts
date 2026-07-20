import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

let cachedDrive: drive_v3.Drive | null = null;

/**
 * Builds an authenticated Drive client using OAuth2 (user-delegated),
 * via a refresh token obtained through OAuth Playground.
 */
function getDriveClient(): drive_v3.Drive {
  if (cachedDrive) return cachedDrive;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing Google OAuth credentials — set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN.'
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  cachedDrive = google.drive({ version: 'v3', auth });
  return cachedDrive;
}

/**
 * Finds today's dated folder under the parent folder, or creates it if it
 * doesn't exist yet. Safe to call once per photo — it will reuse the same
 * folder for the whole day's batch.
 */
export async function ensureDateFolder(dateLabel: string): Promise<{
  folderId: string;
  folderLink: string;
}> {
  const drive = getDriveClient();
  const parentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
  if (!parentId) {
    throw new Error('Missing GOOGLE_DRIVE_PARENT_FOLDER_ID environment variable.');
  }
  const escapedName = dateLabel.replace(/'/g, "\\'");
  const query = [
    `name = '${escapedName}'`,
    `'${parentId}' in parents`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ].join(' and ');
  const existing = await drive.files.list({
    q: query,
    fields: 'files(id, webViewLink)',
    spaces: 'drive',
  });
  if (existing.data.files && existing.data.files.length > 0) {
    const folder = existing.data.files[0];
    return {
      folderId: folder.id as string,
      folderLink: folder.webViewLink as string,
    };
  }
  const created = await drive.files.create({
    requestBody: {
      name: dateLabel,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, webViewLink',
  });
  return {
    folderId: created.data.id as string,
    folderLink: created.data.webViewLink as string,
  };
}

/**
 * Finds a folder by name under the parent folder, or creates it if it doesn't exist.
 */
export async function ensureFolder(name: string, parentId: string): Promise<{
  folderId: string;
  folderLink: string;
}> {
  const drive = getDriveClient();
  const escapedName = name.replace(/'/g, "\\'");
  const query = [
    `name = '${escapedName}'`,
    `'${parentId}' in parents`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ].join(' and ');
  const existing = await drive.files.list({
    q: query,
    fields: 'files(id, webViewLink)',
    spaces: 'drive',
  });
  if (existing.data.files && existing.data.files.length > 0) {
    const folder = existing.data.files[0];
    return {
      folderId: folder.id as string,
      folderLink: folder.webViewLink as string,
    };
  }
  const created = await drive.files.create({
    requestBody: {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, webViewLink',
  });
  return {
    folderId: created.data.id as string,
    folderLink: created.data.webViewLink as string,
  };
}

/**
 * Uploads a single file buffer into the given Drive folder.
 */
export async function uploadToDrive(
  folderId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ fileId: string; webViewLink: string }> {
  const drive = getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id, webViewLink',
  });
  return {
    fileId: res.data.id as string,
    webViewLink: res.data.webViewLink as string,
  };
}

/**
 * Lists the immediate contents of a Drive folder.
 */
export async function listFolderContents(folderId: string): Promise<{ id: string; name: string; mimeType: string; thumbnailLink?: string }[]> {
  const drive = getDriveClient();
  const query = [
    `'${folderId}' in parents`,
    'trashed = false'
  ].join(' and ');
  
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name, mimeType, thumbnailLink)',
    spaces: 'drive',
    orderBy: 'folder, name'
  });
  
  if (!res.data.files) return [];
  
  return res.data.files.map(f => ({
    id: f.id as string,
    name: f.name as string,
    mimeType: f.mimeType as string,
    thumbnailLink: f.thumbnailLink as string | undefined
  }));
}