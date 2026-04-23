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
  version: 8,
  name: 'Add pricebook calc columns and estimate tab',
  up: async ({ sheets, spreadsheetId }) => {
    const calcHeaders = [
      'labor_hourly_rate',
      'labor_unit_cost',
      'base_unit_cost',
      'subtotal_unit_cost',
      'pre_tax_unit_cost',
      'tax_unit_cost',
      'final_unit_cost'
    ];

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetList = spreadsheet.data.sheets || [];
    const hasEstimateCalc = sheetList.some((s) => s.properties.title === 'Estimate_Calc');

    if (!hasEstimateCalc) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Estimate_Calc',
                  gridProperties: { frozenRowCount: 3 }
                }
              }
            }
          ]
        }
      });
    }

    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Pricebook_Master!1:1'
    });
    const headers = (headerRes.data.values && headerRes.data.values[0]) || [];
    if (!headers.length) {
      throw new Error('Pricebook_Master headers not found.');
    }

    let mergedHeaders = [...headers];
    for (const h of calcHeaders) {
      if (!mergedHeaders.includes(h)) mergedHeaders.push(h);
    }

    const endCol = toA1Col(mergedHeaders.length);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Pricebook_Master!A1:${endCol}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [mergedHeaders] }
    });

    const yCol = mergedHeaders.indexOf('labor_hourly_rate') + 1;
    const aeCol = mergedHeaders.indexOf('final_unit_cost') + 1;
    const calcStart = toA1Col(yCol);
    const calcEnd = toA1Col(aeCol);

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

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Estimate_Calc!A1:H3',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['project_sf', '', '', '', '', '', '', 'summary'],
          ['', '', '', '', '', '', 'Estimate_Total', '=SUM(E4:E)'],
          ['item_code', 'quantity', 'unit', 'final_unit_cost', 'line_total', '', 'Overall_Price_per_SF', '=IF(B1>0,H2/B1,0)']
        ]
      }
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Estimate_Calc!C4:E4',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          '=ARRAYFORMULA(IF(A4:A="","",IFERROR(VLOOKUP(A4:A, Pricebook_Master!A:E, 5, FALSE),"")))',
          '=ARRAYFORMULA(IF(A4:A="","",IFERROR(VLOOKUP(A4:A, Pricebook_Master!A:AE, 31, FALSE),0)))',
          '=ARRAYFORMULA(IF(A4:A="","",B4:B*D4:D))'
        ]]
      }
    });

    console.log('Added calculation columns and Estimate_Calc worksheet formulas.');
  }
};
