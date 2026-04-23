require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

function normalizeSheetId(input) {
  const value = String(input || '').trim();
  if (!value) return '';
  const urlMatch = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return urlMatch ? urlMatch[1] : value;
}

const SHEET_ID = normalizeSheetId(process.env.SHEET_ID);
if (!SHEET_ID) {
  throw new Error('Missing SHEET_ID in .env');
}

const OUTPUT_PATH = path.join(__dirname, '..', '..', 'data', 'jobber_products_services.csv');

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ]
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toNumberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Pricebook_Master!A:AZ'
  });

  const rows = res.data.values || [];
  if (rows.length < 2) {
    throw new Error('Pricebook_Master has no data rows to export.');
  }

  const headers = rows[0];
  const idx = {
    item_code: headers.indexOf('item_code'),
    description: headers.indexOf('description'),
    taxable: headers.indexOf('taxable'),
    status: headers.indexOf('status'),
    base_unit_cost: headers.indexOf('base_unit_cost'),
    final_unit_cost: headers.indexOf('final_unit_cost')
  };

  for (const [key, value] of Object.entries(idx)) {
    if (value < 0) throw new Error(`Missing required Pricebook_Master column: ${key}`);
  }

  const outputHeaders = [
    'Name',
    'Description',
    'Unit Price',
    'Taxable',
    'Category',
    'Active',
    'Unit cost'
  ];

  const outputLines = [outputHeaders.map(csvEscape).join(',')];

  for (const row of rows.slice(1)) {
    const itemCode = String(row[idx.item_code] || '').trim();
    const description = String(row[idx.description] || '').trim();
    if (!itemCode || !description) continue;

    const active = String(row[idx.status] || '').trim().toLowerCase() !== 'retired';
    const taxable = String(row[idx.taxable] || '').trim().toUpperCase() === 'Y';
    const unitCost = toNumberOrZero(row[idx.base_unit_cost]).toFixed(2);
    const unitPrice = toNumberOrZero(row[idx.final_unit_cost]).toFixed(2);

    const name = itemCode;
    const desc = description;

    const outRow = [
      name,
      desc,
      unitPrice,
      taxable ? 'TRUE' : 'FALSE',
      'Service',
      active ? 'TRUE' : 'FALSE',
      unitCost
    ];
    outputLines.push(outRow.map(csvEscape).join(','));
  }

  fs.writeFileSync(OUTPUT_PATH, `${outputLines.join('\n')}\n`, 'utf8');
  console.log(`Exported ${outputLines.length - 1} items to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Jobber CSV export failed:', err.message);
  process.exit(1);
});
