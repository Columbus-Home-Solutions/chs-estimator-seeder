function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function buildRow(headers, values) {
  return headers.map((h) => (Object.prototype.hasOwnProperty.call(values, h) ? values[h] : ''));
}

async function getHeaders(sheets, spreadsheetId, tabName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!1:1`
  });
  return (res.data.values && res.data.values[0]) || [];
}

async function getExistingKeys(sheets, spreadsheetId, tabName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A2:A`
  });
  return new Set(
    (res.data.values || [])
      .map((r) => String(r[0] || '').trim())
      .filter(Boolean)
  );
}

async function appendRows(sheets, spreadsheetId, tabName, rows) {
  if (rows.length === 0) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows }
  });
}

module.exports = {
  version: 4,
  name: 'Seed vendors and labor rates',
  up: async ({ sheets, spreadsheetId }) => {
    const today = todayISO();

    const laborTab = 'Labor_Rates';
    const laborHeaders = await getHeaders(sheets, spreadsheetId, laborTab);
    if (laborHeaders.length === 0) {
      throw new Error(`${laborTab} headers not found.`);
    }
    const existingLaborRefs = await getExistingKeys(sheets, spreadsheetId, laborTab);
    const laborStarter = [
      ['LAB-PLMB', 'Plumber', 85, today, 'Active'],
      ['LAB-ELEC', 'Electrician', 90, today, 'Active'],
      ['LAB-DRYW', 'Drywall Finisher', 60, today, 'Active']
    ];
    const laborRows = laborStarter
      .filter((row) => !existingLaborRefs.has(row[0]))
      .map((row) =>
        buildRow(laborHeaders, {
          labor_rate_ref: row[0],
          role: row[1],
          hourly_rate: row[2],
          effective_date: row[3],
          status: row[4]
        })
      );
    await appendRows(sheets, spreadsheetId, laborTab, laborRows);

    const vendorsTab = 'Vendors';
    const vendorHeaders = await getHeaders(sheets, spreadsheetId, vendorsTab);
    if (vendorHeaders.length === 0) {
      throw new Error(`${vendorsTab} headers not found.`);
    }
    const existingVendorRefs = await getExistingKeys(sheets, spreadsheetId, vendorsTab);
    const vendorStarter = [
      {
        vendor_ref: 'VENDOR-GENERAL',
        vendor_name: 'General Building Supply',
        contact_name: 'Sales Desk',
        phone: '501-555-0110',
        email: 'sales@generalbuildingsupply.example',
        city: 'North Little Rock',
        state: 'AR',
        active: 'Y'
      },
      {
        vendor_ref: 'VENDOR-ELEC',
        vendor_name: 'River City Electric Supply',
        contact_name: 'Counter Team',
        phone: '501-555-0133',
        email: 'orders@rivercityelectric.example',
        city: 'Little Rock',
        state: 'AR',
        active: 'Y'
      },
      {
        vendor_ref: 'VENDOR-PLUMB',
        vendor_name: 'Delta Plumbing Wholesale',
        contact_name: 'Inside Sales',
        phone: '501-555-0188',
        email: 'sales@deltaplumbing.example',
        city: 'Sherwood',
        state: 'AR',
        active: 'Y'
      }
    ];
    const vendorRows = vendorStarter
      .filter((row) => !existingVendorRefs.has(row.vendor_ref))
      .map((row) => buildRow(vendorHeaders, row));
    await appendRows(sheets, spreadsheetId, vendorsTab, vendorRows);

    console.log(
      `Added ${laborRows.length} labor rates and ${vendorRows.length} vendors.`
    );
  }
};
