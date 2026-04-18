import pytest

def delta_match(section, pub_text, affected_provisions):
    section_refs = section.get('reg_refs', [])
    section_text = section.get('text', '')

    ref_match = bool(set(section_refs) & set(affected_provisions))
    if ref_match:
        confidence = 'HIGH'
    else:
        try:
            if len(section_text.split()) > 5 and len(pub_text.split()) > 5:
                from sklearn.feature_extraction.text import TfidfVectorizer
                vectorizer = TfidfVectorizer(max_features=500, stop_words='english')
                tfidf = vectorizer.fit_transform([section_text, pub_text])
                sim = (tfidf[0] * tfidf[1].T).toarray()[0][0]
                confidence = 'MEDIUM' if sim > 0.15 else None
            else:
                confidence = None
        except Exception:
            confidence = None
            
    if not confidence:
        return None
        
    text_lower = section_text.lower()
    if 'deadline' in text_lower or 'comply by' in text_lower:
        change_type = 'DEADLINE_CHANGE'
    else:
        change_type = 'NEW_REQUIREMENT' # simplified for test pure function
        
    return {
        'confidence': confidence,
        'change_type': change_type
    }

def test_delta_match_high():
    section = {'reg_refs': ['PRIN 2A.1'], 'text': 'Some text'}
    res = delta_match(section, 'Pub text', ['PRIN 2A.1'])
    assert res['confidence'] == 'HIGH'
    
def test_delta_match_medium():
    section = {'reg_refs': ['COCON 4.2'], 'text': 'This policy establishes consumer duty principles regarding fair value and vulnerable customers in the firm.'}
    pub_text = 'The consumer duty rule specifies principles for fair value to vulnerable customers in retail financial services.'
    res = delta_match(section, pub_text, ['PRIN 2A.1'])
    assert res['confidence'] == 'MEDIUM'

def test_delta_match_none():
    section = {'reg_refs': [], 'text': 'IT infrastructure requirements for server racks.'}
    pub_text = 'The consumer duty rule specifies principles for fair value.'
    res = delta_match(section, pub_text, ['PRIN 2A.1'])
    assert res is None
