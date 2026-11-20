import {adminDb,jsonError} from '../../../../lib/db';
import {generateForUser} from '../../../../lib/quiz';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request) {
  try {
    const secret=process.env.CRON_SECRET;
    if(!secret || request.headers.get('authorization')!==`Bearer ${secret}`) return Response.json({error:'Unauthorized'},{status:401});
    const db=adminDb();
    // Designed for a personal app with a single account. For more users, use a queue.
    const {data:users,error}=await db.from('profiles').select('id').order('created_at',{ascending:true}).limit(10);
    if(error) throw error;
    const results=[];
    for(const user of users||[]) {
      try {results.push({user:user.id,...await generateForUser(db,user.id)});}
      catch(e){results.push({user:user.id,error:e.message});}
    }
    return Response.json({ok:results.every(x=>!x.error),results});
  }catch(e){return jsonError(e);}
}
