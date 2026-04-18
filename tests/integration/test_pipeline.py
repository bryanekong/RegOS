import os
import time
import httpx
import psycopg2

API_BASE = os.environ.get('API_BASE', 'http://localhost:8000')
DB_URL = os.environ.get('SUPABASE_DB_URL_SYNC')
HEADERS = {'X-API-Key': 'regos-proto-2026'}

def test_full_pipeline():
    if not DB_URL:
        import pytest
        pytest.skip("SUPABASE_DB_URL_SYNC not set")
        
    # 1. POST
    r = httpx.post(f"{API_BASE}/api/ingest/trigger", headers=HEADERS)
    assert r.status_code == 200
    data = r.json()
    assert data.get('triggered') is True
    pub_id = data.get('publication_id')
    assert pub_id
    
    # 3. Poll
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    timeout = time.time() + 120
    
    task_count = 0
    while time.time() < timeout:
        cur.execute("SELECT COUNT(*) FROM remediation_tasks WHERE publication_id = %s::uuid", (pub_id,))
        task_count = cur.fetchone()[0]
        if task_count > 0:
            break
        time.sleep(5)
        
    assert task_count > 0
    
    # 5. Check status
    cur.execute("SELECT status FROM publications WHERE publication_id = %s::uuid", (pub_id,))
    status = cur.fetchone()[0]
    assert status == 'actioned'
    
    cur.close()
    conn.close()
