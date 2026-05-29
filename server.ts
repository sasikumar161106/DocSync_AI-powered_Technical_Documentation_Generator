import dotenv from "dotenv";
import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// ========================================================================================
// 📦 IN-MEMORY STORES — Webhook Activity Log, Doc History & Rate Limiting
// ========================================================================================

interface WebhookEvent {
  id: string;
  timestamp: string;
  eventType: string;
  action: string;
  repoFullName: string;
  prNumber: number | null;
  prTitle: string;
  prAuthor: string;
  status: 'processing' | 'success' | 'failed' | 'ignored';
  message: string;
  commentUrl?: string;
  durationMs?: number;
}

interface DocHistoryEntry {
  id: string;
  timestamp: string;
  repoFullName: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  documentation: string;
  commentUrl: string;
}

const webhookActivityLog: WebhookEvent[] = [];
const docHistory: DocHistoryEntry[] = [];
const MAX_LOG_SIZE = 100;
const MAX_HISTORY_SIZE = 50;

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // max 30 webhook calls per minute

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count++;
  return true;
}

// Verify GitHub webhook signature (HMAC-SHA256)
function verifyWebhookSignature(payload: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const digest = `sha256=${hmac.digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}


// Helper to get connected GenAI client
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  return new GoogleGenAI({ apiKey });
}

// API Routes
app.post("/api/docs/generate", async (req, res) => {
  try {
    const { code, filename, context } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: "Code content is required" });
    }

    const ai = getGenAI();
    
    const prompt = `You are an expert technical documentation generator.
Your task is to analyze the following code snippet and generate clear, comprehensive Markdown documentation for it.

File Name (optional): ${filename || 'Unknown'}
Context (optional): ${context || 'None provided'}

Guidelines:
1. Provide a brief overview of what this code does.
2. Document all functions, inputs, outputs, and side effects.
3. Include a usage example if applicable.
4. Keep the documentation professional, structured, and easy to read.
5. Use markdown formatting exclusively.
6. Do not wrap the response with \`\`\`markdown, just return raw markdown.

Source Code:
\`\`\`
${code}
\`\`\`
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const markdownDoc = response.text;
    res.json({ document: markdownDoc });
  } catch (error: any) {
    console.error("Documentation generation error:", error);
    res.status(500).json({ 
      error: error.message || "Failed to generate documentation",
      details: error.statusText
    });
  }
});

app.get("/api/github/user", async (req, res) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.status(400).json({ error: "GITHUB_TOKEN is not set in environment" });

    const headers = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "DocSync-App"
    };

    const userRes = await fetch("https://api.github.com/user", { headers });
    if (!userRes.ok) throw new Error("Failed to fetch user");
    const user = await userRes.json();
    res.json({ login: user.login, avatar_url: user.avatar_url, name: user.name, email: user.email });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/github/repos", async (req, res) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.status(400).json({ error: "GITHUB_TOKEN is not set in environment" });

    const headers = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "DocSync-App"
    };

    const reposRes = await fetch("https://api.github.com/user/repos?sort=updated&per_page=20", { headers });
    if (!reposRes.ok) throw new Error("Failed to fetch repos: " + await reposRes.text());
    const repos = await reposRes.json();
    res.json(repos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/docs/generate-repo", async (req, res) => {
  try {
    const { repoFullName } = req.body;
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.status(400).json({ error: "GITHUB_TOKEN is not set in environment" });

    const headers = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "DocSync-App"
    };

    // 1. Get default branch
    const repoRes = await fetch(`https://api.github.com/repos/${repoFullName}`, { headers });
    if (!repoRes.ok) throw new Error("Failed to fetch repo info");
    const repoInfo = await repoRes.json();
    const branch = repoInfo.default_branch;

    // 2. Get git tree recursively
    const treeRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/trees/${branch}?recursive=1`, { headers });
    if (!treeRes.ok) throw new Error("Failed to fetch repo tree");
    const treeData = await treeRes.json();
    
    if (!treeData.tree || treeData.tree.length === 0) {
      return res.status(400).json({ error: "Repository is empty" });
    }

    // Filter out node_modules, dist, build, pictures, lockfiles, etc.
    const filePaths = treeData.tree
      .filter((file: any) => file.type === 'blob')
      .map((file: any) => file.path)
      .filter((path: string) => !path.match(/(node_modules|dist|build|\.(jpg|png|gif|svg|ico|pdf|zip|mp4)|package-lock\.json|yarn\.lock)/i))
      .filter((path: string) => !path.includes('/.')) // exclude hidden files/folders
      .slice(0, 15); // Limit to top 15 files to avoid massive payloads for this demo

    let allContents = "";
    for (const path of filePaths) {
      const fileRes = await fetch(`https://raw.githubusercontent.com/${repoFullName}/${branch}/${path}`, { headers });
      if (fileRes.ok) {
         const content = await fileRes.text();
         allContents += `\n\n--- File: ${path} ---\n\`\`\`\n${content}\n\`\`\`\n`;
      }
    }

    if (!allContents) {
       return res.status(400).json({ error: "No suitable code files found to analyze" });
    }

    const ai = getGenAI();
    const prompt = `You are an expert technical documentation generator.
Your task is to analyze the following repository files and generate a comprehensive \`README.md\` style documentation for the entire project.

Repository: ${repoFullName}

Guidelines:
1. Provide a project overview.
2. Document the structure and main components/features based on the files.
3. Suggest usage or setup instructions if apparent.
4. Keep the documentation professional, structured, and easy to read.
5. Use markdown formatting exclusively.
6. Do not wrap the response with \`\`\`markdown, just return raw markdown.

Source Files Analyzed:
${allContents}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    res.json({ document: response.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/github/commit", async (req, res) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.status(400).json({ error: "GITHUB_TOKEN is not set in environment" });
    const { repo, path, content, message } = req.body;

    if (!repo || !path || !content) {
      return res.status(400).json({ error: "Missing required fields (repo, path, content)" });
    }

    const headers = {
       "Authorization": `Bearer ${token}`,
       "Accept": "application/vnd.github.v3+json",
       "User-Agent": "DocSync-App",
       "Content-Type": "application/json"
    };

    // 1. Get file SHA if it exists so we can update it
    let sha = undefined;
    const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, { headers });
    if (getRes.ok) {
      const getJson = await getRes.json();
      sha = getJson.sha;
    }

    // 2. Base64 encode content
    const b64Content = Buffer.from(content).toString('base64');

    // 3. PUT request
    const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: message || `Update docs for ${path}`,
        content: b64Content,
        sha
      })
    });

    if (!putRes.ok) {
       throw new Error("Failed to commit file: " + await putRes.text());
    }
    
    res.json({ success: true, url: (await putRes.json()).content.html_url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================================================================
// 🤖 AUTONOMOUS WEBHOOK SYSTEM — DocSync Autopilot
// Signature verification · Rate limiting · Activity logging · Doc history
// ========================================================================================

// We need raw body for signature verification, so we add a raw body capture middleware
app.post('/api/github/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const startTime = Date.now();
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const githubEvent = req.headers['x-github-event'] as string || 'unknown';
  const deliveryId = req.headers['x-github-delivery'] as string || crypto.randomUUID();

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    console.error(`⛔ Rate limit exceeded for ${clientIp}`);
    webhookActivityLog.unshift({
      id: deliveryId,
      timestamp: new Date().toISOString(),
      eventType: githubEvent,
      action: payload?.action || 'N/A',
      repoFullName: payload?.repository?.full_name || 'unknown',
      prNumber: null,
      prTitle: '',
      prAuthor: '',
      status: 'failed',
      message: 'Rate limit exceeded',
      durationMs: Date.now() - startTime
    });
    if (webhookActivityLog.length > MAX_LOG_SIZE) webhookActivityLog.pop();
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // ── Signature Verification (optional — only if WEBHOOK_SECRET is set) ─────
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error('⛔ Invalid webhook signature — request rejected');
      webhookActivityLog.unshift({
        id: deliveryId,
        timestamp: new Date().toISOString(),
        eventType: githubEvent,
        action: payload?.action || 'N/A',
        repoFullName: payload?.repository?.full_name || 'unknown',
        prNumber: null,
        prTitle: '',
        prAuthor: '',
        status: 'failed',
        message: 'Invalid webhook signature',
        durationMs: Date.now() - startTime
      });
      if (webhookActivityLog.length > MAX_LOG_SIZE) webhookActivityLog.pop();
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  // 1. GitHub expects a fast 2xx response — acknowledge receipt immediately
  res.status(202).send('Webhook received and processing');

  // 2. Only proceed for Pull Request opened or synchronized (new commits pushed)
  if (
    githubEvent === 'pull_request' &&
    (payload.action === 'opened' || payload.action === 'synchronize')
  ) {
    const prNumber: number = payload.pull_request.number;
    const diffUrl: string = payload.pull_request.diff_url;
    const repoFullName: string = payload.repository.full_name;
    const prTitle: string = payload.pull_request.title;
    const prAuthor: string = payload.pull_request.user?.login || 'unknown';

    // Log as processing
    const activityEntry: WebhookEvent = {
      id: deliveryId,
      timestamp: new Date().toISOString(),
      eventType: githubEvent,
      action: payload.action,
      repoFullName,
      prNumber,
      prTitle,
      prAuthor,
      status: 'processing',
      message: `Processing PR #${prNumber} "${prTitle}"`
    };
    webhookActivityLog.unshift(activityEntry);
    if (webhookActivityLog.length > MAX_LOG_SIZE) webhookActivityLog.pop();

    console.log(`\n🚨 Autonomous trigger! PR #${prNumber} "${prTitle}" by @${prAuthor} in ${repoFullName}`);

    try {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        activityEntry.status = 'failed';
        activityEntry.message = 'GITHUB_TOKEN is not set';
        activityEntry.durationMs = Date.now() - startTime;
        console.error('❌ GITHUB_TOKEN is not set — cannot process webhook');
        return;
      }

      // ── Fetch the code diff ───────────────────────────────────────────────
      const diffResponse = await fetch(diffUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3.diff',
          'User-Agent': 'DocSync-App'
        }
      });

      if (!diffResponse.ok) {
        throw new Error(`Failed to fetch diff: ${diffResponse.status} ${diffResponse.statusText}`);
      }

      const diffText = await diffResponse.text();
      console.log(`✅ Fetched diff for PR #${prNumber} (${diffText.length} chars)`);

      const maxDiffLength = 30000;
      const truncatedDiff = diffText.length > maxDiffLength
        ? diffText.substring(0, maxDiffLength) + '\n\n... [diff truncated for size]'
        : diffText;

      // ── Prompt Gemini with the diff ───────────────────────────────────────
      const ai = getGenAI();

      const prompt = `You are an expert technical documentation agent named DocSync.
Review the following code diff from Pull Request #${prNumber} titled "${prTitle}" in the repository "${repoFullName}".

Write a concise, well-structured Markdown summary of the changes suitable for a PR comment.

Include:
1. **High-Level Summary** — A 1-2 sentence overview of the purpose of these changes.
2. **Files Changed** — For each modified file, briefly explain what changed and why it matters.
3. **New Additions** — Any new functions, endpoints, classes, dependencies, or configurations added.
4. **Potential Concerns** — Flag any potential issues, missing tests, or areas that may need review.
5. **Documentation Impact** — Note if existing documentation should be updated based on these changes.

Keep the tone professional and helpful. Use bullet points for clarity.

Code Diff:
\`\`\`diff
${truncatedDiff}
\`\`\`
`;

      const geminiResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });

      const aiDocumentation = geminiResponse.text;
      if (!aiDocumentation) {
        throw new Error('Gemini returned an empty response');
      }

      console.log(`✅ Gemini analysis complete for PR #${prNumber}`);

      // ── Post the comment back to the Pull Request ─────────────────────────
      const commentsUrl = `https://api.github.com/repos/${repoFullName}/issues/${prNumber}/comments`;

      const commentBody = `## 🤖 DocSync Automated Analysis

> _This analysis was automatically generated by **DocSync** when this PR was ${payload.action === 'opened' ? 'opened' : 'updated'}._

${aiDocumentation}

---
<sub>🔗 Powered by <b>DocSync AI</b> · Gemini 2.5 Flash · <a href="https://github.com/${repoFullName}">Repository</a></sub>`;

      const commentResponse = await fetch(commentsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'DocSync-App'
        },
        body: JSON.stringify({ body: commentBody })
      });

      if (commentResponse.ok) {
        const commentData = await commentResponse.json() as any;
        const commentUrl = commentData.html_url;
        console.log(`✅ Posted documentation to PR #${prNumber}: ${commentUrl}`);

        // Update activity log
        activityEntry.status = 'success';
        activityEntry.message = `Documentation posted to PR #${prNumber}`;
        activityEntry.commentUrl = commentUrl;
        activityEntry.durationMs = Date.now() - startTime;

        // Save to documentation history
        docHistory.unshift({
          id: deliveryId,
          timestamp: new Date().toISOString(),
          repoFullName,
          prNumber,
          prTitle,
          prAuthor,
          documentation: aiDocumentation,
          commentUrl
        });
        if (docHistory.length > MAX_HISTORY_SIZE) docHistory.pop();
      } else {
        const errText = await commentResponse.text();
        activityEntry.status = 'failed';
        activityEntry.message = `Failed to post comment: ${commentResponse.status}`;
        activityEntry.durationMs = Date.now() - startTime;
        console.error(`❌ Failed to post comment to PR #${prNumber}: ${commentResponse.status} ${errText}`);
      }
    } catch (error: any) {
      activityEntry.status = 'failed';
      activityEntry.message = error.message || 'Unknown error';
      activityEntry.durationMs = Date.now() - startTime;
      console.error(`❌ Error processing webhook for PR #${prNumber}:`, error);
    }
  } else {
    // Log ignored events
    webhookActivityLog.unshift({
      id: deliveryId,
      timestamp: new Date().toISOString(),
      eventType: githubEvent,
      action: payload?.action || 'N/A',
      repoFullName: payload?.repository?.full_name || 'unknown',
      prNumber: null,
      prTitle: '',
      prAuthor: '',
      status: 'ignored',
      message: `Ignored: ${githubEvent} / ${payload?.action || 'N/A'}`,
      durationMs: Date.now() - startTime
    });
    if (webhookActivityLog.length > MAX_LOG_SIZE) webhookActivityLog.pop();
    console.log(`ℹ️  Ignored webhook event: ${githubEvent} — action: ${payload?.action || 'N/A'}`);
  }
});

