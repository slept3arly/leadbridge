# Next.js + PostgreSQL Hosting Landscape 2026

*Research compiled September 2026. All prices verified against official sources.*

---

## Quick Comparison Table

| Platform | Free Tier | Cheapest Paid | Next.js App Router | PostgreSQL | Cold Starts |
|----------|-----------|---------------|-------------------|------------|-------------|
| **Vercel** | Yes (generous) | $20/mo Pro | Native (best) | No built-in | Fluid compute reduces |
| **Cloudflare** | Yes (100K req/day) | $5/mo Workers Paid | Via OpenNext adapter | D1 (SQLite) + Hyperdrive | Near-zero (edge) |
| **Railway** | $1/mo credit | $5/mo Hobby | Full support | Yes (managed) | No cold starts |
| **Render** | Yes (750 hrs/mo) | $7/mo Starter | Full support | Yes (managed) | ~1 min spin-up (free) |
| **Fly.io** | No (waives <$5) | ~$5/mo (usage) | Via Docker/OpenNext | Fly Postgres (self-managed) | Sub-second |
| **Hetzner** | No | €5.49/mo CX23 | Self-managed | Self-managed on VPS | N/A (always-on) |
| **AWS** | Yes (12mo free) | $5/mo Lightsail | open-next / SST | RDS ($13+/mo) | Varies |
| **Google Cloud** | $300 credit + always-free | ~$7/mo Cloud Run | Via adapter | Cloud SQL ($8+/mo) | Sub-second |

---

## 1. Vercel

**Source**: https://vercel.com/pricing, https://vercel.com/docs/limits (Sep 2026)

### Plans
| Plan | Price | Best For |
|------|-------|----------|
| Hobby | $0/mo | Personal projects |
| Pro | $20/user/mo | Production teams |
| Enterprise | Custom | Large organizations |

### Free Tier (Hobby)
- **Projects**: 200
- **Deployments**: 100/day
- **Bandwidth**: 100 GB/mo
- **Edge Requests**: 1M/mo
- **Active CPU**: 4 CPU-hrs/mo
- **Provisioned Memory**: 360 GB-hrs/mo
- **Function Invocations**: 1M/mo
- **ISR Reads**: 1M/mo, **ISR Writes**: 200K/mo
- **Image Optimization**: Included
- **Domains**: 50 per project
- **Build cache**: 1 GB max

### Pro Tier ($20/mo)
- **Bandwidth**: 1 TB/mo included (then $0.15/GB)
- **Edge Requests**: 10M/mo (then $2/1M)
- **Active CPU**: Usage-based (starting $0.128/hr)
- **Provisioned Memory**: Usage-based (starting $0.0106/GB-hr)
- **Function Invocations**: Usage-based ($0.60/1M)
- **Deployments**: 6,000/day
- **$20 usage credit** included

### Function Limits
| Feature | Hobby | Pro/Enterprise |
|---------|-------|----------------|
| Max Duration | 300s (5 min) | 300s default, 800s max, **1800s (30 min) beta** |
| Memory | 2 GB / 1 vCPU | 2 GB default, 4 GB max / 2 vCPU |
| Bundle Size | 250 MB | 250 MB (500 MB Python, 5 GB large functions) |
| Concurrency | Up to 30,000 | Up to 30,000 (100,000+ Enterprise) |
| Edge Runtime | 25s response start, 300s streaming | Same |

### Cold Starts
- **Fluid compute** (default since Apr 2025): Optimized concurrency, bytecode caching, pre-warmed instances
- Pro plan includes cold start prevention
- Hobby: Cold starts can be 2-3s for large functions

### Cron/Scheduled Functions
- Supported via `vercel.json` cron configuration
- Limits per plan (see docs)

### Database
- **No built-in PostgreSQL** — use Vercel Postgres (Neon-based, paid), Supabase, or external
- Vercel Postgres available as separate paid service

### Next.js Support
- **Native, best-in-class** — Vercel maintains Next.js
- Full App Router, Server Components, Server Actions, ISR, PPR, Middleware
- Zero-config deployment
- All features available first on Vercel

---

## 2. Cloudflare Pages/Workers

**Source**: https://developers.cloudflare.com/workers/platform/pricing, https://developers.cloudflare.com/workers/platform/limits (Sep 2026)

