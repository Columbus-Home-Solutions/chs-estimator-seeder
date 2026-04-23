module.exports = {
  version: 15,
  name: 'Unhide pricing verification columns',
  up: async ({ sheets, spreadsheetId }) => {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const pbSheet = (spreadsheet.data.sheets || []).find(
      (s) => s.properties && s.properties.title === 'Pricebook_Master'
    );
    if (!pbSheet) throw new Error('Pricebook_Master sheet not found.');

    const sheetId = pbSheet.properties.sheetId;
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Pricebook_Master!1:1'
    });
    const headers = (headerRes.data.values && headerRes.data.values[0]) || [];
    if (!headers.length) throw new Error('Pricebook_Master headers not found.');

    const toUnhide = new Set(['confidence_score', 'status']);
    const requests = [];

    headers.forEach((h, i) => {
      if (!toUnhide.has(h)) return;
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: i,
            endIndex: i + 1
          },
          properties: { hiddenByUser: false },
          fields: 'hiddenByUser'
        }
      });
    });

    if (!requests.length) {
      console.log('No pricing verification columns found to unhide.');
      return;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });

    console.log('Unhid pricing verification columns.');
  }
};
