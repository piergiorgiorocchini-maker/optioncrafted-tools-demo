#!/usr/bin/env node
// SEC fundamentals universe backfill.
// Reads the live Assets ticker list, downloads five annual periods of standard SEC facts
// for issuers with an unambiguous SEC ticker/CIK match, and updates SEC_Raw + Sync_Log.
// It never overwrites the normalized Fundamentals sheet.
import crypto from 'node:crypto';

const spreadsheetId = process.env.OPTIONSCRAFTED_SHEET_ID;
const credentialsText = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const secUserAgent = process.env.SEC_USER_AGENT;
if (!spreadsheetId || !credentialsText || !secUserAgent || !secUserAgent.includes('@')) {
  throw new Error('Missing OPTIONSCRAFTED_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON, or SEC_USER_AGENT');
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const now = new Date().toISOString();
const sourceVersion = 'SEC-companyfacts-standard-5FY-2026-11';
const forms = new Set(['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A']);
const metricSpecs = [
  { key: 'revenue', kind: 'flow', tags: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'Revenue'] },
  { key: 'netIncome', kind: 'flow', tags: ['NetIncomeLoss', 'ProfitLoss'] },
  { key: 'operatingIncome', kind: 'flow', tags: ['OperatingIncomeLoss', 'OperatingProfitLoss'] },
  { key: 'cashFromOperations', kind: 'flow', tags: ['NetCashProvidedByUsedInOperatingActivities', 'CashFlowsFromUsedInOperatingActivities', 'CashFlowsFromOperatingActivities'] },
  { key: 'capex', kind: 'flow', tags: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsForPropertyPlantAndEquipment', 'PurchaseOfPropertyPlantAndEquipment'] },
  { key: 'epsDiluted', kind: 'perShare', tags: ['EarningsPerShareDiluted'] },
  { key: 'cash', kind: 'instant', tags: ['CashAndCashEquivalentsAtCarryingValue', 'CashAndCashEquivalents'] },
  { key: 'currentAssets', kind: 'instant', tags: ['AssetsCurrent', 'CurrentAssets'] },
  { key: 'currentLiabilities', kind: 'instant', tags: ['LiabilitiesCurrent', 'CurrentLiabilities'] },
  { key: 'inventory', kind: 'instant', tags: ['InventoryNet', 'Inventories'] },
  { key: 'totalAssets', kind: 'instant', tags: ['Assets', 'TotalAssets'] },
  { key: 'totalLiabilities', kind: 'instant', tags: ['Liabilities', 'TotalLiabilities'] },
  { key: 'equity', kind: 'instant', tags: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'Equity'] },
  { key: 'longTermDebt', kind: 'instant', tags: ['LongTermDebtNoncurrent', 'LongTermDebt'] },
  { key: 'shortTermDebt', kind: 'instant', tags: ['LongTermDebtCurrent', 'ShortTermBorrowings', 'ShortTermDebtCurrent'] }
];

const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const account = JSON.parse(credentialsText);
if (!account.client_email || !account.private_key) throw new Error('Invalid Google service-account JSON');
const issuedAt = Math.floor(Date.now() / 1000);
const jwtHeader = b64({ alg: 'RS256', typ: 'JWT' });
const jwtClaims = b64({
  iss: account.client_email,
  scope: 'https://www.googleapis.com/auth/spreadsheets',
  aud: 'https://oauth2.googleapis.com/token',
  iat: issuedAt,
  exp: issuedAt + 3600
});
const jwtSignature = crypto.sign('RSA-SHA256', Buffer.from(jwtHeader + '.' + jwtClaims), account.private_key).toString('base64url');
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwtHeader + '.' + jwtClaims + '.' + jwtSignature
  })
});
if (!tokenResponse.ok) throw new Error('Google token HTTP ' + tokenResponse.status);
const accessToken = (await tokenResponse.json()).access_token;
const sheetBase = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId);
async function sheetsApi(path, options = {}) {
  const response = await fetch(sheetBase + path, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error('Google Sheets HTTP ' + response.status + ': ' + (await response.text()).slice(0, 500));
  if (response.status === 204) return {};
  return response.json();
}
async function readValues(range) {
  const path = '/values/' + encodeURIComponent(range) + '?valueRenderOption=UNFORMATTED_VALUE';
  const response = await sheetsApi(path);
  return response.values || [];
}

async function fetchSecJson(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, {
      headers: { 'User-Agent': secUserAgent, Accept: 'application/json', 'Accept-Encoding': 'gzip' },
      signal: AbortSignal.timeout(30000)
    });
    if (response.ok) return response.json();
    const retryable = [429, 500, 502, 503, 504].includes(response.status);
    if (!retryable || attempt === 4) throw new Error('SEC HTTP ' + response.status + ' for ' + url);
    await sleep(1500 * (2 ** attempt));
  }
  throw new Error('SEC request failed for ' + url);
}

