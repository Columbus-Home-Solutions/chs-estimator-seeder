module.exports = {
    version: 2,
    name: 'Ensure Jobber sync fields exist on Estimate_Header',
    up: async ({ sheets, spreadsheetId }) => {
      const tabName = 'Estimate_Header';
      const required = [
        'jobber_client_id',
        'jobber_property_id',
        'jobber_quote_id',
        'jobber_sync_status',
        'jobber_synced_at'
      ];
  
      const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${tabName}!1:1`
      });
  
      const headers = (headerRes.data.values && headerRes.data.values[0]) || [];
      const missing = required.filter(h => !headers.includes(h));
  
      if (missing.length === 0) {
        console.log('No missing Jobber fields.');
        return;
      }
  
      const newHeaders = [...headers, ...missing];
      const endCol = toA1Col(newHeaders.length);
  
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1:${endCol}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [newHeaders] }
      });
  
      console.log(`Added missing columns: ${missing.join(', ')}`);
    }
  };
  
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