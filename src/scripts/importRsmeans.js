const fs = require('fs');
const path = require('path');

const INPUT_PATH = path.join(__dirname, '..', '..', 'data', 'rsmeans_raw.csv');
const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'data', 'rsmeans_raw.template.csv');
const OUTPUT_PATH = path.join(__dirname, '..', '..', 'data', 'rsmeans_observations.json');

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((v) => v.trim());
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] || '';
    });
    return row;
  });
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Missing ${INPUT_PATH}. Copy ${TEMPLATE_PATH} to rsmeans_raw.csv and fill it in.`);
  }

  const rows = parseCsv(fs.readFileSync(INPUT_PATH, 'utf8'));
  const observations = rows
    .filter((r) => r.item_code && r.unit)
    .map((r) => ({
      item_code: r.item_code,
      unit: r.unit,
      labor_unit_cost_low: Number(r.labor_unit_cost_low),
      labor_unit_cost_high: Number(r.labor_unit_cost_high),
      source_name: r.source_name || 'RSMeans',
      source_url: r.source_url || '',
      source_date: r.source_date || new Date().toISOString().slice(0, 10),
      notes: r.notes || '',
      source_type: 'rsmeans',
      source_weight: 3,
      labor_rate_ref: r.labor_rate_ref || ''
    }))
    .filter((r) => Number.isFinite(r.labor_unit_cost_low) && Number.isFinite(r.labor_unit_cost_high) && r.labor_unit_cost_low > 0 && r.labor_unit_cost_high > 0);

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(observations, null, 2)}\n`, 'utf8');
  console.log(`Imported ${observations.length} RSMeans observations to ${OUTPUT_PATH}`);
}

main();
