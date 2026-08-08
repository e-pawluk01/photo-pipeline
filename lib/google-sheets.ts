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
      const addSheetResponse = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: tabName,
                  gridProperties: {
                    frozenRowCount: 1
                  }
                }
              }
            }
          ]
        }
      });

      const newSheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId;

      // Add Headers exactly at A1:G1
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1:G1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['item', 'sourced', 'bought for', 'recomend price', 'Inital up. pri.', 'sold for', 'SKU']]
        }
      });
      
      // Apply rich formatting
      if (newSheetId !== undefined) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              // Column A (item) width
              {
                updateDimensionProperties: {
                  range: { sheetId: newSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
                  properties: { pixelSize: 220 },
                  fields: 'pixelSize'
                }
              },
              // Column B (sourced) width
              {
                updateDimensionProperties: {
                  range: { sheetId: newSheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
                  properties: { pixelSize: 180 },
                  fields: 'pixelSize'
                }
              },
              // Columns C-G widths
              {
                updateDimensionProperties: {
                  range: { sheetId: newSheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 7 },
                  properties: { pixelSize: 130 },
                  fields: 'pixelSize'
                }
              },
              // Format Row 1 (Headers)
              {
                repeatCell: {
                  range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.98, green: 0.78, blue: 0.89 }, // Light Pink
                      textFormat: { bold: true },
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE'
                    }
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
                }
              },
              // Format Columns A-G Data Alignment (Centered)
              {
                repeatCell: {
                  range: { sheetId: newSheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
                  cell: {
                    userEnteredFormat: {
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE'
                    }
                  },
                  fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)'
                }
              }
            ]
          }
        });
      }
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
