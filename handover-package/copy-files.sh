#!/bin/bash
# Run this from the veritas-mvp directory

# Create directory structure
mkdir -p handover-package/root
mkdir -p handover-package/contracts
mkdir -p handover-package/frontend
mkdir -p handover-package/services/copy-trading
mkdir -p handover-package/services/indexer
mkdir -p handover-package/services/indexer-backup
mkdir -p handover-package/telegram-bot
mkdir -p handover-package/claude

# Copy env files
cp .env handover-package/root/.env 2>/dev/null || echo "No root .env"
cp contracts/.env handover-package/contracts/.env 2>/dev/null || echo "No contracts .env"
cp frontend/.env.local handover-package/frontend/.env.local 2>/dev/null || echo "No frontend .env.local"
cp frontend/.env.mode handover-package/frontend/.env.mode 2>/dev/null || echo "No frontend .env.mode"
cp services/.env handover-package/services/.env 2>/dev/null || echo "No services .env"
cp services/copy-trading/.env handover-package/services/copy-trading/.env 2>/dev/null || echo "No copy-trading .env"
cp services/indexer/.env handover-package/services/indexer/.env 2>/dev/null || echo "No indexer .env"
cp services/indexer-backup/.env handover-package/services/indexer-backup/.env 2>/dev/null || echo "No indexer-backup .env"
cp telegram-bot/.env handover-package/telegram-bot/.env 2>/dev/null || echo "No telegram-bot .env"
cp telegram-bot/.env.mainnet handover-package/telegram-bot/.env.mainnet 2>/dev/null || echo "No telegram-bot .env.mainnet"

# Copy claude settings
cp -r .claude/* handover-package/claude/ 2>/dev/null || echo "No .claude folder"

echo "Done! Check handover-package folder"
