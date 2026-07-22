import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const html = read('index.html');
const clientScript = read('spazio_cliente.js');
const serviceWorker = read('service-worker.js');
const adminFunction = read('supabase/functions/ares-admin-users/index.ts');
const adminMigration = read('supabase/migrations/003_admin_user_management.sql');

new vm.Script(clientScript, { filename: 'spazio_cliente.js' });
new vm.Script(serviceWorker, { filename: 'service-worker.js' });

const inlineScriptPattern = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
let inlineMatch;
let inlineCount = 0;
while ((inlineMatch = inlineScriptPattern.exec(html))) {
  if (!inlineMatch[1].trim()) continue;
  inlineCount += 1;
  new vm.Script(inlineMatch[1], { filename: `index-inline-${inlineCount}.js` });
}

const staticHtml = html.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, '');
const ids = [...staticHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
assert(duplicateIds.length === 0, `ID statici duplicati: ${duplicateIds.join(', ')}`);

const localRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((ref) => !ref.startsWith('http'))
  .filter((ref) => !ref.startsWith('#'))
  .filter((ref) => !ref.startsWith('data:'))
  .filter((ref) => !ref.includes('$'))
  .filter((ref) => !ref.includes(' + '))
  .map((ref) => ref.replace(/^\.\//, '').split('?')[0]);
const missingRefs = [...new Set(localRefs.filter((ref) => ref && !fs.existsSync(ref)))];
assert(missingRefs.length === 0, `Asset locali mancanti: ${missingRefs.join(', ')}`);

const manifestBytes = fs.readFileSync('manifest.json');
assert(manifestBytes[0] !== 0xef, 'manifest.json contiene ancora il BOM UTF-8');
JSON.parse(manifestBytes.toString('utf8'));

const browserCode = `${html}\n${clientScript}`;
assert(html.includes("event === 'PASSWORD_RECOVERY'"), 'gestione callback recupero password mancante');
assert(html.includes('resetPasswordForEmail'), 'richiesta recupero password mancante');
assert(html.includes("['recovery', 'invite'].includes(initialAuthCallbackType)"), 'gestione callback invito mancante');
assert(html.includes("functions.invoke('ares-admin-users'"), 'collegamento gestione utenti protetta mancante');
assert(clientScript.includes('1ANe1Zz0XbzbvzXy8OlSyrW_WSyDjB78'), 'mappa Villa Ciciarelli mancante');
assert(clientScript.includes('earth.google.com/web/@42.49595776,12.3758491'), 'collegamento Google Earth mancante');
assert(!clientScript.includes('new maplibregl.Map'), 'vecchia inizializzazione MapLibre ancora presente');
assert(!html.includes('http://localhost:3000'), 'redirect localhost presente nel sorgente');
assert(!browserCode.includes('SUPABASE_SERVICE_ROLE_KEY'), 'riferimento service-role presente nel codice browser');
assert(adminFunction.includes('.auth.getUser('), 'verifica server-side del token mancante');
assert(/callerProfile\?\.role\s*!==\s*["']super_admin["']/.test(adminFunction), 'controllo server-side Super Admin mancante');
assert(adminFunction.includes('inviteUserByEmail'), 'invito email server-side mancante');
assert(adminMigration.includes('alter table public.ares_admin_audit enable row level security'), 'RLS registro amministrativo mancante');
assert(!/eyJ[A-Za-z0-9_-]{80,}/.test(adminFunction), 'possibile chiave JWT inclusa nella Edge Function');
for (const [pattern, description] of [
  [/ares2026/i, 'password predefinita nel sorgente'],
  [/from\(['"]ares_users['"]\)/, 'lettura browser della tabella password legacy'],
  [/getPublicUrl\(/, 'URL pubblico per Storage privato'],
  [/@latest/, 'dipendenza CDN non versionata']
]) {
  assert(!pattern.test(browserCode), description);
}

console.log(`Controlli superati: ${inlineCount} script inline, ${ids.length} ID statici, ${localRefs.length} riferimenti locali.`);
