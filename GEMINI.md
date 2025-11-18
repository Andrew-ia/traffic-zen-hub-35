# GEMINI.md - Project Overview: traffic-zen-hub-35

This document provides a comprehensive overview of the `traffic-zen-hub-35` project, to be used as instructional context for future interactions with the Gemini CLI.

## Project Overview

`traffic-zen-hub-35` is a full-stack web application built with the "Lovable" platform. It serves as a dashboard for managing and analyzing marketing data from various sources, including Meta (Facebook/Instagram) Ads, Google Ads, and Google Analytics. The application also includes features for project management, AI-powered creative generation, and a virtual try-on tool.

### Main Technologies

*   **Frontend:**
    *   **Framework:** React with Vite
    *   **Language:** TypeScript
    *   **Styling:** Tailwind CSS with shadcn-ui
    *   **Routing:** `react-router-dom`
    *   **Data Fetching:** `@tanstack/react-query`
*   **Backend:**
    *   **Framework:** Express.js on Node.js
    *   **Language:** TypeScript
    *   **Database:** PostgreSQL (via Supabase)
*   **Integrations:**
    *   **Meta Marketing API:** For syncing campaigns, ad sets, and ads.
    *   **Google Ads API:** For syncing Google Ads data.
    *   **Google Analytics:** For displaying analytics data.
    *   **Supabase:** For database, authentication, and storage.
    *   **Model Context Protocol (MCP):** For interacting with AI assistants.

### Architecture

The project is structured as a monorepo-like full-stack application:

*   **`src/`:** Contains the frontend React application.
*   **`server/`:** Contains the backend Express.js server.
*   **`scripts/`:** Contains various scripts for data synchronization, database management, and other tasks.
*   **`public/`:** Contains static assets for the frontend.
*   **`dist/`:** Contains the production build of the frontend.

The frontend and backend are tightly integrated. The backend exposes a RESTful API that the frontend consumes. During development, the Vite development server proxies API requests to the backend server.

## Building and Running

### Prerequisites

*   Node.js and npm (or a compatible package manager).

### Installation

1.  Install the project dependencies:
    ```bash
    npm install
    ```

### Running the Application

The application consists of a frontend and a backend, which need to be run concurrently.

1.  **Run the development servers:**
    ```bash
    npm run dev
    ```
    This command starts both the Vite development server for the frontend (on port 8080) and the Express.js server for the backend (on port 3001).

### Building for Production

To create a production build of the frontend, run:

```bash
npm run build
```

This will generate a `dist` directory with the optimized and bundled frontend assets.

## Development Conventions

### Environment Variables

The project uses `.env` files for managing environment variables. The main configuration file for local development is `.env.local`. It contains credentials for various services like Supabase, Meta, Google, etc.

### Scripts

The `package.json` file contains a number of useful scripts for development and data synchronization:

*   `npm run dev`: Starts the development servers.
*   `npm run build`: Builds the project for production.
*   `npm run sync:meta`: Syncs data from the Meta Marketing API.
*   `npm run sync:google`: Syncs data from the Google Ads API.
*   `npm run test:api`: Runs API health checks.

### Model Context Protocol (MCP)

The project uses the Model Context Protocol (MCP) to interact with AI assistants. The configuration for the MCP servers is located in `.mcp-config.json`.

To start the Supabase MCP server with the correct credentials from `.env.local`, you can use the following command:

```bash
npx tsx scripts/start-supabase-mcp.ts
```

This will start the MCP server, allowing an AI assistant to interact with the Supabase database.
