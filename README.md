# DocSync: AI-Powered Technical Documentation Generator


</div>

DocSync is an AI agent designed to streamline the process of technical documentation generation for developers. It offers robust integration with GitHub, allowing users to analyze entire repositories, generate comprehensive `README.md`-style documentation, and automatically commit these updates back to their projects. Additionally, it provides a flexible playground for generating documentation for individual code snippets. Built as an AI Studio app, DocSync features a modern React frontend and a powerful Node.js backend powered by Google's Gemini API.

## Project Overview

DocSync aims to simplify developer workflows by automating the creation and maintenance of project documentation. By leveraging advanced AI models, it can understand code context, identify key components, and produce clear, structured Markdown documentation. This tool is particularly useful for:

*   **Quickly generating initial documentation** for new projects or modules.
*   **Maintaining up-to-date documentation** by integrating with existing codebases.
*   **Exploring code snippets** with instant AI-generated explanations and usage guidelines.

## Features

*   **AI-Powered Documentation Generation:** Utilizes Google's Gemini API to generate high-quality, comprehensive Markdown documentation for code.
*   **GitHub Repository Integration (Dashboard):**
    *   Fetches and displays a list of your GitHub repositories.
    *   Analyzes selected repositories (filtering out non-code files and limiting to key files for efficiency).
    *   Generates a project-level `README.md` (saved as `DOCSYNC.md`) based on the repository's codebase.
    *   Enables direct committing of generated documentation back to the specified GitHub repository.
*   **Code Snippet Playground:**
    *   Provides an interface to paste individual code snippets.
    *   Allows specifying an optional filename and context for more accurate documentation.
    *   Generates and displays Markdown documentation instantly.
    *   Includes a copy-to-clipboard function for easy transfer.
*   **Intuitive User Interface:** A responsive and modern React frontend with clear navigation (Dashboard, Test Playground, Setup & Integration).
*   **Local Setup Guide:** Comprehensive, step-by-step instructions within the application for configuring GitHub Personal Access Tokens and other prerequisites.

## Project Structure

The project is structured into a React frontend and an Express.js backend, bundled and served using Vite.

```
AI_doc_Generator_for_developers/
├── .env.local             # Environment variables for local development (e.g., API keys)
├── index.html             # Main HTML entry point for the React application
├── metadata.json          # Project metadata for AI Studio app definition
├── package.json           # Defines project dependencies and scripts
├── server.ts              # Backend entry point and API routes (Express.js)
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite build tool configuration
└── src/                   # Frontend source code (React)
    ├── App.tsx            # Main React component, handles routing and layout
    ├── index.css          # Tailwind CSS import
    ├── main.tsx           # React application entry point
    ├── types.ts           # TypeScript type definitions
    └── components/        # Reusable React components
        ├── Dashboard.tsx  # Component for GitHub repository analysis and doc generation
        ├── Playground.tsx # Component for manual code snippet documentation
        └── Settings.tsx   # Component providing setup and integration instructions
```

### Key Components

*   **`server.ts`**: The heart of the backend, implemented with Express.js and TypeScript. It handles:
    *   **Environment Variable Loading**: Uses `dotenv` for `GEMINI_API_KEY` and `GITHUB_TOKEN`.
    *   **Google GenAI Client**: Initializes the AI client with the provided API key.
    *   **API Endpoints**:
        *   `POST /api/docs/generate`: Accepts `code`, `filename`, `context` and returns AI-generated Markdown documentation.
        *   `GET /api/github/user`: Fetches the authenticated GitHub user's details.
        *   `GET /api/github/repos`: Retrieves a list of the authenticated user's repositories.
        *   `POST /api/docs/generate-repo`: Orchestrates fetching repository files (filtering certain types/paths), compiling them, and sending them to the AI for a comprehensive `README.md` generation.
        *   `POST /api/github/commit`: Facilitates committing a new file (`DOCSYNC.md`) or updating an existing one in a GitHub repository.
    *   **Vite Integration**: Serves the React frontend in development and production modes.