// ========================================================================================
// 📊 DASHBOARD API ENDPOINTS — Activity, History & Stats
// ========================================================================================

// Get webhook activity log (recent events)
app.get('/api/webhook/activity', (_req, res) => {
  res.json(webhookActivityLog);
});

// Get documentation history (past generated docs)
app.get('/api/webhook/history', (_req, res) => {
  res.json(docHistory);
});

// Get aggregated stats
app.get('/api/webhook/stats', (_req, res) => {
  const total = webhookActivityLog.length;
  const successful = webhookActivityLog.filter(e => e.status === 'success').length;
  const failed = webhookActivityLog.filter(e => e.status === 'failed').length;
  const ignored = webhookActivityLog.filter(e => e.status === 'ignored').length;
  const processing = webhookActivityLog.filter(e => e.status === 'processing').length;
  const avgDuration = webhookActivityLog
    .filter(e => e.durationMs)
    .reduce((sum, e) => sum + (e.durationMs || 0), 0) / (successful + failed || 1);

  res.json({
    total,
    successful,
    failed,
    ignored,
    processing,
    avgDurationMs: Math.round(avgDuration),
    docsGenerated: docHistory.length,
    lastEvent: webhookActivityLog[0]?.timestamp || null
  });
});

// Health-check endpoint for webhook verification
app.get('/api/github/webhook/health', (_req, res) => {
  res.json({
    status: 'active',
    service: 'DocSync Autonomous Agent',
    timestamp: new Date().toISOString(),
    webhookEndpoint: '/api/github/webhook',
    signatureVerification: !!process.env.WEBHOOK_SECRET,
    rateLimiting: { windowMs: RATE_LIMIT_WINDOW_MS, maxRequests: RATE_LIMIT_MAX }
  });
});

