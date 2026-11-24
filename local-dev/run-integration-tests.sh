#!/usr/bin/env bash

INTEGRATION_DIR="$(mktemp -d)"
cp -a . "$INTEGRATION_DIR/source"
cp .env "$INTEGRATION_DIR/source/.env"
node --input-type=module - "$INTEGRATION_DIR/source" <<'NODE'
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
for (const entry of fs.readdirSync(root)) {
    const file = path.join(root, entry, 'function.json');
    if (!fs.existsSync(file)) continue;
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const binding of config.bindings ?? []) {
        if (binding.type?.toLowerCase() === 'httptrigger') binding.authLevel = 'anonymous';
    }
    fs.writeFileSync(file, `${JSON.stringify(config, null, 4)}\n`);
}
NODE
docker compose --project-directory "$INTEGRATION_DIR/source" up --build --detach
ready=false
for attempt in $(seq 1 60); do
	if curl -fsS --max-time 2 http://localhost:8080/api/pub/version >/dev/null; then
		ready=true
		break
	fi
	sleep 3
done
test "$ready" = true
npm run docker:int:test
docker compose --project-directory "$INTEGRATION_DIR/source" down --volumes --remove-orphans
rm -rf "$INTEGRATION_DIR"
