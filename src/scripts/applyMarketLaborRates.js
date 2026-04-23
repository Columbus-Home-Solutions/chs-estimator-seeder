require('dotenv').config();
const { google } = require('googleapis');
const { applyMarketLaborTargets } = require('../lib/applyMarketLaborTargets');

const SHEET_ID = String(process.env.SHEET_ID || '').trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1]
  || String(process.env.SHEET_ID || '').trim();

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

async function main() {
  const sheets = await getSheetsClient();
  const result = await applyMarketLaborTargets({ sheets, spreadsheetId: SHEET_ID });
  console.log(
    `Applied market labor targets. Updated ${result.updatedCount}/${result.targetCount} items; ${result.skippedNoHourlyRate} skipped due to missing labor rates.`
  );
}

main().catch((err) => {
  console.error('Apply market rates failed:', err.message);
  process.exit(1);
});
