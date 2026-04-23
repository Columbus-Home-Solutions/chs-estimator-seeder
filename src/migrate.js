require('dotenv').config();
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

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

function nowISO() {
  return new Date().toISOString();
}

function parseVersion(v) {
  const m = String(v || '').match(/^v(\d+)$/i);
  return m ? Number(m[1]) : 0;
}

function versionLabel(n) {
  return `v${n}`;
}

async function readCurrentSchemaVersion(sheets) {
  // Ensure Schema_Metadata exists and has headers if needed.
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheetsList = spreadsheet.data.sheets || [];
  const hasMeta = sheetsList.some(s => s.properties.title === 'Schema_Metadata');

  if (!hasMeta) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: 'Schema_Metadata', gridProperties: { frozenRowCount: 1 } }
            }
          }
        ]
      }
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Schema_Metadata!A1:C1',
      valueInputOption: 'RAW',
      requestBody: { values: [['schema_version', 'last_migrated_at', 'notes']] }
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Schema_Metadata!A2:C2',
      valueInputOption: 'RAW',
      requestBody: { values: [['v0', nowISO(), 'Bootstrap metadata']] }
    });

    return 'v0';
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Schema_Metadata!A2:A2'
  });

  const value = (res.data.values && res.data.values[0] && res.data.values[0][0]) || 'v0';
  return value;
}

async function writeCurrentSchemaVersion(sheets, version, notes) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Schema_Metadata!A2:C2',
    valueInputOption: 'RAW',
    requestBody: { values: [[version, nowISO(), notes || 'Migration applied']] }
  });
}

function loadMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => /^\d+_.+\.js$/.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return files.map(file => {
    const fullPath = path.join(migrationsDir, file);
    const mod = require(fullPath);
    if (!mod || typeof mod.version !== 'number' || typeof mod.up !== 'function') {
      throw new Error(`Invalid migration file: ${file}`);
    }
    return {
      file,
      version: mod.version,
      name: mod.name || file,
      up: mod.up
    };
  });
}

async function main() {
  const sheets = await getSheetsClient();
  const currentLabel = await readCurrentSchemaVersion(sheets);
  const currentVersion = parseVersion(currentLabel);

  console.log(`Current schema version: ${currentLabel}`);

  const migrations = loadMigrations();
  const pending = migrations.filter(m => m.version > currentVersion);

  if (pending.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  for (const m of pending) {
    console.log(`Applying migration ${versionLabel(m.version)} (${m.file})...`);
    await m.up({ sheets, spreadsheetId: SHEET_ID });
    await writeCurrentSchemaVersion(
      sheets,
      versionLabel(m.version),
      `Applied ${m.file}`
    );
    console.log(`Applied ${m.file}`);
  }

  console.log('All migrations applied successfully.');
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});