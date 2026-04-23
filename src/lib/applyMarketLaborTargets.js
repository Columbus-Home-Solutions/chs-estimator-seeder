const fs = require('fs');
const path = require('path');

const TARGETS_PATH = path.join(__dirname, '..', '..', 'data', 'market_labor_targets.json');

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

function idx(headers, name) {
  return headers.indexOf(name);
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function applyMarketLaborTargets({ sheets, spreadsheetId }) {
  if (!fs.existsSync(TARGETS_PATH)) {
    throw new Error(`Missing ${TARGETS_PATH}. Run: npm run build:market-rates`);
  }

  const payload = JSON.parse(fs.readFileSync(TARGETS_PATH, 'utf8'));
  const targets = payload.targets || [];
  if (!targets.length) {
    return { updatedCount: 0, targetCount: 0, skippedNoHourlyRate: 0 };
  }

  const laborRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Labor_Rates!A:E'
  });
  const laborRows = laborRes.data.values || [];
  const laborMap = new Map();
  for (const row of laborRows.slice(1)) {
    laborMap.set(String(row[0] || '').trim(), toNumber(row[2]));
  }

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Pricebook_Master!1:1'
  });
  const headers = (headerRes.data.values && headerRes.data.values[0]) || [];
  if (!headers.length) {
    return { updatedCount: 0, targetCount: targets.length, skippedNoHourlyRate: 0 };
  }

  // Stop at the first calculated column so we never overwrite ARRAYFORMULAs.
  const firstCalcHeader = 'labor_hourly_rate';
  const firstCalcIdx = headers.indexOf(firstCalcHeader);
  const writableEndIdx = firstCalcIdx > 0 ? firstCalcIdx : headers.length;
  const writableEndCol = toA1Col(writableEndIdx);

  const pbRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `Pricebook_Master!A:${writableEndCol}`
  });
  const rows = pbRes.data.values || [];
  if (rows.length < 2) {
    return { updatedCount: 0, targetCount: targets.length, skippedNoHourlyRate: 0 };
  }

  const itemCodeIdx = idx(headers, 'item_code');
  const laborHoursIdx = idx(headers, 'labor_hours_per_unit');
  const laborRateRefIdx = idx(headers, 'labor_rate_ref');
  const sourceTypeIdx = idx(headers, 'source_type');
  const sourceUrlIdx = idx(headers, 'source_url');
  const sourceDateIdx = idx(headers, 'source_date');
  const confidenceIdx = idx(headers, 'confidence_score');
  const statusIdx = idx(headers, 'status');
  const updatedAtIdx = idx(headers, 'last_updated_at');

  if ([itemCodeIdx, laborHoursIdx, laborRateRefIdx].some((i) => i < 0)) {
    throw new Error('Required Pricebook_Master columns are missing.');
  }
  if (laborHoursIdx >= writableEndIdx) {
    throw new Error('labor_hours_per_unit falls inside calculated column range; aborting.');
  }

  const targetByCode = new Map(targets.map((t) => [t.item_code, t]));
  let updatedCount = 0;
  let skippedNoHourlyRate = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const itemCode = String(row[itemCodeIdx] || '').trim();
    const target = targetByCode.get(itemCode);
    if (!target) continue;

    const laborRef = target.labor_rate_ref || String(row[laborRateRefIdx] || '').trim();
    const hourly = laborMap.get(laborRef);
    if (!hourly || hourly <= 0) {
      skippedNoHourlyRate += 1;
      continue;
    }

    const laborHoursPerUnit = target.labor_unit_cost_target / hourly;
    row[laborHoursIdx] = String(Number(laborHoursPerUnit.toFixed(4)));
    row[laborRateRefIdx] = laborRef;

    if (sourceTypeIdx >= 0) row[sourceTypeIdx] = 'market_blend';
    if (sourceUrlIdx >= 0) row[sourceUrlIdx] = (target.source_urls || []).slice(0, 2).join(' | ');
    if (sourceDateIdx >= 0) row[sourceDateIdx] = target.source_date || new Date().toISOString().slice(0, 10);
    if (confidenceIdx >= 0) row[confidenceIdx] = String(target.confidence_score || 70);
    if (statusIdx >= 0 && !String(row[statusIdx] || '').trim()) row[statusIdx] = 'Reviewed';
    if (updatedAtIdx >= 0) row[updatedAtIdx] = new Date().toISOString();
    updatedCount += 1;
  }

  // Only write back the non-calculated portion so we preserve ARRAYFORMULAs.
  const truncatedRows = rows.map((r) => r.slice(0, writableEndIdx));
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Pricebook_Master!A1:${writableEndCol}${rows.length}`,
    valueInputOption: 'RAW',
    requestBody: { values: truncatedRows }
  });

  return { updatedCount, targetCount: targets.length, skippedNoHourlyRate };
}

module.exports = {
  applyMarketLaborTargets
};
