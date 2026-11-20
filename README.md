# My English Reading Studio — 배포용 웹앱

영어 원서를 웹사이트에서 AI 선생님과 공부하고, 배운 표현을 자동 저장하고, 매주 일요일 오전 10시(한국시간)에 주간 10문항 시험을 자동 생성하는 개인용 웹앱입니다.

## 구현한 기능

- 이메일 매직링크 로그인 (Supabase Auth)
- ChatGPT와 유사한 영어 원서 질문/답변 (OpenAI API)
- 공부 중 배운 주요 단어·숙어·구동사·문법 자동 추출 및 서버 DB 저장
- 매주 일요일 오전 10시 KST 자동 시험 생성 (Vercel Cron 01:00 UTC)
- 필요할 때 이번 주 시험 수동 생성 (주당 1회만 저장)
- 시험은 정답 비공개 → 전 문항 제출 시 채점·해설 공개
- 오답 표현 누적 및 다음 주 출제 입력에 반영
- 로그인 계정별 데이터 분리, HTTPS 배포 지원

## 배포하기 — 처음 한 번만

1. [Supabase](https://supabase.com/)에서 프로젝트 생성. **Authentication → Providers → Email** 활성화, 이메일 OTP 로그인 사용 가능하도록 설정.
2. Supabase **SQL Editor**에서 `supabase/schema.sql` 전체 실행.
3. Supabase **Project URL**과 **Publishable key**, **Secret key** 확인. Secret key는 서버에서만 사용합니다. 기존 프로젝트에 따라 `service_role` 키를 대체값으로 사용할 수 있지만 새 secret key 사용을 권장합니다.
4. 이 폴더를 GitHub **비공개 저장소**에 업로드하고 [Vercel](https://vercel.com/)로 Import Project → Next.js 선택.
5. Vercel 환경변수에 `.env.example`의 여섯 값을 등록. `CRON_SECRET`은 32자 이상의 무작위 문자열로 설정합니다. API 키는 반드시 **Vercel 서버 환경변수**로만 등록하고 코드나 GitHub에 넣지 않습니다.
6. Deploy 후 Supabase **Authentication → URL Configuration**에서 Site URL을 실제 배포 주소로 설정하고, Redirect URLs에도 `https://YOUR-DOMAIN/**`를 추가.
7. 배포된 주소에서 자신의 이메일로 로그인 → 영어 문장 질문 → 표현 자동 저장 확인.
8. Vercel 프로젝트에서 Cron을 활성화. `vercel.json`의 `0 1 * * 0`은 **일요일 01:00 UTC = 일요일 10:00 한국시간**입니다. 호스팅 요금제에 따라 예약 작업 실행 시점에 오차가 있을 수 있습니다.

## 로컬 실행

```bash
cp .env.example .env.local
npm install
npm run dev
```

`.env.local`에 실제 키를 입력하고 http://localhost:3000 으로 접속합니다. 로컬 인증 리다이렉트를 쓰려면 Supabase Redirect URLs에 `http://localhost:3000/**`도 추가합니다.

## 보안 / 제한

- 이 앱은 **기존에 고정된 ChatGPT 채팅을 자동으로 읽지 않습니다.** 이후에는 이 웹사이트 안에서 공부한 내용이 자동 저장됩니다. 기존 학습 기록은 수동 이전해야 합니다.
- `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`을 브라우저에 노출하지 마세요. `.env.local`은 git에 포함하지 않습니다.
- 모든 데이터 테이블의 RLS를 활성화했고 공개 읽기 정책은 정의하지 않았습니다. 서버만 로그인 토큰을 확인하여 secret key로 접근합니다.
- 데이터는 Supabase 서버에 저장됩니다. OpenAI API로 전송된 질문은 모델 답변 및 단어 추출에 사용됩니다. 개인 식별정보나 의료·금융 기밀은 입력하지 않는 것이 좋습니다.
- 이 버전은 개인 사용에 초점을 맞췄습니다. Cron은 최대 10개 프로필을 순차 처리합니다. 사용자 증가 시 작업 큐, 재시도, 비용 제한, 알림 등이 필요합니다.
- 주간 시험은 출제 때 존재하는 학습 기록을 사용합니다. 일요일 시험 생성 이후 추가로 학습해도 그 주의 시험은 변경되지 않으며 다음 주에 반영됩니다.
- API 모델 `gpt-4.1-mini`는 예시이며 OpenAI 계정에서 사용 가능한 JSON Schema 지원 모델로 변경할 수 있습니다. 최신 사용 가능 모델 및 가격은 OpenAI API 계정에서 확인하세요.
- 자동 생성 문제는 AI가 만들므로 출제 오류 가능성이 있습니다. 중요한 경우 해설을 검토하세요.
- 매주 일요일 기존 ChatGPT 자동화는 **별개**로 남아 있습니다. 이 웹앱만 이용할 경우 기존 자동화는 직접 중지해 중복 출제를 피할 수 있습니다.

## 주요 파일

- `app/page.jsx`: 로그인, AI 채팅, 복습시험, 표현 노트, 성적 UI
- `app/api/study/route.js`: AI 응답 및 자동 학습 기록 저장
- `app/api/quiz/generate/route.js`: 수동 이번 주 시험 생성
- `app/api/quiz/submit/route.js`: 채점 및 오답 저장
- `app/api/cron/sunday/route.js`: 인증된 주간 자동 출제
- `supabase/schema.sql`: 데이터베이스 테이블과 접근 제어
- `vercel.json`: 일요일 자동 예약

## 참고 문서

- Supabase Next.js: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Vercel Cron: https://vercel.com/docs/cron-jobs
- OpenAI Responses API: https://developers.openai.com/api/reference/resources/responses/methods/create
