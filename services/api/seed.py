import os
import psycopg2
from psycopg2.extras import Json
import logging

logger = logging.getLogger(__name__)

def seed_policies():
    db_url = os.environ.get('SUPABASE_DB_URL_SYNC')
    if not db_url:
        logger.warning("SUPABASE_DB_URL_SYNC not set. Skipping seed.")
        return

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        cur.execute("SELECT COUNT(*) FROM policies;")
        count = cur.fetchone()[0]
        if count > 0:
            return  # Idempotent: return if > 0

        policies = [
            {
                "title": "Consumer Duty Outcomes Policy",
                "doc_type": "Policy",
                "frameworks": ["ConsumerDuty"],
                "reg_refs": ["PRIN 2A.1", "PRIN 2A.2", "PRIN 2A.3", "PRIN 2A.4"],
                "sections": [
                    {"id": "s1", "title": "Scope and Application", "text": "This policy applies to all retail products in accordance with PRIN 2A.1. Firms must deliver good outcomes for retail customers.", "reg_refs": ["PRIN 2A.1"]},
                    {"id": "s2", "title": "Consumer Outcomes Framework", "text": "We must deliver the four consumer outcomes per PRIN 2A.2 covering products and services, price and value, consumer understanding and consumer support.", "reg_refs": ["PRIN 2A.2", "PRIN 2A.3"]},
                    {"id": "s3", "title": "Monitoring and Review", "text": "Regular review of consumer outcomes is required under PRIN 2A.3. The Consumer Principle applies across all retail activities.", "reg_refs": ["PRIN 2A.3"]}
                ]
            },
            {
                "title": "Fair Value Assessment Framework",
                "doc_type": "Procedure",
                "frameworks": ["ConsumerDuty"],
                "reg_refs": ["PRIN 2A.2", "COCON 4.1"],
                "sections": [
                    {"id": "s1", "title": "Price and Value Assessment", "text": "Assessment of price and value for all products per COCON 4.1. Products must demonstrate fair value for retail customers.", "reg_refs": ["COCON 4.1"]},
                    {"id": "s2", "title": "Value Indicators", "text": "Products must demonstrate fair value in line with Consumer Duty Rule and cross-cutting rules under PRIN 2A.2.", "reg_refs": ["PRIN 2A.2"]}
                ]
            },
            {
                "title": "Vulnerable Customer Policy",
                "doc_type": "Policy",
                "frameworks": ["ConsumerDuty"],
                "reg_refs": ["PRIN 2A.4", "COCON 4.1"],
                "sections": [
                    {"id": "s1", "title": "Identifying Vulnerable Customers", "text": "Identification of customers in vulnerable circumstances per PRIN 2A.4 Consumer Duty requirements.", "reg_refs": ["PRIN 2A.4"]},
                    {"id": "s2", "title": "Consumer Support Outcomes", "text": "Ensuring consumer support outcomes for vulnerable customers as required by Consumer Principle and cross-cutting rules.", "reg_refs": ["PRIN 2A.4", "COCON 4.1"]}
                ]
            },
            {
                "title": "Product Governance Standard",
                "doc_type": "Standard",
                "frameworks": ["ConsumerDuty"],
                "reg_refs": ["PRIN 2A.3"],
                "sections": [
                    {"id": "s1", "title": "Product Design Requirements", "text": "Products and services must meet needs of the target market under PRIN 2A.3 products and services outcome.", "reg_refs": ["PRIN 2A.3"]}
                ]
            },
            {
                "title": "SM&CR Senior Manager Responsibilities",
                "doc_type": "Policy",
                "frameworks": ["SMCR"],
                "reg_refs": ["SYSC 4.1"],
                "sections": [
                    {"id": "s1", "title": "Responsibilities Map", "text": "Senior managers must maintain responsibilities maps per SYSC 4.1 requirements.", "reg_refs": ["SYSC 4.1"]}
                ]
            }
        ]

        for p in policies:
            cur.execute(
                """
                INSERT INTO policies (title, doc_type, frameworks, reg_refs, sections)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (p['title'], p['doc_type'], p['frameworks'], p['reg_refs'], Json(p['sections']))
            )
        
        conn.commit()
        logger.info("Policies seeded successfully.")
    except Exception as e:
        logger.error(f"Failed to seed policies: {e}")
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()
