import os
import time
import logging
import hashlib
import json
import psycopg2
from apscheduler.schedulers.blocking import BlockingScheduler
from parsers.fca_parser import fetch_publications

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_URL = os.environ.get('SUPABASE_DB_URL_SYNC')
INTERVAL = int(os.environ.get('POLL_INTERVAL_SECONDS', '600'))

def run_cycle():
    if not DB_URL:
        logger.error("SUPABASE_DB_URL_SYNC not set.")
        return
        
    logger.info("Starting ingestion cycle...")
    pubs = fetch_publications()
    
    new_count = 0
    skipped_count = 0
    
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        for pub in pubs:
            hash_input = (pub['title'] + pub['source_url'] + pub['pub_date']).encode()
            content_hash = hashlib.sha256(hash_input).hexdigest()
            
            cur.execute("SELECT COUNT(*) FROM publications WHERE content_hash = %s", (content_hash,))
            if cur.fetchone()[0] > 0:
                skipped_count += 1
                logger.debug(f"Skipped existing: {pub['title']}")
                continue
                
            cur.execute("""
                INSERT INTO publications (source, title, pub_date, doc_type, source_url, summary, full_text, content_hash, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (content_hash) DO NOTHING
                RETURNING publication_id
            """, (
                pub['source'], pub['title'], pub['pub_date'], pub['doc_type'],
                pub['source_url'], pub['summary'], pub['full_text'], content_hash, 'pending'
            ))
            
            row = cur.fetchone()
            if row:
                pub_id = row[0]
                payload = {
                    "publication_id": str(pub_id),
                    "source_url": pub['source_url'],
                    "summary": pub['summary']
                }
                cur.execute("""
                    INSERT INTO pipeline_queue (stage, payload)
                    VALUES ('stage1', %s)
                """, (json.dumps(payload),))
                new_count += 1
            else:
                skipped_count += 1
                
        conn.commit()
    except Exception as e:
        logger.error(f"Cycle error: {e}", exc_info=True)
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()
        
    logger.info(f"Cycle complete: {new_count} new, {skipped_count} skipped")

if __name__ == '__main__':
    run_cycle()
    scheduler = BlockingScheduler()
    scheduler.add_job(run_cycle, 'interval', seconds=INTERVAL)
    logger.info(f"Started ingestion scheduler (interval={INTERVAL}s)")
    scheduler.start()
