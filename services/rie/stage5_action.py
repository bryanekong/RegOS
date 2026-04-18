from base_worker import BaseWorker

class Stage5Worker(BaseWorker):
  def __init__(self): super().__init__('stage5', None)

  def process(self, payload):
    from datetime import datetime, timedelta, timezone
    urgency = payload.get('urgency', 'STANDARD')
    days_map = {'IMMEDIATE': 7, 'URGENT': 30, 'STANDARD': 90, 'MONITOR': 180}
    deadline = (datetime.now(timezone.utc) + timedelta(days=days_map.get(urgency, 90))).date()

    self.cur.execute(
      """INSERT INTO remediation_tasks
         (publication_id, policy_id, policy_section_id, section_title,
          change_type, action_text, severity, deadline, status, owner)
         VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, 'open', 'Compliance Team')
         ON CONFLICT ON CONSTRAINT uq_remediation_task_pub_policy_section DO NOTHING
         RETURNING task_id""",
      (
        payload['publication_id'], payload['policy_id'],
        payload.get('policy_section_id'), payload.get('section_title'),
        payload.get('change_type'), payload.get('action_text'),
        payload.get('severity'), deadline.isoformat()
      )
    )
    row = self.cur.fetchone()
    self.update_publication(
      payload['publication_id'],
      status='actioned',
      processed_at=datetime.now(timezone.utc).isoformat()
    )
    if row:
      self.logger.info(f"Stage5 task created: task_id={row[0]}, policy={payload['policy_id']}")
    else:
      self.logger.info(
        f"Stage5 skipped duplicate task: pub={payload['publication_id']}, "
        f"policy={payload['policy_id']}, section={payload.get('policy_section_id')}"
      )

if __name__ == '__main__': Stage5Worker().run()
