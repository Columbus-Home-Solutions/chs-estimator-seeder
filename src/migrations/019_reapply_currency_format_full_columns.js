module.exports = {
  version: 19,
  name: 'Reapply 2-decimal currency format to entire dollar columns (covers appended rows)',
  up: async ({ sheets, spreadsheetId }) => {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const allSheets = spreadsheet.data.sheets || [];
    const pbSheet = allSheets.find((s) => s.properties && s.properties.title === 'Pricebook_Master');
    if (!pbSheet) throw new Error('Pricebook_Master sheet not found.');
    const pbSheetId = pbSheet.properties.sheetId;
    const pbMaxRows = pbSheet.properties.gridProperties.rowCount || 2000;

    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Pricebook_Master!1:1'
    });
    const headers = (headerRes.data.values && headerRes.data.values[0]) || [];
    if (!headers.length) throw new Error('Pricebook_Master headers not found.');

    const currencyHeaders = new Set([
      'material_cost',
      'equipment_cost_per_unit',
      'labor_hourly_rate',
      'labor_unit_cost',
      'base_unit_cost',
      'subtotal_unit_cost',
      'pre_tax_unit_cost',
      'tax_unit_cost',
      'final_unit_cost'
    ]);

    const requests = [];
    headers.forEach((h, i) => {
      if (!currencyHeaders.has(h)) return;
      requests.push({
        repeatCell: {
          range: {
            sheetId: pbSheetId,
            startRowIndex: 1,
            endRowIndex: pbMaxRows,
            startColumnIndex: i,
            endColumnIndex: i + 1
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'NUMBER', pattern: '#,##0.00' }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      });
    });

    if (!requests.length) return;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });

    console.log(`Reapplied 2-decimal format across ${requests.length} dollar columns.`);
  }
};
