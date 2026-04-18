from base_worker import BaseWorker

class Stage4Worker(BaseWorker):
  def __init__(self):
    super().__init__('stage4', 'stage5')
    from sklearn.feature_extraction.text import TfidfVectorizer
    self.vectorizer = TfidfVectorizer(max_features=500, stop_words='english')

  def process(self, payload):
    import json
    publication_id = payload['publication_id']
    policy_id = payload['policy_id']
    affected_provisions = payload.get('affected_provisions', [])
    if isinstance(affected_provisions, str):
      affected_provisions = json.loads(affected_provisions)

    pub = self.get_publication(publication_id)
    pub_text = pub['full_text'][:3000]

    # Fetch policy sections
    self.cur.execute("SELECT sections, doc_type FROM policies WHERE policy_id = %s::uuid", (policy_id,))
    row = self.cur.fetchone()
    if not row:
      return
    sections = row[0] or []
    doc_type = pub.get('doc_type', 'GuidanceNote')

    matched = 0
    for section in sections:
      section_refs = section.get('reg_refs', [])
      section_text = section.get('text', '')

      # Direct reg_ref match
      ref_match = bool(set(section_refs) & set(affected_provisions))
      if ref_match:
        confidence = 'HIGH'
      else:
        # TF-IDF cosine similarity fallback
        try:
          if len(section_text.split()) > 5 and len(pub_text.split()) > 5:
            tfidf = self.vectorizer.fit_transform([section_text, pub_text])
            sim = (tfidf[0] * tfidf[1].T).toarray()[0][0]
            confidence = 'MEDIUM' if sim > 0.10 else 'LOW'
          else:
            confidence = 'LOW'
        except Exception:
          confidence = 'LOW'

      if not confidence:
        continue

      # Change type
      text_lower = section_text.lower()
      if 'deadline' in text_lower or 'comply by' in text_lower:
        change_type = 'DEADLINE_CHANGE'
      elif doc_type == 'FinalRule' and ('must' in text_lower or 'shall' in text_lower or 'required' in text_lower):
        change_type = 'AMENDED_REQUIREMENT'
      else:
        change_type = 'NEW_REQUIREMENT'

      provisions_str = ', '.join(affected_provisions[:3]) if affected_provisions else 'Consumer Duty requirements'
      action_text = (
        f"Review section '{section['title']}' against {provisions_str}. "
        f"The publication '{pub['title']}' introduces a {change_type.lower().replace('_', ' ')}. "
        f"Confidence: {confidence}."
      )

      self.publish_next({
        'publication_id': publication_id,
        'policy_id': policy_id,
        'policy_section_id': section['id'],
        'section_title': section['title'],
        'change_type': change_type,
        'action_text': action_text,
        'confidence': confidence,
        'severity': payload.get('severity', 'MEDIUM'),
        'urgency': payload.get('urgency', 'STANDARD')
      })
      matched += 1

    self.logger.info(f"Stage4 delta: pub={publication_id}, policy={policy_id}, sections_matched={matched}")

if __name__ == '__main__': Stage4Worker().run()
