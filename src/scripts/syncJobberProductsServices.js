require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { refreshAccessToken, graphql } = require('../lib/jobberOAuth');

function updateEnvFile(updates) {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;
  let contents = fs.readFileSync(envPath, 'utf8');
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(contents)) {
      contents = contents.replace(re, line);
    } else {
      contents += (contents.endsWith('\n') ? '' : '\n') + line + '\n';
    }
  }
  fs.writeFileSync(envPath, contents, 'utf8');
  console.log('Rotated Jobber tokens saved to .env');
}

function normalizeSheetId(input) {
  const value = String(input || '').trim();
  if (!value) return '';
  const urlMatch = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return urlMatch ? urlMatch[1] : value;
}

const SHEET_ID = normalizeSheetId(process.env.SHEET_ID);
const CLIENT_ID = process.env.JOBBER_CLIENT_ID;
const CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.JOBBER_REFRESH_TOKEN;
const DRY_RUN = String(process.env.DRY_RUN || '').toLowerCase() === 'true';
const REFRESH_TOKEN_OUT_PATH = process.env.JOBBER_REFRESH_TOKEN_OUT_PATH || '';

if (!SHEET_ID) throw new Error('Missing SHEET_ID');
if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  throw new Error('Missing JOBBER_CLIENT_ID / JOBBER_CLIENT_SECRET / JOBBER_REFRESH_TOKEN');
}

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

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function fetchPricebookRows(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Pricebook_Master!A:AZ'
  });
  const rows = res.data.values || [];
  if (rows.length < 2) throw new Error('Pricebook_Master has no data rows.');
  const headers = rows[0];
  const needed = ['item_code', 'description', 'taxable', 'status', 'base_unit_cost', 'final_unit_cost'];
  const idx = {};
  for (const h of needed) {
    idx[h] = headers.indexOf(h);
    if (idx[h] < 0) throw new Error(`Missing column: ${h}`);
  }
  return rows.slice(1)
    .map((row) => {
      const itemCode = String(row[idx.item_code] || '').trim();
      const description = String(row[idx.description] || '').trim();
      if (!itemCode || !description) return null;
      return {
        itemCode,
        name: itemCode,
        description,
        taxable: String(row[idx.taxable] || '').trim().toUpperCase() === 'Y',
        status: String(row[idx.status] || '').trim().toLowerCase(),
        unitCost: toNumber(row[idx.base_unit_cost]),
        defaultUnitCost: toNumber(row[idx.final_unit_cost])
      };
    })
    .filter(Boolean);
}

const LIST_PRODUCTS_QUERY = `
  query ListProducts($after: String) {
    productOrServices(first: 100, after: $after) {
      nodes { id name description defaultUnitCost internalUnitCost taxable visible category }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const CREATE_MUTATION = `
  mutation CreateProduct($input: ProductsAndServicesInput!) {
    productsAndServicesCreate(input: $input) {
      productOrService { id name }
      userErrors { message path }
    }
  }
`;

const EDIT_MUTATION = `
  mutation EditProduct($productOrServiceId: EncodedId!, $input: ProductsAndServicesEditInput!) {
    productsAndServicesEdit(productOrServiceId: $productOrServiceId, input: $input) {
      productOrService { id name defaultUnitCost internalUnitCost taxable }
      userErrors { message path }
    }
  }