function tickerRowsFromPayload(payload) {
  if (Array.isArray(payload?.data) && Array.isArray(payload?.fields)) {
    return payload.data.map(row => Object.fromEntries(payload.fields.map((field, index) => [field, row[index]])));
  }
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') return Object.values(payload);
  return [];
}
function normCik(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? digits.padStart(10, '0').slice(-10) : '';
}
function normTicker(value) {
  return String(value ?? '').trim().toUpperCase();
}
function tickerMap(payload) {
  const map = new Map();
  for (const row of tickerRowsFromPayload(payload)) {
    const ticker = normTicker(row.ticker ?? row.symbol);
    const cik = normCik(row.cik_str ?? row.cik ?? row.CIK);
    const title = String(row.title ?? row.name ?? row.company ?? '').trim();
    if (!ticker || !cik || !/^\d{10}$/.test(cik)) continue;
    const entries = map.get(ticker) || [];
    entries.push({ ticker, cik, title });
    map.set(ticker, entries);
  }
  for (const [ticker, entries] of map) {
    map.set(ticker, [...new Map(entries.map(entry => [entry.cik, entry])).values()]);
  }
  return map;
}
async function loadTickerMap() {
  const exchangeUrl = 'https://www.sec.gov/files/company_tickers_exchange.json';
  try {
    const payload = await fetchSecJson(exchangeUrl);
    const parsed = tickerMap(payload);
    if (parsed.size) return { map: parsed, source: exchangeUrl };
  } catch (error) {
    console.log('SEC exchange ticker map unavailable; trying the legacy ticker map: ' + error.message);
  }
  const tickerUrl = 'https://www.sec.gov/files/company_tickers.json';
  const payload = await fetchSecJson(tickerUrl);
  const parsed = tickerMap(payload);
  if (!parsed.size) throw new Error('SEC ticker/CIK map was empty or unrecognized');
  return { map: parsed, source: tickerUrl };
}

