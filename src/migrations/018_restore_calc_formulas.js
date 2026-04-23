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
  version: 18,
  name: 'Restore Pricebook_Master calc ARRAYFORMULAs after apply:market-rates regression',
  up: async ({ sheets, spreadsheetId }) => {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const pbSheet = (spreadsheet.data.sheets || []).find(
      (s) => s.properties && s.properties.title === 'Pricebook_Master'
    );
    if (!pbSheet) throw new Error('Pricebook_Master sheet not found.');
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
      if (!headers.includes(h)) throw new Error(`Missing calc column: ${h}`);
    }

    const yCol = headers.indexOf('labor_hourly_rate') + 1;
    const aeCol = headers.indexOf('final_unit_cost') + 1;
    const calcStart = toA1Col(yCol);
    const calcEnd = toA1Col(aeCol);

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `Pricebook_Master!${calcStart}2:${calcEnd}${pbRowCount}`
    });

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

    console.log('Restored Pricebook_Master ARRAYFORMULAs in Y2:AE2.');
  }
};
