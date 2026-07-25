import { google } from 'googleapis';

function getGoogleSheetsClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
  
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

export async function appendToGoogleSheet(groupData: any) {
  // Check if we have the necessary environment variables
  if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN || !process.env.GOOGLE_SHEET_ID) {
    console.warn('Google Sheets integration is not configured. Missing GOOGLE_OAUTH_REFRESH_TOKEN or GOOGLE_SHEET_ID.');
    return;
  }

  try {
    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    // Format the date as "MMM YY" (e.g., "Jul 26")
    const date = new Date();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear().toString().slice(2);
    const tabName = `${month} ${year}`;
    
    // Check if the tab exists
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets?.some(
      (s: any) => s.properties?.title === tabName
    );

    // If tab doesn't exist, create it and add headers
    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: tabName
                }
              }
            }
          ]
        }
      });

      // Add Headers
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${tabName}!A1:G1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['item', 'sourced', 'bought for', 'recommended price', 'Inital up. pri.', 'sold for', 'SKU']]
        }
      });
      
      // Optionally format the header row with background color (skipped for brevity)
    }

    // Append the new row
    // Columns: A: item, B: sourced, C: bought for, D: rec price, E: init up pri, F: sold for, G: SKU
    const rowData = [
      groupData.title || '',
      groupData.sourced || '',
      groupData.bought_for_price ? `£${groupData.bought_for_price}` : '',
      '', // recommended price
      '', // Inital up. pri.
      '', // sold for
      groupData.sku || ''
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A:G`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData]
      }
    });

    console.log(`Successfully appended SKU ${groupData.sku} to Google Sheet tab ${tabName}`);
  } catch (error) {
    console.error('Error appending to Google Sheet:', error);
    // We don't throw here to avoid failing the group creation process
  }
}
