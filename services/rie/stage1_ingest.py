from base_worker import BaseWorker

class Stage1Worker(BaseWorker):
  def __init__(self): super().__init__('stage1', 'stage2')

  def process(self, payload):
    publication_id = payload['publication_id']
    pub = self.get_publication(publication_id)
    source_url = payload.get('source_url', '')

    # 1. Fetch full text
    full_text = ''
    if source_url.lower().endswith('.pdf'):
      import pdfplumber, httpx, io
      resp = httpx.get(source_url, timeout=20, follow_redirects=True)
      with pdfplumber.open(io.BytesIO(resp.content)) as pdf:
        full_text = '\n'.join(p.extract_text() or '' for p in pdf.pages)
    else:
      import trafilatura
      full_text = trafilatura.fetch_url(source_url) or ''
      if not full_text and source_url:
        import httpx
        from bs4 import BeautifulSoup
        try:
          r = httpx.get(source_url, timeout=15, follow_redirects=True)
          full_text = BeautifulSoup(r.text, 'lxml').get_text(separator=' ', strip=True)
        except Exception:
          pass
    if not full_text:
      full_text = payload.get('summary', pub.get('summary', ''))

    # 2. Extract sections
    sections = []
    lines = full_text.split('\n')
    current_title = 'Introduction'
    current_lines = []
    import re
    heading_pat = re.compile(r'^(\d+\.[\d\.]*\s+[A-Z]|[A-Z][A-Z\s]{3,}:?)\s*$')
    for line in lines:
      stripped = line.strip()
      if not stripped:
        continue
      if heading_pat.match(stripped) and len(stripped) < 80:
        if current_lines:
          sections.append({'id': f's{len(sections)+1}', 'title': current_title, 'text': ' '.join(current_lines)})
        current_title = stripped
        current_lines = []
      else:
        current_lines.append(stripped)
    if current_lines:
      sections.append({'id': f's{len(sections)+1}', 'title': current_title, 'text': ' '.join(current_lines)})
    if not sections:
      sections = [{'id': 's1', 'title': 'Full Text', 'text': full_text[:5000]}]

    # 3. Persist and forward
    self.update_publication(publication_id, full_text=full_text[:10000], sections=sections, status='ingested')
    self.publish_next({**payload, 'publication_id': publication_id, 'full_text': full_text[:8000]})
    self.logger.info(f"Stage1 complete: pub={publication_id}, sections={len(sections)}")

if __name__ == '__main__': Stage1Worker().run()
