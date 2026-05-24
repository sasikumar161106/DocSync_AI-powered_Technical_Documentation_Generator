# 🤖 DocSync: Autonomous AI-Powered Technical Documentation Agent

DocSync is an autonomous AI agent designed to revolutionize technical documentation by integrating directly into development workflows. It automatically analyzes code changes in GitHub Pull Requests, generates comprehensive technical documentation, and injects it where developers need it most — directly as PR comments.

Built with a modern **React** frontend and a powerful **Node.js/Express** backend, DocSync leverages **Google's Gemini 2.5 Flash** to provide intelligent, contextual documentation. This eliminates the manual documentation bottleneck, allowing development teams to maintain up-to-date and accurate project documentation with minimal effort.

---

## ✨ Features

### 1. 🚀 Autonomous Pull Request Documentation

The flagship feature — DocSync acts as an **automated technical writer** that wakes up every time code changes.

-   **Webhook Listener** — Listens for GitHub webhooks. When a developer opens or updates a Pull Request, the agent triggers automatically.
-   **Intelligent Diff Analysis** — Fetches the raw code changes (diff) from the PR using the GitHub API.
-   **Gemini Processing** — Sends the diff to Google's Gemini 2.5 Flash with a structured prompt, analyzing files changed, new additions, potential concerns, and documentation impact.
-   **Automated PR Comments** — Posts a concise, bulleted Markdown summary directly on the Pull Request as a comment.

### 2. 📊 Webhook Activity Dashboard

A real-time monitoring panel built into the UI.

-   **Live Stats Cards** — Total events, success rate, average processing duration, and total docs generated.
-   **Event Feed** — Chronological log of every webhook event with color-coded status indicators (✅ success, ❌ failed, 🔄 processing, 👁 ignored).
-   **Auto-Refresh** — Dashboard refreshes every 10 seconds with a live/paused toggle.
-   **Direct Links** — Click through to view the generated comment on GitHub.

### 3. 📚 Documentation History

Browse and review all past AI-generated documentation.

-   **Expandable Accordion** — Click any entry to reveal the full Markdown documentation inline.
-   **PR Metadata** — Shows repository, PR number, title, author, and timestamp for each entry.
-   **GitHub Links** — Jump directly to the comment on GitHub.

### 4. 📁 Project-Level Documentation Generation

Generate comprehensive overviews for entire repositories.

-   **Repository Dashboard** — View and select your GitHub repositories from a modern UI.
-   **Smart Filtering** — Automatically excludes `node_modules`, `dist`, lockfiles, images, and hidden files.
-   **README Compilation** — Generates a project-wide `DOCSYNC.md` documenting structure, components, and setup.
-   **One-Click Commit** — Push the generated file directly back to GitHub.

### 5. 🧪 Code Snippet Playground

A flexible testing ground for on-the-fly documentation.

-   **Instant Analysis** — Paste code snippets and get structured Markdown documentation instantly.
-   **Contextual Formatting** — Provide optional filename and context strings for tailored output.
-   **One-Click Copy** — Copy the raw Markdown to your clipboard.

### 6. 🔒 Security & Reliability

Production-grade protections built into the webhook pipeline.

-   **HMAC-SHA256 Signature Verification** — Validates the `X-Hub-Signature-256` header to ensure only GitHub can trigger your endpoint. Activated by setting `WEBHOOK_SECRET` in `.env`.
-   **Rate Limiting** — 30 requests per minute per IP to prevent abuse.
-   **Graceful Error Handling** — All failures are logged with context and duration for easy debugging.

---

## 🏗️ Project Structure

The project is structured into a React frontend and an Express.js backend, communicating via a REST API.