function baseCurrency(unit) {
  return String(unit).split('/')[0].toUpperCase();
}
function allowedUnit(metric, unit) {
  if (metric.kind === 'perShare') return /^[A-Z]{3}\/shares$/i.test(unit);
  return /^[A-Z]{3}$/.test(unit);
}
function factCandidates(doc, metric) {
  const facts = doc?.facts || {};
  const out = [];
  for (const framework of ['us-gaap', 'ifrs-full']) {
    const concepts = facts[framework] || {};
    for (let tagIndex = 0; tagIndex < metric.tags.length; tagIndex++) {
      const tag = metric.tags[tagIndex];
      const units = concepts[tag]?.units || {};
      for (const [unit, observations] of Object.entries(units)) {
        if (!allowedUnit(metric, unit) || !Array.isArray(observations)) continue;
        for (const observation of observations) {
          if (!forms.has(observation.form) || !observation.end || !observation.filed || !Number.isFinite(Number(observation.val))) continue;
          const hasStart = Boolean(observation.start);
          if (metric.kind === 'flow') {
            if (!hasStart) continue;
            const days = (Date.parse(observation.end) - Date.parse(observation.start)) / 86400000;
            if (days < 330 || days > 380) continue;
          } else if (metric.kind === 'instant' && hasStart) {
            continue;
          } else if (metric.kind === 'perShare') {
            if (!hasStart) continue;
            const days = (Date.parse(observation.end) - Date.parse(observation.start)) / 86400000;
            if (days < 330 || days > 380) continue;
          }
          out.push({
            value: Number(observation.val),
            start: observation.start || '',
            end: observation.end,
            filed: observation.filed,
            form: observation.form,
            accession: observation.accn || '',
            tag,
            framework,
            tagIndex,
            unit
          });
        }
      }
    }
  }
  return out;
}
function annualPeriodEnds(candidatesByMetric) {
  const ends = new Set();
  for (const metric of metricSpecs) {
    if (metric.kind !== 'flow' && metric.kind !== 'perShare') continue;
    for (const fact of candidatesByMetric[metric.key] || []) ends.add(fact.end);
  }
  return [...ends].sort((a, b) => b.localeCompare(a)).slice(0, 5).sort();
}
function preferredCurrency(candidatesByMetric) {
  const counts = new Map();
  for (const metric of metricSpecs) {
    if (metric.kind === 'instant') continue;
    for (const fact of candidatesByMetric[metric.key] || []) {
      const currency = baseCurrency(fact.unit);
      counts.set(currency, (counts.get(currency) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] === 'USD' ? -1 : b[0] === 'USD' ? 1 : a[0].localeCompare(b[0])))[0]?.[0] || 'USD';
}
function chooseFact(candidates, periodEnd, kind, currency) {
  const matching = candidates.filter(fact => fact.end === periodEnd);
  matching.sort((a, b) => {
    const aCurrency = baseCurrency(a.unit), bCurrency = baseCurrency(b.unit);
    const aCurrencyRank = aCurrency === currency ? 2 : aCurrency === 'USD' ? 1 : 0;
    const bCurrencyRank = bCurrency === currency ? 2 : bCurrency === 'USD' ? 1 : 0;
    if (aCurrencyRank !== bCurrencyRank) return bCurrencyRank - aCurrencyRank;
    const aFrameworkRank = a.framework === 'us-gaap' ? 1 : 0;
    const bFrameworkRank = b.framework === 'us-gaap' ? 1 : 0;
    if (aFrameworkRank !== bFrameworkRank) return bFrameworkRank - aFrameworkRank;
    const aFormRank = a.form.endsWith('/A') ? 1 : 0;
    const bFormRank = b.form.endsWith('/A') ? 1 : 0;
    if (aFormRank !== bFormRank) return bFormRank - aFormRank;
    if (a.filed !== b.filed) return b.filed.localeCompare(a.filed);
    return a.tagIndex - b.tagIndex;
  });
  return matching[0] || null;
}
function buildRows(doc, ticker, cik, companyName, sourceUrl, generatedAt) {
  if (!doc?.facts || normCik(doc.cik) !== cik) throw new Error('SEC CIK mismatch or no facts for ' + ticker);
  const candidatesByMetric = {};
  for (const metric of metricSpecs) candidatesByMetric[metric.key] = factCandidates(doc, metric);
  const periodEnds = annualPeriodEnds(candidatesByMetric);
  if (!periodEnds.length) return { rows: [], periodEnds: [], missingMetrics: metricSpecs.map(metric => metric.key), companyName: companyName || doc.entityName || '' };
  const currency = preferredCurrency(candidatesByMetric);
  const sourceUrl = 'https://data.sec.gov/api/xbrl/companyfacts/CIK' + cik + '.json';
  const rows = [];
  const availableMetrics = new Set();
  for (const metric of metricSpecs) {
    const candidates = candidatesByMetric[metric.key] || [];
    for (const end of periodEnds) {
      const fact = chooseFact(candidates, end, metric.kind, currency);
      if (!fact) continue;
      rows.push([
        ticker, cik, metric.key, fact.value, fact.start, fact.end, fact.filed,
        fact.form, fact.accession, fact.tag, fact.unit, sourceUrl, generatedAt, 'VERIFIED_SOURCE'
      ]);
      availableMetrics.add(metric.key);
    }
  }
  const missingMetrics = metricSpecs.map(metric => metric.key).filter(metric => !availableMetrics.has(metric));
  return { rows, periodEnds, missingMetrics, companyName: companyName || doc.entityName || '', currency };
}

const metadata = await sheetsApi('?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))');
const sheets = new Map((metadata.sheets || []).map(sheet => [sheet.properties.title, sheet.properties]));
const secSheet = sheets.get('SEC_Raw');
if (!secSheet) throw new Error('SEC_Raw tab not found');
const syncSheet = sheets.get('Sync_Log');
if (!syncSheet) throw new Error('Sync_Log tab not found');

const assetValues = await readValues('Assets!B2:B1000');
const assetTickers = [...new Set(assetValues.map(row => normTicker(row?.[0])).filter(Boolean))];
if (assetTickers.length === 0 || assetTickers.length > 1000) throw new Error('Unexpected Assets ticker count: ' + assetTickers.length);

const { map: secTickerMap, source: tickerMapSource } = await loadTickerMap();
console.log('Assets tickers: ' + assetTickers.length + '; SEC ticker map: ' + secTickerMap.size + ' entries from ' + tickerMapSource);

const factsCache = new Map();
const outcomes = [];
for (const ticker of assetTickers) {
  const matches = secTickerMap.get(ticker) || [];
  if (matches.length === 0) {
    outcomes.push({ ticker, status: 'NO_SEC_MATCH', records: [], cik: '', error: 'No exact ticker match in SEC issuer ticker map; another source or instrument-specific treatment is needed.' });
    continue;
  }
  if (matches.length !== 1) {
    outcomes.push({ ticker, status: 'AMBIGUOUS_CIK', records: [], cik: '', error: 'Ticker maps to multiple SEC CIKs: ' + matches.map(match => match.cik).join(', ') });
    continue;
  }
  const match = matches[0];
  let cached = factsCache.get(match.cik);
  if (!cached) {
    const sourceUrl = 'https://data.sec.gov/api/xbrl/companyfacts/CIK' + match.cik + '.json';
    try {
      cached = { doc: await fetchSecJson(sourceUrl), sourceUrl };
      factsCache.set(match.cik, cached);
    } catch (error) {
      outcomes.push({ ticker, status: 'SOURCE_ERROR', records: [], cik: match.cik, error: error.message });
      await sleep(150);
      continue;
    }
    await sleep(150);
  }
  try {
    const parsed = buildRows(cached.doc, ticker, match.cik, match.title, cached.sourceUrl, now);
    if (!parsed.rows.length) {
      outcomes.push({ ticker, status: 'NO_STANDARD_FACTS', records: [], cik: match.cik, periods: parsed.periodEnds, error: 'No supported annual standard-taxonomy facts found in the latest five periods.' });
    } else {
      outcomes.push({
        ticker, status: parsed.missingMetrics.length ? 'PARTIAL' : 'OK',
        records: parsed.rows, cik: match.cik, periods: parsed.periodEnds,
        currency: parsed.currency, missingMetrics: parsed.missingMetrics,
        companyName: parsed.companyName, error: parsed.missingMetrics.length ? 'Metrics not found: ' + parsed.missingMetrics.join(', ') : ''
      });
    }
  } catch (error) {
    outcomes.push({ ticker, status: 'SOURCE_ERROR', records: [], cik: match.cik, error: error.message });
  }
}

const successfulTickers = new Set(outcomes.filter(outcome => outcome.records.length > 0).map(outcome => outcome.ticker));
const newFactRows = outcomes.flatMap(outcome => outcome.records);
const rawCapacity = 50000;
const requiredRows = newFactRows.length + 1;
if (requiredRows > rawCapacity) throw new Error('SEC_Raw backfill exceeds the configured row capacity: ' + requiredRows);

if (secSheet.gridProperties?.rowCount < rawCapacity) {
  await sheetsApi('/batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        updateSheetProperties: {
          properties: { sheetId: secSheet.sheetId, gridProperties: { rowCount: rawCapacity } },
          fields: 'gridProperties.rowCount'
        }
      }]
    })
  });
}