`;

async function listAllJobberProducts(accessToken) {
  const all = [];
  let after = null;
  while (true) {
    const data = await graphql({ accessToken, query: LIST_PRODUCTS_QUERY, variables: { after } });
    const conn = data.productOrServices;
    all.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return all;
}

function buildEditInput(row) {
  return {
    name: row.name,
    description: row.description,
    defaultUnitCost: Number(row.defaultUnitCost.toFixed(2)),
    internalUnitCost: Number(row.unitCost.toFixed(2)),
    taxable: row.taxable,
    visible: row.status !== 'retired'
  };
}

function buildCreateInput(row) {
  return {
    name: row.name,
    description: row.description,
    defaultUnitCost: Number(row.defaultUnitCost.toFixed(2)),
    internalUnitCost: Number(row.unitCost.toFixed(2)),
    taxable: row.taxable,
    category: 'SERVICE'
  };
}

function needsUpdate(existing, desired) {
  const e = {
    name: existing.name,
    description: existing.description || '',
    defaultUnitCost: Number(existing.defaultUnitCost || 0),
    internalUnitCost: Number(existing.internalUnitCost || 0),
    taxable: Boolean(existing.taxable),
    visible: Boolean(existing.visible)
  };
  return (
    e.name !== desired.name ||
    e.description !== desired.description ||
    e.defaultUnitCost.toFixed(2) !== desired.defaultUnitCost.toFixed(2) ||
    e.internalUnitCost.toFixed(2) !== desired.internalUnitCost.toFixed(2) ||
    e.taxable !== desired.taxable ||
    e.visible !== desired.visible
  );
}

async function main() {
  console.log(`Jobber sync starting${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  const tokens = await refreshAccessToken({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    refreshToken: REFRESH_TOKEN
  });
  const accessToken = tokens.access_token;

  if (tokens.refresh_token && tokens.refresh_token !== REFRESH_TOKEN) {
    if (REFRESH_TOKEN_OUT_PATH) {
      fs.writeFileSync(REFRESH_TOKEN_OUT_PATH, tokens.refresh_token, 'utf8');
      console.log(`Rotated refresh token written to ${REFRESH_TOKEN_OUT_PATH}`);
    }
    updateEnvFile({
      JOBBER_REFRESH_TOKEN: tokens.refresh_token,
      JOBBER_ACCESS_TOKEN: tokens.access_token
    });
  }

  const sheets = await getSheetsClient();
  const desiredRows = await fetchPricebookRows(sheets);
  console.log(`Loaded ${desiredRows.length} rows from Pricebook_Master.`);

  const existingProducts = await listAllJobberProducts(accessToken);
  const byName = new Map();
  for (const p of existingProducts) {
    byName.set(String(p.name || '').trim(), p);
  }
  console.log(`Fetched ${existingProducts.length} existing Jobber products.`);

  let created = 0;
  let updated = 0;
  let skippedUnchanged = 0;
  const errors = [];

  for (const row of desiredRows) {
    const existing = byName.get(row.name);
    try {
      if (!existing) {
        if (DRY_RUN) {
          console.log(`[dry] CREATE ${row.name}`);
        } else {
          const data = await graphql({
            accessToken,
            query: CREATE_MUTATION,
            variables: { input: buildCreateInput(row) }
          });
          const ue = data.productsAndServicesCreate.userErrors || [];
          if (ue.length) throw new Error(ue.map((e) => e.message).join(' | '));
        }
        created += 1;
        continue;
      }

      const desired = buildEditInput(row);
      if (!needsUpdate(existing, desired)) {
        skippedUnchanged += 1;
        continue;
      }

      if (DRY_RUN) {
        console.log(`[dry] UPDATE ${row.name}`);
      } else {
        const data = await graphql({
          accessToken,
          query: EDIT_MUTATION,
          variables: { productOrServiceId: existing.id, input: desired }
        });
        const ue = data.productsAndServicesEdit.userErrors || [];
        if (ue.length) throw new Error(ue.map((e) => e.message).join(' | '));
      }
      updated += 1;
    } catch (err) {
      errors.push({ item: row.name, error: err.message });
    }
  }

  console.log('\nJobber sync summary:');
  console.log(`  Created:          ${created}`);
  console.log(`  Updated:          ${updated}`);
  console.log(`  Unchanged:        ${skippedUnchanged}`);
  console.log(`  Errors:           ${errors.length}`);
  if (errors.length) {
    for (const e of errors) console.log(`    ! ${e.item}: ${e.error}`);
  }

  const summary = { created, updated, unchanged: skippedUnchanged, errors };
  const outPath = path.join(__dirname, '..', '..', 'data', 'jobber_sync_summary.json');
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  if (errors.length) process.exit(1);
}

main().catch((err) => {
  const payload = err.response && err.response.data ? JSON.stringify(err.response.data, null, 2) : err.message;
  console.error('Jobber sync failed:', payload);
  process.exit(1);
});