### Plans
| Plan | Price | Best For |
|------|-------|----------|
| Workers Free | $0 | Experimentation |
| Workers Paid | $5/mo per account | Production |
| Pages Free | $0 | Static sites |
| Pages Pro | $20/mo | Teams |

### Free Tier Limits
- **Requests**: 100,000/day (resets midnight UTC)
- **CPU Time**: 10 ms per invocation
- **Memory**: 128 MB per isolate
- **Subrequests**: 50 per request
- **Worker Size**: 64 MiB
- **Cron Triggers**: 5 per account
- **Static asset requests**: Free and unlimited
- **Pages Builds**: 500/mo (1 concurrent)
- **Pages Files**: 20,000 per site
- **Bandwidth**: Free, unlimited (no egress charges)

### Paid Tier ($5/mo)
- **Requests**: 10M/mo included (then $0.30/1M)
- **CPU Time**: Up to **5 minutes** per request (default 30s)
- **CPU Milliseconds**: 30M/mo included (then $0.02/1M)
- **Memory**: Still 128 MB per isolate
- **Subrequests**: 10,000 per request
- **Worker Size**: 64 MiB
- **Cron Triggers**: 250 per account
- **Pages Builds**: 5,000/mo (5 concurrent)
- **Pages Files**: 100,000 per site
- **Workers**: 500 per account

### Key Characteristics
- **No bandwidth/egress charges** — unique among all platforms
- **No cold starts** — V8 isolates start in <1ms
- **128 MB memory limit** — hard cap, cannot be increased
- CPU time = actual compute; I/O wait time is free

### PostgreSQL Compatibility
- **D1**: SQLite-based database (NOT PostgreSQL)
- **Hyperdrive**: Connection pooler for external PostgreSQL databases
  - Free: 100,000 queries/day
  - Paid: Unlimited queries
- **No native managed PostgreSQL** — must use external DB via Hyperdrive

### Next.js App Router Support (via OpenNext adapter)
| Feature | Status | Notes |
|---------|--------|-------|
| App Router | ✅ Supported | |
| Pages Router | ✅ Supported | |
| React Server Components | ✅ Supported | |
| Server Actions | ✅ Supported | |
| ISR | ✅ Supported | Backed by KV |
| SSR | ✅ Supported | |
| Middleware | ✅ Supported | Node.js in MW not yet supported |
| Image Optimization | ✅ Supported | Via Cloudflare Images |
| PPR | ✅ Supported | Experimental in Next.js |
| Node.js APIs | ⚠️ Partial | `nodejs_compat` flag; some APIs stubbed |
| Edge Runtime | ❌ Not yet | Adapter uses Node.js runtime mode |

### Limitations
- 128 MB memory per isolate (cannot run memory-heavy SSR)
- 50 subrequests on free plan
- Worker bundle 64 MiB compressed
- Node.js compatibility layer — some npm packages may not work
- No native PostgreSQL (use Hyperdrive + external DB)

---

## 3. Railway

**Source**: https://railway.com/pricing, https://docs.railway.com/pricing (Jul 2026)

### Plans
| Plan | Price | Credits Included |
|------|-------|-----------------|
| Free | $0/mo | $1/mo usage credit |
| Hobby | $5/mo | $5 usage credit |
| Pro | $20/mo/workspace | $20 usage credit |
| Enterprise | Custom | Custom |

### Resource Limits
| Plan | vCPU | RAM | Replicas | Volume Storage | Image Size |
|------|------|-----|----------|---------------|------------|
| Free | 1 | 0.5 GB | 1 | 0.5 GB | 4 GB |
| Hobby | 48 | 48 GB | 6 | 5 GB | 100 GB |
| Pro | 1,000 | 1 TB | 42 | 1 TB | Unlimited |

### Usage-Based Pricing
| Resource | Price |
|----------|-------|
| CPU | $20/vCPU/month ($0.000463/vCPU/min) |
| RAM | $10/GB/month ($0.000231/GB/min) |
| Network Egress | $0.05/GB |
| Volume Storage | $0.15/GB/month |
| Object Storage | $0.015/GB-month |

### PostgreSQL
- **Managed PostgreSQL available** as a service on Railway
- Count against same usage credit as compute
- Free tier DB: limited by $1/mo credit
- Hobby tier DB: runs within $5 credit
- No separate DB pricing — it's all usage-based

