module.exports = {
  version: 10,
  name: 'Format currency columns to two decimals',
  up: async ({ sheets, spreadsheetId }) => {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const allSheets = spreadsheet.data.sheets || [];

    const pricebookSheet = allSheets.find(
      (s) => s.properties && s.properties.title === 'Pricebook_Master'
    );
    const estimateCalcSheet = allSheets.find(
      (s) => s.properties && s.properties.title === 'Estimate_Calc'
    );

    if (!pricebookSheet) {
      throw new Error('Pricebook_Master sheet not found.');
    }

    const pbSheetId = pricebookSheet.properties.sheetId;
    const pbHeadersRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Pricebook_Master!1:1'
    });
    const pbHeaders = (pbHeadersRes.data.values && pbHeadersRes.data.values[0]) || [];
    if (!pbHeaders.length) {
      throw new Error('Pricebook_Master headers not found.');
    }

    const currencyColumns = new Set([
      'material_cost',
      'equipment_cost_per_unit',
      'labor_unit_cost',
      'base_unit_cost',
      'subtotal_unit_cost',
      'pre_tax_unit_cost',
      'tax_unit_cost',
      'final_unit_cost'
    ]);

    const requests = [];
    pbHeaders.forEach((header, i) => {
      if (!currencyColumns.has(header)) return;
      requests.push({
        repeatCell: {
          range: {
            sheetId: pbSheetId,
            startRowIndex: 1,
            startColumnIndex: i,
            endColumnIndex: i + 1
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: 'NUMBER',
                pattern: '#,##0.00'
              }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      });
    });

    if (estimateCalcSheet) {
      const ecSheetId = estimateCalcSheet.properties.sheetId;
      // D: final_unit_cost, E: line_total
      requests.push({
        repeatCell: {
          range: {
            sheetId: ecSheetId,
            startRowIndex: 3,
            startColumnIndex: 3,
            endColumnIndex: 5
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: 'NUMBER',
                pattern: '#,##0.00'
              }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      });
      // H2 estimate total and H3 overall price per sf
      requests.push({
        repeatCell: {
          range: {
            sheetId: ecSheetId,
            startRowIndex: 1,
            endRowIndex: 3,
            startColumnIndex: 7,
            endColumnIndex: 8
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: 'NUMBER',
                pattern: '#,##0.00'
              }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      });
    }

    if (!requests.length) {
      console.log('No applicable numeric ranges found for formatting.');
      return;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });

    console.log('Applied 2-decimal formatting to currency/price ranges.');
  }
};
