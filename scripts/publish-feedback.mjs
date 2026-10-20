import { setTimeout as pause } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const REPOSITORY = 'gn02335338/hedo-life';
const BASE_URL = 'https://hedo-life.bvstudio.workers.dev';
const AUDIENCE = `${BASE_URL}/api/feedback-publisher`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISSUE_URL = /^https:\/\/github\.com\/gn02335338\/hedo-life\/issues\/([1-9][0-9]*)$/;

class PublisherError extends Error {
  constructor(message, stopBatch = false) {
    super(message);
    this.stopBatch = stopBatch;
  }
}

function requireConfiguration({ baseUrl, oidcToken, githubToken, repository }) {
  if (repository !== REPOSITORY) throw new PublisherError('Unexpected feedback repository.');
  if (baseUrl !== BASE_URL && baseUrl !== `${BASE_URL}/`) {
    throw new PublisherError('Unexpected feedback service URL.');
  }
  for (const token of [oidcToken, githubToken]) {
    if (typeof token !== 'string' || !token || /[\r\n]/.test(token)) {
      throw new PublisherError('Missing or invalid publisher authentication.');
    }
  }
}

function validateItems(data) {
  if (!data || !Array.isArray(data.items) || data.items.length > 3) {
    throw new PublisherError('Invalid feedback claim response.');
  }
  const seen = new Set();
  for (const item of data.items) {
    if (!item || typeof item !== 'object' || !UUID.test(item.submissionId) ||
        typeof item.leaseId !== 'string' || !/^[A-Za-z0-9_-]{8,160}$/.test(item.leaseId) ||
        typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) ||
        typeof item.title !== 'string' || !item.title.trim() || item.title.length > 256 ||
        /[\r\n]/.test(item.title) || typeof item.body !== 'string' || item.body.length > 60_000 ||
        !item.body.trimEnd().endsWith(`\n<!-- hedo-feedback:${item.submissionId} -->`) || seen.has(item.submissionId)) {
      throw new PublisherError('Invalid feedback claim item.');
    }
    seen.add(item.submissionId);
  }
  return data.items;
}

function publisherAuthor(issue) {
  return issue?.user?.login === 'github-actions[bot]' && issue.user.type === 'Bot';
}

function canonicalIssue(issue) {
  const match = typeof issue?.html_url === 'string' && ISSUE_URL.exec(issue.html_url);
  if (!publisherAuthor(issue) || !match || !Number.isSafeInteger(issue.number) || issue.number < 1 || Number(match[1]) !== issue.number) {
    throw new PublisherError('GitHub returned an unexpected issue address.');
  }
  return { issueUrl: issue.html_url, issueNumber: issue.number };
}

async function request(fetchImpl, url, options) {
  try {
    return await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    if (error instanceof PublisherError) throw error;
    // Do not expose a URL, request body or tokens through the thrown fetch error.
    throw new PublisherError('Publisher request did not complete.');
  }
}

async function responseJson(response, service) {
  if (!response.ok) {
    const stopBatch = service === 'GitHub' && [401, 403, 429].includes(response.status);
    throw new PublisherError(`${service} returned HTTP ${response.status}.`, stopBatch);
  }
  try { return await response.json(); }
  catch { throw new PublisherError(`${service} returned an invalid response.`); }
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2026-03-10',
    'Content-Type': 'application/json',
    'User-Agent': 'hedo-life-feedback-publisher',
  };
}

async function findPublishedIssue(item, headers, fetchImpl) {
  const marker = `<!-- hedo-feedback:${item.submissionId} -->`;
  const since = new Date(Date.parse(item.createdAt) - 5 * 60_000).toISOString();
  for (let page = 1; page <= 10; page += 1) {
    const url = new URL(`https://api.github.com/repos/${REPOSITORY}/issues`);
    url.search = new URLSearchParams({ state: 'all', sort: 'created', direction: 'desc', since, per_page: '100', page: String(page) });
    const response = await request(fetchImpl, url.href, { headers });
    const issues = await responseJson(response, 'GitHub');
    if (!Array.isArray(issues) || issues.length > 100) throw new PublisherError('Invalid GitHub issue list.');
    for (const issue of issues) {
      if (!issue?.pull_request && publisherAuthor(issue) && typeof issue?.body === 'string' && issue.body.trimEnd().endsWith(`\n${marker}`)) {
        return canonicalIssue(issue);
      }
    }
    if (issues.length < 100) return null;
  }
  // A bounded scan that cannot prove absence must never create another issue.
  throw new PublisherError('Issue reconciliation exceeded its safe scan limit.');
}

