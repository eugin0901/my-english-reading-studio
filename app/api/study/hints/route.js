import { requireUser, jsonError } from '../../../../lib/db';
import { readingHints } from '../../../../lib/ai';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request) {
  try {
    await requireUser(request);
    const { source } = (await request.json().catch(() => null)) || {};
    if (typeof source !== 'string' || !source.trim() || source.length > 900) {
      return Response.json({ error: '원서 문장을 1~900자로 입력해 주세요.' }, { status: 400 });
    }
    return Response.json({ hints: await readingHints(source.trim()) });
  } catch (error) {
    return jsonError(error, 'study.hints');
  }
}
