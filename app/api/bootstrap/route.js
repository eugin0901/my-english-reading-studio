import { readPages } from '../../../lib/books';
import { requireUser, jsonError, ensureProfile } from '../../../lib/db';
export async function GET(request) {
  try {
    const {user,db}=await requireUser(request);
    await ensureProfile(db,user);
    const [m,t,q,a,books]=await Promise.all([
      db.from('messages').select('id,role,content,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(40),
      readPages(() => db.from('terms').select('id,expression,meaning,kind,example,wrong_count,reading_book_terms(book_id)').eq('user_id',user.id).order('created_at',{ascending:false}).order('id')),
      db.from('quizzes').select('id,title,week_key,created_at,questions').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20),
      db.from('attempts').select('quiz_id,score,wrong_expressions,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(30),
      readPages(() => db.from('reading_books').select('id,title').eq('user_id',user.id).order('title').order('id'))
    ]);
    for(const v of [m,q,a]) if(v.error) throw v.error;
    // Never expose grading answers before submitting the quiz.
    const quizzes=q.data.map(x=>({id:x.id,title:x.title,week_key:x.week_key,created_at:x.created_at,questions:x.questions.map(({stem,options,sourceExpression})=>({stem,options,sourceExpression}))}));
    return Response.json({messages:m.data.reverse(),terms:t.map(({reading_book_terms, ...term}) => ({ ...term, bookIds: reading_book_terms.map(link => link.book_id) })),books,quizzes,attempts:a.data});
  } catch(e) { return jsonError(e, 'bootstrap'); }
}
