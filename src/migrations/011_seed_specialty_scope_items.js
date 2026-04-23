function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowISO() {
  return new Date().toISOString();
}

function buildRow(headers, values) {
  return headers.map((h) => (Object.prototype.hasOwnProperty.call(values, h) ? values[h] : ''));
}

async function appendMissingRows({ sheets, spreadsheetId, tabName, keyColumnName, rowBuilder, rows }) {
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!1:1`
  });
  const headers = (headerRes.data.values && headerRes.data.values[0]) || [];
  if (!headers.length) throw new Error(`${tabName} headers not found.`);

  const keyIndex = headers.indexOf(keyColumnName);
  if (keyIndex < 0) throw new Error(`${keyColumnName} not found in ${tabName}.`);

  const colLetter = String.fromCharCode(65 + keyIndex);
  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!${colLetter}2:${colLetter}`
  });
  const existingKeys = new Set((existingRes.data.values || []).map((r) => String(r[0] || '').trim()).filter(Boolean));

  const newRows = rows.filter((r) => !existingKeys.has(String(r[keyColumnName] || '').trim())).map((r) => rowBuilder(headers, r));
  if (!newRows.length) return 0;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: newRows }
  });
  return newRows.length;
}

module.exports = {
  version: 11,
  name: 'Seed specialty scope items and labor rates',
  up: async ({ sheets, spreadsheetId }) => {
    const today = todayISO();

    const laborRows = [
      { labor_rate_ref: 'LAB-ROOF', role: 'Roofer', hourly_rate: 78, effective_date: today, status: 'Active' },
      { labor_rate_ref: 'LAB-CONC', role: 'Concrete Crew', hourly_rate: 72, effective_date: today, status: 'Active' },
      { labor_rate_ref: 'LAB-MASON', role: 'Mason', hourly_rate: 82, effective_date: today, status: 'Active' },
      { labor_rate_ref: 'LAB-LAND', role: 'Drainage / Site Crew', hourly_rate: 68, effective_date: today, status: 'Active' }
    ];

    const addedLabor = await appendMissingRows({
      sheets,
      spreadsheetId,
      tabName: 'Labor_Rates',
      keyColumnName: 'labor_rate_ref',
      rowBuilder: buildRow,
      rows: laborRows
    });

    const defaults = {
      waste_pct: 0.08,
      overhead_pct_default: 0.15,
      profit_pct_default: 0.2,
      taxable: 'Y',
      vendor_ref: 'VENDOR-GENERAL',
      source_type: 'market_seed',
      source_url: '',
      source_date: today,
      confidence_score: 72,
      status: 'Draft',
      effective_date: today,
      expiration_date: '',
      pricebook_version: 'v1',
      last_updated_by: 'system',
      last_updated_at: nowISO(),
      equipment_cost_per_unit: 0
    };

    const scopeItems = [
      { item_code: 'KIT-REMOD-MID', category: 'Kitchen', subcategory: 'Remodel', description: 'Kitchen remodel allowance mid-range', unit: 'sf', material_cost: 120, labor_hours_per_unit: 1.8, labor_rate_ref: 'LAB-GEN' },
      { item_code: 'BATH-REMOD-MID', category: 'Bath', subcategory: 'Remodel', description: 'Bathroom remodel allowance mid-range', unit: 'sf', material_cost: 95, labor_hours_per_unit: 1.6, labor_rate_ref: 'LAB-GEN' },
      { item_code: 'ADD-ROOM-GND', category: 'Additions', subcategory: 'Ground Floor', description: 'Ground floor room addition standard finish', unit: 'sf', material_cost: 110, labor_hours_per_unit: 1.7, labor_rate_ref: 'LAB-GEN' },
      { item_code: 'NEW-CONST-MID', category: 'New Construction', subcategory: 'Residential', description: 'New construction baseline allowance mid-grade', unit: 'sf', material_cost: 115, labor_hours_per_unit: 1.75, labor_rate_ref: 'LAB-GEN' },
      { item_code: 'FENC-WOOD-PRV', category: 'Fence', subcategory: 'Wood Privacy', description: 'Install 6ft wood privacy fence', unit: 'lf', material_cost: 18, labor_hours_per_unit: 0.4, labor_rate_ref: 'LAB-CARP' },
      { item_code: 'DECK-COMP-STD', category: 'Deck', subcategory: 'Composite', description: 'Build standard composite deck framing and boards', unit: 'sf', material_cost: 14, labor_hours_per_unit: 0.55, labor_rate_ref: 'LAB-CARP' },
      { item_code: 'ROOF-ASH-RPL', category: 'Roofing', subcategory: 'Asphalt Shingle', description: 'Replace asphalt architectural shingle roofing', unit: 'sf', material_cost: 3.2, labor_hours_per_unit: 0.12, labor_rate_ref: 'LAB-ROOF' },
      { item_code: 'CONC-DRV-STD', category: 'Concrete', subcategory: 'Driveway', description: 'Pour standard broom-finish driveway slab', unit: 'sf', material_cost: 4.8, labor_hours_per_unit: 0.14, labor_rate_ref: 'LAB-CONC' },
      { item_code: 'CONC-PAT-STD', category: 'Concrete', subcategory: 'Patio', description: 'Pour standard broom-finish patio slab', unit: 'sf', material_cost: 4.2, labor_hours_per_unit: 0.13, labor_rate_ref: 'LAB-CONC' },
      { item_code: 'RETN-BLOCK-STD', category: 'Sitework', subcategory: 'Retaining Wall', description: 'Install segmental retaining wall with base prep', unit: 'sf', material_cost: 16, labor_hours_per_unit: 0.28, labor_rate_ref: 'LAB-MASON' },
      { item_code: 'DRN-FRCH-EXT', category: 'Drainage', subcategory: 'French Drain Exterior', description: 'Install exterior french drain trench and pipe', unit: 'lf', material_cost: 6, labor_hours_per_unit: 0.18, labor_rate_ref: 'LAB-LAND' },
      { item_code: 'DRN-FRCH-INT', category: 'Drainage', subcategory: 'French Drain Interior', description: 'Install interior perimeter basement french drain', unit: 'lf', material_cost: 10, labor_hours_per_unit: 0.42, labor_rate_ref: 'LAB-LAND' }
    ];

    const addedItems = await appendMissingRows({
      sheets,
      spreadsheetId,
      tabName: 'Pricebook_Master',
      keyColumnName: 'item_code',
      rowBuilder: (headers, row) => buildRow(headers, { ...defaults, ...row, last_updated_at: nowISO() }),
      rows: scopeItems
    });

    console.log(`Added ${addedLabor} labor rates and ${addedItems} specialty scope items.`);
  }
};
