import pytest
from datetime import datetime, timedelta, timezone

def classify(title, full_text, doc_type, taxonomy):
    text = (title + ' ' + full_text).lower()
    matches = [kw for kw in taxonomy['keywords'] if kw.lower() in text]
    
    if len(matches) < 2:
        return None
        
    has_high_phrase = any(p in text for p in taxonomy['high_severity_phrases'])
    
    if doc_type == 'FinalRule' and has_high_phrase:
        severity = 'CRITICAL'
    elif doc_type == 'FinalRule' or len(matches) >= 3:
        severity = 'HIGH'
    elif doc_type == 'ConsultationPaper' or len(matches) == 2:
        severity = 'MEDIUM'
    else:
        severity = 'LOW'
        
    import re
    from dateutil import parser as dateparser
    urgency = 'MONITOR'
    date_pat = re.compile(
      r'\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b',
      re.IGNORECASE
    )
    now = datetime.now(timezone.utc)
    min_days = None
    for m in date_pat.finditer(full_text):
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
        
    affected_provisions = [p for p in taxonomy['provisions'] if p in full_text]
    confidence = 'HIGH' if len(matches) >= 4 else 'MEDIUM' if len(matches) >= 2 else 'LOW'
    
    return {
        'framework': taxonomy['framework'],
        'severity': severity,
        'urgency': urgency,
        'confidence': confidence,
        'affected_provisions': affected_provisions
    }

@pytest.fixture
def taxonomy():
    return {
      "framework": "ConsumerDuty",
      "keywords": ["consumer duty", "fair value", "vulnerable customers", "price and value", "good outcomes"],
      "high_severity_phrases": ["enforcement action"],
      "provisions": ["PRIN 2A.1", "COCON 4.1"]
    }

def test_classify_three_matches(taxonomy):
    res = classify("Update", "Consumer duty requires fair value and good outcomes.", "GuidanceNote", taxonomy)
    assert res is not None
    assert res['framework'] == 'ConsumerDuty'
    assert res['severity'] == 'HIGH'
    
def test_classify_no_matches(taxonomy):
    res = classify("Update on IT", "This is about technology and nothing else.", "GuidanceNote", taxonomy)
    assert res is None

def test_classify_critical(taxonomy):
    res = classify("Final Policy", "consumer duty, fair value. Failure leads to enforcement action.", "FinalRule", taxonomy)
    assert res['severity'] == 'CRITICAL'
    
def test_classify_medium(taxonomy):
    res = classify("Consultation", "consumer duty, fair value.", "ConsultationPaper", taxonomy)
    assert res['severity'] == 'MEDIUM'

def test_classify_urgency_immediate(taxonomy):
    future_date = (datetime.now(timezone.utc) + timedelta(days=4)).strftime('%d %B %Y')
    res = classify("Policy", f"consumer duty, fair value. Comply by {future_date}", "FinalRule", taxonomy)
    assert res['urgency'] == 'IMMEDIATE'

def test_classify_urgency_monitor(taxonomy):
    res = classify("Policy", "consumer duty, fair value. No dates mentioned.", "FinalRule", taxonomy)
    assert res['urgency'] == 'MONITOR'

def test_classify_provisions(taxonomy):
    res = classify("Policy", "consumer duty, fair value. See PRIN 2A.1 and COCON 4.1.", "FinalRule", taxonomy)
    assert 'PRIN 2A.1' in res['affected_provisions']
    assert 'COCON 4.1' in res['affected_provisions']
