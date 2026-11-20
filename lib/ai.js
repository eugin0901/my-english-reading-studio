import OpenAI from 'openai';
import { RequestError } from './errors';

export function classifyOpenAIError(error) {
  const code = error.code ?? error.error?.code;
  const type = error.type ?? error.error?.type;
  const quotaCodes = ['insufficient_quota', 'billing_hard_limit_reached'];
  if (quotaCodes.includes(code) || quotaCodes.includes(type) || error.status === 402) {
    return new RequestError('AI_QUOTA', 503, 'AI 서비스 사용 한도에 도달했습니다. OpenAI 결제 설정과 사용 한도를 확인해 주세요.');
  }
  if (code === 'model_not_found' || error.status === 404) {
    return new RequestError('AI_MODEL', 503, 'AI 모델 이름과 프로젝트의 모델 접근 권한을 확인해 주세요.');
  }
  if (error.status === 401 || error.status === 403) {
    return new RequestError('AI_ACCESS', 503, 'AI 서비스의 API 키와 프로젝트 권한을 확인해 주세요.');
  }
  if (error.status === 429) {
    if (code === 'rate_limit_exceeded' || type === 'rate_limit_exceeded') {
      return new RequestError('AI_RATE_LIMIT', 429, 'OpenAI 프로젝트의 요청 또는 토큰 한도에 도달했습니다. 반복되면 모델의 사용 한도를 확인해 주세요.');
    }
    return new RequestError('AI_LIMIT_UNKNOWN', 429, 'OpenAI가 요청을 제한했습니다. 반복되면 API 결제 상태와 프로젝트 사용 한도를 확인해 주세요.');
  }
  if (error.status === 400 || error.status === 422) {
    return new RequestError('AI_REQUEST', 502, 'AI 모델의 Responses API 및 구조화 출력 지원 여부를 확인해 주세요.');
  }
  return new RequestError('AI_UNAVAILABLE', 502, 'AI 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
}

const termSchema = {type:'object',additionalProperties:false,required:['expression','meaning','type','example'],properties:{expression:{type:'string'},meaning:{type:'string'},type:{type:'string',enum:['word','idiom','phrasal verb','grammar']},example:{type:'string'}}};
const tutorSchema = {type:'object',additionalProperties:false,required:['answer','terms'],properties:{answer:{type:'string'},terms:{type:'array',items:termSchema}}};
const questionSchema = {type:'object',additionalProperties:false,required:['stem','options','correctIndex','explanation','sourceExpression'],properties:{stem:{type:'string'},options:{type:'array',items:{type:'string'}},correctIndex:{type:'integer'},explanation:{type:'string'},sourceExpression:{type:'string'}}};
const quizSchema = {type:'object',additionalProperties:false,required:['title','questions'],properties:{title:{type:'string'},questions:{type:'array',items:questionSchema}}};
async function structured(system, input, schema, name) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new RequestError('AI_CONFIGURATION', 503, 'AI 서비스의 API 키 설정을 확인해 주세요.');
  const client = new OpenAI({ apiKey, timeout: 25_000, maxRetries: 0 });
  let result;
  try {
    result = await client.responses.create({
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
      store: false,
      instructions: system,
      input: JSON.stringify(input),
      text: { format: { type: 'json_schema', name, strict: true, schema } },
    });
  } catch (error) {
    const failure = classifyOpenAIError(error);
    if (error.status === 429 || failure.code === 'AI_QUOTA') {
      console.warn('OpenAI limit response', {
        operation: name,
        status: error.status,
        code: failure.code,
        retryAfterProvided: Boolean(error.headers?.get?.('retry-after')),
      });
    }
    throw failure;
  }
  try {
    if (result.status !== 'completed' || !result.output_text) throw new Error();
    return JSON.parse(result.output_text);
  } catch {
    throw new RequestError('AI_OUTPUT', 502, 'AI가 완전한 답변을 생성하지 못했습니다. 다시 시도해 주세요.');
  }
}
export async function teach(messages, latest) {
  const result = await structured(
    `너는 한국인 성인 학습자가 영어 원서를 스스로 읽을 수 있도록 돕는 영어 독해 선생님이다.
한국어로 쉽고 정확하게 설명하고, 영어 표현은 원문 그대로 표시한다. 첫 문단에서 사용자의 질문에 바로 답한다.

질문의 종류에 따라 설명을 구성한다.
- 문장 해석: 이 문맥에서 자연스러운 한국어 번역을 먼저 제시한다. 어려운 부분만 의미 단위로 끊고, 주어와 동사, 수식 관계, 대명사가 가리키는 대상 등 해석에 영향을 주는 구조를 설명한다.
- 단어·숙어: 문장에서 쓰인 뜻과 뉘앙스를 먼저 설명한다. 이 뜻을 판단한 문맥 단서와 자주 쓰는 형태를 짚는다. 도움이 되면 헷갈리는 표현과 비교한다.
- 문법·표현 비교: 질문에 나온 문장을 근거로 형태와 의미가 어떻게 연결되는지 설명한다. 의미 차이가 드러나는 짧은 영어 예문과 자연스러운 번역을 함께 제시한다.

answer는 읽기 쉬운 Markdown으로 작성한다. 짧은 질문에는 간결하게 답한다. 설명할 내용이 여러 가지일 때는 짧은 소제목(###), 굵은 핵심 표현, 목록으로 나눈다. 원문 인용은 필요한 구절만 인용 블록으로 표시한다. HTML, 표, 코드 블록은 사용하지 않는다. 창작 문장은 '예문'으로 표시하고 책의 원문처럼 소개하지 않는다. 문맥이 부족하면 가능한 해석과 그 조건을 밝힌다. 등장인물, 줄거리, 원문을 추측해서 단정하지 않는다.

이전 대화는 현재 질문의 맥락을 이해하는 데 활용한다. terms에는 이번 답변에서 실제로 설명한 학습 표현을 최대 5개 담는다. 각 항목의 뜻은 답변에서 설명한 문맥과 일치해야 한다. 적절한 학습 표현이 없으면 빈 배열을 반환한다. 개인정보를 추출하지 않는다.`,
    {recentMessages: messages, latest}, tutorSchema, 'tutor_reply');
  if (!result.answer?.trim()) throw new RequestError('AI_OUTPUT', 502, 'AI가 빈 답변을 반환했습니다. 다시 시도해 주세요.');
  result.terms = (result.terms || []).slice(0,5).filter(t => t.expression.trim() && t.meaning.trim());
  return result;
}
export async function makeQuiz(entries, wrong) {
  const result = await structured(
    `영어 원서 복습시험 출제자다. 정확히 10개의 한국어 객관식 4지선다 문제를 만든다. 각 질문은 독립적이며 정답은 하나만 존재한다. 단어 2, 숙어/구동사 2, 문맥 판단 3, 문법 1, 자연스러운 해석 2문제로 구성한다. 실제 학습 항목과 오답을 우선 사용하되 부족하면 명확히 창작한 영어 예문을 활용한다. 창작 예문을 책의 원문이라고 주장하지 않는다. 교묘한 함정이나 애매한 동의어 선택지는 피한다. correctIndex는 0부터 3까지다. options는 반드시 4개다. 해설은 한국어로 간결하고 정확하게 제공한다.`,
    {learned:entries, recentMistakes:wrong}, quizSchema,'weekly_quiz');
  if (!Array.isArray(result.questions) || result.questions.length !== 10 || result.questions.some(q=>q.options.length !== 4 || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3)) throw new RequestError('AI_QUIZ_FORMAT', 502, '시험 형식 검증에 실패했습니다. 다시 시도해 주세요.');
  return result;
}
