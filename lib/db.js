import { createClient } from '@supabase/supabase-js';

export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase 서버 환경변수가 없습니다.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireUser(request) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) throw new Error('LOGIN_REQUIRED');
  const db = adminDb();
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data?.user) throw new Error('LOGIN_REQUIRED');
  return { user: data.user, db };
}

export function jsonError(err) {
  const invalid = err.message === 'LOGIN_REQUIRED';
  return Response.json({ error: invalid ? '다시 로그인해 주세요.' : '요청을 처리하지 못했습니다.', detail: process.env.NODE_ENV === 'development' ? err.message : undefined }, { status: invalid ? 401 : 500 });
}

export async function ensureProfile(db, user) {
  const { error } = await db.from('profiles').upsert({ id: user.id, email: user.email || null }, { onConflict: 'id' });
  if (error) throw error;
}

export function dateSeoul(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul', year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function weekKey() {
  // Labels the next available quiz using its local Sunday date.
  const local = dateSeoul();
  const d = new Date(`${local}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0,10);
}
