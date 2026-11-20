import { makeQuiz } from './ai';
import { weekKey } from './db';
export async function generateForUser(db, uid) {
  const wk = weekKey();
  const {data:existing,error:lookupErr} = await db.from('quizzes').select('id').eq('user_id',uid).eq('week_key',wk).maybeSingle();
  if (lookupErr) throw lookupErr;
  if (existing) return {id:existing.id, created:false};
  const [terms, attempts] = await Promise.all([
    db.from('terms').select('expression,meaning,kind,example,wrong_count').eq('user_id',uid).order('created_at',{ascending:false}).limit(150),
    db.from('attempts').select('wrong_expressions').eq('user_id',uid).order('created_at',{ascending:false}).limit(8)
  ]);
  if (terms.error) throw terms.error;
  if (attempts.error) throw attempts.error;
  const previous = (attempts.data || []).flatMap(x=>x.wrong_expressions || []).slice(0,30);
  const quiz = await makeQuiz(terms.data || [], previous);
  const {data, error} = await db.from('quizzes').insert({user_id:uid, week_key:wk, title:quiz.title, questions:quiz.questions}).select('id').single();
  if (error?.code === '23505') return {created:false,duplicate:true};
  if (error) throw error;
  return {id:data.id, created:true};
}
