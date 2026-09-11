#!/bin/bash
# Run this script from the handover-package folder AFTER cloning the repo
# Usage: cd handover-package && bash restore-files.sh

PROJECT_ROOT=".."

echo "Restoring environment files to project..."

# Create directories if they don't exist
mkdir -p "$PROJECT_ROOT/.claude"
mkdir -p "$PROJECT_ROOT/contracts"
mkdir -p "$PROJECT_ROOT/frontend/.vercel"
mkdir -p "$PROJECT_ROOT/user-docs/.vercel"
mkdir -p "$PROJECT_ROOT/services/copy-trading"
mkdir -p "$PROJECT_ROOT/services/indexer"
mkdir -p "$PROJECT_ROOT/services/indexer-backup"
mkdir -p "$PROJECT_ROOT/telegram-bot"

# Copy env files
cp root/.env "$PROJECT_ROOT/.env" 2>/dev/null && echo "✓ .env" || echo "✗ root/.env not found"
cp contracts/.env "$PROJECT_ROOT/contracts/.env" 2>/dev/null && echo "✓ contracts/.env" || echo "✗ contracts/.env not found"
cp frontend/.env.local "$PROJECT_ROOT/frontend/.env.local" 2>/dev/null && echo "✓ frontend/.env.local" || echo "✗ frontend/.env.local not found"
cp frontend/.env.mode "$PROJECT_ROOT/frontend/.env.mode" 2>/dev/null && echo "✓ frontend/.env.mode" || echo "✗ frontend/.env.mode not found"
cp services/.env "$PROJECT_ROOT/services/.env" 2>/dev/null && echo "✓ services/.env" || echo "✗ services/.env not found"
cp services/copy-trading/.env "$PROJECT_ROOT/services/copy-trading/.env" 2>/dev/null && echo "✓ services/copy-trading/.env" || echo "✗ services/copy-trading/.env not found"
cp services/indexer/.env "$PROJECT_ROOT/services/indexer/.env" 2>/dev/null && echo "✓ services/indexer/.env" || echo "✗ services/indexer/.env not found"
cp services/indexer-backup/.env "$PROJECT_ROOT/services/indexer-backup/.env" 2>/dev/null && echo "✓ services/indexer-backup/.env" || echo "✗ services/indexer-backup/.env not found"
cp telegram-bot/.env "$PROJECT_ROOT/telegram-bot/.env" 2>/dev/null && echo "✓ telegram-bot/.env" || echo "✗ telegram-bot/.env not found"
cp telegram-bot/.env.mainnet "$PROJECT_ROOT/telegram-bot/.env.mainnet" 2>/dev/null && echo "✓ telegram-bot/.env.mainnet" || echo "✗ telegram-bot/.env.mainnet not found"
cp claude/settings.local.json "$PROJECT_ROOT/.claude/settings.local.json" 2>/dev/null && echo "✓ .claude/settings.local.json" || echo "✗ claude/settings.local.json not found"

# Copy Vercel project configs
cp -r frontend/.vercel/* "$PROJECT_ROOT/frontend/.vercel/" 2>/dev/null && echo "✓ frontend/.vercel/" || echo "✗ frontend/.vercel/ not found"
cp -r user-docs/.vercel/* "$PROJECT_ROOT/user-docs/.vercel/" 2>/dev/null && echo "✓ user-docs/.vercel/" || echo "✗ user-docs/.vercel/ not found"

echo ""
echo "Done! Now run:"
echo "  cd $PROJECT_ROOT/frontend && npm install && npm run dev"
echo ""
echo "To deploy to Vercel (same projects):"
echo "  cd $PROJECT_ROOT/frontend && vercel"
echo "  cd $PROJECT_ROOT/user-docs && vercel"
