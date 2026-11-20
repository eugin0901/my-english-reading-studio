import {requireUser,jsonError} from '../../../../lib/db';
export async function POST(request) {
  try {
    const {user,db}=await requireUser(request);
    const {quizId,answers}=await request.json();
    if(typeof quizId!=='string'||!Array.isArray(answers)) return Response.json({error:'잘못된 답안입니다.'},{status:400});
    const {data:quiz,error:qerr}=await db.from('quizzes').select('id,questions').eq('id',quizId).eq('user_id',user.id).single();
    if(qerr || !quiz) return Response.json({error:'시험을 찾을 수 없습니다.'},{status:404});
    const qs=quiz.questions;
    if(answers.length!==qs.length || answers.some(a=>!Number.isInteger(a)||a<0||a>3)) return Response.json({error:'모든 문항에 답해 주세요.'},{status:400});
    const {data:previous}=await db.from('attempts').select('score,answers,wrong_expressions').eq('quiz_id',quizId).eq('user_id',user.id).maybeSingle();
    if(previous) return Response.json({error:'이미 응시한 시험입니다. 기록에서 점수를 확인하세요.'},{status:409});
    const detail=qs.map((q,i)=>({stem:q.stem,selected:answers[i],correctIndex:q.correctIndex,correct:q.correctIndex===answers[i],explanation:q.explanation,expression:q.sourceExpression}));
    const score=Math.round(detail.filter(x=>x.correct).length*100/detail.length);
    const wrong=detail.filter(x=>!x.correct).map(x=>x.expression);
    const {error:aerr}=await db.from('attempts').insert({user_id:user.id,quiz_id:quizId,answers,score,wrong_expressions:wrong});
    if(aerr) throw aerr;
    // Track repeated mistakes by vocabulary; ignore untracked/new expressions.
    for (const expression of new Set(wrong)) {
      const {data:term}=await db.from('terms').select('id,wrong_count').eq('user_id',user.id).eq('expression',expression).maybeSingle();
      if(term) await db.from('terms').update({wrong_count:term.wrong_count+1}).eq('id',term.id).eq('user_id',user.id);
    }
    return Response.json({score,detail});
  } catch(e){return jsonError(e);}
}