### Deployment Model
- Git-push-to-deploy (GitHub/GitLab)
- Nixpacks auto-detection (Node.js, Python, Go, etc.)
- Docker support
- **Always-on** — services do NOT sleep on paid plans
- Free tier: services sleep after inactivity

### Cron/Background Jobs
- Cron services supported natively
- Background workers supported
- No separate cron tier — runs as a service

### Key Characteristics
- **Usage-based billing by the second** — no overprovisioning
- No cold starts on paid plans (always-on)
- Private networking between services
- $5 credit on Hobby covers ~8 vCPU-hours or ~32 GB-hours
- Trial: $5 one-time credit, no credit card required

---

## 4. Render

**Source**: https://render.com/pricing (Sep 2026)

### Workspace Plans
| Plan | Price | Bandwidth | Pipeline Minutes |
|------|-------|-----------|-----------------|
| Hobby | $0/mo | 100 GB | 500 |
| Professional | $19/seat/mo | 500 GB | Included |
| Organization | $29/seat/mo | 1,000 GB | Included |

### Web Service Pricing
| Instance | Price/mo | RAM | CPU |
|----------|----------|-----|-----|
| Free | $0 | 512 MB | 0.1 |
| Starter | $7 | 512 MB | 0.5 |
| Standard | $25 | 2 GB | 1 |
| Pro | $85 | 4 GB | 2 |
| Pro Plus | $175 | 8 GB | 4 |
| Pro Max | $225 | 16 GB | 4 |
| Pro Ultra | $450 | 32 GB | 8 |

### PostgreSQL Pricing
| Instance | Price/mo | CPU | RAM | Connections |
|----------|----------|-----|-----|-------------|
| Free | $0 (30-day limit) | 0.1 | 256 MB | 100 |
| Basic-256mb | $6 | 0.1 | 256 MB | 100 |
| Basic-1gb | $19 | 0.5 | 1 GB | 100 |
| Basic-4gb | $75 | 2 | 4 GB | 100 |
| Pro-4gb | $55 | 1 | 4 GB | 100 |
| Pro-8gb | $100 | 2 | 8 GB | 200 |

- **Storage**: $0.30/GB/month (independent of compute)
- Flexible plans: scale CPU/RAM/storage independently

### Free Tier
- **750 free instance hours** per workspace per month
- Free web services **spin down after 15 min inactivity** (~1 min restart)
- Free PostgreSQL **expires after 30 days** (14-day grace period)
- 1 GB storage on free Postgres
- No credit card required

### Static Sites
- Free to deploy
- Count against bandwidth and pipeline minutes

### Cron Jobs
- Supported as a service type
- Starting at $1/mo

### Key Characteristics
- Always-on paid services (no spin-down)
- Git-push-to-deploy
- Docker support
- Preview environments
- Infrastructure as code via Blueprints/Terraform

---

## 5. Fly.io

**Source**: https://fly.io/pricing, https://fly.io/docs/about/pricing (Sep 2026)

### Pricing Model
- **Pay-as-you-go** — no fixed plans (removed free tier in 2024)
- All resources metered per second
- Invoices under $5 are waived (soft free tier)

### Machine Pricing
| Type | vCPU | RAM | Monthly Cost |
|------|------|-----|-------------|
| shared-cpu-1x | 1 shared | 256 MB | ~$1.94 |
| shared-cpu-1x | 1 shared | 512 MB | ~$3.32 |
| shared-cpu-1x | 1 shared | 1 GB | ~$5.70 |
| performance-1x | 1 dedicated | 2 GB | ~$30 |
| performance-2x | 2 dedicated | 4 GB | ~$60 |

### Volume Storage
| Size | Monthly Cost |
|------|-------------|
| 1 GB | $0.15 |
| 10 GB | $1.50 |
| 50 GB | $7.50 |
| 100 GB | $15.00 |

### Bandwidth
| Region | Included | Overage |
|--------|----------|---------|
| NA & Europe | 100 GB/mo | $0.02/GB |
| Asia Pacific | 30 GB/mo | $0.04/GB |
| India | 30 GB/mo | $0.12/GB |

### Fly Postgres
- **Self-managed** PostgreSQL on Fly Machines
- Not fully managed — you handle backups, upgrades, failover
- Minimal setup: shared-cpu-1x, 256 MB, 1 GB volume ≈ **$2.09/mo**
- Production: shared-cpu-1x, 1 GB RAM, 10 GB volume ≈ **$7.20/mo**
- HA: 2 replicas + 10 GB ≈ **$15-30/mo**

