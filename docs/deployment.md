# Deployment Guide — aieos-console

## Prerequisites
- Docker installed
- AIEOS kit directories accessible on host
- Project directory for state persistence
- LLM API key (Anthropic)

## Build
```bash
docker build -t aieos-console .
```

## Run
```bash
docker run -d \
  --name aieos-console \
  -v /path/to/kits:/kits:ro \
  -v /path/to/project:/project \
  -e PROJECT_DIR=/project \
  -e KIT_DIRS=/kits/kit1,/kits/kit2 \
  -e LLM_API_KEY=<your-api-key> \
  -e LLM_PROVIDER=anthropic \
  -e LLM_MODEL=claude-sonnet-4-20250514 \
  -p 3000:3000 \
  aieos-console
```

## Verify
1. Check health: `curl -f http://localhost:3000/api/health`
2. Check logs: `docker logs aieos-console`
3. Access UI: http://localhost:3000

## Environment Variables
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PROJECT_DIR | Yes | — | Path to project directory inside container |
| KIT_DIRS | Yes | — | Comma-separated kit directory paths inside container |
| LLM_API_KEY | Yes | — | API key for LLM provider |
| LLM_PROVIDER | No | anthropic | LLM provider ID |
| LLM_MODEL | No | — | Model name |
| PORT | No | 3000 | Server port |

## Volume Mounts
- **Kits (read-only)**: Mount AIEOS kit directories with `:ro` flag
- **Project (read-write)**: Mount project directory for state persistence

## Rollback
1. Stop current: `docker stop aieos-console && docker rm aieos-console`
2. Run previous version: `docker run ... aieos-console:previous-tag`
3. Verify state loads: `curl http://localhost:3000/api/project`

## State Persistence
- State stored in `PROJECT_DIR/.aieos/state.json`
- Artifacts stored in `PROJECT_DIR/docs/sdlc/`
- Container restart preserves state via volume mount
