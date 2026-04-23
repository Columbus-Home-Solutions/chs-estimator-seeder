const axios = require('axios');

const JOBBER_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';
const JOBBER_GRAPHQL_URL = 'https://api.getjobber.com/api/graphql';
const JOBBER_API_VERSION = '2024-12-05';

async function exchangeAuthCode({ clientId, clientSecret, code, redirectUri }) {
  const res = await axios.post(JOBBER_TOKEN_URL, {
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri
  }, { headers: { 'Content-Type': 'application/json' } });
  return res.data;
}

async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const res = await axios.post(JOBBER_TOKEN_URL, {
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken
  }, { headers: { 'Content-Type': 'application/json' } });
  return res.data;
}

async function graphql({ accessToken, query, variables }) {
  const res = await axios.post(
    JOBBER_GRAPHQL_URL,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-JOBBER-GRAPHQL-VERSION': JOBBER_API_VERSION
      }
    }
  );
  if (res.data.errors && res.data.errors.length) {
    const msg = res.data.errors.map((e) => e.message).join(' | ');
    throw new Error(`Jobber GraphQL error: ${msg}`);
  }
  return res.data.data;
}

module.exports = {
  JOBBER_TOKEN_URL,
  JOBBER_GRAPHQL_URL,
  JOBBER_API_VERSION,
  exchangeAuthCode,
  refreshAccessToken,
  graphql
};
