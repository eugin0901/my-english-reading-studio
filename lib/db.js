import { RequestError } from './errors';
export { jsonError } from './errors';
import { createClient } from '@supabase/supabase-js';

export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new RequestError('DB_CONFIGURATION', 503, '학습 기록 서비스 설정을 확인해 주세요.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireUser(request) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) throw new RequestError('LOGIN_REQUIRED', 401, '다시 로그인해 주세요.');
  const db = adminDb();
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error?.status === 0 || error?.status >= 500) {
    throw new RequestError('AUTH_UNAVAILABLE', 503, '로그인 확인 서비스에 일시적으로 연결할 수 없습니다.');
  }
  if (error || !data?.user) throw new RequestError('LOGIN_REQUIRED', 401, '다시 로그인해 주세요.');
  return { user: data.user, db };
}

export async function ensureProfile(db, user) {
  const { error } = await db.from('profiles').upsert({ id: user.id, email: user.email || null }, { onConflict: 'id' });
  if (error) throw error;
}

export function dateSeoul(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}
export function weekKey(date = new Date()) {
  const local = dateSeoul(date);
  const d = new Date(`${local}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0,10);
}
