import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = { 
  vus: 20, 
  duration: '60s', 
  thresholds: { http_req_duration: ['p(95)<2000'] } 
};

const BASE = __ENV.API_BASE || 'http://localhost:8000';
const HEADERS = { 'X-API-Key': 'regos-proto-2026' };

export default function () {
  const trigger = http.post(BASE + '/api/ingest/trigger', null, { headers: HEADERS });
  check(trigger, { 'trigger 200': r => r.status === 200 });
  
  const pubs = http.get(BASE + '/api/publications', { headers: HEADERS });
  check(pubs, { 'publications 200': r => r.status === 200, 'has body': r => r.body.length > 2 });
  
  const tasks = http.get(BASE + '/api/tasks', { headers: HEADERS });
  check(tasks, { 'tasks 200': r => r.status === 200 });
  
  const status = http.get(BASE + '/api/pipeline/status', { headers: HEADERS });
  check(status, { 'status 200': r => r.status === 200 });
  
  sleep(1);
}