### Cold Starts
- Machines can be set to auto-stop/start (scale to zero)
- Startup time: sub-second for apps, ~2-3s for heavy apps
- Volumes keep accruing charges even when Machine is stopped

### Support Add-ons
| Tier | Price |
|------|-------|
| None (Free) | $0 |
| Standard | $29/mo |
| Premium | $199/mo |
| Enterprise | Custom |
| Compliance (SOC2/BAA) | $99/mo |

### Key Characteristics
- Multi-region deployment (35+ regions)
- Private networking (WireGuard)
- Dockerfile or buildpacks
- No managed PostgreSQL — you operate it
- $5 invoice waiver acts as soft free tier

---

## 6. Hetzner

**Source**: https://www.hetzner.com/cloud, pricing calculator (Sep 2026)

### Cloud VPS Pricing (EU/Germany, excl. VAT)
*Prices increased June 15, 2026 — CX/CAX +30-40%*

| Instance | vCPU | RAM | Storage | Traffic | Monthly |
|----------|------|-----|---------|---------|---------|
| CX23 | 2 | 4 GB | 40 GB | 20 TB | €5.49 |
| CAX11 (ARM) | 2 | 4 GB | 40 GB | 20 TB | €5.99 |
| CX33 | 4 | 8 GB | 80 GB | 20 TB | €8.49 |
| CX43 | 8 | 16 GB | 160 GB | 20 TB | €15.99 |
| CX53 | 16 | 32 GB | 320 GB | 20 TB | €29.49 |
| CCX13 (dedicated) | 2 | 8 GB | 80 GB | 20 TB | €42.99 |

### Additional Costs
- **IPv4**: €1.50/mo (IPv6-only saves €0.50)
- **Snapshots**: €0.01/GB/month
- **Backups**: 20% of server price
- **Load Balancer**: from €5.29/mo (LB11)

### Storage
- Block Storage: €0.052/GB/month (100 GB = €5.20)
- Object Storage: €7.54/mo per TB

### Managed PostgreSQL
- **Not available** as a managed service from Hetzner
- Self-host on VPS (Docker) or use third-party (Elestio from $11/mo)

### Key Characteristics
- EU-based (Germany/Finland) — GDPR advantage
- Very competitive pricing vs AWS/GCP
- No managed databases — fully self-managed
- 20 TB traffic included per instance
- Hourly billing with monthly price cap
- Dedicated CPU options available
- US/Singapore regions: +20-40% more expensive

---

## 7. AWS (Relevant Services)

**Source**: https://aws.amazon.com/lightsail/pricing, https://aws.amazon.com/rds/pricing (Aug 2026)

### Free Tier (12 months)
- 750 hours/mo t2.micro or t3.micro EC2
- 750 hours/mo RDS db.t2.micro (PostgreSQL)
- 20 GB gp2 storage
- 20 GB backup storage
- 1M Lambda requests/mo (always free)
- 400,000 GB-seconds Lambda compute (always free)

### Lightsail (Simple VPS)
| Plan | Price | RAM | vCPU | SSD | Transfer |
|------|-------|-----|------|-----|----------|
| Linux | $5/mo | 0.5 GB | 2 | 20 GB | 1 TB |
| Linux | $7/mo | 1 GB | 2 | 40 GB | 2 TB |
| Linux | $12/mo | 2 GB | 2 | 60 GB | 3 TB |
| Linux | $24/mo | 4 GB | 2 | 80 GB | 4 TB |

- 90-day free trial on paid plans
- Includes static IP, DNS, TLS

### EC2 On-Demand (us-east-1)
| Instance | vCPU | RAM | Monthly |
|----------|------|-----|---------|
| t3.micro | 2 | 1 GB | ~$7.59 |
| t3.small | 2 | 2 GB | ~$15.18 |
| t3.medium | 2 | 4 GB | ~$30.37 |
| t3.large | 2 | 8 GB | ~$60.74 |

