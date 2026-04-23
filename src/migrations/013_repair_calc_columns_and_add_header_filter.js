function toA1Col(n) {
  let s = '';
  let num = n;
  while (num > 0) {
    const m = (num - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    num = Math.floor((num - m) / 26);
  }
  return s;
}

module.exports = {
  version: 13,
  name: 'Repair calc columns and enable header filter',
  up: async ({ sheets, spreadsheetId }) => {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const allSheets = spreadsheet.data.sheets || [];
    const pbSheet = allSheets.find((s) => s.properties && s.properties.title === 'Pricebook_Master');
    const estimateSheet = allSheets.find((s) => s.properties && s.properties.title === 'Estimate_Calc');

    if (!pbSheet) throw new Error('Pricebook_Master sheet not found.');
    const pbSheetId = pbSheet.properties.sheetId;
    const pbRowCount = pbSheet.properties.gridProperties.rowCount || 2000;

    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Pricebook_Master!1:1'
    });
    const headers = (headerRes.data.values && headerRes.data.values[0]) || [];
    if (!headers.length) throw new Error('Pricebook_Master headers not found.');

    const calcHeaders = [
      'labor_hourly_rate',
      'labor_unit_cost',
      'base_unit_cost',
      'subtotal_unit_cost',
      'pre_tax_unit_cost',
      'tax_unit_cost',
      'final_unit_cost'
    ];
    for (const h of calcHeaders) {
      if (!headers.includes(h)) {
        throw new Error(`Missing expected calc column: ${h}`);
      }
    }

    const yCol = headers.indexOf('labor_hourly_rate') + 1;
    const aeCol = headers.indexOf('final_unit_cost') + 1;
    const calcStart = toA1Col(yCol);
    const calcEnd = toA1Col(aeCol);
    const fullEnd = toA1Col(headers.length);

    // Clear calc region below header so ARRAYFORMULA can spill cleanly.
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `Pricebook_Master!${calcStart}2:${calcEnd}${pbRowCount}`
    });

    // Restore array formulas in row 2.
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Pricebook_Master!${calcStart}2:${calcEnd}2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          '=ARRAYFORMULA(IF(A2:A="",,IFERROR(VLOOKUP(H2:H, Labor_Rates!A:C, 3, FALSE),0)))',
          '=ARRAYFORMULA(IF(A2:A="",,G2:G*Y2:Y))',
          '=ARRAYFORMULA(IF(A2:A="",,F2:F+Z2:Z+I2:I))',
          '=ARRAYFORMULA(IF(A2:A="",,AA2:AA*(1+J2:J)))',
          '=ARRAYFORMULA(IF(A2:A="",,AB2:AB*(1+K2:K+L2:L)))',
          '=ARRAYFORMULA(IF(A2:A="",,IF(M2:M="Y",AC2:AC*IFERROR(INDEX(Settings!B:B, MATCH("sales_tax_pct", Settings!A:A, 0)), 0),0)))',
          '=ARRAYFORMULA(IF(A2:A="",,AC2:AC+AD2:AD))'
        ]]
      }
    });

    const requests = [
      // Turn on row-1 filter dropdowns for the full table.
      {
        setBasicFilter: {
          filter: {
            range: {
              sheetId: pbSheetId,
              startRowIndex: 0,
              startColumnIndex: 0,
              endColumnIndex: headers.length
            }
          }
        }
      }
    ];

    // Reapply 2-decimal formatting on calc/dollar columns.
    const currencyHeaders = new Set([
      'material_cost',
      'equipment_cost_per_unit',
      'labor_unit_cost',
      'base_unit_cost',
      'subtotal_unit_cost',
      'pre_tax_unit_cost',
      'tax_unit_cost',
      'final_unit_cost'
    ]);
    headers.forEach((h, i) => {
      if (!currencyHeaders.has(h)) return;
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
              numberFormat: { type: 'NUMBER', pattern: '#,##0.00' }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      });
    });

    if (estimateSheet) {
      const ecSheetId = estimateSheet.properties.sheetId;
      requests.push(
        {
          repeatCell: {
            range: {
              sheetId: ecSheetId,
              startRowIndex: 3,
              startColumnIndex: 3,
              endColumnIndex: 5
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'NUMBER', pattern: '#,##0.00' }
              }
            },
            fields: 'userEnteredFormat.numberFormat'
          }
        },
        {
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
                numberFormat: { type: 'NUMBER', pattern: '#,##0.00' }
              }
            },
            fields: 'userEnteredFormat.numberFormat'
          }
        }
      );
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });

    // Ensure first row is still headers after any prior sorts and filter scopes.
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Pricebook_Master!A1:${fullEnd}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] }
    });

    console.log('Repaired Y:AE formulas, enabled row-1 filter, and refreshed formatting.');
  }
};
