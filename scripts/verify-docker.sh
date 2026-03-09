#!/usr/bin/env bash
set -euo pipefail

# Docker deployment verification script
# Run this after fixing Docker permissions

echo "=== Docker Deployment Verification ==="

# Step 1: Build
echo "[1/4] Building Docker image..."
docker build -t aieos-console:test .

# Step 2: Create temp dirs
TEMP_PROJECT=$(mktemp -d)
chmod 777 "$TEMP_PROJECT"
echo "[2/4] Using temp project dir: $TEMP_PROJECT"

# Step 3: Run container
echo "[3/4] Starting container..."
docker run -d \
  --name aieos-verify \
  -v "$(pwd)/e2e/fixtures/test-kit:/kits/test-kit:ro" \
  -v "$TEMP_PROJECT:/project" \
  -e PROJECT_DIR=/project \
  -e KIT_DIRS=/kits/test-kit \
  -e LLM_PROVIDER=mock \
  -e LLM_API_KEY=test \
  -e LLM_MODEL=mock-model \
  -p 3001:3000 \
  aieos-console:test

# Wait for startup
echo "Waiting for container to start..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Step 4: Verify
echo "[4/4] Verifying..."

# Health check
HEALTH=$(curl -sf http://localhost:3001/api/health)
echo "Health: $HEALTH"
if echo "$HEALTH" | grep -q '"ok"'; then
  echo "✓ Health check PASS"
else
  echo "✗ Health check FAIL"
  docker logs aieos-verify
  docker stop aieos-verify && docker rm aieos-verify
  rm -rf "$TEMP_PROJECT"
  exit 1
fi

# Initialize project
INIT=$(curl -sf -X POST http://localhost:3001/api/project/initialize \
  -H "Content-Type: application/json" \
  -d '{"projectDir":"/project","kitConfigs":[{"kitId":"e2e-test-kit","kitPath":"/kits/test-kit"}],"llmConfigs":[{"providerId":"mock","model":"mock-model","apiKeyEnvVar":"LLM_API_KEY"}]}')
echo "Init: $INIT"
if echo "$INIT" | grep -q '"success"'; then
  echo "✓ Project initialization PASS"
else
  echo "✗ Project initialization FAIL"
fi

# State persistence check
echo "Restarting container..."
docker restart aieos-verify
sleep 5
for i in $(seq 1 30); do
  if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

STATE=$(curl -sf http://localhost:3001/api/project)
if echo "$STATE" | grep -q '"projectId"'; then
  echo "✓ State persistence PASS"
else
  echo "✗ State persistence FAIL"
fi

# Cleanup
docker stop aieos-verify && docker rm aieos-verify
# Temp dir may contain files owned by the container user; use sudo if available
rm -rf "$TEMP_PROJECT" 2>/dev/null || sudo rm -rf "$TEMP_PROJECT" 2>/dev/null || true

echo ""
echo "=== Verification Complete ==="
