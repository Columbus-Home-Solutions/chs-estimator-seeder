function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowISO() {
  return new Date().toISOString();
}

function getHeaderIndex(headers, name) {
  return headers.indexOf(name);
}

function buildRow(headers, values) {
  return headers.map((h) => (Object.prototype.hasOwnProperty.call(values, h) ? values[h] : ''));
}

module.exports = {
  version: 3,
  name: 'Seed additional pricebook items',
  up: async ({ sheets, spreadsheetId }) => {
    const tabName = 'Pricebook_Master';

    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!1:1`
    });
    const headers = (headerRes.data.values && headerRes.data.values[0]) || [];
    if (headers.length === 0) {
      throw new Error(`${tabName} headers not found.`);
    }

    const itemCodeIdx = getHeaderIndex(headers, 'item_code');
    if (itemCodeIdx < 0) {
      throw new Error(`item_code column not found in ${tabName}.`);
    }

    const existingRowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A2:A`
    });
    const existingItemCodes = new Set(
      (existingRowsRes.data.values || [])
        .map((r) => String(r[0] || '').trim())
        .filter(Boolean)
    );

    const today = todayISO();
    const now = nowISO();
    const defaults = {
      waste_pct: 0.08,
      overhead_pct_default: 0.15,
      profit_pct_default: 0.2,
      taxable: 'Y',
      vendor_ref: 'VENDOR-GENERAL',
      source_type: 'manual',
      source_url: '',
      source_date: today,
      confidence_score: 85,
      status: 'Approved',
      effective_date: today,
      expiration_date: '',
      pricebook_version: 'v1',
      last_updated_by: 'system',
      last_updated_at: now
    };

    const starterItems = [
      {
        item_code: 'DRY-PATCH-STD',
        category: 'Drywall',
        subcategory: 'Repair',
        description: 'Drywall patch and texture blend',
        unit: 'sf',
        material_cost: 0.95,
        labor_hours_per_unit: 0.045,
        labor_rate_ref: 'LAB-GEN',
        equipment_cost_per_unit: 0
      },
      {
        item_code: 'TRM-BASE-PRM',
        category: 'Trim',
        subcategory: 'Baseboard',
        description: 'Install and paint primed baseboard',
        unit: 'lf',
        material_cost: 1.7,
        labor_hours_per_unit: 0.05,
        labor_rate_ref: 'LAB-CARP',
        equipment_cost_per_unit: 0
      },
      {
        item_code: 'ELC-DEV-STD',
        category: 'Electrical',
        subcategory: 'Device',
        description: 'Replace standard outlet or switch',
        unit: 'ea',
        material_cost: 8.5,
        labor_hours_per_unit: 0.35,
        labor_rate_ref: 'LAB-GEN',
        equipment_cost_per_unit: 0
      },
      {
        item_code: 'PLB-FIX-STD',
        category: 'Plumbing',
        subcategory: 'Fixture',
        description: 'Install standard vanity faucet fixture',
        unit: 'ea',
        material_cost: 68,
        labor_hours_per_unit: 1.15,
        labor_rate_ref: 'LAB-GEN',
        equipment_cost_per_unit: 0
      },
      {
        item_code: 'CLN-FINAL-POST',
        category: 'General',
        subcategory: 'Cleaning',
        description: 'Post-construction final cleanup',
        unit: 'sf',
        material_cost: 0.06,
        labor_hours_per_unit: 0.012,
        labor_rate_ref: 'LAB-GEN',
        equipment_cost_per_unit: 0
      }
    ];

    const newRows = starterItems
      .filter((item) => !existingItemCodes.has(item.item_code))
      .map((item) => buildRow(headers, { ...defaults, ...item, last_updated_at: nowISO() }));

    if (newRows.length === 0) {
      console.log('No new starter pricebook items to add.');
      return;
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: newRows }
    });

    console.log(`Added ${newRows.length} starter pricebook items.`);
  }
};
