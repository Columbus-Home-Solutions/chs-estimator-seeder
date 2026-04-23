module.exports = {
  version: 14,
  name: 'Align E:M right and remove category dropdown',
  up: async ({ sheets, spreadsheetId }) => {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const pbSheet = (spreadsheet.data.sheets || []).find(
      (s) => s.properties && s.properties.title === 'Pricebook_Master'
    );
    if (!pbSheet) throw new Error('Pricebook_Master sheet not found.');

    const sheetId = pbSheet.properties.sheetId;
    const rowCount = pbSheet.properties.gridProperties.rowCount || 2000;

    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Pricebook_Master!1:1'
    });
    const headers = (headerRes.data.values && headerRes.data.values[0]) || [];
    if (!headers.length) throw new Error('Pricebook_Master headers not found.');

    const categoryIdx = headers.indexOf('category');
    if (categoryIdx < 0) throw new Error('category column not found.');

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 1,
                endRowIndex: rowCount,
                startColumnIndex: 4,
                endColumnIndex: 13
              },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'RIGHT'
                }
              },
              fields: 'userEnteredFormat.horizontalAlignment'
            }
          },
          {
            setDataValidation: {
              range: {
                sheetId,
                startRowIndex: 1,
                endRowIndex: rowCount,
                startColumnIndex: categoryIdx,
                endColumnIndex: categoryIdx + 1
              },
              rule: null
            }
          }
        ]
      }
    });

    console.log('Right-aligned Pricebook_Master E:M and removed category dropdown validation.');
  }
};
