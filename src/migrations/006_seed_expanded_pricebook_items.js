function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowISO() {
  return new Date().toISOString();
}

function buildRow(headers, values) {
  return headers.map((h) => (Object.prototype.hasOwnProperty.call(values, h) ? values[h] : ''));
}

module.exports = {
  version: 6,
  name: 'Seed expanded construction pricebook items',
  up: async ({ sheets, spreadsheetId }) => {
    const tabName = 'Pricebook_Master';
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!1:1`
    });
    const headers = (headerRes.data.values && headerRes.data.values[0]) || [];
    if (!headers.length) throw new Error(`${tabName} headers not found.`);

    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A2:A`
    });
    const existingCodes = new Set((existingRes.data.values || []).map((r) => String(r[0] || '').trim()).filter(Boolean));

    const today = todayISO();
    const defaults = {
      waste_pct: 0.08,
      overhead_pct_default: 0.15,
      profit_pct_default: 0.2,
      taxable: 'Y',
      vendor_ref: 'VENDOR-GENERAL',
      source_type: 'manual_seed',
      source_url: '',
      source_date: today,
      confidence_score: 70,
      status: 'Draft',
      effective_date: today,
      expiration_date: '',
      pricebook_version: 'v1',
      last_updated_by: 'system',
      last_updated_at: nowISO()
    };

    const items = [
      ['CARP-DOOR-HNG', 'Carpentry', 'Doors', 'Hang prehung interior door', 'ea', 145, 2.2, 'LAB-CARP'],
      ['CARP-DOOR-SLB', 'Carpentry', 'Doors', 'Install interior slab door with hardware prep', 'ea', 95, 1.8, 'LAB-CARP'],
      ['CARP-TRIM-CRN', 'Carpentry', 'Trim', 'Install crown molding', 'lf', 2.4, 0.08, 'LAB-CARP'],
      ['CARP-TRIM-CAS', 'Carpentry', 'Trim', 'Install door and window casing', 'lf', 1.6, 0.06, 'LAB-CARP'],
      ['DRY-HANG-12', 'Drywall', 'Install', 'Hang and finish drywall 1/2 inch board', 'sf', 0.85, 0.05, 'LAB-DRYW'],
      ['DRY-TAPE-FIN', 'Drywall', 'Finish', 'Tape, mud, and finish drywall joints', 'sf', 0.28, 0.035, 'LAB-DRYW'],
      ['PNT-CEIL-STD', 'Paint', 'Interior', 'Paint ceiling standard prep', 'sf', 0.33, 0.02, 'LAB-PAINT'],
      ['PNT-TRIM-STD', 'Paint', 'Interior', 'Paint interior trim and doors', 'lf', 0.42, 0.015, 'LAB-PAINT'],
      ['FLR-TILE-CER', 'Flooring', 'Tile', 'Install ceramic floor tile', 'sf', 3.1, 0.11, 'LAB-FLOOR'],
      ['FLR-CARP-PAD', 'Flooring', 'Carpet', 'Install carpet with pad', 'sf', 1.45, 0.04, 'LAB-FLOOR'],
      ['FLR-LAM-STD', 'Flooring', 'Laminate', 'Install laminate flooring floating system', 'sf', 1.85, 0.05, 'LAB-FLOOR'],
      ['ELE-LITE-RCS', 'Electrical', 'Lighting', 'Install recessed light can retrofit', 'ea', 32, 0.75, 'LAB-ELEC'],
      ['ELE-LITE-FAN', 'Electrical', 'Fixture', 'Install ceiling fan with light', 'ea', 88, 1.4, 'LAB-ELEC'],
      ['ELE-SMOKE-DET', 'Electrical', 'Safety', 'Install smoke and CO detector', 'ea', 24, 0.45, 'LAB-ELEC'],
      ['PLB-TOIL-STD', 'Plumbing', 'Fixture', 'Install standard toilet fixture', 'ea', 135, 1.7, 'LAB-PLMB'],
      ['PLB-SINK-KIT', 'Plumbing', 'Fixture', 'Install kitchen sink and basket strainer', 'ea', 155, 1.9, 'LAB-PLMB'],
      ['PLB-VALVE-SHW', 'Plumbing', 'Valve', 'Install shower mixing valve trim set', 'ea', 115, 1.8, 'LAB-PLMB'],
      ['CNT-LAM-STD', 'Cabinetry', 'Countertop', 'Install laminate countertop', 'lf', 24, 0.55, 'LAB-CARP'],
      ['CAB-BASE-STD', 'Cabinetry', 'Base Cabinet', 'Install base cabinet run', 'lf', 88, 0.8, 'LAB-CARP'],
      ['CAB-WALL-STD', 'Cabinetry', 'Wall Cabinet', 'Install wall cabinet run', 'lf', 92, 0.9, 'LAB-CARP'],
      ['EXT-SID-VIN', 'Exterior', 'Siding', 'Install vinyl siding over housewrap', 'sf', 1.95, 0.06, 'LAB-GEN'],
      ['EXT-SOF-ALM', 'Exterior', 'Soffit', 'Install aluminum soffit and fascia trim', 'lf', 3.2, 0.07, 'LAB-GEN'],
      ['DEM-INT-STD', 'Demolition', 'Interior', 'Selective interior demolition and haul', 'sf', 0.55, 0.02, 'LAB-GEN'],
      ['INS-BATT-R13', 'Insulation', 'Walls', 'Install fiberglass batt insulation R13', 'sf', 0.48, 0.018, 'LAB-GEN'],
      ['WTHR-CLN-FIN', 'General', 'Cleaning', 'Final wipe and polish after completion', 'sf', 0.09, 0.01, 'LAB-GEN']
    ];

    const rows = items
      .filter((row) => !existingCodes.has(row[0]))
      .map(([item_code, category, subcategory, description, unit, material_cost, labor_hours_per_unit, labor_rate_ref]) =>
        buildRow(headers, {
          ...defaults,
          item_code,
          category,
          subcategory,
          description,
          unit,
          material_cost,
          labor_hours_per_unit,
          labor_rate_ref,
          equipment_cost_per_unit: 0,
          last_updated_at: nowISO()
        })
      );

    if (!rows.length) {
      console.log('No additional expanded pricebook items to add.');
      return;
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows }
    });

    console.log(`Added ${rows.length} expanded pricebook items.`);
  }
};