```
DocSync_AI-powered_Technical_Documentation_Generator/
├── .env                   # Environment variables (API keys, secrets)
├── .gitignore             # Specifies intentionally untracked files to ignore
├── index.html             # Main HTML entry point for the React application
├── LICENSE.md             # Project's MIT License
├── metadata.json          # Project metadata, including name and AI capabilities
├── package.json           # Defines project dependencies and scripts
├── server.ts              # Backend: Express.js server, API routes, and webhook system
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite build configuration for the frontend
└── src/                   # Frontend source (React)
    ├── App.tsx            # Main application component, handles routing and sidebar navigation
    ├── index.css          # Tailwind CSS import and custom styles
    ├── main.tsx           # React application entry point
    ├── types.ts           # TypeScript type definitions for frontend data structures
    └── components/        # Reusable React components
        ├── Dashboard.tsx        # UI for project-level documentation generation and repository analysis
        ├── Playground.tsx       # UI for manual code snippet documentation
        ├── Settings.tsx         # In-app guide for setup and integration, especially for GitHub tokens
        ├── WebhookDashboard.tsx # UI for live monitoring of webhook activity and statistics
        └── DocHistory.tsx       # UI for browsing and reviewing past AI-generated documentation
```

### Backend Architecture (`server.ts`)

The `server.ts` file orchestrates the backend logic, including API endpoint handling, GitHub integration, AI model interaction, and webhook processing. It also manages in-memory stores for activity logs and history, along with security features like rate limiting and signature verification.

| Endpoint | Method | Description |
| :----------------------- | :----- | :------------------------------------------------------------------------------------------------- |
| `/api/docs/generate`     | `POST` | Generates documentation for a provided code snippet using the Gemini AI model.                       |
| `/api/docs/generate-repo`| `POST` | Analyzes a specified GitHub repository (filtering common files) and generates project-level documentation. |
| `/api/github/user`       | `GET`  | Fetches authenticated GitHub user information.                                                     |
| `/api/github/repos`      | `GET`  | Lists the authenticated user's GitHub repositories.                                                |
| `/api/github/commit`     | `POST` | Commits generated documentation (e.g., `DOCSYNC.md`) to a specified GitHub repository.             |
| `/api/github/webhook`    | `POST` | **GitHub webhook receiver** for autonomous documentation generation on Pull Request events.          |
| `/api/github/webhook/health` | `GET`  | Provides a health check and configuration status for the webhook endpoint.                         |
| `/api/webhook/activity`  | `GET`  | Retrieves a log of recent webhook events for the Webhook Activity Dashboard.                       |
| `/api/webhook/history`   | `GET`  | Retrieves a history of all AI-generated documentation entries for the Doc History viewer.          |
| `/api/webhook/stats`     | `GET`  | Provides aggregated statistics on webhook events (total, successful, failed, avg. duration).       |

---

## 🚀 Setup & Usage

### Prerequisites

