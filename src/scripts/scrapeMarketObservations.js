const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const SOURCES_PATH = path.join(__dirname, '..', '..', 'data', 'market_scrape_sources.json');
const OBS_PATH = path.join(__dirname, '..', '..', 'data', 'market_labor_observations.json');
const REPORT_PATH = path.join(__dirname, '..', '..', 'data', 'scrape_report.json');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const REQUEST_DELAY_MS = Number(process.env.SCRAPE_DELAY_MS || 3000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url) {
  const res = await axios.get(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    timeout: 20000,
    maxRedirects: 5,
    validateStatus: (s) => s >= 200 && s < 400
  });
  return res.data;
}

function parseDollarNumber(raw) {
  return Number(String(raw).replace(/,/g, ''));
}

function extractRangeFromText(text, patterns) {
  for (const patternStr of patterns) {
    const re = new RegExp(patternStr, 'i');
    const m = text.match(re);
    if (m && m[1] && m[2]) {
      const low = parseDollarNumber(m[1]);
      const high = parseDollarNumber(m[2]);
      if (Number.isFinite(low) && Number.isFinite(high) && low > 0 && high >= low) {
        return { low, high, matched: m[0] };
      }
    }
  }
  return null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function scrapeSource(source) {
  const html = await fetchHtml(source.url);
  const $ = cheerio.load(html);
  const bodyText = $('body').text().replace(/\s+/g, ' ');
  const range = extractRangeFromText(bodyText, source.patterns);
  if (!range) return { ok: false, reason: 'pattern_not_matched' };
  return {
    ok: true,
    observation: {
      item_code: source.item_code,
      unit: source.unit,
      labor_unit_cost_low: range.low,
      labor_unit_cost_high: range.high,
      source_name: source.source_name,
      source_url: source.url,
      source_date: todayISO(),
      notes: 'Auto-scraped quarterly refresh.',
      source_type: 'auto_scrape',
      source_weight: 1
    },
    matched: range.matched
  };
}

function mergeObservations(existing, fresh) {
  const freshByKey = new Map(fresh.map((o) => [`${o.item_code}|${o.source_name}`, o]));
  const merged = [];
  for (const row of existing) {
    const key = `${row.item_code}|${row.source_name}`;
    if (freshByKey.has(key)) {
      merged.push(freshByKey.get(key));
      freshByKey.delete(key);
    } else {
      merged.push(row);
    }
  }
  for (const row of freshByKey.values()) merged.push(row);
  return merged;
}

async function main() {
  const sources = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf8'));
  const existing = fs.existsSync(OBS_PATH) ? JSON.parse(fs.readFileSync(OBS_PATH, 'utf8')) : [];

  const results = [];
  const successes = [];

  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i];
    if (i > 0) await sleep(REQUEST_DELAY_MS);
    const startedAt = new Date().toISOString();
    try {
      const outcome = await scrapeSource(source);
      if (outcome.ok) {
        successes.push(outcome.observation);
        results.push({
          item_code: source.item_code,
          source_name: source.source_name,
          url: source.url,
          ok: true,
          matched: outcome.matched,
          low: outcome.observation.labor_unit_cost_low,
          high: outcome.observation.labor_unit_cost_high,
          started_at: startedAt
        });
        console.log(`  OK   ${source.item_code}  ${source.source_name}  $${outcome.observation.labor_unit_cost_low}-$${outcome.observation.labor_unit_cost_high}`);
      } else {
        results.push({
          item_code: source.item_code,
          source_name: source.source_name,
          url: source.url,
          ok: false,
          reason: outcome.reason,
          started_at: startedAt
        });
        console.log(`  MISS ${source.item_code}  ${source.source_name}  (${outcome.reason})`);
      }
    } catch (err) {
      const status = err.response && err.response.status;
      results.push({
        item_code: source.item_code,
        source_name: source.source_name,
        url: source.url,
        ok: false,
        reason: status ? `http_${status}` : 'request_error',
        error: err.message,
        started_at: startedAt
      });
      console.log(`  FAIL ${source.item_code}  ${source.source_name}  (${err.message})`);
    }
  }

  const merged = mergeObservations(existing, successes);
  fs.writeFileSync(OBS_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

  const report = {
    generated_at: new Date().toISOString(),
    total_sources: sources.length,
    successes: results.filter((r) => r.ok).length,
    failures: results.filter((r) => !r.ok).length,
    results
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`\nScrape report: ${report.successes}/${report.total_sources} successful.`);
  console.log(`Updated observations written to ${OBS_PATH}`);
  console.log(`Report written to ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error('Scrape failed:', err.message);
  process.exit(1);
});
