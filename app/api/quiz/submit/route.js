import {requireUser,jsonError} from '../../../../lib/db';
export async function POST(request) {
  try {
    const {user,db}=await requireUser(request);
    const {quizId,answers}=(await request.json().catch(() => null)) || {};
    if(typeof quizId!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(quizId)||!Array.isArray(answers)) return Response.json({error:'잘못된 답안입니다.'},{status:400});
    const {data:quiz,error:qerr}=await db.from('quizzes').select('id,questions').eq('id',quizId).eq('user_id',user.id).maybeSingle();
    if(qerr) throw qerr;
    if(!quiz) return Response.json({error:'시험을 찾을 수 없습니다.'},{status:404});
    const qs=quiz.questions;
    if(answers.length!==qs.length || answers.some(a=>!Number.isInteger(a)||a<0||a>3)) return Response.json({error:'모든 문항에 답해 주세요.'},{status:400});
    const detail=qs.map((q,i)=>({stem:q.stem,selected:answers[i],correctIndex:q.correctIndex,correct:q.correctIndex===answers[i],explanation:q.explanation,expression:q.sourceExpression}));
    const score=Math.round(detail.filter(x=>x.correct).length*100/detail.length);
    const wrong=detail.filter(x=>!x.correct).map(x=>x.expression);
    const { data: saved, error } = await db.rpc('save_quiz_attempt', {
      p_user_id: user.id, p_quiz_id: quizId, p_answers: answers, p_score: score, p_wrong: wrong,
    });
    if (error) throw error;
    if (!saved) return Response.json({error:'이미 응시한 시험입니다. 기록에서 점수를 확인하세요.'},{status:409});
    return Response.json({score,detail});
  } catch(e){return jsonError(e, 'quiz.submit');}
}
