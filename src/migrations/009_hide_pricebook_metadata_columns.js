module.exports = {
  version: 9,
  name: 'Hide pricebook metadata columns for readability',
  up: async ({ sheets, spreadsheetId }) => {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const pbSheet = (spreadsheet.data.sheets || []).find(
      (s) => s.properties && s.properties.title === 'Pricebook_Master'
    );

    if (!pbSheet) {
      throw new Error('Pricebook_Master sheet not found.');
    }

    const sheetId = pbSheet.properties.sheetId;
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Pricebook_Master!1:1'
    });
    const headers = (headerRes.data.values && headerRes.data.values[0]) || [];
    if (!headers.length) {
      throw new Error('Pricebook_Master headers not found.');
    }

    const columnsToHide = new Set([
      'vendor_ref',
      'source_type',
      'source_url',
      'source_date',
      'confidence_score',
      'status',
      'effective_date',
      'expiration_date',
      'pricebook_version',
      'last_updated_by',
      'last_updated_at'
    ]);

    const requests = [];
    headers.forEach((header, i) => {
      if (!columnsToHide.has(header)) return;
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: i,
            endIndex: i + 1
          },
          properties: {
            hiddenByUser: true
          },
          fields: 'hiddenByUser'
        }
      });
    });

    if (!requests.length) {
      console.log('No matching metadata columns found to hide.');
      return;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });

    console.log(`Hid ${requests.length} metadata columns on Pricebook_Master.`);
  }
};
