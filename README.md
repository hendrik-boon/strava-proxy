# Strava Proxy Worker

Cloudflare Worker that acts as a secure proxy for the Strava API.

This worker handles authentication using a refresh token and caches the access token in KV to avoid unnecessary refreshes.

## Features

- Secure token handling (never exposes secrets)
- Access token caching using Cloudflare KV
- CORS enabled for frontend use
- Two endpoints:
    - `/strava/stats`: Athlete statistics
    - `/strava/activities`: Paginated activities

## Setup Instructions

### 1. Create KV Namespace
Create a new namespace called `strava-token-cache` 

### 2. Configure wrangler.toml

Update `wrangler.toml` and replace `YOUR_KV_NAMESPACE_ID_HERE` with your actual KV Namespace ID.

### 3. Add Secrets

Run these commands:

```bash
wrangler secret put STRAVA_CLIENT_ID
wrangler secret put STRAVA_CLIENT_SECRET
wrangler secret put STRAVA_REFRESH_TOKEN