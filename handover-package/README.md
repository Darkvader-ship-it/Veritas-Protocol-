# Veritas Handover Package

This package contains all environment files and configuration needed to run the Veritas project.

## Contents

```
handover-package/
├── root/.env                    → Copy to .env (project root)
├── contracts/.env               → Copy to contracts/.env
├── frontend/.env.local          → Copy to frontend/.env.local
├── frontend/.env.mode           → Copy to frontend/.env.mode (optional)
├── frontend/.vercel/            → Copy to frontend/.vercel/ (Vercel project link)
├── user-docs/.vercel/           → Copy to user-docs/.vercel/ (Vercel project link)
├── services/.env                → Copy to services/.env
├── services/copy-trading/.env   → Copy to services/copy-trading/.env
├── services/indexer/.env        → Copy to services/indexer/.env
├── services/indexer-backup/.env → Copy to services/indexer-backup/.env
├── telegram-bot/.env            → Copy to telegram-bot/.env
├── telegram-bot/.env.mainnet    → Copy to telegram-bot/.env.mainnet
└── claude/settings.local.json   → Copy to .claude/settings.local.json
```

## Vercel Projects

| Folder | Project Name | URL |
|--------|--------------|-----|
| frontend/ | frontend | https://veritas.xyz |
| user-docs/ | user-docs | (check Vercel dashboard) |

The `.vercel/` folders link to the existing Vercel projects. After copying, running `vercel` will deploy to the same projects.

## Setup Instructions

1. Clone the repo: `git clone <repo-url>`
2. Copy each env file to its correct location (see tree above)
3. Install dependencies:
   ```bash
   # Root
   npm install

   # Frontend
   cd frontend && npm install

   # Contracts (if needed)
   cd contracts && forge install
   ```

4. Start the frontend:
   ```bash
   cd frontend && npm run dev
   ```

## Key Environment Variables

### Frontend (.env.local)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role (server-side only)

### Services
- Various API keys for prediction market platforms
- Telegram bot tokens

## Important Notes

- **Do NOT commit these files to git** - they contain secrets
- The production URL is: `https://veritas.xyz`
- See `CLAUDE.md` in the project root for architecture overview
- See `frontend/DESIGN_SYSTEM.md` for UI/design guidelines

## Support

Contact the previous developer if you have questions about:
- Supabase schema/RLS policies
- Platform API integrations
- Smart contract deployment addresses
