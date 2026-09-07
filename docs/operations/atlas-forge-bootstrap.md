# ATLAS Forge Bootstrap Operations

This procedure brings up the first sovereign ATLAS Forge control plane on an ATLAS-controlled Linux host. GitHub is optional after the local bare repository has been created.

## Host assumptions

- Node.js 22 or newer
- npm available at `/usr/bin/npm`
- Git available to the `atlas-forge` service account
- repository working copy at `/opt/atlas/atlasenterprisesuite`
- persistent Forge state at `/srv/atlas-forge`

## 1. Create the service account and state directories

```bash
sudo useradd --system --home /srv/atlas-forge --shell /usr/sbin/nologin atlas-forge || true
sudo mkdir -p /srv/atlas-forge /etc/atlas-forge
sudo chown -R atlas-forge:atlas-forge /srv/atlas-forge
sudo chmod 700 /srv/atlas-forge /etc/atlas-forge
```

## 2. Generate control-plane credentials

Generate two independent random values containing at least 32 random bytes. Do not paste them into Git, issues, PRs, chat logs, or service logs.

```bash
CONTROL_TOKEN="$(openssl rand -hex 32)"
RUNNER_TOKEN="$(openssl rand -hex 32)"
sudo install -m 600 -o root -g root /dev/null /etc/atlas-forge/forge.env
sudo sh -c "cat > /etc/atlas-forge/forge.env" <<EOF_ENV
ATLAS_FORGE_HOME=/srv/atlas-forge
ATLAS_FORGE_REPOSITORIES_ROOT=/srv/atlas-forge/repos
ATLAS_FORGE_PIPELINES_ROOT=/opt/atlas/atlasenterprisesuite/.atlas/forge/pipelines
ATLAS_FORGE_API_URL=http://127.0.0.1:8788
ATLAS_FORGE_BIND=127.0.0.1
ATLAS_FORGE_PORT=8788
ATLAS_FORGE_RUNNER_ID=runner-primary
ATLAS_FORGE_CONTROL_TOKEN=$CONTROL_TOKEN
ATLAS_FORGE_RUNNER_TOKEN=$RUNNER_TOKEN
EOF_ENV
unset CONTROL_TOKEN RUNNER_TOKEN
sudo chmod 600 /etc/atlas-forge/forge.env
```

## 3. Bootstrap the authoritative local Git copy

Run from the ATLAS checkout:

```bash
sudo -u atlas-forge scripts/forge/bootstrap-local-repository.sh \
  /opt/atlas/atlasenterprisesuite \
  /srv/atlas-forge \
  atlas
```

The script performs `git fsck --full` and configures `receive.denyNonFastForwards=true`.

Verify the release SHA explicitly:

```bash
git -C /opt/atlas/atlasenterprisesuite rev-parse release/atlas-a-z
git --git-dir /srv/atlas-forge/repos/atlas.git rev-parse refs/heads/release/atlas-a-z
```

The two SHAs must match before the local repository is treated as authoritative for that branch.

## 4. Optional GitHub mirror

If a `github` remote is configured on the bare repository, fetch with:

```bash
scripts/forge/sync-git-mirror.sh /srv/atlas-forge/repos/atlas.git github
```

A GitHub failure must be recorded as mirror degradation. It does not stop local source or CI. Pushing all refs is intentionally explicit:

```bash
scripts/forge/sync-git-mirror.sh /srv/atlas-forge/repos/atlas.git github --push
```

Never use an unreviewed force reconciliation for diverged history.

## 5. Install and start services

```bash
sudo install -m 644 infra/forge/systemd/atlas-forge-api.service /etc/systemd/system/atlas-forge-api.service
sudo install -m 644 infra/forge/systemd/atlas-forge-runner.service /etc/systemd/system/atlas-forge-runner.service
sudo systemctl daemon-reload
sudo systemctl enable --now atlas-forge-api atlas-forge-runner
```

Health check:

```bash
curl --fail --silent http://127.0.0.1:8788/healthz
```

Expected state: `ready`. A degraded check blocks release promotion but does not invent a successful state.

## 6. Emergency CI without GitHub Actions

From a complete ATLAS checkout:

```bash
ATLAS_FORGE_HOME="$(mktemp -d)" npm run forge:ci:local
```

The command records the exact current Git SHA and writes evidence under `<forge-home>/local-runs/`. Do not claim the complete A-Z CI gate is green unless every canonical command actually exits 0.

## 7. Bootstrap validation

Run the zero-dependency Forge test suite:

```bash
npm run test:forge
```

This validates state transitions, pipeline restrictions, Git exact-SHA checkout, secret stripping, failure classification, Artifact Vault integrity, API lifecycle, runner/API execution, and sovereign continuity while the GitHub mirror is deliberately unavailable.

## 8. Restart verification

```bash
sudo systemctl restart atlas-forge-api atlas-forge-runner
sudo systemctl is-active --quiet atlas-forge-api
sudo systemctl is-active --quiet atlas-forge-runner
curl --fail --silent http://127.0.0.1:8788/healthz
```

Forge is not called resilient until a second independent repository copy or verified backup has also passed restoration/integrity verification.
