require('dotenv').config();
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exchangeAuthCode } = require('../lib/jobberOAuth');

async function openBrowser(target) {
  try {
    const mod = await import('open');
    await mod.default(target);
  } catch (_err) {
    // User can click the printed URL manually.
  }
}

const CLIENT_ID = process.env.JOBBER_CLIENT_ID;
const CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET;
const PORT = Number(process.env.JOBBER_OAUTH_PORT || 53682);
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = [
  'read_products_and_services',
  'write_products_and_services'
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing JOBBER_CLIENT_ID or JOBBER_CLIENT_SECRET in .env');
  process.exit(1);
}

const state = crypto.randomBytes(16).toString('hex');
const authorizeUrl = new URL('https://api.getjobber.com/api/oauth/authorize');
authorizeUrl.searchParams.set('response_type', 'code');
authorizeUrl.searchParams.set('client_id', CLIENT_ID);
authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authorizeUrl.searchParams.set('state', state);
authorizeUrl.searchParams.set('scope', SCOPES.join(' '));

console.log('\nConfigure this Callback URL in your Jobber Developer app:');
console.log(`   ${REDIRECT_URI}\n`);
console.log('Opening browser to authorize Jobber access...');
console.log('If it does not open automatically, paste this URL:');
console.log(authorizeUrl.toString());
console.log('');

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname !== '/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const { code, state: returnedState, error } = parsed.query;
  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h1>Authorization error</h1><pre>${error}</pre>`);
    server.close();
    process.exit(1);
  }

  if (returnedState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>State mismatch</h1>');
    server.close();
    process.exit(1);
  }

  try {
    const tokens = await exchangeAuthCode({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      code,
      redirectUri: REDIRECT_URI
    });

    const envPath = path.join(__dirname, '..', '..', '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    envContent = envContent.replace(/^JOBBER_REFRESH_TOKEN=.*\n?/m, '');
    envContent = envContent.replace(/^JOBBER_ACCESS_TOKEN=.*\n?/m, '');
    if (!envContent.endsWith('\n') && envContent.length) envContent += '\n';
    envContent += `JOBBER_REFRESH_TOKEN=${tokens.refresh_token}\n`;
    envContent += `JOBBER_ACCESS_TOKEN=${tokens.access_token}\n`;
    fs.writeFileSync(envPath, envContent, 'utf8');

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(
      `<h1>Jobber connected</h1>
       <p>Tokens written to .env. You can close this tab.</p>
       <p>Access token expires in ${tokens.expires_in || 3600} seconds.</p>`
    );
    console.log('\nJobber OAuth complete.');
    console.log('Saved to .env:');
    console.log('  JOBBER_REFRESH_TOKEN  (long-lived, used for auto-refresh)');
    console.log('  JOBBER_ACCESS_TOKEN   (short-lived, will auto-refresh)');
    console.log('\nAdd JOBBER_REFRESH_TOKEN to GitHub Secrets for automated runs.');
    server.close();
    process.exit(0);
  } catch (err) {
    const payload = err.response && err.response.data ? JSON.stringify(err.response.data, null, 2) : err.message;
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>Token exchange failed</h1><pre>${payload}</pre>`);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  openBrowser(authorizeUrl.toString());
});
