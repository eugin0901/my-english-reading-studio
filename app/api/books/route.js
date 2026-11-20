import { requireUser, jsonError } from '../../../lib/db';
import { isUuid } from '../../../lib/books';

export async function POST(request) {
  try {
    const { user, db } = await requireUser(request);
    const { title } = (await request.json().catch(() => null)) || {};
    const name = typeof title === 'string' ? title.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > 180) {
      return Response.json({ error: '책 제목을 1~180자로 입력해 주세요.' }, { status: 400 });
    }
    const { data, error } = await db.from('reading_books').insert({ user_id: user.id, title: name }).select('id,title').single();
    if (error?.code === '23505') {
      return Response.json({ error: '이미 등록된 제목입니다. 목록에서 원서를 선택해 주세요.' }, { status: 409 });
    }
    if (error) throw error;
    return Response.json({ book: data }, { status: 201 });
  } catch (error) {
    return jsonError(error, 'books.create');
  }
}

export async function PATCH(request) {
  try {
    const { user, db } = await requireUser(request);
    const { bookId, termId } = (await request.json().catch(() => null)) || {};
    if (!isUuid(bookId) || !isUuid(termId)) {
      return Response.json({ error: '원서와 학습 표현을 선택해 주세요.' }, { status: 400 });
    }
    const { error } = await db.from('reading_book_terms').insert({ user_id: user.id, book_id: bookId, term_id: termId });
    if (error?.code === '23503') {
      return Response.json({ error: '원서 또는 표현을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (error && error.code !== '23505') throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error, 'books.link');
  }
}
