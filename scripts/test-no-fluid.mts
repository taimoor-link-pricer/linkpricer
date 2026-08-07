import { adminAuth } from '../lib/firebase/admin';

const BASE = 'https://linkpricer.ai';
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
const uid = 'GjInuTWiVLeoJHY6mYh8FzyEbdb2';

const customToken = await adminAuth.createCustomToken(uid);
const exchangeRes = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) }
);
const idToken = (await exchangeRes.json()).idToken;
const sessionRes = await fetch(`${BASE}/api/auth/session`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE },
  body: JSON.stringify({ idToken }),
});
const cookie = sessionRes.headers.get('set-cookie')!.split(';')[0];

console.log('Fluid Compute now DISABLED. Testing Amit 10x, 300ms apart...\n');
let ok = 0;
const results: number[] = [];
for (let i = 0; i < 10; i++) {
  const res = await fetch(`${BASE}/api/developers/me`, { headers: { Cookie: cookie } });
  results.push(res.status);
  if (res.status === 200) ok++;
  await new Promise(r => setTimeout(r, 300));
}
console.log(`Amit: ${ok}/10 succeeded — [${results.join(', ')}]`);
