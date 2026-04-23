const { applyMarketLaborTargets } = require('../lib/applyMarketLaborTargets');

module.exports = {
  version: 5,
  name: 'Apply market labor ranges to pricebook',
  up: async ({ sheets, spreadsheetId }) => {
    const result = await applyMarketLaborTargets({ sheets, spreadsheetId });
    console.log(`Updated ${result.updatedCount} pricebook items with market labor targets.`);
  }
};