const oldRaw = await readValues('SEC_Raw!A1:N' + rawCapacity);
const rawHeader = ['Ticker', 'CIK', 'Metric', 'Value (native unit)', 'Period Start', 'Period End', 'Filed Date', 'Form', 'Accession', 'SEC Tag', 'Unit', 'Source URL', 'Imported At', 'Status'];
const oldHeader = oldRaw[0] || [];
const expectedHeader = ['Ticker', 'CIK', 'Metric', 'Value USD', 'Period Start', 'Period End', 'Filed Date', 'Form', 'Accession', 'SEC Tag', 'Unit', 'Source URL', 'Imported At', 'Status'];
if (oldHeader.length < 14 || expectedHeader.some((value, index) => index !== 3 && oldHeader[index] !== value) || !['Value USD', 'Value (native unit)'].includes(oldHeader[3])) {
  throw new Error('Unexpected SEC_Raw headers; refusing to overwrite the sheet.');
}
const oldRawRows = oldRaw.slice(1).filter(row => row.some(value => value !== '' && value !== null && value !== undefined));
const retainedRawRows = oldRawRows.filter(row => !successfulTickers.has(normTicker(row[0])));
const mergedRawRows = [rawHeader, ...retainedRawRows, ...newFactRows];
if (mergedRawRows.length > rawCapacity) throw new Error('SEC_Raw merged data exceeds row capacity.');

