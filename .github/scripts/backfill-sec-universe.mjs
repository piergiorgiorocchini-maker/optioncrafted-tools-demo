#!/usr/bin/env node
// SEC fundamentals universe backfill.
// Reads the live Assets ticker list, downloads six annual periods of standard SEC facts
// for issuers with an unambiguous SEC ticker/CIK match, and updates SEC_Raw + Sync_Log.
// It never overwrites the normalized Fundamentals sheet.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const spreadsheetId = process.env.OPTIONSCRAFTED_SHEET_ID;
const credentialsText = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const secUserAgent = process.env.SEC_USER_AGENT;
if (!spreadsheetId || !credentialsText || !secUserAgent || !secUserAgent.includes('@')) {
  throw new Error('Missing OPTIONSCRAFTED_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON, or SEC_USER_AGENT');
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const now = new Date().toISOString();
const sourceVersion = 'SEC-companyfacts+annual-XBRL-enrichment-6FY-2026-11-v9';
// SEC's 2026-Q3 filing documents the July 1, 2026 redomiciliation merger:
// CIK 0000034088 is the predecessor; CIK 0002115436 is the publicly traded parent.
const XOM_LEGACY_CIK = '0000034088';
const forms = new Set(['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A']);
const metricSpecs = [
  { key: 'revenue', kind: 'flow', tags: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'Revenue'] },
  { key: 'netIncome', kind: 'flow', tags: ['NetIncomeLoss', 'ProfitLoss'] },
  { key: 'operatingIncome', kind: 'flow', tags: ['OperatingIncomeLoss', 'OperatingProfitLoss'] },
  { key: 'cashFromOperations', kind: 'flow', tags: ['NetCashProvidedByUsedInOperatingActivities', 'CashFlowsFromUsedInOperatingActivities', 'CashFlowsFromOperatingActivities'] },
  { key: 'capex', kind: 'flow', tags: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsForPropertyPlantAndEquipment', 'PurchaseOfPropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets', 'PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibles', 'PurchasesOfPropertyPlantAndEquipment'] },
  { key: 'epsDiluted', kind: 'perShare', tags: ['EarningsPerShareDiluted', 'EarningsPerShareDilutedIncludingExtraordinaryItems', 'EarningsPerShareBasicAndDiluted'] },
  { key: 'grossProfit', kind: 'flow', tags: ['GrossProfit'] },
  { key: 'depreciationAndAmortization', kind: 'flow', tags: ['DepreciationDepletionAndAmortizationPropertyPlantAndEquipment', 'DepreciationDepletionAndAmortization', 'DepreciationAmortizationAndAccretionNet'] },
  // InterestExpense is the standard operating/nonoperating interest-expense concept.
  { key: 'interestExpense', kind: 'flow', tags: ['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseNonOperating', 'InterestAndDebtExpense', 'InterestExpenseDebt'] },
  { key: 'dilutedShares', kind: 'shares', tags: ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingDiluted', 'WeightedAverageNumberOfDilutedSharesOutstandingBasicAndDiluted'] },
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
    let response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': secUserAgent, Accept: 'application/json', 'Accept-Encoding': 'gzip' },
        signal: AbortSignal.timeout(30000)
      });
    } catch (error) {
      if (attempt === 4) throw new Error('SEC network request failed after five attempts for ' + url + ': ' + error.message);
      await sleep(1500 * (2 ** attempt));
      continue;
    }
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
  if (metric.kind === 'shares') return /^shares$/i.test(unit);
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
          if (['flow', 'perShare', 'shares'].includes(metric.kind)) {
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
    if (!['flow', 'perShare', 'shares'].includes(metric.kind)) continue;
    for (const fact of candidatesByMetric[metric.key] || []) ends.add(fact.end);
  }
  return [...ends].sort((a, b) => b.localeCompare(a)).slice(0, 6).sort();
}
function preferredCurrency(candidatesByMetric) {
  const counts = new Map();
  for (const metric of metricSpecs) {
    if (metric.kind === 'instant' || metric.kind === 'shares') continue;
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

async function fetchSecText(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': secUserAgent, Accept: 'application/xml,text/xml,text/plain,*/*', 'Accept-Encoding': 'gzip' },
        signal: AbortSignal.timeout(30000)
      });
    } catch (error) {
      if (attempt === 4) throw new Error('SEC document request failed after five attempts for ' + url + ': ' + error.message);
      await sleep(1500 * (2 ** attempt));
      continue;
    }
    if (response.ok) return response.text();
    const retryable = [429, 500, 502, 503, 504].includes(response.status);
    if (!retryable || attempt === 4) throw new Error('SEC HTTP ' + response.status + ' for ' + url);
    await sleep(1500 * (2 ** attempt));
  }
  throw new Error('SEC document request failed for ' + url);
}

function xmlAttribute(attributes, name) {
  const match = String(attributes || '').match(new RegExp('(?:^|\\s)' + name + '=["\\x27]([^"\\x27]*)["\\x27]', 'i'));
  return match ? match[1] : '';
}
function xmlValue(block, localName) {
  const match = String(block || '').match(new RegExp('<(?:[A-Za-z_][\\w.-]*:)?' + localName + '\\b[^>]*>([^<]*)<\\/(?:[A-Za-z_][\\w.-]*:)?' + localName + '>', 'i'));
  return match ? match[1].trim() : '';
}
function decodeXmlText(value) {
  return String(value || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#160;|&nbsp;/gi, ' ').replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}
function parseXbrlInstance(xml, filing) {
  const contexts = new Map();
  const contextPattern = /<([A-Za-z_][\w.-]*:)?context\b([^>]*)>([\s\S]*?)<\/\1context>/gi;
  for (const match of xml.matchAll(contextPattern)) {
    const body = match[3];
    contexts.set(xmlAttribute(match[2], 'id'), {
      start: xmlValue(body, 'startDate'),
      end: xmlValue(body, 'endDate') || xmlValue(body, 'instant'),
      dimensional: /<(?:[A-Za-z_][\w.-]*:)?(?:explicitMember|typedMember)\b/i.test(body)
    });
  }
  const units = new Map();
  const unitPattern = /<([A-Za-z_][\w.-]*:)?unit\b([^>]*)>([\s\S]*?)<\/\1unit>/gi;
  for (const match of xml.matchAll(unitPattern)) {
    const measures = [...match[3].matchAll(/<(?:[A-Za-z_][\w.-]*:)?measure\b[^>]*>([^<]+)<\/(?:[A-Za-z_][\w.-]*:)?measure>/gi)].map(item => item[1].trim());
    const currency = measures.map(value => value.match(/(?:iso4217:)?([A-Z]{3})$/i)?.[1]?.toUpperCase()).find(Boolean) || '';
    const isShares = measures.some(value => /(?:^|:)shares$/i.test(value));
    units.set(xmlAttribute(match[2], 'id'), currency ? (isShares ? currency + '/shares' : currency) : measures.join('/'));
  }
  const patterns = {
    capex: /(?:capex|capitalexpenditur|payments?toacquire.*(?:property|plant|equipment|fixedasset|productiveasset|intangibleasset)|purchases?of.*(?:property|plant|equipment|fixedasset|productiveasset|intangibleasset)|(?:property|plant|equipment).*purchases?)/i,
    epsDiluted: /(?:(?:earnings|netincome|income|profit).*pershare.*diluted|diluted.*(?:earnings|netincome|income|profit).*pershare|income.*continuingoperationsperdilutedshare)/i
  };
  const found = [];
  const auditTags = [];
  const factPattern = /<([A-Za-z_][\w.-]*:)([A-Za-z_][\w.-]*)\b([^>]*)>([^<]*)<\/\1\2>/gi;
  for (const match of xml.matchAll(factPattern)) {
    const localName = match[2];
    if (filing.audit && /share|dilut|income|earnings|profit|purchase|property|equipment|capital|capex/i.test(localName) && auditTags.length < 160) {
      const auditContext = contexts.get(xmlAttribute(match[3], 'contextRef'));
      if (auditContext?.start && auditContext.end) {
        const auditDays = (Date.parse(auditContext.end + 'T00:00:00Z') - Date.parse(auditContext.start + 'T00:00:00Z')) / 86400000;
        const auditUnit = units.get(xmlAttribute(match[3], 'unitRef')) || '';
        if (auditDays >= 330 && auditDays <= 380 && /USD|shares/i.test(auditUnit)) {
          auditTags.push({ tag: match[1] + localName, value: match[4].trim(), unit: auditUnit, start: auditContext.start, end: auditContext.end, dimensional: auditContext.dimensional });
        }
      }
    }
    const metric = Object.entries(patterns).find(([, pattern]) => pattern.test(localName))?.[0];
    if (!metric || /<[^>]+>/.test(match[4]) || /xsi:nil=["']true["']/i.test(match[3])) continue;
    const context = contexts.get(xmlAttribute(match[3], 'contextRef'));
    if (!context?.start || !context.end) continue;
    const days = (Date.parse(context.end + 'T00:00:00Z') - Date.parse(context.start + 'T00:00:00Z')) / 86400000;
    if (days < 330 || days > 380) continue;
    const unit = units.get(xmlAttribute(match[3], 'unitRef')) || '';
    if (metric === 'epsDiluted' && !/^[A-Z]{3}\/shares$/i.test(unit)) continue;
    if (metric === 'capex' && !/^[A-Z]{3}$/i.test(unit)) continue;
    let valueText = decodeXmlText(match[4].replace(/<[^>]*>/g, '')).replace(/[\s,\u00a0]/g, '').trim();
    let value = Number(valueText);
    if (!Number.isFinite(value)) continue;
    const scale = Number(xmlAttribute(match[3], 'scale'));
    if (Number.isFinite(scale) && scale !== 0) value *= Math.pow(10, scale);
    if (xmlAttribute(match[3], 'sign') === '-') value = -Math.abs(value);
    found.push({ metric, value, start: context.start, end: context.end, unit, tag: match[1] + localName, filed: filing.filed, form: filing.form, accession: filing.accession, sourceUrl: filing.sourceUrl, dimensional: context.dimensional });
  }
  if (filing.audit) console.log('SEC XBRL tag audit ABNB ' + filing.reportEnd + ': ' + JSON.stringify(auditTags));
  return found.sort((a, b) => Number(a.dimensional) - Number(b.dimensional) || b.filed.localeCompare(a.filed));
}
async function fetchRecentAnnualXbrlFacts(cik, desiredPeriodEnds = []) {
  const submissionsUrl = 'https://data.sec.gov/submissions/CIK' + cik + '.json';
  const submissions = await fetchSecJson(submissionsUrl);
  await sleep(150);
  const recent = submissions?.filings?.recent || {};
  const annualForms = new Set(['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A']);
  const latestByReportEnd = new Map();
  for (let index = 0; index < (recent.form || []).length; index++) {
    const form = recent.form[index];
    const reportEnd = recent.reportDate?.[index] || '';
    if (!annualForms.has(form) || !reportEnd) continue;
    const filing = { form, reportEnd, filed: recent.filingDate?.[index] || '', accession: recent.accessionNumber?.[index] || '', primaryDocument: recent.primaryDocument?.[index] || '', audit: cik === '0001559720' };
    const prior = latestByReportEnd.get(reportEnd);
    if (!prior || filing.filed > prior.filed) latestByReportEnd.set(reportEnd, filing);
  }
  const requestedPeriodEnds = new Set(desiredPeriodEnds);
  const annualFilings = [...latestByReportEnd.values()]
    .filter(filing => !requestedPeriodEnds.size || requestedPeriodEnds.has(filing.reportEnd))
    .sort((a, b) => b.filed.localeCompare(a.filed))
    .slice(0, requestedPeriodEnds.size || 2);
  const collected = [];
  for (const filing of annualFilings) {
    const accessionFolder = filing.accession.replace(/-/g, '');
    const cikFolder = String(Number(cik));
    const baseUrl = 'https://www.sec.gov/Archives/edgar/data/' + cikFolder + '/' + accessionFolder;
    const index = await fetchSecJson(baseUrl + '/index.json');
    await sleep(150);
    const items = index?.directory?.item || [];
    let instance = items.find(item => /EXTRACTED XBRL INSTANCE DOCUMENT/i.test(item.type || ''));
    if (!instance) instance = items.find(item => /_htm\.xml$/i.test(item.name || ''));
    if (!instance?.name) {
      await sleep(150);
      continue;
    }
    filing.sourceUrl = baseUrl + '/' + instance.name;
    const xml = await fetchSecText(filing.sourceUrl);
    collected.push(...parseXbrlInstance(xml, filing));
    await sleep(150);
  }
  return collected;
}

function buildRows(doc, ticker, cik, companyName, generatedAt) {
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

function buildQuarterlyRows(doc, ticker, cik, companyName, generatedAt) {
  if (!doc?.facts || normCik(doc.cik) !== cik) throw new Error('SEC CIK mismatch or no facts for ' + ticker);
  const quarterForms = new Set(['10-Q', '10-Q/A']);
  const candidatesByMetric = {};
  const allPeriods = new Map();
  for (const metric of metricSpecs) {
    const candidates = [];
    for (const framework of ['us-gaap', 'ifrs-full']) {
      const concepts = doc.facts[framework] || {};
      for (let tagIndex = 0; tagIndex < metric.tags.length; tagIndex++) {
        const tag = metric.tags[tagIndex];
        const units = concepts[tag]?.units || {};
        for (const [unit, observations] of Object.entries(units)) {
          if (!allowedUnit(metric, unit) || !Array.isArray(observations)) continue;
          for (const observation of observations) {
            if (!quarterForms.has(observation.form) || !observation.end || !observation.filed ||
                !Number.isFinite(Number(observation.val)) || observation.end < '2025-01-01') continue;
            const start = observation.start || '';
            if (metric.kind === 'instant') {
              if (start) continue;
            } else {
              if (!start) continue;
              const days = (Date.parse(observation.end) - Date.parse(start)) / 86400000;
              // Preserve discrete quarters and 6/9-month cumulative periods from 10-Q filings.
              if (![[60, 110], [150, 200], [240, 280]].some(([min, max]) => days >= min && days <= max)) continue;
            }
            const fact = {
              value: Number(observation.val), start, end: observation.end,
              filed: observation.filed, form: observation.form,
              accession: observation.accn || '', tag, framework, tagIndex, unit
            };
            candidates.push(fact);
            allPeriods.set(start + '|' + fact.end, { start, end: fact.end });
          }
        }
      }
    }
    candidatesByMetric[metric.key] = candidates;
  }

  const periods = [...allPeriods.values()].sort((a, b) => a.end.localeCompare(b.end) || a.start.localeCompare(b.start));
  const currencyCounts = new Map();
  for (const metric of metricSpecs) {
    if (metric.kind === 'instant' || metric.kind === 'shares') continue;
    for (const fact of candidatesByMetric[metric.key] || []) {
      const currency = baseCurrency(fact.unit);
      currencyCounts.set(currency, (currencyCounts.get(currency) || 0) + 1);
    }
  }
  const currency = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || 'USD';
  const sourceUrl = 'https://data.sec.gov/api/xbrl/companyfacts/CIK' + cik + '.json';
  const rows = [];
  const availableMetrics = new Set();
  for (const metric of metricSpecs) {
    const candidates = candidatesByMetric[metric.key] || [];
    for (const period of periods) {
      const matching = candidates.filter(fact => fact.end === period.end && fact.start === period.start);
      if (!matching.length) continue;
      matching.sort((a, b) => {
        const aCurrency = baseCurrency(a.unit), bCurrency = baseCurrency(b.unit);
        const aCurrencyRank = aCurrency === currency ? 2 : aCurrency === 'USD' ? 1 : 0;
        const bCurrencyRank = bCurrency === currency ? 2 : bCurrency === 'USD' ? 1 : 0;
        if (aCurrencyRank !== bCurrencyRank) return bCurrencyRank - aCurrencyRank;
        if ((a.framework === 'us-gaap') !== (b.framework === 'us-gaap')) return a.framework === 'us-gaap' ? -1 : 1;
        if (a.filed !== b.filed) return b.filed.localeCompare(a.filed);
        return a.tagIndex - b.tagIndex;
      });
      const fact = matching[0];
      rows.push([
        ticker, cik, metric.key, fact.value, fact.start, fact.end, fact.filed,
        fact.form, fact.accession, fact.tag, fact.unit, sourceUrl, generatedAt, 'VERIFIED_SOURCE'
      ]);
      availableMetrics.add(metric.key);
    }
  }
  const missingMetrics = metricSpecs.map(metric => metric.key).filter(metric => !availableMetrics.has(metric));
  return {
    rows, periodEnds: [...new Set(periods.map(period => period.end))],
    missingMetrics, companyName: companyName || doc.entityName || '', currency
  };
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

const requestedBatchTickers = [...new Set(
  String(process.env.SEC_TICKER_BATCH || '').split(/[\\s,;]+/).map(normTicker).filter(Boolean)
)];
const assetTickerSet = new Set(assetTickers);
const unknownBatchTickers = requestedBatchTickers.filter(ticker => !assetTickerSet.has(ticker));
if (unknownBatchTickers.length) {
  throw new Error('SEC_TICKER_BATCH contains tickers not present in Assets: ' + unknownBatchTickers.join(', '));
}
const processingTickers = requestedBatchTickers.length ? requestedBatchTickers : assetTickers;

const { map: secTickerMap, source: tickerMapSource } = await loadTickerMap();
// Deere & Company is CIK 0000315189; retain this explicit mapping if the SEC ticker file omits it.
secTickerMap.set('DE', [{ ticker: 'DE', cik: '0000315189', title: 'Deere & Company' }]);
console.log('Assets tickers: ' + assetTickers.length + '; selected SEC tickers: ' + processingTickers.length + '; SEC ticker map: ' + secTickerMap.size + ' entries from ' + tickerMapSource);

const factsCache = new Map();
const outcomes = [];
for (const ticker of processingTickers) {
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
      const missingFactsEndpoint = error.message.includes('SEC HTTP 404');
      outcomes.push({
        ticker, status: missingFactsEndpoint ? 'NO_COMPANYFACTS' : 'SOURCE_ERROR',
        records: [], cik: match.cik,
        error: missingFactsEndpoint
          ? 'Ticker/CIK matched, but the SEC CompanyFacts endpoint returned HTTP 404; this issuer is not covered by this SEC facts dataset.'
          : error.message
      });
      await sleep(150);
      continue;
    }
    await sleep(150);
  }
  try {
    let parsed = buildRows(cached.doc, ticker, match.cik, match.title, now);
    if (ticker === 'XOM' && match.cik !== XOM_LEGACY_CIK) {
      // The current SEC ticker map points XOM to its 2026 publicly traded parent.
      // Add predecessor annual history and current-parent quarterly observations separately.
      let legacy = factsCache.get(XOM_LEGACY_CIK);
      if (!legacy) {
        const legacyUrl = 'https://data.sec.gov/api/xbrl/companyfacts/CIK' + XOM_LEGACY_CIK + '.json';
        legacy = { doc: await fetchSecJson(legacyUrl), sourceUrl: legacyUrl };
        factsCache.set(XOM_LEGACY_CIK, legacy);
        await sleep(150);
      }
      const historical = buildRows(legacy.doc, ticker, XOM_LEGACY_CIK, 'Exxon Mobil Corporation (predecessor)', now);
      const quarterly = buildQuarterlyRows(cached.doc, ticker, match.cik, match.title, now);
      const rows = [...historical.rows, ...quarterly.rows];
      const covered = new Set(rows.map(row => row[2]));
      const missingMetrics = metricSpecs.map(metric => metric.key).filter(key => !covered.has(key));
      parsed = {
        rows,
        periodEnds: [...new Set([...historical.periodEnds, ...quarterly.periodEnds])],
        missingMetrics,
        companyName: match.title || cached.doc.entityName || 'ExxonMobil',
        currency: historical.currency || quarterly.currency || 'USD'
      };
    } else {
      // Keep recent SEC 10-Q facts for every matched issuer; raw quarterly periods
      // enable a later, correctly periodized TTM calculation without annual/TTM mixing.
      const quarterly = buildQuarterlyRows(cached.doc, ticker, match.cik, match.title, now);
      const rows = [...parsed.rows, ...quarterly.rows];
      const covered = new Set(rows.map(row => row[2]));
      parsed = {
        ...parsed,
        rows,
        periodEnds: [...new Set([...parsed.periodEnds, ...quarterly.periodEnds])],
        missingMetrics: metricSpecs.map(metric => metric.key).filter(key => !covered.has(key))
      };
    }
    if (!parsed.rows.length) {
      outcomes.push({ ticker, status: 'NO_STANDARD_FACTS', records: [], cik: match.cik, periods: parsed.periodEnds, companyName: parsed.companyName, error: 'No supported annual standard-taxonomy facts found for ' + (parsed.companyName || match.title || match.cik) + '.' });
    } else {
      outcomes.push({
        ticker, status: parsed.missingMetrics.length ? 'PARTIAL' : 'OK',
        records: parsed.rows, cik: match.cik, periods: parsed.periodEnds,
        currency: parsed.currency, missingMetrics: parsed.missingMetrics,
        companyName: parsed.companyName,
        error: ticker === 'XOM'
          ? 'History: predecessor CIK ' + XOM_LEGACY_CIK + '; current quarter data: parent CIK ' + match.cik + ' after 2026 redomiciliation. Missing metrics: ' + parsed.missingMetrics.join(', ')
          : parsed.missingMetrics.length ? 'Metrics not found: ' + parsed.missingMetrics.join(', ') : ''
      });
    }
  } catch (error) {
    outcomes.push({ ticker, status: 'SOURCE_ERROR', records: [], cik: match.cik, error: error.message });
  }
}


const inlineFactsCache = new Map();
let inlineFactRowsAdded = 0;
for (const outcome of outcomes) {
  if (!outcome.cik) continue;
  const annualEnds = [...new Set(outcome.records
    .filter(row => row[4] && row[5] && forms.has(String(row[7] || '').toUpperCase()) && metricSpecs.find(metric => metric.key === row[2])?.kind !== 'instant')
    .map(row => row[5]))].sort().slice(-6);
  const annualRows = outcome.records.filter(row => forms.has(String(row[7] || '').toUpperCase()));
  const existing = new Set(annualRows.map(row => row[2] + '|' + row[5]));
  const missingAnnualPeriods = annualEnds.filter(end => !existing.has('capex|' + end) || !existing.has('epsDiluted|' + end));
  const hasGap = missingAnnualPeriods.length > 0;
  if (!hasGap) continue;
  try {
    let facts = inlineFactsCache.get(outcome.cik);
    if (!facts) {
      facts = await fetchRecentAnnualXbrlFacts(outcome.cik, missingAnnualPeriods);
      inlineFactsCache.set(outcome.cik, facts);
    }
    const addedPeriods = new Set();
    let tickerAdded = 0;
    for (const fact of facts) {
      if (fact.metric !== 'capex' && fact.metric !== 'epsDiluted') continue;
      const key = fact.metric + '|' + fact.end;
      if (existing.has(key) || addedPeriods.has(key)) continue;
      if (annualEnds.length && !annualEnds.includes(fact.end)) continue;
      const desiredCurrency = outcome.currency || 'USD';
      if (!fact.unit.toUpperCase().startsWith(desiredCurrency.toUpperCase())) continue;
      outcome.records ||= [];
      outcome.records.push([
        outcome.ticker, outcome.cik, fact.metric, fact.value, fact.start, fact.end,
        fact.filed, fact.form, fact.accession, fact.tag, fact.unit, fact.sourceUrl, now, 'VERIFIED_SOURCE'
      ]);
      existing.add(key);
      addedPeriods.add(key);
      inlineFactRowsAdded++;
      tickerAdded++;
    }
    if (outcome.ticker === 'ABNB' || tickerAdded > 0) console.log('Annual XBRL facts ' + outcome.ticker + ': added ' + tickerAdded + '; missing annual metrics: ' + annualEnds.filter(end => !outcome.records.some(row => row[2] === 'capex' && row[5] === end)).length + ' CapEx periods and ' + annualEnds.filter(end => !outcome.records.some(row => row[2] === 'epsDiluted' && row[5] === end)).length + ' EPS periods.');
    if (outcome.records.length) {
      const covered = new Set(outcome.records.map(row => row[2]));
      outcome.missingMetrics = metricSpecs.map(metric => metric.key).filter(key => !covered.has(key));
      outcome.status = outcome.missingMetrics.length ? 'PARTIAL' : 'OK';
      outcome.error = outcome.missingMetrics.length ? 'Metrics not found after SEC CompanyFacts and annual XBRL filing enrichment: ' + outcome.missingMetrics.join(', ') : '';
    }
  } catch (error) {
    outcome.error = [outcome.error, 'Annual XBRL enrichment: ' + error.message].filter(Boolean).join(' | ').slice(0, 1000);
  }
}
console.log('Annual XBRL enrichment rows added: ' + inlineFactRowsAdded);

const successfulTickers = new Set(outcomes.filter(outcome => outcome.records.length > 0).map(outcome => outcome.ticker));
const newFactRows = outcomes.flatMap(outcome => outcome.records);
const rawCapacity = 50000;
const requiredRows = newFactRows.length + 1;
if (requiredRows > rawCapacity) throw new Error('SEC_Raw backfill exceeds the configured row capacity: ' + requiredRows);

if (secSheet.gridProperties?.rowCount < rawCapacity) {
  await sheetsApi(':batchUpdate', {
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
const outcomeTickers = new Set(outcomes.map(outcome => outcome.ticker));
const retainedLogRows = oldLogRows.filter(row => !(String(row[1]).toUpperCase() === 'SEC' && outcomeTickers.has(normTicker(row[0]))));
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


const [assetsGrid, fundamentalsGrid, jsonAssetsGrid, classificationGrid, financialHistoryGrid] = await Promise.all([
  readValues('Assets!A1:U1000'),
  readValues('Fundamentals!A1:BD1000'),
  readValues('JSON_assets!A1:B1000'),
  readValues('Ticker_Classification!A1:M1000'),
  readValues('Financial_History!A1:AP1000')
]);
if (assetsGrid.length < 2 || fundamentalsGrid.length < 3 || (fundamentalsGrid[1] || []).length < 55 || jsonAssetsGrid.length < 6 || classificationGrid.length < 2 || financialHistoryGrid.length < 2) {
  throw new Error('Coverage snapshot source ranges are incomplete; refusing to publish.');
}
const hasCoverageValue = value => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const text = value.trim();
    return text !== '' && !text.startsWith('#') && !['N/A', 'N/D', 'N/M', '—', '-'].includes(text.toUpperCase());
  }
  return typeof value === 'number' ? Number.isFinite(value) : true;
};
const categoryChunks = jsonAssetsGrid.slice(5)
  .filter(row => Number.isInteger(Number(row?.[0])) && typeof row?.[1] === 'string')
  .map(row => row[1]);
let jsonAssetRecords;
try {
  jsonAssetRecords = JSON.parse(categoryChunks.join(''));
} catch (error) {
  throw new Error('Could not parse JSON_assets category export: ' + error.message);
}
if (!Array.isArray(jsonAssetRecords) || jsonAssetRecords.length === 0) {
  throw new Error('JSON_assets category export is empty; refusing to publish.');
}
const categoryByTicker = new Map(jsonAssetRecords
  .map(record => [normTicker(record?.ticker), record?.category])
  .filter(([ticker]) => Boolean(ticker)));
const classificationByTicker = new Map(classificationGrid.slice(1)
  .map(row => [normTicker(row?.[0]), { instrumentType: String(row?.[2] || '').trim().toUpperCase(), profile: String(row?.[3] || '').trim().toUpperCase() }])
  .filter(([ticker]) => Boolean(ticker)));
const corporateFinancialMetrics = [
  { id: 'revenueCagr3y', label: 'Revenue CAGR 3Y' },
  { id: 'revenueCagr5y', label: 'Revenue CAGR 5Y' },
  { id: 'normalizedEps5y', label: 'Normalized EPS 5Y' },
  { id: 'epsCagr3y', label: 'EPS CAGR 3Y' },
  { id: 'epsCagr5y', label: 'EPS CAGR 5Y' },
  { id: 'historicalPe', label: 'Historical P/E (fiscal year-end)' },
  { id: 'freeCashFlow', label: 'Free Cash Flow' },
  { id: 'freeCashFlowPerShare', label: 'FCF per Share' },
  { id: 'fcfCagr5y', label: 'FCF CAGR 5Y' },
  { id: 'currentRatio', label: 'Current Ratio' },
  { id: 'totalDebt', label: 'Total Debt' },
  { id: 'netDebt', label: 'Net Debt' },
  { id: 'debtEquity', label: 'Debt / Equity' },
  { id: 'grossMargin', label: 'Gross Margin' },
  { id: 'ebitda', label: 'EBITDA' },
  { id: 'netDebtEbitda', label: 'Net Debt / EBITDA' },
  { id: 'interestCoverage', label: 'Interest Coverage' },
  { id: 'operatingMargin', label: 'Operating Margin' },
  { id: 'netMargin', label: 'Net Margin' },
  { id: 'roe', label: 'ROE' },
  { id: 'roic', label: 'ROIC (21% tax assumption)' }
];
const isAnnualForm = form => ['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A'].includes(String(form || '').toUpperCase());
const isInstantMetric = metric => ['cash', 'currentAssets', 'currentLiabilities', 'inventory', 'totalAssets', 'totalLiabilities', 'equity', 'longTermDebt', 'shortTermDebt'].includes(metric);
const yearEndPriceByTicker = new Map();
for (const row of financialHistoryGrid.slice(1)) {
  const ticker = normTicker(row?.[0]), periodEnd = String(row?.[6] || ''), currency = String(row?.[7] || '').trim().toUpperCase(), close = Number(row?.[36]);
  if (!ticker || !periodEnd || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(close) || close <= 0) continue;
  const periods = yearEndPriceByTicker.get(ticker) || new Map();
  periods.set(periodEnd, { close, currency });
  yearEndPriceByTicker.set(ticker, periods);
}
const financialPeriodsByTicker = new Map();
for (const row of mergedRawRows.slice(1)) {
  const ticker = normTicker(row?.[0]), metric = String(row?.[2] || '').trim(), value = Number(row?.[3]);
  const start = String(row?.[4] || ''), end = String(row?.[5] || ''), form = row?.[7];
  if (!ticker || !end || !isAnnualForm(form) || !Number.isFinite(value) || row?.[13] !== 'VERIFIED_SOURCE') continue;
  if (!isInstantMetric(metric)) {
    if (!start) continue;
    const days = (Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000;
    if (days < 300 || days > 430) continue;
  }
  const periods = financialPeriodsByTicker.get(ticker) || new Map();
  const period = periods.get(end) || { periodEnd: end, currency: '', metrics: {} };
  const factCurrency = String(row?.[10] || '').split('/')[0].trim().toUpperCase();
  if (!period.currency && /^[A-Z]{3}$/.test(factCurrency)) period.currency = factCurrency;
  period.metrics[metric] = value;
  periods.set(end, period);
  financialPeriodsByTicker.set(ticker, periods);
}
const annualCalculatedByTicker = new Map();
const validPositive = value => Number.isFinite(value) && value > 0;
const cagr = (series, field, span) => {
  if (series.length !== span + 1 || series.some(period => !validPositive(period.metrics[field]))) return null;
  for (let index = 1; index < series.length; index++) {
    const days = (Date.parse(series[index].periodEnd + 'T00:00:00Z') - Date.parse(series[index - 1].periodEnd + 'T00:00:00Z')) / 86400000;
    if (days < 300 || days > 430) return null;
  }
  const elapsedYears = (Date.parse(series.at(-1).periodEnd + 'T00:00:00Z') - Date.parse(series[0].periodEnd + 'T00:00:00Z')) / (365.2425 * 86400000);
  return Math.pow(series.at(-1).metrics[field] / series[0].metrics[field], 1 / elapsedYears) - 1;
};
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
for (const [ticker, periodMap] of financialPeriodsByTicker) {
  const allPeriods = [...periodMap.values()].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const reportingCurrency = allPeriods.at(-1)?.currency;
  const periods = allPeriods.filter(period => !reportingCurrency || period.currency === reportingCurrency);
  const counts = Object.fromEntries(corporateFinancialMetrics.map(metric => [metric.id, 0]));
  for (let index = 0; index < periods.length; index++) {
    const p = periods[index], m = p.metrics;
    const fcf = Number.isFinite(m.cashFromOperations) && Number.isFinite(m.capex) ? m.cashFromOperations - Math.abs(m.capex) : null;
    m.freeCashFlow = fcf;
    const shares = validPositive(m.dilutedShares) ? m.dilutedShares :
      Number.isFinite(m.netIncome) && Number.isFinite(m.epsDiluted) && m.epsDiluted !== 0 && m.netIncome / m.epsDiluted > 0 ? m.netIncome / m.epsDiluted : null;
    const debt = Number.isFinite(m.longTermDebt) && Number.isFinite(m.shortTermDebt) ? m.longTermDebt + m.shortTermDebt : null;
    const netDebt = debt !== null && Number.isFinite(m.cash) ? debt - m.cash : null;
    const ebitda = Number.isFinite(m.operatingIncome) && Number.isFinite(m.depreciationAndAmortization) ? m.operatingIncome + Math.abs(m.depreciationAndAmortization) : null;
    const epsWindow = periods.slice(Math.max(0, index - 4), index + 1).map(row => row.metrics.epsDiluted);
    const previousPeriod = index > 0 ? periods[index - 1] : null;
    const previous = previousPeriod?.metrics || null;
    const periodGapDays = previousPeriod ? (Date.parse(p.periodEnd + 'T00:00:00Z') - Date.parse(previousPeriod.periodEnd + 'T00:00:00Z')) / 86400000 : null;
    const adjacentAnnual = periodGapDays !== null && periodGapDays >= 300 && periodGapDays <= 430;
    const currentCapital = debt !== null && Number.isFinite(m.equity) && Number.isFinite(m.cash) ? debt + m.equity - m.cash : null;
    const previousDebt = previous && Number.isFinite(previous.longTermDebt) && Number.isFinite(previous.shortTermDebt) ? previous.longTermDebt + previous.shortTermDebt : null;
    const previousCapital = previousDebt !== null && Number.isFinite(previous?.equity) && Number.isFinite(previous?.cash) ? previousDebt + previous.equity - previous.cash : null;
    const averageCapital = adjacentAnnual && currentCapital !== null && previousCapital !== null ? (currentCapital + previousCapital) / 2 : null;
    const averageEquity = adjacentAnnual && Number.isFinite(m.equity) && Number.isFinite(previous?.equity) ? (m.equity + previous.equity) / 2 : null;
    const derived = {
      revenueCagr3y: index >= 3 ? cagr(periods.slice(index - 3, index + 1), 'revenue', 3) : null,
      revenueCagr5y: index >= 5 ? cagr(periods.slice(index - 5, index + 1), 'revenue', 5) : null,
      normalizedEps5y: epsWindow.length === 5 && epsWindow.every(value => validPositive(value)) ? median(epsWindow) : null,
      epsCagr3y: index >= 3 ? cagr(periods.slice(index - 3, index + 1), 'epsDiluted', 3) : null,
      epsCagr5y: index >= 5 ? cagr(periods.slice(index - 5, index + 1), 'epsDiluted', 5) : null,
      fcfCagr5y: index >= 5 ? cagr(periods.slice(index - 5, index + 1), 'freeCashFlow', 5) : null,
      historicalPe: (() => { const quote = yearEndPriceByTicker.get(ticker)?.get(p.periodEnd); return quote && quote.currency === p.currency && validPositive(quote.close) && validPositive(m.epsDiluted) ? quote.close / m.epsDiluted : null; })(),
      freeCashFlow: fcf,
      freeCashFlowPerShare: fcf !== null && validPositive(shares) ? fcf / shares : null,
      currentRatio: Number.isFinite(m.currentAssets) && Number.isFinite(m.currentLiabilities) && m.currentLiabilities > 0 ? m.currentAssets / m.currentLiabilities : null,
      totalDebt: debt,
      netDebt,
      debtEquity: debt !== null && Number.isFinite(m.equity) && m.equity !== 0 ? debt / m.equity : null,
      grossMargin: Number.isFinite(m.grossProfit) && Number.isFinite(m.revenue) && m.revenue !== 0 ? m.grossProfit / m.revenue : null,
      ebitda,
      netDebtEbitda: netDebt !== null && validPositive(ebitda) ? netDebt / ebitda : null,
      interestCoverage: Number.isFinite(m.operatingIncome) && Number.isFinite(m.interestExpense) && m.interestExpense !== 0 ? m.operatingIncome / Math.abs(m.interestExpense) : null,
      operatingMargin: Number.isFinite(m.operatingIncome) && Number.isFinite(m.revenue) && m.revenue !== 0 ? m.operatingIncome / m.revenue : null,
      netMargin: Number.isFinite(m.netIncome) && Number.isFinite(m.revenue) && m.revenue !== 0 ? m.netIncome / m.revenue : null,
      roe: Number.isFinite(m.netIncome) && averageEquity !== null && averageEquity !== 0 ? m.netIncome / averageEquity : null,
      roic: Number.isFinite(m.operatingIncome) && averageCapital !== null && averageCapital > 0 ? m.operatingIncome * 0.79 / averageCapital : null
    };
    for (const metric of corporateFinancialMetrics) if (derived[metric.id] !== null && Number.isFinite(derived[metric.id])) counts[metric.id]++;
  }
  annualCalculatedByTicker.set(ticker, counts);
}
const hasCategoryValue = value => typeof value === 'string' &&
  value.trim() !== '' &&
  value.trim() !== '0' &&
  !['N/A', 'N/D', 'UNCLASSIFIED'].includes(value.trim().toUpperCase());
const hasMarketMetricValue = (metric, value, ticker) => {
  if (metric.id === 'category') return hasCategoryValue(categoryByTicker.get(ticker));
  if (metric.id === 'avgVolume') return hasCoverageValue(value) && Number(value) > 0;
  return hasCoverageValue(value);
};
const slugifyCoverageLabel = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');
const marketMetrics = [
  { id: 'price', label: 'Prezzo', column: 2 },
  { id: 'change5d', label: 'Variazione 5 gg', column: 3 },
  { id: 'name', label: 'Nome società', column: 4 },
  { id: 'currency', label: 'Valuta', column: 5 },
  { id: 'marketCap', label: 'Capitalizzazione', column: 6 },
  { id: 'avgVolume', label: 'Volume medio', column: 7 },
  { id: 'beta', label: 'Beta', column: 8 },
  { id: 'pe', label: 'P/E', column: 9 },
  { id: 'eps', label: 'EPS', column: 10 },
  { id: 'high52', label: 'Massimo 52 settimane', column: 11 },
  { id: 'low52', label: 'Minimo 52 settimane', column: 12 },
  { id: 'drawdown52', label: 'Drawdown 52 settimane', column: 13 },
  { id: 'dividendYield', label: 'Dividend yield', column: 14 },
  { id: 'sector', label: 'Settore', column: 15 },
  { id: 'category', label: 'Categoria', column: 16 },
  { id: 'change1d', label: 'Variazione 1 giorno', column: 17 },
  { id: 'changeYtd', label: 'Variazione YTD', column: 18 },
  { id: 'alphaPe', label: 'P/E Alpha Vantage', column: 19 },
  { id: 'alphaDividendYield', label: 'Dividend yield Alpha Vantage', column: 20 }
];
const secMetricLabels = {
  revenue: 'Ricavi',
  netIncome: 'Utile netto',
  operatingIncome: 'Reddito operativo',
  cashFromOperations: 'Flusso di cassa operativo',
  capex: 'CapEx',
  epsDiluted: 'EPS diluito',
  grossProfit: 'Gross profit',
  depreciationAndAmortization: 'Depreciation & amortization',
  interestExpense: 'Interest expense',
  dilutedShares: 'Weighted-average diluted shares',
  cash: 'Cassa ed equivalenti',
  currentAssets: 'Attività correnti',
  currentLiabilities: 'Passività correnti',
  inventory: 'Rimanenze',
  totalAssets: 'Totale attivo',
  totalLiabilities: 'Passività totali',
  equity: 'Patrimonio netto',
  longTermDebt: 'Debito a lungo termine',
  shortTermDebt: 'Debito a breve termine'
};
const fundamentalMetrics = Array.from({ length: 43 }, (_, index) => {
  const column = 12 + index;
  const label = String(fundamentalsGrid[1]?.[column] ?? '').trim() || 'Fundamental field ' + (column + 1);
  return { id: slugifyCoverageLabel(label), label, column };
});
if (marketMetrics.length !== 19 || metricSpecs.length !== 19 || fundamentalMetrics.length !== 43 ||
    fundamentalMetrics.some(metric => !metric.id)) {
  throw new Error('Unexpected admin coverage metric schema; refusing to publish.');
}
const marketByTicker = new Map();
for (const row of assetsGrid.slice(1)) {
  const ticker = normTicker(row?.[1]);
  if (ticker) marketByTicker.set(ticker, row);
}
const secByTicker = new Map();
for (const row of mergedRawRows.slice(1)) {
  const ticker = normTicker(row?.[0]);
  const metric = String(row?.[2] ?? '').trim();
  if (!ticker || !metric || !hasCoverageValue(row?.[3])) continue;
  const present = secByTicker.get(ticker) || new Set();
  present.add(metric);
  secByTicker.set(ticker, present);
}
const fundamentalsByTicker = new Map();
for (const row of fundamentalsGrid.slice(2)) {
  const ticker = normTicker(row?.[0]);
  if (ticker) fundamentalsByTicker.set(ticker, row);
}
const snapshotGroups = [
  { id: 'market', label: 'Dati di mercato', metrics: marketMetrics.map(({ id, label }) => ({ id, label })) },
  { id: 'sec', label: 'Dati grezzi SEC', metrics: metricSpecs.map(metric => ({ id: metric.key, label: secMetricLabels[metric.key] || metric.key })) },
  { id: 'calculated', label: 'Metriche annuali calcolate', metrics: corporateFinancialMetrics },
  { id: 'fundamentals', label: 'Fundamentals normalizzati / calcolati', metrics: fundamentalMetrics.map(({ id, label }) => ({ id, label })) }
];
const secAnnualFundamentalMap = {
  revenue_cagr_3y: 'revenueCagr3y',
  revenue_cagr_5y: 'revenueCagr5y',
  normalized_eps_5y: 'normalizedEps5y',
  eps_cagr_3y: 'epsCagr3y',
  eps_cagr_5y: 'epsCagr5y',
  fcf_per_share: 'freeCashFlowPerShare',
  fcf_cagr_5y: 'fcfCagr5y',
  total_debt: 'totalDebt',
  net_debt: 'netDebt',
  debt_equity: 'debtEquity',
  net_debt_ebitda: 'netDebtEbitda',
  current_ratio: 'currentRatio',
  interest_coverage: 'interestCoverage',
  gross_margin: 'grossMargin',
  operating_margin: 'operatingMargin',
  net_margin: 'netMargin',
  roe: 'roe',
  roic: 'roic'
};
const industrialFundamentalNA = ['operating_cash_flow_ttm','free_cash_flow_ttm','fcf_per_share','fcf_cagr_5y','total_debt','net_debt','debt_equity','net_debt_ebitda','current_ratio','interest_coverage','gross_margin','operating_margin','net_margin','roic','p_fcf','ev_ebitda'];
const coverageSnapshot = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  definition: 'Present means the ticker has at least one non-empty sheet value or one SEC-derived annual value with the same metric meaning. FY counts show the number of annual SEC observations; annual values never fill or relabel TTM fields. Presence does not mean the full history is complete.',
  source: 'Google Sheets · Assets, JSON_assets, SEC_Raw, Fundamentals · SEC annual calculations',
  universeCount: assetTickers.length,
  groups: snapshotGroups,
  tickers: assetTickers.map(ticker => {
    const marketRow = marketByTicker.get(ticker) || [];
    const fundamentalRow = fundamentalsByTicker.get(ticker) || [];
    const secPresent = secByTicker.get(ticker) || new Set();
    const classInfo = classificationByTicker.get(ticker) || { instrumentType: 'UNKNOWN', profile: 'UNKNOWN' };
    const fundOrIndex = ['ETF', 'INDEX'].includes(classInfo.instrumentType) || /ETF|INDEX/.test(classInfo.profile);
    const bankOrInsurer = ['BANK', 'CONSUMER_FINANCE', 'BROKERAGE', 'FINANCIAL_MARKET_INFRASTRUCTURE', 'INSURANCE'].includes(classInfo.profile);
    const reitOrMlp = /REIT|MLP/.test(classInfo.profile);
    const bankNA = ['grossMargin','operatingMargin','netMargin','freeCashFlow','freeCashFlowPerShare','fcfCagr5y','currentRatio','totalDebt','netDebt','debtEquity','ebitda','netDebtEbitda','interestCoverage','roic'];
    const calculatedNA = fundOrIndex ? corporateFinancialMetrics.map(metric => metric.id) : bankOrInsurer ? bankNA : reitOrMlp ? ['freeCashFlowPerShare','fcfCagr5y','roic'] : [];
    const fundamentalsNA = fundOrIndex ? fundamentalMetrics.map(metric => metric.id) : bankOrInsurer ? industrialFundamentalNA : reitOrMlp ? ['fcf_per_share','fcf_cagr_5y','p_fcf','roic'] : [];
    const notApplicable = {
      sec: fundOrIndex ? metricSpecs.map(metric => metric.key) : [],
      calculated: calculatedNA,
      fundamentals: fundamentalsNA
    };
    const annualCalculated = annualCalculatedByTicker.get(ticker) || {};
    const sheetFundamentals = fundamentalMetrics.filter(metric => hasCoverageValue(fundamentalRow[metric.column])).map(metric => metric.id);
    const annualFundamentals = fundamentalMetrics.filter(metric => {
      const calculated = secAnnualFundamentalMap[metric.id];
      return calculated && (annualCalculated[calculated] || 0) > 0;
    }).map(metric => metric.id);
    const fundamentalsPresent = new Set([...sheetFundamentals, ...annualFundamentals]);
    return {
      ticker,
      name: hasCoverageValue(marketRow[4]) ? String(marketRow[4]).trim() : ticker,
      sector: hasCoverageValue(marketRow[15]) ? String(marketRow[15]).trim() : '',
      instrumentType: classInfo.instrumentType,
      valuationProfile: classInfo.profile,
      notApplicable,
      periodCounts: {
        sec: Object.fromEntries(metricSpecs.map(metric => [metric.key, [...(financialPeriodsByTicker.get(ticker)?.values() || [])].filter(period => Number.isFinite(period.metrics[metric.key])).length])),
        calculated: annualCalculated,
        fundamentals: Object.fromEntries(fundamentalMetrics.map(metric => {
          const calculated = secAnnualFundamentalMap[metric.id];
          return [metric.id, calculated ? annualCalculated[calculated] || 0 : 0];
        }))
      },
      present: {
        market: marketMetrics.filter(metric => hasMarketMetricValue(metric, marketRow[metric.column], ticker)).map(metric => metric.id),
        sec: metricSpecs.filter(metric => secPresent.has(metric.key) && !notApplicable.sec.includes(metric.key)).map(metric => metric.key),
        calculated: Object.entries(annualCalculated).filter(([metric, count]) => count > 0 && !notApplicable.calculated.includes(metric)).map(([metric]) => metric),
        fundamentals: fundamentalMetrics.filter(metric => fundamentalsPresent.has(metric.id) && !notApplicable.fundamentals.includes(metric.id)).map(metric => metric.id)
      }
    };
  })
};
if (coverageSnapshot.tickers.length !== assetTickers.length) {
  throw new Error('Coverage snapshot ticker count mismatch; refusing to publish.');
}
await fs.writeFile('platform-app/src/data/adminCoverageSnapshot.json', JSON.stringify(coverageSnapshot, null, 2) + '\n');


const valuationSourceMetrics = metricSpecs.map(metric => metric.key);
const valuationSourceFacts = mergedRawRows.slice(1)
  .filter(row => valuationSourceMetrics.includes(String(row?.[2] || '')) && Number.isFinite(Number(row?.[3])) && row?.[13] === 'VERIFIED_SOURCE')
  .map(row => ({
    ticker: normTicker(row[0]), cik: normCik(row[1]), metric: String(row[2]), value: Number(row[3]),
    periodStart: String(row[4] || ''), periodEnd: String(row[5] || ''), filedDate: String(row[6] || ''),
    form: String(row[7] || ''), accession: String(row[8] || ''), tag: String(row[9] || ''),
    unit: String(row[10] || ''), sourceUrl: String(row[11] || ''), importedAt: String(row[12] || ''),
    status: String(row[13] || '')
  }));
const annualPrices = [...yearEndPriceByTicker.entries()].flatMap(([ticker, periods]) => [...periods.entries()].map(([periodEnd, quote]) => ({ ticker, periodEnd, currency: quote.currency, close: quote.close, source: 'GOOGLEFINANCE close · Financial_History' })));
const valuationSourceSnapshot = {
  schemaVersion: 2,
  generatedAt: now.slice(0, 10),
  source: 'Google Sheet · Tabella Stagionalità · SEC_Raw',
  spreadsheetId,
  sourceImportedAt: now,
  factCount: valuationSourceFacts.length,
  metrics: valuationSourceMetrics,
  facts: valuationSourceFacts,
  annualPrices
};
await fs.writeFile('platform-app/src/data/googleSheetsSecFacts.json', JSON.stringify(valuationSourceSnapshot));


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
