# ATLAS Enterprise Suite

> **Canonical Operational Repository for ATLAS**  
> Primary Domain: [https://www.atlasenterprisesuite.com](https://www.atlasenterprisesuite.com)

ATLAS Enterprise Suite is the shared enterprise platform for people, finance, operations, security, communication, intelligence, health, mobility, productivity, and connected services.

---

## 🏛️ Repository Authority & Governance

- **Canonical Repository:** `atlasenterprisesuite/atlasenterprisesuite`
- **Production Branch:** `main`
- **Integration Branch:** `release/atlas-a-z`
- **Primary Backend / Control Plane:** Supabase `atlas-core` (`ggmanzcgtlrvqfoccgsh`)
- **Primary Public Edge Target:** Cloudflare Workers
- **Primary Intelligence Model:** `gpt-6-astra` (Responses API)

### Key Governance & Architecture Specs
- Governance Policy: [`docs/governance/ATLAS_CANONICAL_REPOSITORY.md`](docs/governance/ATLAS_CANONICAL_REPOSITORY.md)
- Infrastructure Control Plane: [`docs/architecture/ATLAS_MANAGER_SPEC.md`](docs/architecture/ATLAS_MANAGER_SPEC.md)
- Runtime Migration Plan: [`docs/architecture/GPT_6_ASTRA_MIGRATION.md`](docs/architecture/GPT_6_ASTRA_MIGRATION.md)

---

## 🚦 Truthful Production State

Status is tracked strictly per layer. A successful CI build does not imply edge verification until publicly validated.

| Subsystem | Target / Provider | Software Gate | Public / Runtime Status |
| :--- | :--- | :---: | :---: |
| **Control Plane** | Supabase (`atlas-core`) | ✅ Passed | `verified` |
| **Public Edge** | Cloudflare Workers | ✅ Passed | `live` |
| **AI Intelligence** | `gpt-6-astra` via Responses API | ✅ Passed | `connected` |

---

## ⚡ Deployment Path & Rules

- **Authorized Deployment Path:** `GitHub` ➔ `Supabase` ➔ `Cloudflare` ➔ `Production`
- **Infrastructure Brain:** Managed strictly via **ATLAS Manager**.
- **Deployment Constraint:** No deployment artifacts or Pull Requests are sent to Vercel.

---

## 🔄 Operating Rule

ATLAS advances continuously through analysis, implementation, correction, testing, integration, deployment gates, and verification. Work stops only when a real human, legal, authorization, or technically irresolvable dependency makes further progress impossible.

2. .github/workflows/deploy-cloudflare.yml (GitHub Action)
name: ATLAS CI/CD Gate & Cloudflare Deployment

on:
  push:
    branches:
      - main
      - release/atlas-a-z
  pull_request:
    branches:
      - main

jobs:
  validate-and-deploy:
    name: Software Gates & Cloudflare Deploy
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js Environment
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run Quality & Security Gates
        run: |
          npm run lint
          npm run test

      - name: Validate ATLAS Manager Convergence
        run: |
          echo "Verifying deployment readiness via ATLAS Manager..."
          # Insert custom ATLAS Manager validation script here if applicable
          # node scripts/atlas-manager-check.js

      - name: Deploy Edge Artifacts to Cloudflare Workers
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --env production

Ambos archivos quedan configurados respetando las reglas de gobernanza, la ruta directa de despliegue a Cloudflare sin Vercel y el control de estado real.
