import dotenv from "dotenv";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

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
      model: "gemini-2.5-flash",
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

app.get("/api/github/repo-latest-sha", async (req, res) => {
  try {
     const repoFullName = req.query.repo as string;
     const token = process.env.GITHUB_TOKEN;
     if (!token) return res.status(400).json({ error: "No token" });
     const headers = {
       "Authorization": `Bearer ${token}`,
       "Accept": "application/vnd.github.v3+json",
       "User-Agent": "DocSync-App"
     };
     const commitsRes = await fetch(`https://api.github.com/repos/${repoFullName}/commits?per_page=1`, { headers });
     if (!commitsRes.ok) throw new Error("Fetch failed");
     const commits = await commitsRes.json();
     if (commits.length > 0) {
        res.json({ sha: commits[0].sha });
     } else {
        res.json({ sha: null });
     }
  } catch(err: any) {
     res.status(500).json({ error: err.message });
  }
});

app.post("/api/docs/auto-update", async (req, res) => {
  try {
    const { repoFullName, sha } = req.body;
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.status(400).json({ error: "No token" });

    const headers = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "DocSync-App"
    };

    // 1. Get the commit diff
    const commitRes = await fetch(`https://api.github.com/repos/${repoFullName}/commits/${sha}`, { headers });
    if (!commitRes.ok) throw new Error("Failed to fetch commit");
    const commitData = await commitRes.json();
    
    // Ignore if the commit was our own doc update!
    if (commitData.commit.message.includes("Auto-updated technical documentation")) {
      return res.json({ status: "ignored_own_commit" });
    }

    const filesChanged = commitData.files || [];
    let diffs = filesChanged.map((f: any) => `File: ${f.filename}\nPatch:\n${f.patch}`).join("\n\n");
    
    if (!diffs) {
       return res.json({ status: "no_files_changed" });
    }

    // 2. Get current README.md
    let currentReadme = "";
    let readmeSha = undefined;
    const readmeRes = await fetch(`https://api.github.com/repos/${repoFullName}/readme`, { headers });
    if (readmeRes.ok) {
       const readmeData = await readmeRes.json();
       currentReadme = Buffer.from(readmeData.content, 'base64').toString('utf8');
       readmeSha = readmeData.sha;
    } else {
       currentReadme = "No existing README.md found.";
    }

    // 3. Call Gemini
    const ai = getGenAI();
    const prompt = `You are an expert technical documentation generator.
Your task is to review recent code changes and decide if the project's README.md needs an update.

Recent Code Changes (Git Diff):
${diffs.substring(0, 15000)} // truncate to prevent huge token limits if needed

Current README.md:
${currentReadme}

Instructions:
1. Analyze if the changes are significant enough to warrant an update to the documentation (e.g., new features, altered APIs, changed setup steps).
2. If NO update is needed, respond with EXACTLY the word: NO_UPDATE_NEEDED (and nothing else).
3. If an update IS needed, respond with the COMPLETE, fully-updated markdown content for the README.md. Do not wrap it in markdown codeblocks like \`\`\`markdown, just return the raw markdown text.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const result = response.text.trim();

    if (result === "NO_UPDATE_NEEDED") {
       return res.json({ status: "no_update_needed" });
    }

    // 4. Update the README on GitHub
    const b64Content = Buffer.from(result).toString('base64');
    
    const putRes = await fetch(`https://api.github.com/repos/${repoFullName}/contents/README.md`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Auto-updated technical documentation for commit ${sha.substring(0, 7)}`,
        content: b64Content,
        sha: readmeSha
      })
    });

    if (!putRes.ok) {
       throw new Error("Failed to commit README.md: " + await putRes.text());
    }

    res.json({ status: "updated", url: (await putRes.json()).content.html_url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/docs/generate-repo", async (req, res) => {
  try {
    const { repoFullName, customInstruction } = req.body;
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
    let prompt = `You are an expert technical documentation generator.
Your task is to analyze the following repository files and generate a comprehensive \`README.md\` style documentation for the entire project.

Repository: ${repoFullName}

Guidelines:
1. Provide a project overview.
2. Document the structure and main components/features based on the files.
3. Suggest usage or setup instructions if apparent.
4. Keep the documentation professional, structured, and easy to read.
5. Use markdown formatting exclusively.
6. Do not wrap the response with \`\`\`markdown, just return raw markdown.

`;

    if (customInstruction) {
       prompt += `\nAdditional User Instructions regarding documentation generation:\n${customInstruction}\n\n`;
    }

    prompt += `Source Files Analyzed:\n${allContents}\n`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
