const { applyMarketLaborTargets } = require('../lib/applyMarketLaborTargets');

module.exports = {
  version: 7,
  name: 'Reapply market labor targets after expansion',
  up: async ({ sheets, spreadsheetId }) => {
    const result = await applyMarketLaborTargets({ sheets, spreadsheetId });
    console.log(
      `Reapplied market labor targets: updated ${result.updatedCount}/${result.targetCount}, skipped ${result.skippedNoHourlyRate}.`
    );
  }
};