### RDS PostgreSQL
| Instance | vCPU | RAM | On-Demand/mo | 1yr Reserved |
|----------|------|-----|-------------|-------------|
| db.t4g.micro | 2 | 1 GB | ~$12 | ~$9 |
| db.t3.micro | 2 | 1 GB | ~$13 | ~$9.50 |
| db.t4g.medium | 2 | 4 GB | ~$47 | ~$34 |
| db.t3.medium | 2 | 4 GB | ~$52-60 | ~$38-47 |

- Storage: $0.115/GB-month (gp3)
- Multi-AZ: 2x compute cost
- Backup: $0.095/GB beyond free allowance

### Lambda + Next.js
- Use **open-next** or **SST** framework
- Lambda free tier: 1M requests + 400K GB-s/mo
- Cold starts: 100ms-1s (depending on package size)
- Memory: up to 10 GB
- Duration: up to 15 minutes

---

## 8. Google Cloud

**Source**: https://cloud.google.com/run/pricing, https://cloud.google.com/sql/pricing (Sep 2026)

### Free Tier
- **$300 credit** for 90 days (new accounts)
- **Always-free** Cloud Run:
  - 240,000 vCPU-seconds/mo (2.8 CPU-days)
  - 450,000 GiB-seconds/mo
  - 2M requests/mo (request-based billing)
  - 1 GiB outbound data/mo
- **Cloud SQL**: 30-day free trial instance

### Cloud Run Pricing (us-central1)
| Component | Price |
|-----------|-------|
| CPU | $0.00002400/vCPU-second ($0.0864/vCPU-hr) |
| Memory | $0.00000250/GiB-second ($0.009/GiB-hr) |
| Requests | $0.40/1M requests (request-based billing) |
| Outbound | $0.12/GiB (first 1-10 TiB) |

**Example**: 1 vCPU, 512 MiB, moderate traffic ≈ **$13.69/mo** (with free tier)

### Cloud SQL PostgreSQL
| Instance | vCPU | RAM | On-Demand/mo |
|----------|------|-----|-------------|
| db-f1-micro | 1 | 0.6 GB | ~$8 |
| db-g1-small | 1 | 1.7 GB | ~$26 |
| db-standard-1 | 1 | 3.75 GB | ~$49 |
| db-standard-2 | 2 | 7.5 GB | ~$99 |

- Storage: $0.17/GB-month (SSD)
- HA: 2x compute cost
- CUDs: 25% off (1yr), 52% off (3yr)

### Key Characteristics
- Cloud Run: true serverless containers, scale to zero
- Automatic HTTPS, custom domains
- Concurrency up to 1,000 requests/instance
- VPC connector for private SQL access
- No managed PostgreSQL on Cloud Run itself (use Cloud SQL)

---

## Summary: Best Options by Use Case

### Side Project / MVP (Cheapest)
1. **Railway Free** ($0-1/mo) — Full-stack, Postgres included, easy
2. **Render Free** ($0) — 750 hrs/mo, but spins down
3. **Cloudflare Pages** ($0) — If static or lightweight

### Small Production App
1. **Railway Hobby** ($5/mo) — Best value full-stack
2. **Render Starter** ($13/mo) — Web service + Postgres
3. **Hetzner CX23** (€5.49/mo) — Self-managed, most power per dollar

### Production with Team
1. **Vercel Pro** ($20/mo) — Best Next.js experience
2. **Railway Pro** ($20/mo) — Flexible, usage-based
3. **Render Professional** ($19/seat/mo) — Managed everything

### Global / Edge
1. **Cloudflare Workers** ($5/mo) — No egress, edge-native
2. **Fly.io** (~$15-30/mo) — Multi-region, VMs
3. **Vercel Pro** ($20/mo) — Global CDN, edge middleware

### Self-Managed / Maximum Control
1. **Hetzner** (€5.49+/mo) — Best price/performance VPS
2. **AWS Lightsail** ($5+/mo) — Simple, AWS ecosystem
3. **Fly.io** (~$5+/mo) — Container-based, multi-region

### Next.js + PostgreSQL Specifically
1. **Railway** — Easiest: push code, add Postgres service, done
2. **Render** — Similar ease, managed Postgres, good DX
3. **Vercel + external DB** — Best Next.js, pair with Neon/Supabase
4. **Cloudflare + Hyperdrive** — Cheapest at scale, but D1 is SQLite
5. **Hetzner + Docker** — Cheapest long-term, most work

---

*Note: Prices change frequently. Always verify against official pricing pages before making decisions.*
