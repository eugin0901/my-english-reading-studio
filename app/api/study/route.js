import { isUuid } from '../../../lib/books';
import { requireUser, jsonError, ensureProfile } from '../../../lib/db';
import { teach } from '../../../lib/ai';
import { RequestError } from '../../../lib/errors';
export const maxDuration = 60;
export const runtime = 'nodejs';
export async function POST(request) {
  let operation = 'study.auth';
  try {
    const {user,db} = await requireUser(request);
    const {message, bookId} = (await request.json().catch(() => null)) || {};
    if (typeof message !== 'string' || message.trim().length < 1 || message.length > 2000) return Response.json({error:'메시지는 1~2000자로 작성해 주세요.'},{status:400});
    if (bookId != null) {
      if (!isUuid(bookId)) return Response.json({error:'올바른 원서를 선택해 주세요.'},{status:400});
      operation = 'study.book';
      const { data: book, error } = await db.from('reading_books').select('id').eq('user_id', user.id).eq('id', bookId).maybeSingle();
      if (error) throw error;
      if (!book) return Response.json({error:'선택한 원서를 찾을 수 없습니다.'},{status:404});
    }
    operation = 'study.profile';
    await ensureProfile(db,user);
    operation = 'study.history';
    const {data:recent,error:rerr} = await db.from('messages').select('role,content').eq('user_id',user.id).order('created_at',{ascending:false}).limit(12);
    if (rerr) throw rerr;
    operation = 'study.openai';
    const result = await teach((recent||[]).reverse(),message.trim());
    operation = 'study.save';
    const terms = [...new Map(result.terms.map(term => {
      const expression = term.expression.trim().slice(0, 120);
      return [expression, {
        expression,
        meaning: term.meaning.trim().slice(0, 250),
        type: term.type,
        example: term.example.slice(0, 300),
      }];
    })).values()];
    const { error } = await db.rpc(bookId ? 'save_book_study_turn' : 'save_study_turn', {
      ...(bookId ? { p_book_id: bookId } : {}),
      p_user_id: user.id, p_message: message.trim(), p_answer: result.answer, p_terms: terms,
    });
    if (error) {
      if (error.code === 'PGRST202') {
        throw new RequestError('DB_MIGRATION_REQUIRED', 503, '학습 기록 저장을 위한 데이터베이스 업데이트가 필요합니다.');
      }
      throw error;
    }
    return Response.json({answer:result.answer,terms});
  } catch(e) { return jsonError(e, operation); }
}
