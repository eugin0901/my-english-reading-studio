import {requireUser,jsonError,ensureProfile} from '../../../../lib/db';
import {generateForUser} from '../../../../lib/quiz';
export const runtime='nodejs';
export async function POST(request) {
  try {const {user,db}=await requireUser(request); await ensureProfile(db,user); return Response.json(await generateForUser(db,user.id));}
  catch(e) {return jsonError(e);}
}
