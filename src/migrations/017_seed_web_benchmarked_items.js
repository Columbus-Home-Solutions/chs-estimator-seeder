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
  version: 17,
  name: 'Seed web-benchmarked items (tile, hardwood, windows, doors, HVAC, water heater, gutters, garage door)',
  up: async ({ sheets, spreadsheetId }) => {
    const today = todayISO();

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

    const newItems = [
      { item_code: 'FLR-TILE-STD', category: 'Flooring', subcategory: 'Tile', description: 'Install standard porcelain/ceramic floor tile (straight-lay)', unit: 'sf', material_cost: 5.5, labor_hours_per_unit: 0.2, labor_rate_ref: 'LAB-FLOOR' },
      { item_code: 'FLR-HDW-STD', category: 'Flooring', subcategory: 'Hardwood', description: 'Install standard nail-down solid/engineered hardwood flooring', unit: 'sf', material_cost: 6, labor_hours_per_unit: 0.1, labor_rate_ref: 'LAB-FLOOR' },
      { item_code: 'WIN-REPL-STD', category: 'Exterior', subcategory: 'Windows', description: 'Retrofit replacement window (standard size, double-pane)', unit: 'ea', material_cost: 450, labor_hours_per_unit: 3, labor_rate_ref: 'LAB-CARP' },
      { item_code: 'DOOR-EXT-STD', category: 'Exterior', subcategory: 'Doors', description: 'Install prehung exterior entry door with weatherstrip and threshold', unit: 'ea', material_cost: 700, labor_hours_per_unit: 8, labor_rate_ref: 'LAB-CARP' },
      { item_code: 'HVAC-SYS-3T', category: 'HVAC', subcategory: 'Central System', description: 'Install 3-ton central AC + furnace (standard efficiency, existing ducts)', unit: 'ea', material_cost: 4500, labor_hours_per_unit: 40, labor_rate_ref: 'LAB-GEN' },
      { item_code: 'PLB-WTRHTR-STD', category: 'Plumbing', subcategory: 'Water Heater', description: 'Replace 40-50 gal gas or electric tank water heater', unit: 'ea', material_cost: 900, labor_hours_per_unit: 3, labor_rate_ref: 'LAB-PLMB' },
      { item_code: 'ROOF-GUT-SEAM', category: 'Roofing', subcategory: 'Gutters', description: 'Install seamless aluminum gutters with downspouts', unit: 'lf', material_cost: 4.5, labor_hours_per_unit: 0.1, labor_rate_ref: 'LAB-ROOF' },
      { item_code: 'EXT-GAR-DOOR', category: 'Exterior', subcategory: 'Garage Door', description: 'Install insulated steel garage door (16x7 standard double) with opener', unit: 'ea', material_cost: 1500, labor_hours_per_unit: 8, labor_rate_ref: 'LAB-CARP' }
    ];

    const added = await appendMissingRows({
      sheets,
      spreadsheetId,
      tabName: 'Pricebook_Master',
      keyColumnName: 'item_code',
      rowBuilder: (headers, row) => buildRow(headers, { ...defaults, ...row, last_updated_at: nowISO() }),
      rows: newItems
    });

    console.log(`Added ${added} web-benchmarked items.`);
  }
};
