import { requireUser, jsonError, ensureProfile } from '../../../lib/db';
import { teach } from '../../../lib/ai';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    const {user,db} = await requireUser(request);
    const {message} = await request.json();
    if (typeof message !== 'string' || message.trim().length < 1 || message.length > 2000) return Response.json({error:'메시지는 1~2000자로 작성해 주세요.'},{status:400});
    await ensureProfile(db,user);
    const {data:recent,error:rerr} = await db.from('messages').select('role,content').eq('user_id',user.id).order('created_at',{ascending:false}).limit(12);
    if (rerr) throw rerr;
    const result = await teach((recent||[]).reverse(),message.trim());
    const {error:merr}=await db.from('messages').insert([{user_id:user.id,role:'user',content:message.trim()},{user_id:user.id,role:'assistant',content:result.answer}]);
    if (merr) throw merr;
    for (const t of result.terms) {
      const expression = t.expression.trim().slice(0,120);
      const {error} = await db.from('terms').upsert({user_id:user.id,expression,meaning:t.meaning.slice(0,250),kind:t.type,example:t.example.slice(0,300)}, {onConflict:'user_id,expression'});
      if (error) throw error;
    }
    return Response.json({answer:result.answer,terms:result.terms});
  } catch(e) { return jsonError(e); }
}