// ========================================================================================
// 🤖 AGENTIC AUTO-UPDATE SYSTEM — Autonomous Commit Tracking & Doc Regeneration
// ========================================================================================

interface AutoUpdateLogEntry {
  id: string;
  timestamp: string;
  repoFullName: string;
  type: 'check' | 'detected' | 'generating' | 'committed' | 'skipped' | 'error';
  message: string;
  sha?: string;
  commitUrl?: string;
}

const autoUpdateLog: AutoUpdateLogEntry[] = [];
const MAX_AUTO_LOG_SIZE = 200;

function addAutoLog(entry: Omit<AutoUpdateLogEntry, 'id' | 'timestamp'>) {
  autoUpdateLog.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry
  });
  if (autoUpdateLog.length > MAX_AUTO_LOG_SIZE) autoUpdateLog.pop();
}

// Get latest commit SHA for a repo
app.get('/api/github/repo-latest-sha', async (req, res) => {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.status(400).json({ error: 'GITHUB_TOKEN is not set' });

    const repo = req.query.repo as string;
    if (!repo) return res.status(400).json({ error: 'repo query parameter is required' });

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'DocSync-App'
    };

    // Get default branch
    const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (!repoRes.ok) throw new Error('Failed to fetch repo info');
    const repoInfo = await repoRes.json();
    const branch = repoInfo.default_branch;

    // Get latest commit on default branch
    const commitsRes = await fetch(`https://api.github.com/repos/${repo}/commits/${branch}`, { headers });
    if (!commitsRes.ok) throw new Error('Failed to fetch latest commit');
    const commitData = await commitsRes.json();

    res.json({
      sha: commitData.sha,
      message: commitData.commit?.message || '',
      author: commitData.commit?.author?.name || 'unknown',
      date: commitData.commit?.author?.date || '',
      branch
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Agentic auto-update: detect new commits, regenerate docs, and push
app.post('/api/docs/auto-update', async (req, res) => {
  const { repoFullName, lastKnownSha } = req.body;

  if (!repoFullName) return res.status(400).json({ error: 'repoFullName is required' });

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(400).json({ error: 'GITHUB_TOKEN is not set' });

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'DocSync-App'
  };

  try {
    // Step 1: Check latest commit
    addAutoLog({ repoFullName, type: 'check', message: `Checking for new commits on ${repoFullName}...` });

    const repoRes = await fetch(`https://api.github.com/repos/${repoFullName}`, { headers });
    if (!repoRes.ok) throw new Error('Failed to fetch repo info');
    const repoInfo = await repoRes.json();
    const branch = repoInfo.default_branch;

    const commitsRes = await fetch(`https://api.github.com/repos/${repoFullName}/commits/${branch}`, { headers });
    if (!commitsRes.ok) throw new Error('Failed to fetch latest commit');
    const commitData = await commitsRes.json();
    const latestSha = commitData.sha;
    const commitMessage = commitData.commit?.message || '';
    const commitAuthor = commitData.commit?.author?.name || 'unknown';

    // Step 2: Compare SHAs
    if (lastKnownSha && latestSha === lastKnownSha) {
      addAutoLog({ repoFullName, type: 'skipped', message: `No new commits detected. HEAD is still ${latestSha.substring(0, 7)}.`, sha: latestSha });
      return res.json({ updated: false, sha: latestSha, message: 'No new commits' });
    }

    // New commit detected!
    addAutoLog({
      repoFullName,
      type: 'detected',
      message: `🚨 New commit detected! ${latestSha.substring(0, 7)} by ${commitAuthor}: "${commitMessage}"`,
      sha: latestSha
    });

    console.log(`\n🚨 Auto-Update Agent: New commit ${latestSha.substring(0, 7)} on ${repoFullName}`);

    // Step 3: Fetch repository files for analysis
    addAutoLog({ repoFullName, type: 'generating', message: `Fetching repository files and generating documentation via Gemini AI...`, sha: latestSha });

    const treeRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/trees/${branch}?recursive=1`, { headers });
    if (!treeRes.ok) throw new Error('Failed to fetch repo tree');
    const treeData = await treeRes.json();

    const filePaths = treeData.tree
      .filter((file: any) => file.type === 'blob')
      .map((file: any) => file.path)
      .filter((p: string) => !p.match(/(node_modules|dist|build|\.(jpg|png|gif|svg|ico|pdf|zip|mp4)|package-lock\.json|yarn\.lock|DOCSYNC\.md)/i))
      .filter((p: string) => !p.includes('/.'))
      .slice(0, 15);

    let allContents = '';
    for (const filePath of filePaths) {
      const fileRes = await fetch(`https://raw.githubusercontent.com/${repoFullName}/${branch}/${filePath}`, { headers });
      if (fileRes.ok) {
        const content = await fileRes.text();
        allContents += `\n\n--- File: ${filePath} ---\n\`\`\`\n${content}\n\`\`\`\n`;
      }
    }

    if (!allContents) {
      addAutoLog({ repoFullName, type: 'error', message: 'No analyzable code files found in repository.', sha: latestSha });
      return res.status(400).json({ error: 'No suitable code files found' });
    }

    // Step 4: Generate documentation with Gemini
    const ai = getGenAI();
    const prompt = `You are an expert technical documentation generator named DocSync.
Your task is to analyze the following repository files and generate a comprehensive \`README.md\` style documentation for the entire project.

Repository: ${repoFullName}
Latest Commit: ${latestSha.substring(0, 7)} — "${commitMessage}" by ${commitAuthor}

Guidelines:
1. Provide a project overview.
2. Document the structure and main components/features based on the files.
3. Suggest usage or setup instructions if apparent.
4. Keep the documentation professional, structured, and easy to read.
5. Use markdown formatting exclusively.
6. Do not wrap the response with \`\`\`markdown, just return raw markdown.

Source Files Analyzed:
${allContents}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const generatedDoc = response.text;
    if (!generatedDoc) {
      addAutoLog({ repoFullName, type: 'error', message: 'Gemini returned an empty response.', sha: latestSha });
      throw new Error('Gemini returned an empty response');
    }

    // Step 5: Commit the updated documentation
    addAutoLog({ repoFullName, type: 'generating', message: `Documentation generated (${generatedDoc.length} chars). Committing to GitHub...`, sha: latestSha });

    // Get existing file SHA if it exists
    let fileSha = undefined;
    const getFileRes = await fetch(`https://api.github.com/repos/${repoFullName}/contents/DOCSYNC.md`, { headers });
    if (getFileRes.ok) {
      const fileJson = await getFileRes.json();
      fileSha = fileJson.sha;
    }

    const b64Content = Buffer.from(generatedDoc).toString('base64');
    const putRes = await fetch(`https://api.github.com/repos/${repoFullName}/contents/DOCSYNC.md`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Auto-updated technical documentation for commit ${latestSha.substring(0, 7)}`,
        content: b64Content,
        sha: fileSha
      })
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      addAutoLog({ repoFullName, type: 'error', message: `Failed to commit documentation: ${putRes.status}`, sha: latestSha });
      throw new Error('Failed to commit: ' + errText);
    }

    const putData = await putRes.json();
    const commitUrl = putData.content?.html_url || '';

    addAutoLog({
      repoFullName,
      type: 'committed',
      message: `✅ Documentation auto-updated and committed successfully!`,
      sha: latestSha,
      commitUrl
    });

    console.log(`✅ Auto-Update Agent: Committed updated DOCSYNC.md for ${repoFullName}`);

    res.json({ updated: true, sha: latestSha, commitUrl, message: 'Documentation auto-updated' });
  } catch (err: any) {
    addAutoLog({ repoFullName, type: 'error', message: `❌ Error: ${err.message}`, sha: '' });
    console.error(`❌ Auto-Update Agent error for ${repoFullName}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Get auto-update activity log
app.get('/api/auto-update/log', (req, res) => {
  const repo = req.query.repo as string;
  if (repo) {
    res.json(autoUpdateLog.filter(e => e.repoFullName === repo));
  } else {
    res.json(autoUpdateLog);
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