async function acknowledge(item, issue, baseUrl, headers, fetchImpl) {
  const payload = JSON.stringify({ submissionId: item.submissionId, leaseId: item.leaseId, ...issue });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt) await pause(attempt * 500);
    try {
      const response = await request(fetchImpl, `${baseUrl}/api/feedback-publisher/ack`, {
        method: 'POST', headers, body: payload,
      });
      if (response.ok) return;
      // Stale leases and invalid acknowledgements will not be fixed by retrying.
      if (response.status < 500) throw new PublisherError(`Feedback acknowledgement returned HTTP ${response.status}.`, true);
    } catch (error) {
      if (error instanceof PublisherError && error.stopBatch) throw error;
    }
  }
  throw new PublisherError('Feedback acknowledgement did not complete.');
}

/** Publish a small leased batch; a failed create is never retried in this run. */
export async function publishFeedback({ baseUrl, oidcToken, githubToken, repository, fetchImpl = fetch }) {
  requireConfiguration({ baseUrl, oidcToken, githubToken, repository });
  // GitHub's OIDC token is short-lived. Leave time for acknowledgements and
  // stop safely rather than spending the whole workflow timeout on a scan.
  const deadline = Date.now() + 3 * 60_000;
  const performFetch = fetchImpl;
  fetchImpl = (url, options) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new PublisherError('Feedback batch exceeded its time budget.', true);
    return performFetch(url, {
      ...options,
      signal: AbortSignal.any([options.signal, AbortSignal.timeout(remaining)]),
    });
  };
  baseUrl = BASE_URL;
  const workerHeaders = { Authorization: `Bearer ${oidcToken}`, 'Content-Type': 'application/json' };
  const ghHeaders = githubHeaders(githubToken);
  const claim = await request(fetchImpl, `${baseUrl}/api/feedback-publisher/claim`, {
    method: 'POST', headers: workerHeaders, body: '{}',
  });
  const items = validateItems(await responseJson(claim, 'Feedback service'));
  const result = { claimed: items.length, published: 0, reconciled: 0, failed: 0 };
  let lastCreateAt = 0;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    try {
      let issue = await findPublishedIssue(item, ghHeaders, fetchImpl);
      const reconciled = Boolean(issue);
      if (!issue) {
        await pause(Math.max(0, 1_000 - (Date.now() - lastCreateAt)));
        lastCreateAt = Date.now();
        // If the response is lost, the lease expires and a later run reconciles
        // the marker. Retrying this POST could create an unwanted second issue.
        const response = await request(fetchImpl, `https://api.github.com/repos/${REPOSITORY}/issues`, {
          method: 'POST', headers: ghHeaders, body: JSON.stringify({ title: item.title, body: item.body }),
        });
        issue = canonicalIssue(await responseJson(response, 'GitHub'));
      }
      await acknowledge(item, issue, baseUrl, workerHeaders, fetchImpl);
      result[reconciled ? 'reconciled' : 'published'] += 1;
    } catch (error) {
      result.failed += 1;
      if (error instanceof PublisherError && error.stopBatch) {
        result.failed += items.length - index - 1;
        break;
      }
    }
  }
  return result;
}

async function obtainOidcToken(env, fetchImpl = fetch) {
  if (env.FEEDBACK_AUDIENCE !== AUDIENCE || !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN || !env.ACTIONS_ID_TOKEN_REQUEST_URL) {
    throw new PublisherError('GitHub OIDC environment is unavailable.');
  }
  const url = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  if (url.protocol !== 'https:' || url.username || url.password) throw new PublisherError('Invalid GitHub OIDC service URL.');
  url.searchParams.set('audience', AUDIENCE);
  const response = await request(fetchImpl, url.href, {
    headers: { Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`, Accept: 'application/json' },
  });
  const data = await responseJson(response, 'GitHub OIDC');
  if (typeof data?.value !== 'string' || !data.value || /[\r\n]/.test(data.value)) {
    throw new PublisherError('GitHub OIDC did not return a token.');
  }
  return data.value;
}

async function main() {
  try {
    const oidcToken = await obtainOidcToken(process.env);
    const result = await publishFeedback({
      baseUrl: process.env.FEEDBACK_BASE_URL,
      repository: process.env.FEEDBACK_REPOSITORY,
      githubToken: process.env.GITHUB_TOKEN,
      oidcToken,
    });
    // Only aggregate counts enter public Actions logs.
    console.log(`Feedback batch: claimed=${result.claimed}, published=${result.published}, reconciled=${result.reconciled}, failed=${result.failed}.`);
    if (result.failed) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof PublisherError ? error.message : 'Feedback publication did not complete.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
