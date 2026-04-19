from base_worker import BaseWorker

class Stage2Worker(BaseWorker):
  def __init__(self):
    super().__init__('stage2', 'stage3')
    import json, os
    taxonomy_path = os.path.join(os.path.dirname(__file__), 'taxonomy', 'consumer_duty.json')
    with open(taxonomy_path) as f:
      self.taxonomy = json.load(f)

  def process(self, payload):
    publication_id = payload['publication_id']
    pub = self.get_publication(publication_id)
    # full_text comes from the publications row — payload no longer carries it
    # (see stage1). Fall back to payload only for older queued rows.
    full_text_raw = pub.get('full_text') or payload.get('full_text', '')
    text = (pub['title'] + ' ' + full_text_raw).lower()

    # Framework matching
    matches = [kw for kw in self.taxonomy['keywords'] if kw.lower() in text]
    if len(matches) < 2:
      self.logger.info(f"Stage2 skip: not Consumer Duty relevant (matches={len(matches)})")
      return

    doc_type = pub['doc_type'] or 'GuidanceNote'

    # Severity
    has_high_phrase = any(p in text for p in self.taxonomy['high_severity_phrases'])
    if doc_type == 'FinalRule' and has_high_phrase:
      severity = 'CRITICAL'
    elif doc_type == 'FinalRule' or len(matches) >= 3:
      severity = 'HIGH'
    elif doc_type == 'ConsultationPaper' or len(matches) == 2:
      severity = 'MEDIUM'
    else:
      severity = 'LOW'

    # Urgency — scan for UK date patterns
    import re
    from datetime import datetime, timezone
    from dateutil import parser as dateparser
    urgency = 'MONITOR'
    date_pat = re.compile(
      r'\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b',
      re.IGNORECASE
    )
    now = datetime.now(timezone.utc)
    min_days = None
    for m in date_pat.finditer(full_text_raw):
      try:
        dt = dateparser.parse(m.group(0)).replace(tzinfo=timezone.utc)
        days = (dt - now).days
        if days > 0:
          min_days = days if min_days is None else min(min_days, days)
      except Exception:
        pass
    if min_days is not None:
      if min_days < 7: urgency = 'IMMEDIATE'
      elif min_days < 30: urgency = 'URGENT'
      elif min_days < 90: urgency = 'STANDARD'

    # Provisions (full_text_raw already loaded above)
    affected_provisions = [p for p in self.taxonomy['provisions'] if p in full_text_raw]
    confidence = 'HIGH' if len(matches) >= 4 else 'MEDIUM' if len(matches) >= 2 else 'LOW'

    classification = {
      'framework': 'ConsumerDuty', 'severity': severity, 'urgency': urgency,
      'confidence': confidence, 'affected_provisions': affected_provisions
    }

    self.update_publication(publication_id, classification=classification, status='classified')
    self.publish_next({
      **payload, 'publication_id': publication_id,
      'framework': 'ConsumerDuty', 'severity': severity, 'urgency': urgency,
      'affected_provisions': affected_provisions
    })
    self.logger.info(f"Stage2 classified: pub={publication_id}, severity={severity}, urgency={urgency}")

if __name__ == '__main__': Stage2Worker().run()