-   **Node.js** v18 or higher (includes `npm`)
-   **Git** installed and configured
-   **Google Gemini API Key** — Obtainable from [Google AI Studio](https://ai.google.dev/)
-   **GitHub Personal Access Token** — with `repo` scope (full control of private repositories)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/sasikumar161106/DocSync_AI-powered_Technical_Documentation_Generator.git
    cd DocSync_AI-powered_Technical_Documentation_Generator
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Configuration

Create a `.env` file in the project root directory and populate it with your API keys and secrets:

```ini
# Required
GEMINI_API_KEY="YOUR_GOOGLE_GEMINI_API_KEY"
GITHUB_TOKEN="ghp_your_github_personal_access_token"

# Optional — enables webhook signature verification for enhanced security
WEBHOOK_SECRET="a_strong_random_secret_string"
```

-   **`GEMINI_API_KEY`**: Your API key from [Google AI Studio](https://ai.google.dev/).
-   **`GITHUB_TOKEN`**: Generate a classic Personal Access Token from GitHub's settings (`Settings` → `Developer Settings` → `Personal Access Tokens` → `Tokens (classic)`). Ensure it has the `repo` scope.
-   **`WEBHOOK_SECRET`**: A secret string of your choice. If set, you must use the *exact same string* when configuring your GitHub webhook for HMAC-SHA256 signature verification.

### Running Locally

To start the DocSync application in development mode:

```bash
npm run dev
```

The application will typically be accessible at `http://localhost:3000` in your web browser.

### Setting Up Autonomous Webhooks

To enable DocSync's flagship feature – autonomous documentation generation on Pull Requests – you need to expose your local server to GitHub and configure a webhook.

1.  **Expose your local server** using a tool like [ngrok](https://ngrok.com/):
    ```bash
    ngrok http 3000
    ```
    `ngrok` will provide a public URL (e.g., `https://<your-ngrok-id>.ngrok-free.app`).

2.  **Configure the webhook on your GitHub repository:**
    -   Navigate to your target GitHub repository (`Settings` → `Webhooks` → `Add webhook`).
    -   **Payload URL**: Enter the public URL provided by `ngrok`, followed by `/api/github/webhook` (e.g., `https://<your-ngrok-id>.ngrok-free.app/api/github/webhook`).
    -   **Content type**: Select `application/json`.
    -   **Secret**: (Optional but Recommended) Enter the exact value you set for `WEBHOOK_SECRET` in your `.env` file.
    -   **Which events would you like to trigger this webhook?**: Select **only "Pull requests"**.
    -   Click "Add webhook".

3.  **Test it** — Create a new branch in your configured repository, push some code changes, and open a Pull Request. DocSync should automatically post an analysis comment on your PR.

### Deploying Live (Recommended)

For continuous operation without `ngrok` or a local machine, deploy DocSync to a cloud hosting platform like **Render.com**.

1.  **Create a Render account** and connect your GitHub repository.
2.  **Create a new Web Service** on Render.
3.  **Select your DocSync repository**.
4.  Configure the build settings:
    -   **Root Directory**: `DocSync_AI-powered_Technical_Documentation_Generator` (if your code is in a sub-folder).
    -   **Runtime**: `Node`.
    -   **Build Command**: `npm install && npm run build`.
    -   **Start Command**: `node dist/server.cjs`.
5.  Add your **Environment Variables** under the "Environment" section:
    -   `GEMINI_API_KEY = YOUR_GOOGLE_GEMINI_API_KEY`
    -   `GITHUB_TOKEN = ghp_your_github_personal_access_token`
    -   `WEBHOOK_SECRET = a_strong_random_secret_string`
6.  Click **Create Web Service**.
7.  Once deployed, Render will provide a permanent live URL (e.g., `https://docsync-agent.onrender.com`). Update your GitHub Webhook Payload URL to this new live URL.

### Using the Dashboard

Once DocSync is running, navigate through the sidebar to access its various functionalities:

| Tab                       | Functionality                                                               |
| :------------------------ | :-------------------------------------------------------------------------- |
| **Dashboard**             | Select a GitHub repository, analyze its structure, generate project-level documentation, and commit `DOCSYNC.md` back to the repo. |
| **Test Playground**       | Paste arbitrary code snippets, generate instant Markdown documentation, and copy it to your clipboard. |
| **Webhook Activity**      | Monitor all incoming GitHub webhook events in real-time with live statistics and status updates. |
| **Doc History**           | Browse and review a chronological log of all past AI-generated documentation comments from Pull Requests. |
| **Setup & Integration**   | An in-app guide detailing the steps for GitHub token configuration and webhook setup. |

---

## 🛠️ Technologies Used

| Layer            | Stack                                      |
| :--------------- | :----------------------------------------- |
| **Frontend**     | React, TypeScript, Tailwind CSS, Vite      |
| **Backend**      | Node.js, Express.js, TypeScript            |
| **AI Model**     | Google Gemini 2.5 Flash (`@google/genai`)  |
| **Security**     | HMAC-SHA256 signature verification, rate limiting |
| **Markdown**     | `react-markdown`                           |
| **Icons**        | `lucide-react`                             |
| **Animations**   | `motion` (Framer Motion)                   |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE.md).