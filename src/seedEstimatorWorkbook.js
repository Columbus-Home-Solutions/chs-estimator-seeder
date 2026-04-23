require('dotenv').config();
const { google } = require('googleapis');
const schema = require('./schema');

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

async function getSpreadsheet(sheets) {
  const res = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  return res.data;
}

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

function colIndexFor(tabName, headerName) {
  const tab = schema.tabs.find(t => t.name === tabName);
  if (!tab) return -1;
  return tab.headers.indexOf(headerName);
}

function validationRequest(sheetId, zeroBasedCol, values) {
  return {
    setDataValidation: {
      range: {
        sheetId,
        startRowIndex: 1,
        startColumnIndex: zeroBasedCol,
        endColumnIndex: zeroBasedCol + 1
      },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: values.map(v => ({ userEnteredValue: v }))
        },
        strict: true,
        showCustomUi: true
      }
    }
  };
}

async function ensureTabsExist(sheets, spreadsheet) {
  const existing = new Set((spreadsheet.sheets || []).map(s => s.properties.title));
  const requests = [];

  for (const tab of schema.tabs) {
    if (!existing.has(tab.name)) {
      requests.push({
        addSheet: {
          properties: {
            title: tab.name,
            gridProperties: { frozenRowCount: 1 }
          }
        }
      });
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests }
    });
  }
}

async function upsertHeaders(sheets, tab) {
  const endCol = toA1Col(tab.headers.length);
  const range = `${tab.name}!A1:${endCol}1`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [tab.headers] }
  });
}

async function seedIfEmpty(sheets, tab) {
  if (!tab.seedRows || tab.seedRows.length === 0) return;

  const check = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tab.name}!A2:A2`
  });

  const hasData = (check.data.values || []).flat().some(v => String(v).trim() !== '');
  if (hasData) return;

  const rowStart = 2;
  const rowEnd = rowStart + tab.seedRows.length - 1;
  const colEnd = toA1Col(tab.headers.length);
  const range = `${tab.name}!A${rowStart}:${colEnd}${rowEnd}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: tab.seedRows }
  });
}

async function applyFormattingAndFilters(sheets, spreadsheet) {
  const sheetMap = new Map(
    (spreadsheet.sheets || []).map(s => [s.properties.title, s.properties.sheetId])
  );

  const requests = [];

  for (const tab of schema.tabs) {
    const sheetId = sheetMap.get(tab.name);
    if (sheetId == null) continue;

    requests.push(
      {
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: { frozenRowCount: 1 }
          },
          fields: 'gridProperties.frozenRowCount'
        }
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1
          },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true },
              backgroundColor: { red: 0.93, green: 0.93, blue: 0.93 }
            }
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)'
        }
      },
      {
        setBasicFilter: {
          filter: {
            range: {
              sheetId,
              startRowIndex: 0,
              startColumnIndex: 0,
              endColumnIndex: tab.headers.length
            }
          }
        }
      }
    );
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests }
    });
  }
}

async function applyDropdownValidations(sheets, spreadsheet) {
  const sheetMap = new Map(
    (spreadsheet.sheets || []).map(s => [s.properties.title, s.properties.sheetId])
  );

  const requests = [];

  const pbSheetId = sheetMap.get('Pricebook_Master');
  if (pbSheetId != null) {
    const taxableCol = colIndexFor('Pricebook_Master', 'taxable');
    const statusCol = colIndexFor('Pricebook_Master', 'status');
    if (taxableCol >= 0) requests.push(validationRequest(pbSheetId, taxableCol, ['Y', 'N']));
    if (statusCol >= 0) requests.push(validationRequest(pbSheetId, statusCol, ['Draft', 'Reviewed', 'Approved', 'Retired']));
  }

  const ehSheetId = sheetMap.get('Estimate_Header');
  if (ehSheetId != null) {
    const statusCol = colIndexFor('Estimate_Header', 'status');
    if (statusCol >= 0) requests.push(validationRequest(ehSheetId, statusCol, ['Draft', 'Sent', 'Accepted', 'Declined']));
  }

  const rqSheetId = sheetMap.get('Review_Queue');
  if (rqSheetId != null) {
    const approvalCol = colIndexFor('Review_Queue', 'approval_status');
    if (approvalCol >= 0) requests.push(validationRequest(rqSheetId, approvalCol, ['Pending', 'Approved', 'Rejected']));
  }

  const vendorsSheetId = sheetMap.get('Vendors');
  if (vendorsSheetId != null) {
    const activeCol = colIndexFor('Vendors', 'active');
    if (activeCol >= 0) requests.push(validationRequest(vendorsSheetId, activeCol, ['Y', 'N']));
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests }
    });
  }
}

async function main() {
  const sheets = await getSheetsClient();

  let spreadsheet = await getSpreadsheet(sheets);

  await ensureTabsExist(sheets, spreadsheet);

  spreadsheet = await getSpreadsheet(sheets);

  for (const tab of schema.tabs) {
    await upsertHeaders(sheets, tab);
    await seedIfEmpty(sheets, tab);
  }

  await applyFormattingAndFilters(sheets, spreadsheet);
  await applyDropdownValidations(sheets, spreadsheet);

  console.log('Estimator workbook seed complete.');
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});