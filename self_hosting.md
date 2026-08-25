# Self-Hosting SecureBin

SecureBin is designed to be self-hostable without depending on the hosted
competition deployment. You can run the application, PostgreSQL database, and
private Storage on infrastructure you control with Docker and Node.js.

For the shorter setup and security overview, start with the
[main README](README.md). This file is the expanded operator runbook.

---

## 1. Quick Start (Local & Offline Stack)

Run a complete, isolated local stack (Next.js web app + local Supabase PostgreSQL + local Supabase Storage):

### Prerequisites
- **Node.js:** `v22.23.2` from `.nvmrc` (or the repository's pinned runtime)
- **pnpm:** `v10.15.1` (managed via Corepack)
- **Docker:** Docker Engine / Docker Desktop (running)

### Automated Setup & Launch
```bash
# 1. Clone repository & checkout release
git clone https://github.com/adithyarao2605/SecureBin.git
cd SecureBin

# 2. Enable pnpm and install locked dependencies
corepack enable
corepack install
pnpm install --frozen-lockfile

# 3. Setup and start the local Supabase container and database migrations
pnpm local:setup

# 4. Start the production-built SecureBin web app
pnpm local
```

The web application will be running locally at:
👉 **`http://127.0.0.1:3101`**

### Stopping the Local Stack
```bash
pnpm local:stop
```

---

## 2. Production Deployment (VPS / Bare Metal / Cloud)

### Architecture Overview
1. **Frontend / API Server:** Next.js (Node.js runtime or standalone output).
2. **Database & Storage:** PostgreSQL with Supabase Storage (or standard PostgreSQL + S3-compatible storage via Supabase backend).
3. **Cleanup worker:** An authenticated scheduled task calling
   `/api/internal/cleanup`; hourly is a reasonable self-hosted baseline.

---

### Environment Configuration

Create a `.env` or `.env.production` file on your server with the following required variables:

```bash
# Public URL of your Supabase instance (accessible by server and middleware)
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-instance.example.com

# Server-only service role credential (used only by API route handlers, never exposed to browser)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-secret

# 32-byte hex key for HMAC-SHA-256 rate-limit discriminator hashing
RATE_LIMIT_HMAC_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Secret token protecting the automated storage cleanup endpoint
CRON_SECRET=your-independent-random-cron-secret-12345678

# Optional: Reverse proxy trust ('none' for direct, 'forwarded' for Nginx/Caddy, 'vercel' for Vercel)
SECUREBIN_PROXY_TRUST=forwarded
```

> **Security Note:** Generate strong random secrets:
> ```bash
> openssl rand -hex 32
> ```

---

## 3. Database & Storage Initialization

1. Start your PostgreSQL database.
2. Apply every committed SQL migration in order from `supabase/migrations/`,
   including the latest lifecycle cleanup migration:
   ```bash
   pnpm exec supabase link --project-ref <your-project-id>
   pnpm exec supabase db push
   ```
3. Ensure the private Storage bucket `securebin-files` is created with a 14 MB file size limit and anonymous read/write permissions disabled.

---

## 4. Building & Running the Web Service

```bash
# Build the production bundle
pnpm build

# Start the Next.js server on port 3000
pnpm start
```

### Systemd Service Example (`/etc/systemd/system/securebin.service`)
```ini
[Unit]
Description=SecureBin Zero-Knowledge Sharing Platform
After=network.target

[Service]
Type=simple
User=securebin
WorkingDirectory=/opt/securebin
EnvironmentFile=/opt/securebin/.env.production
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## 5. Reverse Proxy Configuration (Nginx Example)

```nginx
server {
    listen 443 ssl http2;
    server_name securebin.example.com;

    ssl_certificate /etc/letsencrypt/live/securebin.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/securebin.example.com/privkey.pem;

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 6. Scheduled Cleanup Task

SecureBin exposes cleanup but does not run a scheduler inside the application.
Configure an authenticated hourly cron job on your server to remove expired,
revoked, exhausted, and orphaned encrypted material:

```bash
# Crontab entry (/etc/cron.hourly/securebin-cleanup or crontab -e)
0 * * * * curl -X POST https://securebin.example.com/api/internal/cleanup -H "Authorization: Bearer your-independent-random-cron-secret-12345678" > /dev/null 2>&1
```

---

## 7. Verification & Health Check

Verify your instance is healthy:
```bash
curl -i https://securebin.example.com/api/health
```
Expected output:
```json
{"status":"healthy","database":"connected","timestamp":"2026-08-24T16:00:00.000Z"}
```
