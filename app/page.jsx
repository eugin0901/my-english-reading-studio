'use client';
import {Component,useEffect,useState,useRef} from 'react';
import Markdown from 'react-markdown';
import Shadowing from './shadowing';
import remarkGfm from 'remark-gfm';
import {createClient} from '@supabase/supabase-js';
import {BookCopy,BookOpen,MessageSquareText,ClipboardCheck,LibraryBig,ChartNoAxesColumnIncreasing,Send,RefreshCw,LogOut,CheckCircle2,AlertCircle} from 'lucide-react';

const tutorMarkup = ['p', 'h1', 'h2', 'h3', 'h4', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote', 'br', 'code', 'del', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];

class TutorReply extends Component {
 static getDerivedStateFromError() {
  return { formattingFailed: true };
 }

 state = { formattingFailed: false };

 render() {
  const { content } = this.props;
  if (this.state.formattingFailed) return <p className="tutorReplyFallback">{content}</p>;
  return <Markdown remarkPlugins={[remarkGfm]}
   components={{table: ({node, ...props}) => <div className="tutorTable"><table {...props}/></div>}}
   allowedElements={tutorMarkup} unwrapDisallowed skipHtml>{content}</Markdown>;
 }
}

let supabase;
function client(){
 if(!supabase) supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
 return supabase;
}
const empty={messages:[],terms:[],quizzes:[],attempts:[],books:[]};

function noteWeekLabel(start) {
 const end = new Date(start + 'T00:00:00Z');
 end.setUTCDate(end.getUTCDate() + 6);
 const last = end.toISOString().slice(0, 10);
 return start + ' ~ ' + (start.slice(0, 4) === last.slice(0, 4) ? last.slice(5) : last);
}
export default function Page(){
 const [session,setSession]=useState(null),[email,setEmail]=useState(''),[linkSent,setLinkSent]=useState(false),[tab,setTab]=useState('study');
 const [kakaoBusy, setKakaoBusy] = useState(false);
 const [data,setData]=useState(empty),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[quizId,setQuizId]=useState(''),[answers,setAnswers]=useState({}),[result,setResult]=useState(null);
 const [bookId, setBookId] = useState('');
 const [bookFilter, setBookFilter] = useState('all');
 const [weekFilter, setWeekFilter] = useState('all');
 const [bookTitle, setBookTitle] = useState('');
 const [addingBook, setAddingBook] = useState(false);
 const [bookBusy, setBookBusy] = useState(false);
 const [sourceText, setSourceText] = useState('');
 const [ownTranslation, setOwnTranslation] = useState('');
 const ownSource = sourceText.trim();
 const [hintResult, setHintResult] = useState(null);
 const [hintsLoading, setHintsLoading] = useState(false);
 const visibleHints = hintResult?.source === ownSource ? hintResult : null;
 const [practiceOpen, setPracticeOpen] = useState(true);
 const [readingAssessment, setReadingAssessment] = useState(null);
 const [exerciseTranslation, setExerciseTranslation] = useState('');
 const [exerciseComposition, setExerciseComposition] = useState('');
 const assessmentCard = useRef(null);
 const latestReply = useRef(null);
 const studySequence = useRef(0);
 const [replyVersion, setReplyVersion] = useState(0);
 useEffect(()=>{
  const auth=client().auth;
  auth.getSession().then(({data})=>setSession(data.session));
  const {data:{subscription}}=auth.onAuthStateChange((_event,next)=>setSession(next));
  return()=>subscription.unsubscribe();
 },[]);
 useEffect(() => {
  function syncReadingSkills(event) {
   if (window.location.hash === '#reading-skills') {
    setTab('skills');
    setError('');
    window.scrollTo(0, 0);
   } else if (event?.oldURL?.endsWith('#reading-skills')) {
    setTab('study');
   }
  }
  syncReadingSkills();
  window.addEventListener('hashchange', syncReadingSkills);
  return () => window.removeEventListener('hashchange', syncReadingSkills);
 }, []);

 function selectTab(nextTab) {
  if (nextTab !== 'skills' && window.location.hash === '#reading-skills') {
   window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }
  setTab(nextTab);
 }

 const token=session?.access_token;
 async function api(path,method='GET',payload){
  if(!token) throw new Error('로그인 상태를 확인해 주세요.');
  const res=await fetch(path,{method,headers:{Authorization:`Bearer ${token}`,...(payload?{'Content-Type':'application/json'}:{})},body:payload?JSON.stringify(payload):undefined,cache:'no-store'});
  const json=await res.json();
  if(!res.ok) throw new Error(json.error||'처리 실패');
  return json;
 }
 async function reload(expectedReply) {
  try {
   const fresh = await api('/api/bootstrap');
   setData(current => {
    if (expectedReply === undefined || fresh.messages.at(-1)?.content === expectedReply) return fresh;
    return { ...fresh, messages: current.messages };
   });
   if (!quizId && fresh.quizzes[0]) setQuizId(fresh.quizzes[0].id);
  } catch (failure) {
   setError(failure.message);
  }
 }
 useEffect(()=>{if(token){reload();}else{setData(empty);setQuizId('');setBookId('');setBookFilter('all');setWeekFilter('all');setBookTitle('');setAddingBook(false);setPracticeOpen(true);setSourceText('');setOwnTranslation('');setHintResult(null);setReadingAssessment(null);setExerciseTranslation('');setExerciseComposition('');}},[token]);
 useEffect(() => {
  if (replyVersion) latestReply.current?.scrollIntoView({ block: 'start' });
 }, [replyVersion]);
 useEffect(() => {
  const reply = latestReply.current;
  const chat = reply?.parentElement;
  if (chat) chat.scrollTop += reply.getBoundingClientRect().top - chat.getBoundingClientRect().top;
 }, [tab]);
 useEffect(() => {
  if (!readingAssessment) return;
  const reply = latestReply.current;
  const chat = reply?.parentElement;
  if (chat) chat.scrollTop += reply.getBoundingClientRect().top - chat.getBoundingClientRect().top;
  assessmentCard.current?.scrollIntoView({ block: 'start' });
 }, [readingAssessment]);
 async function signInWithKakao() {
  if (busy || kakaoBusy) return;
  setKakaoBusy(true);
  setError('');
  try {
   const settings = await fetch(new URL('/auth/v1/settings', process.env.NEXT_PUBLIC_SUPABASE_URL), {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    cache: 'no-store',
   });
   if (!settings.ok) throw new Error('카카오 로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
   const { external } = await settings.json();
   if (!external?.kakao) throw new Error('카카오 로그인은 아직 연결 준비 중입니다. 이메일로 로그인할 수 있어요.');
   const { data, error: loginError } = await client().auth.signInWithOAuth({
    provider: 'kakao',
    options: {
     redirectTo: window.location.origin,
     skipBrowserRedirect: true,
     // Use the Kakao app's configured consent items instead of Supabase's default email scope.
     queryParams: { scope: '' },
    },
   });
   if (loginError || !data?.url) throw new Error('카카오 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
   window.location.assign(data.url);
  } catch (failure) {
   setError(failure.message);
   setKakaoBusy(false);
  }
 }

 async function signIn(e){e.preventDefault();if(kakaoBusy)return;setBusy(true);setError('');try{const {error}=await client().auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}});if(error)throw error;setLinkSent(true);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function createBook(event) {
  event.preventDefault();
  if (bookBusy || !bookTitle.trim()) return;
  setBookBusy(true);
  setError('');
  try {
   const { book } = await api('/api/books', 'POST', { title: bookTitle });
   setData(current => ({ ...current, books: [...current.books, book] }));
   setBookId(book.id);
   setBookTitle('');
   setAddingBook(false);
  } catch (failure) {
   setError(failure.message);
  } finally {
   setBookBusy(false);
  }
 }

 async function linkTerm(termId, selectedBookId) {
  if (bookBusy || !selectedBookId) return;
  setBookBusy(true);
  setError('');
  try {
   await api('/api/books', 'PATCH', {
    termId, bookId: selectedBookId, weekStart: weekFilter === 'all' ? null : weekFilter,
   });
   await reload();
  } catch (failure) {
   setError(failure.message);
  } finally {
   setBookBusy(false);
  }
 }

 async function sendStudy(input, assessmentInput, studyBookId = bookId) {
  if (!input || busy) return false;
  const sequence = ++studySequence.current;
  const pendingId = 'study-' + sequence;
  setBusy(true);
  setError('');
  setData(current => ({
   ...current, messages: [...current.messages, { role: 'user', content: input, id: pendingId }],
  }));
  try {
   const reply = await api('/api/study', 'POST', { message: input, ...(studyBookId ? { bookId: studyBookId } : {}), ...(assessmentInput ? { readingAssessment: true } : {}) });
   setData(current => ({
    ...current,
    messages: [
     ...current.messages,
     { role: 'assistant', content: reply.answer, id: pendingId + '-reply' },
    ],
   }));
   await reload(reply.answer);
   if (assessmentInput && reply.assessment) {
    setExerciseTranslation('');
    setExerciseComposition('');
    setReadingAssessment({ ...assessmentInput, ...reply.assessment, bookId: studyBookId, tutorAnswer: reply.answer });
   } else {
    setReplyVersion(sequence);
   }
   return true;
  } catch (failure) {
   setData(current => ({ ...current, messages: current.messages.filter(item => item.id !== pendingId) }));
   setError(failure.message);
   return false;
  } finally {
   setBusy(false);
  }
 }

 async function ask(event) {
  event.preventDefault();
  if (await sendStudy(message.trim())) setMessage('');
 }

 async function showReadingHints() {
  if (!ownSource || hintsLoading || visibleHints?.hints) return;
  setHintsLoading(true);
  setHintResult(null);
  try {
   const { hints } = await api('/api/study/hints', 'POST', { source: ownSource });
   setHintResult({ source: ownSource, hints });
  } catch (failure) {
   setHintResult({ source: ownSource, error: failure.message });
  } finally {
   setHintsLoading(false);
  }
 }

 async function evaluatePractice(event) {
  event.preventDefault();
  const translation = ownTranslation.trim();
  if (!ownSource || !translation) return;
  const input = ['독해를 평가해줘.', '원문: ' + ownSource, '내 해석: ' + translation].join('\n');
  await sendStudy(input, { source: ownSource, translation });
 }

 async function submitReadingExercise(event) {
  event.preventDefault();
  const exercise = readingAssessment?.practice;
  const translation = exerciseTranslation.trim();
  const composition = exerciseComposition.trim();
  if (!exercise || !translation || !composition) return;
  const input = [
   '한 문장 연습 답안. 예문 해석과 영어 작문을 각각 평가해줘.',
   '예문: ' + exercise.example,
   '내 예문 해석: ' + translation,
   '지정 표현: ' + exercise.expression,
   '내 영어 작문: ' + composition,
  ].join('\n');
  await sendStudy(input, null, readingAssessment.bookId);
 }

 async function generate(){setBusy(true);setError('');try{await api('/api/quiz/generate','POST',{});await reload();setTab('quiz');}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function submit(){const q=selected;if(!q)return;const vals=q.questions.map((_,i)=>answers[i]);if(vals.some(x=>!Number.isInteger(x))){setError('모든 문제에 답해 주세요.');return;}setBusy(true);setError('');try{const r=await api('/api/quiz/submit','POST',{quizId:q.id,answers:vals});setResult(r);await reload();}catch(e){setError(e.message);}finally{setBusy(false);}}
 const latestReplyIndex = data.messages.map(item => item.role).lastIndexOf('assistant');
 const readingExercise = readingAssessment?.practice;
 const exerciseReplyIndex = readingExercise ? data.messages.map(item =>
  item.role === 'assistant' ? item.content : null).lastIndexOf(readingAssessment.tutorAnswer) : -1;
 const books = data.books;
 const bookTitles = new Map(books.map(book => [book.id, book.title]));
 const matchesBook = placement => bookFilter === 'all' ||
  (bookFilter === 'unfiled' ? placement.book_id === null : placement.book_id === bookFilter);
 const weeks = [...new Set(data.terms.flatMap(term =>
  term.placements.filter(matchesBook).map(placement => placement.week_start)))].sort().reverse();
 const filteredTerms = data.terms.filter(term => term.placements.some(placement =>
  matchesBook(placement) && (weekFilter === 'all' || placement.week_start === weekFilter)));
 const selected=data.quizzes.find(q=>q.id===quizId)||data.quizzes[0];
 const already=selected&&data.attempts.find(a=>a.quiz_id===selected.id);
 const stats={books:data.books.length,terms:data.terms.length,quizzes:data.attempts.length,score:data.attempts.length?Math.round(data.attempts.reduce((a,b)=>a+b.score,0)/data.attempts.length):0};
 if(!session)return <main className="login"><div className="brand"><div className="logo"><BookOpen/></div> MY ENGLISH READING STUDIO</div><div className="loginCard"><h1>로그인</h1><p>로그인하면 읽던 원서와 학습 기록을 이어서 볼 수 있어요.</p><button type="button" className="kakaoLogin" disabled={busy || kakaoBusy} onClick={signInWithKakao}>
 {kakaoBusy ? '카카오 로그인 연결 중…' : '카카오로 로그인'}
 </button><form onSubmit={signIn}><label>이메일 로그인</label><input type="email" placeholder="you@example.com" required value={email} onChange={e=>setEmail(e.target.value)}/><button className="primary" disabled={busy || kakaoBusy}>{busy?'전송 중...':'로그인 링크 받기'}</button></form>{linkSent&&<div className="success">이메일에서 로그인 링크를 눌러 주세요.</div>}{error&&<p className="err" role="alert">{error}</p>}<small>이메일 로그인은 받은 메일의 링크를 열어 완료할 수 있어요.</small></div></main>;
 const chatPanel = (
 <section className="panel studyPanel"><div className="panelHead"><div><MessageSquareText size={19}/><strong>AI 원서 선생님</strong></div></div><div className="chat">{data.messages.length===0&&<div className="welcome"><h2>문장에 대해 질문해 보세요</h2><div className="suggestions">{['It wasn’t that I disliked my job. 해석해줘','take time off와 get away from 차이','Ivy and Bean 문장 구조를 설명해줘'].map(s=><button key={s} onClick={()=>setMessage(s)}>{s}</button>)}</div></div>}{data.messages.map((m,i)=><div className={'bubbleRow '+(m.role==='user'?'mine':'')} key={m.id||i} ref={i === latestReplyIndex ? latestReply : null}><div className={'bubble '+m.role}>{m.role === 'assistant' ? <>
 <TutorReply content={m.content}/>
 {tab === 'study' && i === exerciseReplyIndex && <div className="tutorPracticePreview">
  <h3 className="practicePreviewTitle">오늘의 읽기 기술</h3>
  <p><strong>{readingExercise.skill}</strong></p>
  <p>{readingExercise.tip}</p>
  <h4>해석 연습</h4>
  <ol className="bilingualExamples">{readingExercise.readingExamples?.map(({ english, korean }, index) =>
   <li key={index}><strong lang="en">{english}</strong><span>{korean}</span></li>)}</ol>
  <h4>작문 연습</h4>
  <p><strong lang="en">{readingExercise.expression}</strong>를 사용한 예문입니다.</p>
  <ol className="bilingualExamples">{readingExercise.writingExamples?.map(({ english, korean }, index) =>
   <li key={index}><strong>{korean}</strong><span lang="en">{english}</span></li>)}</ol>
  <a href="#reading-skills" className="dailyReviewLink">
   <RefreshCw size={18} aria-hidden="true"/>
   <span>오늘의 한 문장 복습</span>
  </a>
 </div>}
 </> : m.content}</div></div>)}{busy&&<div className="thinking">답변을 준비하고 학습 표현을 정리하는 중...</div>}</div><form className="compose" onSubmit={ask}><input value={message} disabled={busy} onChange={e=>setMessage(e.target.value)} aria-label="AI 원서 선생님에게 질문" placeholder="문장이나 표현에 대해 질문하세요" maxLength={2000}/><button className="primary send" type="submit" aria-label="질문 보내기" disabled={busy||!message.trim()}><Send size={18} aria-hidden="true"/></button></form><p className="note">학습 대화와 주요 영어 표현은 로그인 계정에 저장됩니다. 개인 비밀번호 등 민감정보는 입력하지 마세요.</p></section>
 );
 return <div className="app"><aside className="sidebar"><div className="brand"><div className="logo"><BookOpen size={20}/></div><span>My English Reading Studio</span></div><nav aria-label="학습 메뉴">{[['study',BookOpen,'영어 원서 공부'],['skills',BookOpen,'오늘의 읽기 기술'],['quiz',ClipboardCheck,'주간 복습시험'],['terms',LibraryBig,'단어·표현 노트'],['progress',ChartNoAxesColumnIncreasing,'학습 성적']].map(([id,Icon,label])=><button key={id} className={tab===id?'active':''} aria-current={tab===id ? 'page' : undefined} onClick={()=>{selectTab(id);setError('');setResult(null);setAnswers({});}}><Icon size={19}/>{label}</button>)}</nav><div className="sidebarBottom"><div className="profile"><div className="avatar">{session.user.email?.[0]?.toUpperCase()||'U'}</div><div><strong>{session.user.email || session.user.user_metadata?.name || "내 계정"}</strong></div></div><button onClick={()=>client().auth.signOut()}><LogOut size={16}/> 로그아웃</button></div></aside><main className="content"><div className="pageBody"><div className="heading"><h1>{tab==='study'?'영어 원서 공부':tab==='skills'?'오늘의 읽기 기술':tab==='quiz'?'이번 주 영어 복습시험':tab==='terms'?'단어·표현 노트':'학습 성적'}</h1><p>{tab==='study'?'읽고 있는 책에서 문장을 골라 해석해 보세요.':tab==='skills'?'예문을 해석하고 핵심 표현으로 새 문장을 써 보세요.':tab==='quiz'?'매주 일요일 오전 10시(한국시간)에 새 시험이 열립니다.':tab==='terms'?'AI 선생님과 공부하며 수집된 표현입니다.':'시험 응시 결과와 학습한 표현을 확인하세요.'}</p></div><div className="stats"><div><span>누적 학습 원서</span><strong>{stats.books}<small>권</small></strong></div><div><span>누적 학습 표현</span><strong>{stats.terms}<small>개</small></strong></div><div><span>완료한 시험</span><strong>{stats.quizzes}<small>회</small></strong></div><div><span>평균 점수</span><strong>{stats.score}<small>점</small></strong></div></div>{error&&<div className="error"><AlertCircle size={16}/>{error}<button onClick={()=>setError('')}>닫기</button></div>}
 {tab==='study'&&<div className="studySections">
 <section className="panel bookPanel readingBookPanel">
  <label className="readingBookLabel" htmlFor="reading-book"><BookCopy size={19} aria-hidden="true"/><strong>원서 제목</strong></label>
  <div className="bookControls">
   <select id="reading-book" value={bookId} disabled={busy || bookBusy} onChange={event => setBookId(event.target.value)}>
    <option value="">원서 선택 안 함</option>
    {books.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}
   </select>
   <button type="button" className="secondary" disabled={busy || bookBusy}
    onClick={() => setAddingBook(open => !open)} aria-expanded={addingBook}>
    {addingBook ? '닫기' : '+ 새 원서'}
   </button>
  </div>
  {addingBook && <form className="bookControls" onSubmit={createBook}>
   <input aria-label="새 원서 제목" placeholder="원서 제목을 입력하세요" value={bookTitle}
    onChange={event => setBookTitle(event.target.value)} required maxLength={180} disabled={bookBusy} autoFocus/>
   <button className="primary" disabled={bookBusy || !bookTitle.trim()}>등록</button>
  </form>}
 </section>
 <section className="panel sourcePanel">
  <div className="readingPractice">
   <label htmlFor="reading-source"><strong>원서 문장 넣기</strong></label>
   <textarea id="reading-source" lang="en" value={sourceText} disabled={busy} rows={3} maxLength={900}
    placeholder="읽고 있는 영어 원서 문장을 붙여넣으세요"
    onChange={event => {
     setSourceText(event.target.value);
     setHintResult(null);
     if (event.target.value.trim()) setPracticeOpen(true);
    }}/>
   {ownSource && <Shadowing key={ownSource} sentence={ownSource} token={token}/>}
  </div>
 </section>
 {ownSource && <section className="panel">
  <div className="panelHead">
   <div><BookOpen size={19}/><strong>먼저 해석하기 : 스스로 해석해봐!</strong></div>
   <button type="button" className="secondary" disabled={busy} aria-expanded={practiceOpen} aria-controls="reading-practice"
    onClick={() => setPracticeOpen(open => !open)}>
    {practiceOpen ? '접기' : '펼치기'}
   </button>
  </div>
 <form id="reading-practice" className="readingPractice" hidden={!practiceOpen} onSubmit={evaluatePractice}>
  <div className="practiceSentence">
   <label htmlFor="own-translation">내 해석</label>
   <textarea id="own-translation" placeholder="위에 넣은 문장을 한국어로 해석해 보세요" rows={3}
    maxLength={900} required disabled={busy} value={ownTranslation}
    onChange={event => setOwnTranslation(event.target.value)}/>
   <div className="readingHints" aria-live="polite">
    {visibleHints?.hints ? (visibleHints.hints.length ? <ul>
     {visibleHints.hints.map(({ expression, meaning }) => <li key={expression}>
      <strong lang="en">{expression}</strong> — {meaning}
     </li>)}
    </ul> : <p>이 문장에는 따로 짚을 표현이 없어요.</p>) : <>
     <button type="button" className="secondary" onClick={showReadingHints} disabled={busy || hintsLoading}>
      {hintsLoading ? '힌트 찾는 중…' : '단어·표현 힌트 보기'}
     </button>
     {visibleHints?.error && <p role="alert">{visibleHints.error}</p>}
    </>}
   </div>
  </div>
  <button className="primary" disabled={busy || !ownTranslation.trim()}>
   {busy ? '독해 평가 중…' : '내 해석 평가받기'}
  </button>
 </form>
 </section>}
 {readingAssessment && <section className="panel readingAssessment" ref={assessmentCard} aria-labelledby="assessment-title">
  <div className="panelHead">
   <div><ClipboardCheck size={19}/><h2 id="assessment-title">오늘의 독해 평가</h2></div>
  </div>
  <div className="assessmentBody">
   <div className="assessmentScore"><strong>{readingAssessment.score}</strong><span> / 100점</span></div>
   <p className="assessmentNote">
    {readingAssessment.counts ? <>표 기준 · 정확 {readingAssessment.counts.correct}개, 부분 이해 {readingAssessment.counts.partial}개, 보완 필요 {readingAssessment.counts.incorrect}개</> : '학습용 점수예요.'}
   </p>
   {readingAssessment.counts && <p className="assessmentNote">정확은 1점, 부분 이해는 0.5점, 보완 필요는 0점으로 계산해 100점으로 환산한 학습용 점수예요.</p>}
   <dl>
    <div><dt>원문</dt><dd lang="en">{readingAssessment.source}</dd></div>
    <div><dt>내 해석</dt><dd>{readingAssessment.translation}</dd></div>
    <div><dt>자연스러운 해석</dt><dd>{readingAssessment.naturalTranslation}</dd></div>
   </dl>
   {!!readingAssessment.feedbackRows?.length && <div className="assessmentFeedback">
    <h3 id="assessment-feedback-title">무엇을 잘 읽었을까?</h3>
    <div className="tutorTable" tabIndex={0} role="region" aria-labelledby="assessment-feedback-title">
     <table aria-labelledby="assessment-feedback-title">
      <thead><tr>
       <th scope="col">표현</th><th scope="col">내 이해</th><th scope="col">평가</th><th scope="col">자연스러운 해석</th>
      </tr></thead>
      <tbody>{readingAssessment.feedbackRows.map((row, index) => <tr key={index}>
       <td lang="en">{row.expression}</td><td>{row.understanding}</td>
       <td>{row.evaluation}</td><td>{row.translation}</td>
      </tr>)}</tbody>
     </table>
    </div>
   </div>}
  </div>
 </section>}
  {chatPanel}
  <a href="#reading-skills" className="dailyReviewLink" style={{textDecoration: 'none'}}>
   <RefreshCw size={20} aria-hidden="true"/>
   <span>오늘의 한 문장 복습</span>
  </a>
 </div>}
 {tab === 'skills' && <div className="studySections">
  {readingExercise ? <section className="panel readingExercise" aria-labelledby="reading-skill-title">
  <div className="panelHead">
   <div><BookOpen size={19}/><h2 id="reading-skill-title">오늘의 읽기 기술</h2></div>
  </div>
  <form className="readingPractice" onSubmit={submitReadingExercise}>
   <h3>{readingExercise.skill}</h3>
   <p>{readingExercise.tip}</p>
   <div className="practiceSentence">
    <h4>한 문장 연습</h4>
    <p className="practiceEnglish" lang="en">{readingExercise.example}</p>
    <Shadowing key={readingExercise.example} sentence={readingExercise.example} token={token}/>
    <label htmlFor="exercise-translation">예문 해석</label>
    <textarea id="exercise-translation" rows={3} maxLength={700} required disabled={busy}
     value={exerciseTranslation} onChange={event => setExerciseTranslation(event.target.value)}
     placeholder="영어 예문을 한국어로 해석해 보세요"/>
   </div>
   <div className="practiceSentence">
    <label htmlFor="exercise-composition">영어 문장 만들기</label>
    <p id="exercise-expression"><strong lang="en">{readingExercise.expression}</strong>를 사용해 새로운 영어 문장을 써 보세요. {readingExercise.compositionTip}</p>
    <textarea id="exercise-composition" aria-describedby="exercise-expression" lang="en" rows={3} maxLength={700}
     required disabled={busy} value={exerciseComposition}
     onChange={event => setExerciseComposition(event.target.value)}
     placeholder="Write your own sentence in English."/>
   </div>
   <button className="primary" disabled={busy || !exerciseTranslation.trim() || !exerciseComposition.trim()}>
    {busy ? '피드백 준비 중…' : '해석·작문 피드백 받기'}
   </button>
  </form>
 </section> :
   <section className="panel"><div className="empty">
    <BookOpen size={32}/>
    <p>원서 문장을 해석하고 평가받으면 여기에 읽기 기술과 연습 문제가 생깁니다.</p>
    <button type="button" className="secondary" onClick={() => selectTab('study')}>원서 공부로 가기</button>
   </div></section>}
  {chatPanel}
 </div>}
 {tab==='quiz'&&<section className="panel"><div className="panelHead"><div><ClipboardCheck size={19}/><strong>복습시험</strong></div><button className="secondary" onClick={generate} disabled={busy}><RefreshCw size={15}/>{busy?'생성 중...':'이번 주 시험 만들기'}</button></div>{!data.quizzes.length?<div className="empty"><BookOpen size={34}/><h3>아직 시험이 없습니다.</h3><p>영어 공부를 시작한 후 ‘이번 주 시험 만들기’를 눌러 보세요.<br/>매주 일요일에도 자동 생성됩니다.</p></div>:<><div className="quizSelect"><label>시험 선택</label><select value={selected?.id||''} onChange={e=>{setQuizId(e.target.value);setAnswers({});setResult(null);}}>{data.quizzes.map(q=><option value={q.id} key={q.id}>{q.week_key} · {q.title}</option>)}</select></div>{already&&!result?<div className="submitted"><CheckCircle2 size={24}/><h3>이미 응시한 시험입니다.</h3><p>점수: <strong>{already.score}점</strong> · 다른 주의 시험을 선택하거나 학습 성적 탭을 확인하세요.</p></div>:result?<div className="results"><div className="scoreCard"><CheckCircle2 size={28}/><span>이번 시험 점수</span><strong>{result.score}<small> / 100</small></strong></div>{result.detail.map((d,i)=><div className={'answerCard '+(d.correct?'correct':'wrong')} key={i}><b>{i+1}. {d.stem}</b><p>{d.correct?'✓ 정답입니다.':'✗ 오답입니다.'} 정답: {selected.questions[i].options[d.correctIndex]}</p><div>{d.explanation}</div></div>)}</div>:<div className="questions">{selected.questions.map((q,i)=><div className="question" key={i}><div className="qNum">문제 {i+1}</div><h3>{q.stem}</h3><div className="options">{q.options.map((o,j)=><button key={j} className={answers[i]===j?'picked':''} onClick={()=>setAnswers(a=>({...a,[i]:j}))}><span>{'ABCD'[j]}</span>{o}</button>)}</div></div>)}<button className="primary submit" onClick={submit} disabled={busy}>시험 제출하고 채점받기</button></div>}</>}</section>}
 {tab==='terms'&&<section className="panel">
  <div className="panelHead"><div><LibraryBig size={19}/><strong>단어·표현 노트</strong></div><span className="pill">{filteredTerms.length}개</span></div>
  <div className="bookPanel">
   <label htmlFor="book-filter">원서별 보기</label>
   <select id="book-filter" value={bookFilter} onChange={event => { setBookFilter(event.target.value); setWeekFilter('all'); }}>
    <option value="all">전체</option>
    <option value="unfiled">미분류</option>
    {books.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}
   </select>
   <label htmlFor="week-filter">주차별 보기</label>
   <select id="week-filter" value={weekFilter} onChange={event => setWeekFilter(event.target.value)}>
    <option value="all">전체 주차</option>
    {weeks.map(week => <option key={week} value={week}>{noteWeekLabel(week)}</option>)}
   </select>
  </div>
  {!filteredTerms.length ? <div className="empty"><LibraryBig size={32}/><p>이 분류에 저장된 표현이 없습니다.</p></div> :
   <div className="termGrid">{filteredTerms.map(term => {
    const placements = term.placements.filter(placement => weekFilter === 'all' || placement.week_start === weekFilter);
    const linkedTitles = [...new Set(placements.map(({book_id}) => book_id === null ? '미분류' : bookTitles.get(book_id)).filter(Boolean))];
    const labelWeeks = [...new Set(placements.filter(matchesBook).map(placement => placement.week_start))].sort().reverse();
    const availableBooks = books.filter(book => placements.some(placement =>
     !placements.some(link => link.book_id === book.id && link.week_start === placement.week_start)));
    return <article className="term" key={term.id}>
     <div className="termTop"><span className="pill">{term.kind}</span>{term.wrong_count > 0 && <span className="mistake">오답 {term.wrong_count}회</span>}</div>
     <h3>{term.expression}</h3><strong>{term.meaning}</strong><p>{term.example}</p>
     <p className="termBooks">{linkedTitles.join(' · ')}</p>
     <p className="termBooks">{labelWeeks.map(noteWeekLabel).join(' · ')}</p>
     {!!availableBooks.length && <select aria-label={term.expression + '을 연결할 원서'} value="" disabled={bookBusy}
      onChange={event => linkTerm(term.id, event.target.value)}>
      <option value="">원서에 연결</option>
      {availableBooks.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}
     </select>}
    </article>;
   })}</div>}
 </section>}
 {tab==='progress'&&<section className="panel"><div className="panelHead"><div><ChartNoAxesColumnIncreasing size={19}/><strong>학습 이력</strong></div></div>{!data.attempts.length?<div className="empty"><ChartNoAxesColumnIncreasing size={32}/><p>첫 주간 복습시험을 마치면 점수가 여기에 기록됩니다.</p></div>:<div className="history">{data.attempts.map((a,i)=><div className="historyRow" key={i}><span>{new Date(a.created_at).toLocaleDateString('ko-KR')}</span><div className="progressBar"><div style={{width:`${a.score}%`}}/></div><strong>{a.score}점</strong><small>오답 {a.wrong_expressions?.length||0}개</small></div>)}</div>}</section>}
 <footer className="appFoot">My English Reading Studio · Private learning space</footer></div></main></div>;
}
