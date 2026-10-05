import crypto from 'crypto';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const BLUE = { red: 0.678, green: 0.847, blue: 0.902 };
let token = null;
let tokenExpires = 0;

function env(name) {
  if (!process.env[name]) throw new Error(`Missing Google Sheets environment variable: ${name}`);
  return process.env[name];
}

function b64(value) {
  return Buffer.from(value).toString('base64url');
}

async function accessToken() {
  const now = Date.now();
  if (token && now < tokenExpires - 60000) return token;

  const email = env('GOOGLE_SHEETS_CLIENT_EMAIL');
  const key = env('GOOGLE_SHEETS_PRIVATE_KEY').replace(/\\n/g, '\n');
  const iat = Math.floor(now / 1000);
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  const unsigned = `${head}.${body}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(key).toString('base64url')}`;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Google auth failed: ${data.error_description || data.error || response.status}`);
  token = data.access_token;
  tokenExpires = now + ((data.expires_in || 3600) * 1000);
  return token;
}

async function request(path, options = {}) {
  const access = await accessToken();
  const response = await fetch(API + path, {
    ...options,
    headers: {
      authorization: `Bearer ${access}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Google Sheets API error ${response.status}: ${data.error?.message || 'Unknown error'}`);
  return data;
}

function col(index) {
  let n = index + 1;
  let out = '';
  while (n) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function norm(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function months(date) {
  const long = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'Asia/Kolkata' }).format(date).toLowerCase();
  return [long, long.slice(0, 3)];
}

async function spreadsheet() {
  const id = env('GOOGLE_SHEETS_SPREADSHEET_ID');
  return request(`/${encodeURIComponent(id)}?fields=sheets(properties(sheetId,title,index))`);
}

async function values(title, range) {
  const id = env('GOOGLE_SHEETS_SPREADSHEET_ID');
  const a1 = encodeURIComponent(`'${title}'!${range}`);
  const data = await request(`/${encodeURIComponent(id)}/values/${a1}?majorDimension=ROWS`);
  return data.values || [];
}

async function write(title, range, value) {
  const id = env('GOOGLE_SHEETS_SPREADSHEET_ID');
  const a1 = encodeURIComponent(`'${title}'!${range}`);
  const data = Array.isArray(value) ? value : [[value]];
  await request(`/${encodeURIComponent(id)}/values/${a1}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: data }),
  });
}

async function blue(sheetId, rowIndex, columnIndex) {
  const id = env('GOOGLE_SHEETS_SPREADSHEET_ID');
  await request(`/${encodeURIComponent(id)}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        repeatCell: {
          range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 },
          cell: { userEnteredFormat: { backgroundColor: BLUE } },
          fields: 'userEnteredFormat.backgroundColor',
        },
      }],
    }),
  });
}

async function supporterRow(title, username, payer) {
  const rows = await values(title, 'A4:B5000');
  const target = norm(username);
  let lastUsedRow = 3;

  for (let i = 0; i < rows.length; i += 1) {
    const name = String(rows[i]?.[0] || '').trim();
    const existing = String(rows[i]?.[1] || '').trim();
    if (target && norm(existing) === target) return i + 4;
    if (name || existing) lastUsedRow = i + 4;
  }

  const row = lastUsedRow + 1;
  await write(title, `A${row}:B${row}`, [[payer, username]]);
  return row;
}

async function raceRow(title, username) {
  const rows = await values(title, 'A4:A5000');
  const target = norm(username);
  let lastUsedRow = 3;

  for (let i = 0; i < rows.length; i += 1) {
    const existing = String(rows[i]?.[0] || '').trim();
    if (target && norm(existing) === target) return i + 4;
    if (existing) lastUsedRow = i + 4;
  }

  const row = lastUsedRow + 1;
  await write(title, `A${row}`, username);
  return row;
}

async function header(title, aliases) {
  const row = (await values(title, 'A3:ZZ3'))[0] || [];
  const wanted = aliases.map(norm);
  for (let i = 0; i < row.length; i += 1) {
    if (wanted.includes(norm(row[i]))) return i;
  }
  return null;
}

const RACE_ALIASES = {
  'bahrain-malaysia': ['singapore', 'bahrain malaysia', 'bahrain'],
  singapore: ['singapore'],
  'united-states': ['us', 'united states', 'usa', 'united states gp', 'united states grand prix'],
  mexico: ['mexico', 'mexico gp', 'mexican gp'],
  'sao-paulo': ['sao paulo', 'sao paulo gp', 'brazil', 'brazil gp'],
  'las-vegas': ['las vegas', 'las vegas gp'],
  qatar: ['qatar', 'qatar gp'],
  'abu-dhabi': ['abu dhabi', 'abu dhabi gp'],
};

export async function syncPaymentToGoogleSheet({ paymentRequest, user }) {
  const book = await spreadsheet();
  const sheets = book.sheets || [];
  const titles = new Set(sheets.map((s) => s.properties?.title));
  const username = user.username || user.tag || user.id;
  const payer = paymentRequest.payerName;
  const purchaseDate = paymentRequest.createdAt || new Date();

  if (paymentRequest.type === 'monthly' || paymentRequest.type === 'yearly') {
    const title = paymentRequest.country === 'india' ? 'INDIAN_SUPPORTERS' : 'NONINDIAN_SUPPORTERS';
    if (!titles.has(title)) throw new Error(`Google Sheet tab not found: ${title}`);
    const row = await supporterRow(title, username, payer);
    const monthColumn = await header(title, months(purchaseDate));
    if (monthColumn === null) throw new Error(`Could not find the purchase month column in ${title}.`);
    const amount = paymentRequest.country === 'india'
      ? (paymentRequest.type === 'monthly' ? 50 : 450)
      : (paymentRequest.type === 'monthly' ? 230 : 2100);
    await write(title, `${col(monthColumn)}${row}`, amount);
    if (paymentRequest.type === 'yearly') {
      const meta = sheets.find((s) => s.properties?.title === title);
      await blue(meta.properties.sheetId, row - 1, monthColumn);
    }
    return { sheet: title, cell: `${col(monthColumn)}${row}`, amount };
  }

  if (paymentRequest.type === 'race') {
    const title = 'RACE_PASS_BUYERS';
    if (!titles.has(title)) throw new Error('Google Sheet tab not found: RACE_PASS_BUYERS');
    const aliases = RACE_ALIASES[paymentRequest.raceKey];
    if (!aliases) throw new Error(`No Google Sheet race mapping configured for ${paymentRequest.raceKey}.`);
    const raceColumn = await header(title, aliases);
    if (raceColumn === null) throw new Error(`Could not find the Google Sheet race column for ${paymentRequest.raceName}.`);
    const row = await raceRow(title, username);
    const amount = paymentRequest.country === 'india' ? 30 : 90;
    await write(title, `${col(raceColumn)}${row}`, amount);
    return { sheet: title, cell: `${col(raceColumn)}${row}`, amount };
  }

  throw new Error(`Unsupported payment type for Google Sheet sync: ${paymentRequest.type}`);
}
