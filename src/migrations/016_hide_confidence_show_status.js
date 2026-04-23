module.exports = {
  version: 16,
  name: 'Hide confidence column keep status visible',
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

    const idxConfidence = headers.indexOf('confidence_score');
    const idxStatus = headers.indexOf('status');
    const requests = [];

    if (idxConfidence >= 0) {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: idxConfidence,
            endIndex: idxConfidence + 1
          },
          properties: { hiddenByUser: true },
          fields: 'hiddenByUser'
        }
      });
    }

    if (idxStatus >= 0) {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: idxStatus,
            endIndex: idxStatus + 1
          },
          properties: { hiddenByUser: false },
          fields: 'hiddenByUser'
        }
      });
    }

    if (!requests.length) {
      console.log('No matching columns found to adjust visibility.');
      return;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });

    console.log('Visibility updated: confidence hidden, status visible.');
  }
};
