# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/38682e2c-234d-48f5-888e-c0ed415a0c1c

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/38682e2c-234d-48f5-888e-c0ed415a0c1c) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/38682e2c-234d-48f5-888e-c0ed415a0c1c) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Integração Meta Marketing API

O repositório inclui um script para sincronizar campanhas, ad sets e anúncios da Meta diretamente para o banco Supabase.

- Configure as variáveis no `.env.local` (`META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_WORKSPACE_ID`).
- Exponha as credenciais para o front-end adicionando `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WORKSPACE_ID` e as variáveis `VITE_META_*` (já exemplificadas em `.env.local`).
- Carregue o ambiente (`set -a && source .env.local && set +a`) e execute `npm run sync:meta`.
- Para preencher o histórico inicial (30 dias) rode `npm run backfill:meta`.
- Para mais detalhes, consulte `docs/integrations/meta.md`.
