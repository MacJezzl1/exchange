.PHONY: all dev test lint format clean migrate seed docker-up docker-down

all: test

dev:
	node scripts/dev.js

test:
	pnpm test

lint:
	pnpm lint

format:
	pnpm format

format-check:
	pnpm format:check

migrate:
	node scripts/migrate.js

docker-up:
	docker compose -f infra/docker/docker-compose.yml up -d

docker-down:
	docker compose -f infra/docker/docker-compose.yml down
