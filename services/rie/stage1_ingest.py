from base_worker import BaseWorker
from urllib.parse import urlparse
import ipaddress
import socket

_FETCH_TIMEOUT = 15

def _is_safe_fetch_url(url: str) -> bool:
  """Block non-http(s) schemes and URLs that resolve to private/loopback/link-local
  addresses. Prevents workers from being steered into fetching internal services
  or cloud metadata endpoints (SSRF)."""
  try:
    parsed = urlparse(url)
  except Exception:
    return False
  if parsed.scheme not in ('http', 'https'):
    return False
  host = parsed.hostname
  if not host:
    return False
  try:
    infos = socket.getaddrinfo(host, None)
  except socket.gaierror:
    return False
  for info in infos:
    addr = info[4][0]
    try:
      ip = ipaddress.ip_address(addr)
    except ValueError:
      continue
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
      return False
  return True

class Stage1Worker(BaseWorker):
  def __init__(self): super().__init__('stage1', 'stage2')

  def process(self, payload):
    publication_id = payload['publication_id']
    pub = self.get_publication(publication_id)
    source_url = payload.get('source_url', '')

    if source_url and not _is_safe_fetch_url(source_url):
      self.logger.warning(f"Stage1: refusing unsafe source_url: {source_url}")
      source_url = ''

    # 1. Fetch full text
    from bs4 import BeautifulSoup
    import re as _re

    def _looks_like_html(text: str) -> bool:
      return bool(_re.search(r'<\s*(html|head|body|meta|div|span|p)\b', text, _re.IGNORECASE))

    def _strip_html(text: str) -> str:
      return BeautifulSoup(text, 'lxml').get_text(separator=' ', strip=True)

    full_text = ''
    if source_url.lower().endswith('.pdf'):
      import pdfplumber, httpx, io
      resp = httpx.get(source_url, timeout=_FETCH_TIMEOUT, follow_redirects=True)
      with pdfplumber.open(io.BytesIO(resp.content)) as pdf:
        full_text = '\n'.join(p.extract_text() or '' for p in pdf.pages)
    else:
      import trafilatura
      raw = trafilatura.fetch_url(source_url) or ''
      # trafilatura can return raw HTML when extraction fails — detect and clean it
      if raw and _looks_like_html(raw):
        self.logger.warning(f"Stage1: trafilatura returned HTML for {source_url}, stripping tags")
        full_text = _strip_html(raw)
      else:
        full_text = raw

      if not full_text and source_url:
        import httpx
        try:
          r = httpx.get(source_url, timeout=_FETCH_TIMEOUT, follow_redirects=True)
          full_text = _strip_html(r.text)
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
    # Store full_text once on the publications row; downstream stages load it
    # from there rather than carrying a second copy through the queue payload.
    self.update_publication(publication_id, full_text=full_text[:10000], sections=sections, status='ingested')
    forward = {k: v for k, v in payload.items() if k != 'full_text'}
    forward['publication_id'] = publication_id
    self.publish_next(forward)
    self.logger.info(f"Stage1 complete: pub={publication_id}, sections={len(sections)}")

if __name__ == '__main__': Stage1Worker().run()
