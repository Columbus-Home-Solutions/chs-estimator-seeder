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
  version: 12,
  name: 'Expand pricebook and organize categories',
  up: async ({ sheets, spreadsheetId }) => {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const pbSheet = (spreadsheet.data.sheets || []).find(
      (s) => s.properties && s.properties.title === 'Pricebook_Master'
    );
    if (!pbSheet) throw new Error('Pricebook_Master sheet not found.');

    const sheetId = pbSheet.properties.sheetId;
    const maxRows = pbSheet.properties.gridProperties.rowCount || 2000;

    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Pricebook_Master!1:1'
    });
    const headers = (headerRes.data.values && headerRes.data.values[0]) || [];
    if (!headers.length) throw new Error('Pricebook_Master headers not found.');

    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Pricebook_Master!A2:A'
    });
    const existingCodes = new Set((existingRes.data.values || []).map((r) => String(r[0] || '').trim()).filter(Boolean));

    const defaults = {
      waste_pct: 0.08,
      overhead_pct_default: 0.15,
      profit_pct_default: 0.2,
      taxable: 'Y',
      vendor_ref: 'VENDOR-GENERAL',
      source_type: 'market_seed',
      source_url: '',
      source_date: todayISO(),
      confidence_score: 70,
      status: 'Draft',
      effective_date: todayISO(),
      expiration_date: '',
      pricebook_version: 'v1',
      last_updated_by: 'system',
      last_updated_at: nowISO(),
      equipment_cost_per_unit: 0
    };

    const phase2Items = [
      ['KIT-CAB-INST', 'Kitchen', 'Cabinetry', 'Install kitchen base and wall cabinetry', 'lf', 95, 0.85, 'LAB-CARP'],
      ['KIT-CAB-REFACE', 'Kitchen', 'Cabinetry', 'Reface existing kitchen cabinets', 'lf', 42, 0.5, 'LAB-CARP'],
      ['KIT-CTP-QTZ', 'Kitchen', 'Countertop', 'Install quartz countertop and edge polish', 'sf', 58, 0.35, 'LAB-CARP'],
      ['KIT-BKS-TILE', 'Kitchen', 'Backsplash', 'Install tile backsplash with grout and seal', 'sf', 16, 0.45, 'LAB-FLOOR'],
      ['KIT-APPL-PKG', 'Kitchen', 'Appliances', 'Install standard kitchen appliance package', 'ea', 420, 3.2, 'LAB-GEN'],
      ['KIT-ISL-FRAME', 'Kitchen', 'Framing', 'Frame and sheath kitchen island structure', 'ea', 180, 2.4, 'LAB-CARP'],

      ['BATH-SHW-TILE', 'Bath', 'Shower', 'Install tile shower surround system', 'sf', 24, 0.65, 'LAB-FLOOR'],
      ['BATH-TUB-INST', 'Bath', 'Tub', 'Set and connect standard bathtub', 'ea', 260, 3.1, 'LAB-PLMB'],
      ['BATH-VAN-INST', 'Bath', 'Vanity', 'Install vanity cabinet, top, and sink', 'ea', 195, 2.6, 'LAB-PLMB'],
      ['BATH-WTRPRF', 'Bath', 'Waterproofing', 'Apply waterproof membrane and prep', 'sf', 7, 0.28, 'LAB-GEN'],
      ['BATH-GLS-DOOR', 'Bath', 'Shower Door', 'Install framed glass shower door set', 'ea', 280, 1.9, 'LAB-GEN'],
      ['BATH-VENT-FAN', 'Bath', 'Electrical', 'Install bath exhaust fan vented exterior', 'ea', 125, 1.4, 'LAB-ELEC'],

      ['ADD-FRM-WALL', 'Additions', 'Framing', 'Frame exterior wall addition section', 'sf', 8.5, 0.22, 'LAB-CARP'],
      ['ADD-TRUSS-SET', 'Additions', 'Roof Framing', 'Set roof trusses for addition', 'sf', 6.8, 0.19, 'LAB-CARP'],
      ['ADD-SID-MATCH', 'Additions', 'Exterior Finish', 'Install matching siding on addition', 'sf', 3.9, 0.12, 'LAB-GEN'],
      ['ADD-INS-R21', 'Additions', 'Insulation', 'Install R21 batt insulation in addition walls', 'sf', 0.72, 0.03, 'LAB-GEN'],
      ['ADD-MEP-ROUGH', 'Additions', 'Rough-In', 'MEP rough-in allowance for addition area', 'sf', 14, 0.2, 'LAB-GEN'],

      ['NEW-SLAB-STD', 'New Construction', 'Foundation', 'Pour reinforced slab-on-grade foundation', 'sf', 6.4, 0.14, 'LAB-CONC'],
      ['NEW-FRM-STD', 'New Construction', 'Framing', 'Complete wall and roof framing package', 'sf', 18, 0.33, 'LAB-CARP'],
      ['NEW-ROOF-STD', 'New Construction', 'Roofing', 'Install architectural shingle roof system', 'sf', 4.5, 0.12, 'LAB-ROOF'],
      ['NEW-MEP-ROUGH', 'New Construction', 'Rough-In', 'New construction MEP rough-in allowance', 'sf', 23, 0.29, 'LAB-GEN'],
      ['NEW-FIN-INT', 'New Construction', 'Interior Finish', 'Interior finish allowance drywall/paint/trim', 'sf', 21, 0.34, 'LAB-GEN'],

      ['FENC-VINYL-PRV', 'Fence', 'Vinyl Privacy', 'Install 6ft vinyl privacy fence', 'lf', 27, 0.35, 'LAB-CARP'],
      ['FENC-CHAIN-STD', 'Fence', 'Chain Link', 'Install galvanized chain link fence', 'lf', 9, 0.25, 'LAB-CARP'],
      ['FENC-GATE-WLK', 'Fence', 'Gate', 'Install standard walk gate with hardware', 'ea', 165, 1.6, 'LAB-CARP'],

      ['DECK-PT-STD', 'Deck', 'Pressure Treated', 'Build pressure-treated deck structure', 'sf', 9.5, 0.52, 'LAB-CARP'],
      ['DECK-RAIL-COMP', 'Deck', 'Railing', 'Install composite/aluminum deck railing', 'lf', 32, 0.25, 'LAB-CARP'],
      ['DECK-STAIR-STD', 'Deck', 'Stairs', 'Build standard exterior deck stairs', 'ea', 180, 2.4, 'LAB-CARP'],

      ['ROOF-TEAR-OLD', 'Roofing', 'Tear-Off', 'Remove and dispose existing shingles', 'sf', 0.8, 0.06, 'LAB-ROOF'],
      ['ROOF-FLASH-STD', 'Roofing', 'Flashing', 'Install roof flashing and penetrations', 'lf', 5.6, 0.08, 'LAB-ROOF'],
      ['ROOF-GUT-INST', 'Roofing', 'Gutters', 'Install seamless gutters and downspouts', 'lf', 6.2, 0.09, 'LAB-ROOF'],

      ['CONC-SIDEWALK', 'Concrete', 'Flatwork', 'Pour concrete sidewalk standard finish', 'sf', 3.7, 0.1, 'LAB-CONC'],
      ['CONC-FOOTING', 'Concrete', 'Footing', 'Excavate and pour reinforced footing', 'lf', 8.8, 0.14, 'LAB-CONC'],
      ['CONC-STAMPED', 'Concrete', 'Decorative', 'Pour stamped decorative concrete slab', 'sf', 8.5, 0.2, 'LAB-CONC'],

      ['RETN-WALL-DRAIN', 'Sitework', 'Retaining Wall', 'Retaining wall drainage aggregate and pipe', 'lf', 12, 0.12, 'LAB-MASON'],
      ['RETN-WALL-GAB', 'Sitework', 'Retaining Wall', 'Install gabion retaining wall assembly', 'sf', 18, 0.24, 'LAB-MASON'],

      ['DRN-CATCH-BASIN', 'Drainage', 'Surface Drain', 'Install catch basin and tie into line', 'ea', 140, 1.9, 'LAB-LAND'],
      ['DRN-DOWNSP-EXT', 'Drainage', 'Downspout Extension', 'Install buried downspout extension line', 'lf', 4.8, 0.08, 'LAB-LAND']
    ];

    const newRows = phase2Items
      .map(([item_code, category, subcategory, description, unit, material_cost, labor_hours_per_unit, labor_rate_ref]) => ({
        ...defaults,
        item_code,
        category,
        subcategory,
        description,
        unit,
        material_cost,
        labor_hours_per_unit,
        labor_rate_ref,
        last_updated_at: nowISO()
      }))
      .filter((r) => !existingCodes.has(r.item_code))
      .map((r) => buildRow(headers, r));

    if (newRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Pricebook_Master!A1',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: newRows }
      });
    }

    const categoryRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Pricebook_Master!B2:B'
    });
    const categoryValues = (categoryRes.data.values || []).map((r) => String(r[0] || '').trim()).filter(Boolean);
    const uniqueCategories = Array.from(new Set(categoryValues)).sort((a, b) => a.localeCompare(b));

    const validationValues = uniqueCategories.map((c) => ({ userEnteredValue: c }));
    const requests = [
      {
        setDataValidation: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: maxRows,
            startColumnIndex: 1,
            endColumnIndex: 2
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: validationValues
            },
            strict: true,
            showCustomUi: true
          }
        }
      },
      {
        sortRange: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: maxRows,
            startColumnIndex: 0,
            endColumnIndex: headers.length
          },
          sortSpecs: [
            { dimensionIndex: 1, sortOrder: 'ASCENDING' },
            { dimensionIndex: 2, sortOrder: 'ASCENDING' },
            { dimensionIndex: 0, sortOrder: 'ASCENDING' }
          ]
        }
      }
    ];

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });

    console.log(
      `Added ${newRows.length} phase-2 items, set category dropdown (${uniqueCategories.length} values), and sorted by category.`
    );
  }
};
