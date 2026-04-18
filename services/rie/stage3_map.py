from base_worker import BaseWorker

class Stage3Worker(BaseWorker):
  def __init__(self):
    super().__init__('stage3', 'stage4')
    import json, os
    taxonomy_path = os.path.join(os.path.dirname(__file__), 'taxonomy', 'consumer_duty.json')
    with open(taxonomy_path) as f:
      self.keywords = json.load(f)['keywords']

  def process(self, payload):
    framework = payload.get('framework')
    if not framework:
      return

    import json
    affected_provisions = payload.get('affected_provisions', [])
    if isinstance(affected_provisions, str):
      affected_provisions = json.loads(affected_provisions)

    # Fetch active Consumer Duty policies
    self.cur.execute(
      "SELECT policy_id, title, reg_refs FROM policies WHERE %s = ANY(frameworks) AND status = 'active'",
      (framework,)
    )
    policies = self.cur.fetchall()
    mapped = 0

    for (policy_id, title, reg_refs) in policies:
      policy_refs = reg_refs or []
      direct_overlap = len(set(policy_refs) & set(affected_provisions))
      keyword_score = sum(1 for kw in self.keywords if kw.lower() in title.lower())
      score = (direct_overlap * 40) + (min(keyword_score, 3) * 10) + 20 + 10

      if score >= 30:
        self.publish_next({
          **payload,
          'policy_id': str(policy_id),
          'relevance_score': score,
          'affected_provisions': affected_provisions
        })
        mapped += 1

    self.logger.info(f"Stage3 mapped: pub={payload['publication_id']}, policies_matched={mapped}")

if __name__ == '__main__': Stage3Worker().run()
