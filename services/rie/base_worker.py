import os
import time
import logging

class BaseWorker:
  def __init__(self, stage_listen: str, stage_next: str | None):
    self.stage_listen = stage_listen
    self.stage_next = stage_next
    self.conn = None
    self.cur = None
    logging.basicConfig(level=logging.INFO)
    self.logger = logging.getLogger(stage_listen)

  def connect(self):
    import psycopg2
    db_url = os.environ['SUPABASE_DB_URL_SYNC']
    self.conn = psycopg2.connect(db_url)
    self.conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    self.cur = self.conn.cursor()
    self.cur.execute(f"LISTEN {self.stage_listen};")
    self.logger.info(f"Listening on channel: {self.stage_listen}")

  def run(self):
    self.connect()
    while True:
      try:
        self._poll()
      except psycopg2.OperationalError as e:
        self.logger.error(f"DB connection lost: {e}. Reconnecting in 5s...")
        time.sleep(5)
        self.connect()
      except Exception as e:
        self.logger.error(f"Unexpected error: {e}", exc_info=True)
        time.sleep(1)

  def _poll(self):
    import select
    if select.select([self.conn], [], [], 30) == ([], [], []):
      return  # timeout heartbeat
    self.conn.poll()
    while self.conn.notifies:
      notify = self.conn.notifies.pop(0)
      queue_id = int(notify.payload)
      # Atomic claim: only one worker processes each row
      self.cur.execute(
        "UPDATE pipeline_queue SET status='processing' WHERE id=%s AND status='pending' RETURNING payload",
        (queue_id,)
      )
      row = self.cur.fetchone()
      if not row:
        return  # another worker claimed it
      payload = row[0]
      # Propagate a correlation id across all stages of a single publication's
      # trip through the pipeline so logs can be grepped end-to-end.
      trace_id = payload.get('trace_id')
      if not trace_id:
        import uuid
        trace_id = uuid.uuid4().hex[:12]
        payload['trace_id'] = trace_id
      self._current_trace = trace_id
      try:
        self.logger.info(
          f"[trace={trace_id}] Processing queue_id={queue_id}, payload keys: {list(payload.keys())}"
        )
        self.process(payload)
        self.cur.execute(
          "UPDATE pipeline_queue SET status='done', processed_at=now(), last_error=NULL WHERE id=%s",
          (queue_id,)
        )
        self.logger.info(f"[trace={trace_id}] queue_id={queue_id} done")
      except Exception as e:
        # Retry up to MAX_ATTEMPTS-1 times before dead-lettering to 'failed'.
        # On retry, status goes back to 'pending' so another NOTIFY or the
        # stuck-job sweeper will pick it up.
        MAX_ATTEMPTS = 3
        err_msg = f"{type(e).__name__}: {e}"[:1000]
        self.logger.error(f"[trace={trace_id}] Stage failed for queue_id={queue_id}: {e}", exc_info=True)
        self.cur.execute(
          """UPDATE pipeline_queue
             SET attempts = COALESCE(attempts, 0) + 1,
                 last_error = %s,
                 status = CASE
                   WHEN COALESCE(attempts, 0) + 1 >= %s THEN 'failed'
                   ELSE 'pending'
                 END,
                 processed_at = CASE
                   WHEN COALESCE(attempts, 0) + 1 >= %s THEN now()
                   ELSE processed_at
                 END
             WHERE id = %s
             RETURNING status, attempts""",
          (err_msg, MAX_ATTEMPTS, MAX_ATTEMPTS, queue_id)
        )
        new_status, attempts = self.cur.fetchone()
        if new_status == 'pending':
          # Re-emit the notification so a worker picks it up again.
          self.cur.execute("SELECT pg_notify(%s, %s)", (self.stage_listen, str(queue_id)))
          self.logger.info(f"Retrying queue_id={queue_id} (attempt {attempts}/{MAX_ATTEMPTS})")
        else:
          self.logger.error(f"Dead-lettered queue_id={queue_id} after {attempts} attempts")

  def publish_next(self, payload: dict):
    if not self.stage_next:
      return
    import json
    self.cur.execute(
      "INSERT INTO pipeline_queue (stage, payload) VALUES (%s, %s)",
      (self.stage_next, json.dumps(payload))
    )
    self.logger.info(f"Published to {self.stage_next}: {list(payload.keys())}")

  _ALLOWED_PUBLICATION_FIELDS = frozenset({
    'full_text', 'sections', 'summary', 'classification',
    'status', 'processed_at', 'doc_type', 'pub_date'
  })

  def update_publication(self, publication_id: str, **kwargs):
    import json
    set_clauses = []
    values = []
    for k, v in kwargs.items():
      if k not in self._ALLOWED_PUBLICATION_FIELDS:
        raise ValueError(f"Disallowed publication field: {k}")
      set_clauses.append(f"{k} = %s")
      values.append(json.dumps(v) if isinstance(v, (dict, list)) else v)
    if not set_clauses:
      return
    values.append(publication_id)
    self.cur.execute(
      f"UPDATE publications SET {', '.join(set_clauses)} WHERE publication_id = %s::uuid",
      values
    )

  def get_publication(self, publication_id: str) -> dict:
    self.cur.execute(
      "SELECT publication_id, title, doc_type, full_text, sections, classification FROM publications WHERE publication_id = %s::uuid",
      (publication_id,)
    )
    row = self.cur.fetchone()
    if not row:
      raise ValueError(f"Publication not found: {publication_id}")
    return {
      'publication_id': str(row[0]), 'title': row[1], 'doc_type': row[2],
      'full_text': row[3] or '', 'sections': row[4] or [], 'classification': row[5] or {}
    }

  def process(self, payload: dict):
    raise NotImplementedError
