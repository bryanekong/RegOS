# RegOS Prototype — Vercel + Railway + Supabase

Operating System for Regulatory Change. Full 5-stage pipeline. Zero services beyond Supabase.

## Live URLs (fill in after deployment)
- Dashboard: https://regos.vercel.app
- API: https://regos-api.railway.app
- API Docs: https://regos-api.railway.app/docs

## Architecture
FCA RSS -> Ingestion (Railway) -> pipeline_queue (Supabase PostgreSQL LISTEN/NOTIFY) ->
5-stage RIE workers (Railway) -> remediation_tasks (Supabase) ->
Supabase Realtime WebSocket -> React Dashboard (Vercel)

## Setup Order
1. Supabase: create project, enable Realtime on remediation_tasks (INSERT events), create 'policies' storage bucket
2. Railway: create project, connect GitHub, create 7 services, set shared env vars from .env.example
3. Vercel: connect GitHub, root=frontend/, set VITE_* env vars
4. Push to GitHub -> Railway and Vercel auto-deploy

## Running Tests
pytest tests/unit/
pytest tests/integration/    # needs real SUPABASE_DB_URL_SYNC + API_BASE
k6 run -e API_BASE=https://regos-api.railway.app tests/load/k6_pipeline.js

## Demo
Click 'Trigger Demo Ingest' on the dashboard. Watch the Remediation Tracker for live task cards appearing in real time via Supabase Realtime.

## Key Env Vars
SUPABASE_DB_URL          - asyncpg format (port 5432) for FastAPI
SUPABASE_DB_URL_SYNC     - psycopg2 format (port 5432) for workers (LISTEN requires session mode)
SUPABASE_URL             - https://[ref].supabase.co
SUPABASE_ANON_KEY        - for frontend Realtime subscription
SUPABASE_SERVICE_ROLE_KEY - for Railway backend services
