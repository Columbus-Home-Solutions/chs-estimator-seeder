const fs = require('fs');
const path = require('path');

const OBSERVATIONS_PATH = path.join(__dirname, '..', '..', 'data', 'market_labor_observations.json');
const RSMEANS_OBSERVATIONS_PATH = path.join(__dirname, '..', '..', 'data', 'rsmeans_observations.json');
const OUTPUT_PATH = path.join(__dirname, '..', '..', 'data', 'market_labor_targets.json');

const ITEM_TO_LABOR_RATE_REF = {
  'PNT-WALL-STD': 'LAB-PAINT',
  'FLR-LVP-STD': 'LAB-FLOOR',
  'DRY-PATCH-STD': 'LAB-DRYW',
  'TRM-BASE-PRM': 'LAB-CARP',
  'ELC-DEV-STD': 'LAB-ELEC',
  'PLB-FIX-STD': 'LAB-PLMB',
  'CLN-FINAL-POST': 'LAB-GEN',
  'KIT-REMOD-MID': 'LAB-GEN',
  'BATH-REMOD-MID': 'LAB-GEN',
  'ADD-ROOM-GND': 'LAB-GEN',
  'NEW-CONST-MID': 'LAB-GEN',
  'FENC-WOOD-PRV': 'LAB-CARP',
  'DECK-COMP-STD': 'LAB-CARP',
  'ROOF-ASH-RPL': 'LAB-ROOF',
  'CONC-DRV-STD': 'LAB-CONC',
  'CONC-PAT-STD': 'LAB-CONC',
  'RETN-BLOCK-STD': 'LAB-MASON',
  'DRN-FRCH-EXT': 'LAB-LAND',
  'DRN-FRCH-INT': 'LAB-LAND',
  'FLR-TILE-STD': 'LAB-FLOOR',
  'FLR-HDW-STD': 'LAB-FLOOR',
  'WIN-REPL-STD': 'LAB-CARP',
  'DOOR-EXT-STD': 'LAB-CARP',
  'HVAC-SYS-3T': 'LAB-GEN',
  'PLB-WTRHTR-STD': 'LAB-PLMB',
  'ROOF-GUT-SEAM': 'LAB-ROOF',
  'EXT-GAR-DOOR': 'LAB-CARP'
};

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function round(value, places = 4) {
  const p = 10 ** places;
  return Math.round(value * p) / p;
}

function computeTarget(points) {
  const sorted = [...points].sort((a, b) => a - b);
  const median = quantile(sorted, 0.5);
  const p75 = quantile(sorted, 0.75);
  const max = sorted[sorted.length - 1];
  const target = Math.min(p75, median + 0.35 * (max - median));
  return {
    median: round(median, 4),
    p75: round(p75, 4),
    max: round(max, 4),
    target: round(target, 4)
  };
}

function build() {
  const observations = JSON.parse(fs.readFileSync(OBSERVATIONS_PATH, 'utf8'));
  const rsmeansObservations = fs.existsSync(RSMEANS_OBSERVATIONS_PATH)
    ? JSON.parse(fs.readFileSync(RSMEANS_OBSERVATIONS_PATH, 'utf8'))
    : [];
  const allObservations = [...observations, ...rsmeansObservations];
  const grouped = new Map();

  for (const row of allObservations) {
    if (!grouped.has(row.item_code)) grouped.set(row.item_code, []);
    grouped.get(row.item_code).push(row);
  }

  const targets = [];
  for (const [itemCode, rows] of grouped.entries()) {
    const points = rows.flatMap((r) => {
      const weight = Math.max(1, Number(r.source_weight || 1));
      const low = Number(r.labor_unit_cost_low);
      const high = Number(r.labor_unit_cost_high);
      if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= 0) return [];
      const weighted = [];
      for (let i = 0; i < weight; i += 1) {
        weighted.push(low, high);
      }
      return weighted;
    });

    if (points.length < 4) continue;

    const stats = computeTarget(points);
    targets.push({
      item_code: itemCode,
      unit: rows[0].unit,
      labor_rate_ref: ITEM_TO_LABOR_RATE_REF[itemCode] || 'LAB-GEN',
      source_count: rows.length,
      rsmeans_source_count: rows.filter((r) => String(r.source_type || '').toLowerCase() === 'rsmeans').length,
      labor_unit_cost_median: stats.median,
      labor_unit_cost_p75: stats.p75,
      labor_unit_cost_max: stats.max,
      labor_unit_cost_target: stats.target,
      confidence_score: Math.min(95, 60 + rows.length * 8),
      source_urls: rows.map((r) => r.source_url).filter(Boolean),
      source_names: rows.map((r) => r.source_name).filter(Boolean),
      source_date: rows.map((r) => r.source_date).sort().slice(-1)[0]
    });
  }

  targets.sort((a, b) => a.item_code.localeCompare(b.item_code));

  const payload = {
    generated_at: new Date().toISOString(),
    strategy: 'target = min(p75, median + 0.35 * (max - median))',
    targets
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${targets.length} market labor targets to ${OUTPUT_PATH}`);
}

build();