const oldLog = await readValues('Sync_Log!A1:I5000');
const logHeader = ['Ticker', 'Provider', 'Last Attempt', 'Last Success', 'Next Check', 'Status', 'Records Updated', 'Error', 'Source Version'];
if (!oldLog[0] || logHeader.some((value, index) => oldLog[0][index] !== value)) throw new Error('Unexpected Sync_Log headers; refusing to overwrite the sheet.');
const oldLogRows = oldLog.slice(1).filter(row => row.some(value => value !== '' && value !== null && value !== undefined));
const oldSecLog = new Map(oldLogRows.filter(row => String(row[1]).toUpperCase() === 'SEC').map(row => [normTicker(row[0]), row]));
const currentTickers = new Set(assetTickers);
const retainedLogRows = oldLogRows.filter(row => !(String(row[1]).toUpperCase() === 'SEC' && currentTickers.has(normTicker(row[0]))));
const nextLogRows = outcomes.map(outcome => {
  const prior = oldSecLog.get(outcome.ticker) || [];
  const successful = outcome.records.length > 0;
  return [
    outcome.ticker, 'SEC', now, successful ? now : (prior[3] || ''),
    '', outcome.status, outcome.records.length,
    String(outcome.error || '').slice(0, 1000), sourceVersion
  ];
});
const mergedLogRows = [logHeader, ...retainedLogRows, ...nextLogRows];
if (mergedLogRows.length > 5000) throw new Error('Sync_Log exceeds its configured row capacity.');

const writeData = [
  { range: 'SEC_Raw!A1:N' + mergedRawRows.length, values: mergedRawRows },
  { range: 'Sync_Log!A1:I' + mergedLogRows.length, values: mergedLogRows }
];
await sheetsApi('/values:batchUpdate', {
  method: 'POST',
  body: JSON.stringify({ valueInputOption: 'RAW', data: writeData })
});
if (oldRaw.length > mergedRawRows.length) {
  await sheetsApi('/values/' + encodeURIComponent('SEC_Raw!A' + (mergedRawRows.length + 1) + ':N' + oldRaw.length) + ':clear', { method: 'POST', body: '{}' });
}
if (oldLog.length > mergedLogRows.length) {
  await sheetsApi('/values/' + encodeURIComponent('Sync_Log!A' + (mergedLogRows.length + 1) + ':I' + oldLog.length) + ':clear', { method: 'POST', body: '{}' });
}

const statusCounts = {};
for (const outcome of outcomes) statusCounts[outcome.status] = (statusCounts[outcome.status] || 0) + 1;
console.log(JSON.stringify({
  completedAt: now,
  assetTickerCount: assetTickers.length,
  secTickerMapSource: tickerMapSource,
  ciksFetched: factsCache.size,
  factRowsWritten: newFactRows.length,
  secRawTickersWithFacts: successfulTickers.size,
  statusCounts,
  examples: outcomes.slice(0, 12).map(outcome => ({
    ticker: outcome.ticker, status: outcome.status, cik: outcome.cik || null,
    records: outcome.records.length, periods: outcome.periods || [], missingMetrics: outcome.missingMetrics || []
  }))
}, null, 2));
