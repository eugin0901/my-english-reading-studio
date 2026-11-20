import OpenAI from 'openai';
function ai() { if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY가 없습니다.'); return new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); }
function model() { return process.env.OPENAI_MODEL || 'gpt-4.1-mini'; }

const termSchema = {type:'object',additionalProperties:false,required:['expression','meaning','type','example'],properties:{expression:{type:'string'},meaning:{type:'string'},type:{type:'string',enum:['word','idiom','phrasal verb','grammar']},example:{type:'string'}}};
const tutorSchema = {type:'object',additionalProperties:false,required:['answer','terms'],properties:{answer:{type:'string'},terms:{type:'array',items:termSchema}}};
const questionSchema = {type:'object',additionalProperties:false,required:['stem','options','correctIndex','explanation','sourceExpression'],properties:{stem:{type:'string'},options:{type:'array',items:{type:'string'}},correctIndex:{type:'integer'},explanation:{type:'string'},sourceExpression:{type:'string'}}};
const quizSchema = {type:'object',additionalProperties:false,required:['title','questions'],properties:{title:{type:'string'},questions:{type:'array',items:questionSchema}}};
async function structured(system, input, schema, name) {
  const result = await ai().responses.create({
    model: model(), store: false,
    instructions: system,
    input: JSON.stringify(input),
    text: {format:{type:'json_schema', name, strict:true, schema}}
  });
  if (!result.output_text) throw new Error('AI가 답변을 생성하지 못했습니다.');
  return JSON.parse(result.output_text);
}
export async function teach(messages, latest) {
  const result = await structured(
    `너는 한국인 성인 학습자를 가르치는 다정하지만 정확한 영어 원서 독해 선생님이다. 사용자가 영어 표현이나 해석을 물으면 한국어로 명료하게 설명한다. 이전 학습 맥락을 활용하되, 실제 원문이 아닌 창작 예문은 '예문'이라고 표시한다. 학습할 만한 단어/숙어/구동사/문법을 최대 5개 terms로 추출한다. 개인정보는 추출하지 않는다. 영문 원문을 장문으로 재생산하지 않는다.`,
    {recentMessages: messages, latest}, tutorSchema, 'tutor_reply');
  result.terms = (result.terms || []).slice(0,5).filter(t => t.expression && t.meaning);
  return result;
}
export async function makeQuiz(entries, wrong) {
  const result = await structured(
    `영어 원서 복습시험 출제자다. 정확히 10개의 한국어 객관식 4지선다 문제를 만든다. 각 질문은 독립적이며 정답은 하나만 존재한다. 단어 2, 숙어/구동사 2, 문맥 판단 3, 문법 1, 자연스러운 해석 2문제로 구성한다. 실제 학습 항목과 오답을 우선 사용하되 부족하면 명확히 창작한 영어 예문을 활용한다. 창작 예문을 책의 원문이라고 주장하지 않는다. 교묘한 함정이나 애매한 동의어 선택지는 피한다. correctIndex는 0부터 3까지다. options는 반드시 4개다. 해설은 한국어로 간결하고 정확하게 제공한다.`,
    {learned:entries, recentMistakes:wrong}, quizSchema,'weekly_quiz');
  if (!Array.isArray(result.questions) || result.questions.length !== 10 || result.questions.some(q=>q.options.length !== 4 || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3)) throw new Error('시험 형식 검증에 실패했습니다. 다시 시도해 주세요.');
  return result;
}