*   **`src/App.tsx`**: The main application component responsible for the overall layout, navigation sidebar, and rendering different views (Dashboard, Playground, Settings). It also fetches and displays basic GitHub user information.
*   **`src/components/Dashboard.tsx`**: Manages the interaction with GitHub repositories. It allows users to select a repository, initiate documentation generation, preview the results, and push the generated `DOCSYNC.md` file back to GitHub. It includes robust error handling, especially for missing GitHub tokens.
*   **`src/components/Playground.tsx`**: Provides a standalone interface for developers to paste arbitrary code snippets and immediately receive AI-generated documentation, offering a quick way to test the AI's capabilities.
*   **`src/components/Settings.tsx`**: Offers a detailed guide on how to set up the necessary environment variables, particularly focusing on obtaining and configuring the GitHub Personal Access Token. This ensures a smooth onboarding experience for local development.

## Setup and Usage

Follow these steps to set up and run DocSync locally.

### Prerequisites

*   **Node.js**: Ensure Node.js (v18 or higher recommended) is installed.
*   **Git**: Required for cloning the repository.
*   **Google Gemini API Key**: Obtain a `GEMINI_API_KEY` from [Google AI Studio](https://ai.google.dev/).
*   **GitHub Personal Access Token (PAT)**: Required for GitHub integration features.

### Local Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/sasikumar161106/AI_doc_Generator_for_developers.git
    cd AI_doc_Generator_for_developers
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env.local` file in the root of your project (or edit `.env` if it exists) and add your API keys:

    ```ini
    # .env.local
    GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
    GITHUB_TOKEN="ghp_your_github_personal_access_token"
    ```

    *   **`GEMINI_API_KEY`**: Get this from [Google AI Studio](https://ai.google.dev/).
    *   **`GITHUB_TOKEN`**:
        *   Go to GitHub Settings -> Developer Settings -> Personal Access Tokens -> Tokens (classic).
        *   Click "Generate new token (classic)".
        *   Give it a descriptive name (e.g., "DocSync Local").
        *   **Crucially, grant `repo` scope (full control of private repositories).** Without this, DocSync cannot fetch your repos or commit documentation.
        *   Generate the token and copy it immediately, as it will not be shown again.

4.  **Run the Application:**
    Start the development server:
    ```bash
    npm run dev
    ```

    The application will typically be accessible at `http://localhost:3000`.

### Using DocSync

Once the application is running, open your web browser and navigate to `http://localhost:3000`.

*   **Dashboard**:
    *   Upon launching, if your `GITHUB_TOKEN` is configured correctly, you will see a list of your GitHub repositories.
    *   Select a repository from the left panel.
    *   Click "Analyze & Generate Documentation" to have the AI process your repository files.
    *   Review the generated documentation.
    *   Click "Commit Documentation" to push the generated `DOCSYNC.md` file directly to your selected repository.
*   **Test Playground**:
    *   Paste any code snippet into the "Source Code" area.
    *   Optionally provide a filename and context for better AI understanding.
    *   Click "Generate Docs" to see the AI-generated documentation in real-time.
    *   Use the "Copy raw" button to copy the Markdown output.
*   **Setup & Integration**:
    *   Refer to this section for a detailed, in-app guide on generating and configuring your GitHub Personal Access Token. This is particularly helpful if you encounter issues with GitHub integration.

**Important Note:** If you modify your `.env.local` file, you will need to restart the `npm run dev` process for the changes to take effect.

## Technologies Used

*   **Frontend**: React, TypeScript, Tailwind CSS, Vite
*   **Backend**: Node.js, Express.js, TypeScript, dotenv
*   **AI Model**: Google Gemini (`@google/genai`)
*   **Markdown Rendering**: `react-markdown`
*   **Icons**: `lucide-react`

## License

This project is licensed under the [MIT License](LICENSE.md).