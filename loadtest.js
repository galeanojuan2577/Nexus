import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const failRate = new Rate('failed_requests');

export const options = {
  stages: [
    { duration: '5s', target: 10 },
    { duration: '15s', target: 30 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    failed_requests: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

const BASE = 'http://localhost:8000';
const EMAIL = "loadtest_" + Date.now() + "@nexus.com";

export function setup() {
  http.post(`${BASE}/auth/register`, JSON.stringify({
    email: EMAIL, password: 'test1234', name: 'LoadTest', role: 'admin',
  }), { headers: { 'Content-Type': 'application/json' } });
  const login = http.post(`${BASE}/auth/login`, JSON.stringify({
    email: EMAIL, password: 'test1234',
  }), { headers: { 'Content-Type': 'application/json' } });
  return { token: login.json('access_token') };
}

export default function (data) {
  const h = { Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/json' };

  let r;

  r = http.get(`${BASE}/health`);
  check(r, { 'health 200': (res) => res.status === 200 });
  failRate.add(r.status !== 200);

  r = http.get(`${BASE}/dashboard/stats`, { headers: h });
  check(r, { 'dashboard 200': (res) => res.status === 200 });
  failRate.add(r.status !== 200);

  r = http.get(`${BASE}/devices/`, { headers: h });
  check(r, { 'devices 200': (res) => res.status === 200 });
  failRate.add(r.status !== 200);

  r = http.get(`${BASE}/auth/me`, { headers: h });
  check(r, { 'auth/me 200': (res) => res.status === 200 });
  failRate.add(r.status !== 200);

  sleep(0.5);
}
