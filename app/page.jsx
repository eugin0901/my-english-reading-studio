'use client';
import {Component,useEffect,useState,useRef} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {createClient} from '@supabase/supabase-js';
import {BookOpen,MessageSquareText,ClipboardCheck,LibraryBig,ChartNoAxesColumnIncreasing,Send,RefreshCw,LogOut,CheckCircle2,AlertCircle,GraduationCap} from 'lucide-react';

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

const practiceSentences = [
  { english: 'Reading books helps me understand the world.', hint: 'the world = 세상' },
  { english: 'Thinking about the past helps us understand ourselves.', hint: 'the past = 과거 / ourselves = 우리 자신' },
  { english: 'Sometimes, making mistakes teaches us important lessons.', hint: 'make mistakes = 실수하다 / teach = 가르치다' },
];

let supabase;
function client(){
 if(!supabase) supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
 return supabase;
}
const empty={messages:[],terms:[],quizzes:[],attempts:[]};
export default function Page(){
 const [session,setSession]=useState(null),[email,setEmail]=useState(''),[linkSent,setLinkSent]=useState(false),[tab,setTab]=useState('study');
 const [data,setData]=useState(empty),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[quizId,setQuizId]=useState(''),[answers,setAnswers]=useState({}),[result,setResult]=useState(null);
 const [sourceText, setSourceText] = useState('');
 const [ownTranslation, setOwnTranslation] = useState('');
 const ownSource = sourceText.trim();
 const [hintResult, setHintResult] = useState(null);
 const [hintsLoading, setHintsLoading] = useState(false);
 const visibleHints = hintResult?.source === ownSource ? hintResult : null;
 const [practiceOpen, setPracticeOpen] = useState(true);
 const [translations, setTranslations] = useState(() => practiceSentences.map(() => ''));
 const latestReply = useRef(null);
 const studySequence = useRef(0);
 const [replyVersion, setReplyVersion] = useState(0);
 useEffect(()=>{
  const auth=client().auth;
  auth.getSession().then(({data})=>setSession(data.session));
  const {data:{subscription}}=auth.onAuthStateChange((_event,next)=>setSession(next));
  return()=>subscription.unsubscribe();
 },[]);
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
 useEffect(()=>{if(token){reload();}else{setData(empty);setQuizId('');setPracticeOpen(true);setSourceText('');setOwnTranslation('');setHintResult(null);setTranslations(practiceSentences.map(() => ''));}},[token]);
 useEffect(() => {
  if (replyVersion) latestReply.current?.scrollIntoView({ block: 'start' });
 }, [replyVersion]);
 async function signIn(e){e.preventDefault();setBusy(true);setError('');try{const {error}=await client().auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}});if(error)throw error;setLinkSent(true);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function sendStudy(input) {
  if (!input || busy) return false;
  const sequence = ++studySequence.current;
  const pendingId = 'study-' + sequence;
  setBusy(true);
  setError('');
  setData(current => ({
   ...current, messages: [...current.messages, { role: 'user', content: input, id: pendingId }],
  }));
  try {
   const reply = await api('/api/study', 'POST', { message: input });
   setData(current => ({
    ...current,
    messages: [
     ...current.messages,
     { role: 'assistant', content: reply.answer, id: pendingId + '-reply' },
    ],
   }));
   await reload(reply.answer);
   setReplyVersion(sequence);
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
  if (ownSource) {
   const translation = ownTranslation.trim();
   if (translation) await sendStudy(['독해를 평가해줘.', '원문: ' + ownSource, '내 해석: ' + translation].join('\n'));
   return;
  }
  if (translations.some(translation => !translation.trim())) return;
  const rows = practiceSentences.map(({ english }, index) =>
   ['문장 ' + (index + 1), '원문: ' + english, '내 해석: ' + translations[index].trim()].join('\n'));
  const input = ['동명사가 주어인 문장 연습이야. 세 문장의 독해를 각각 평가해줘.', ...rows].join('\n\n');
  await sendStudy(input);
 }

 async function generate(){setBusy(true);setError('');try{await api('/api/quiz/generate','POST',{});await reload();setTab('quiz');}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function submit(){const q=selected;if(!q)return;const vals=q.questions.map((_,i)=>answers[i]);if(vals.some(x=>!Number.isInteger(x))){setError('모든 문제에 답해 주세요.');return;}setBusy(true);setError('');try{const r=await api('/api/quiz/submit','POST',{quizId:q.id,answers:vals});setResult(r);await reload();}catch(e){setError(e.message);}finally{setBusy(false);}}
 const latestReplyIndex = data.messages.map(item => item.role).lastIndexOf('assistant');
 const selected=data.quizzes.find(q=>q.id===quizId)||data.quizzes[0];
 const already=selected&&data.attempts.find(a=>a.quiz_id===selected.id);
 const stats={terms:data.terms.length,quizzes:data.attempts.length,score:data.attempts.length?Math.round(data.attempts.reduce((a,b)=>a+b.score,0)/data.attempts.length):0};
 if(!session)return <main className="login"><div className="brand"><div className="logo"><BookOpen/></div> MY ENGLISH READING STUDIO</div><div className="loginCard"><p className="eyebrow">PERSONAL READING COMPANION</p><h1>읽을수록 쌓이는<br/><span>나만의 영어 실력</span></h1><p>AI 영어 선생님과 원서를 공부하면 표현이 자동 저장되고, 매주 일요일 새 복습시험이 만들어집니다.</p><form onSubmit={signIn}><label>이메일 로그인</label><input type="email" placeholder="you@example.com" required value={email} onChange={e=>setEmail(e.target.value)}/><button className="primary" disabled={busy}>{busy?'전송 중...':'로그인 링크 받기'}</button></form>{linkSent&&<div className="success">이메일에서 로그인 링크를 눌러 주세요.</div>}{error&&<p className="err">{error}</p>}<small>로그인 링크는 Supabase 이메일 인증을 사용합니다. 서비스 배포 후 이메일 인증 설정이 필요합니다.</small></div><div className="footer">Study with intention · Review with confidence</div></main>;
 return <div className="app"><aside className="sidebar"><div className="brand"><div className="logo"><BookOpen size={20}/></div><span>Reading<br/>Studio</span></div><div className="sideLabel">MY WORKSPACE</div><nav>{[['study',MessageSquareText,'영어 원서 공부'],['quiz',ClipboardCheck,'주간 복습시험'],['terms',LibraryBig,'단어·표현 노트'],['progress',ChartNoAxesColumnIncreasing,'학습 성적']].map(([id,Icon,label])=><button key={id} className={tab===id?'active':''} onClick={()=>{setTab(id);setError('');setResult(null);setAnswers({});}}><Icon size={19}/>{label}</button>)}</nav><div className="sidebarBottom"><div className="profile"><div className="avatar">{session.user.email?.[0]?.toUpperCase()||'U'}</div><div><strong>My Study Space</strong><small>{session.user.email}</small></div></div><button onClick={()=>client().auth.signOut()}><LogOut size={16}/> 로그아웃</button></div></aside><main className="content"><header className="topbar"><span><GraduationCap size={19}/> Your English journey</span><span className="today">매주 일요일 10:00 KST · 자동 시험</span></header><div className="pageBody"><div className="heading"><p className="eyebrow">YOUR PERSONAL LEARNING SPACE</p><h1>{tab==='study'?'오늘도 한 문장씩, 꾸준하게.':tab==='quiz'?'이번 주 영어 복습시험':tab==='terms'?'나의 영어 표현 노트':'학습 성장 기록'}</h1><p>{tab==='study'?'영어 원서에서 궁금한 문장을 입력하세요. 배운 표현은 자동으로 저장됩니다.':tab==='quiz'?'학습한 표현과 이전 오답을 바탕으로 10문제를 풀어보세요.':tab==='terms'?'AI 선생님과 공부하며 수집된 표현입니다.':'시험 응시 결과와 학습한 표현을 확인하세요.'}</p></div><div className="stats"><div><span>누적 학습 표현</span><strong>{stats.terms}<small>개</small></strong></div><div><span>완료한 시험</span><strong>{stats.quizzes}<small>회</small></strong></div><div><span>평균 점수</span><strong>{stats.score}<small>점</small></strong></div></div>{error&&<div className="error"><AlertCircle size={16}/>{error}<button onClick={()=>setError('')}>닫기</button></div>}
 {tab==='study'&&<div className="studySections">
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
  </div>
 </section>
 <section className="panel">
  <div className="panelHead">
   <div><BookOpen size={19}/><strong>먼저 해석하기 : 스스로 해석해봐!</strong></div>
   <button type="button" className="secondary" disabled={busy} aria-expanded={practiceOpen} aria-controls="reading-practice"
    onClick={() => setPracticeOpen(open => !open)}>
    {practiceOpen ? '접기' : '펼치기'}
   </button>
  </div>
 <form id="reading-practice" className="readingPractice" hidden={!practiceOpen} onSubmit={evaluatePractice}>
  {ownSource ? <div className="practiceSentence">
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
  </div> : <>
  <h2>동명사 주어 연습</h2>
  <p>문장 맨 앞의 <strong>-ing</strong>가 ‘무엇을 하는 것’이라는 주어가 되는지 살펴보세요.</p>
  {practiceSentences.map(({english, hint}, index) => <div className="practiceSentence" key={english}>
   <label htmlFor={'practice-' + index}>문장 {index + 1} 내 해석</label>
   <p className="practiceEnglish" lang="en">{english}</p>
   <small id={'practice-hint-' + index}>{hint}</small>
   <textarea id={'practice-' + index} aria-describedby={'practice-hint-' + index}
    placeholder="한국어로 먼저 해석해 보세요" rows={2} maxLength={450} required
    disabled={busy} value={translations[index]}
    onChange={event => {
     const value = event.target.value;
     setTranslations(current => current.map((text, position) => position === index ? value : text));
    }}/>
  </div>)}
  </>}
  <button className="primary" disabled={busy || (ownSource ? !ownTranslation.trim() : translations.some(text => !text.trim()))}>
   {busy ? '독해 평가 중…' : '내 해석 평가받기'}
  </button>
 </form>
 </section>
 <section className="panel studyPanel"><div className="panelHead"><div><MessageSquareText size={19}/><strong>AI 원서 선생님</strong></div></div><div className="chat">{data.messages.length===0&&<div className="welcome"><div className="welcomeIcon"><BookOpen size={26}/></div><h2>무엇을 읽고 있나요?</h2><p>읽다가 모르는 단어나 문장을 그대로 입력해 보세요.<br/>예: “I didn't understand her feelings until she explained them.” 에서 until의 의미는?</p><div className="suggestions">{['It wasn’t that I disliked my job. 해석해줘','take time off와 get away from 차이','Ivy and Bean 문장 구조를 설명해줘'].map(s=><button key={s} onClick={()=>setMessage(s)}>{s}</button>)}</div></div>}{data.messages.map((m,i)=><div className={'bubbleRow '+(m.role==='user'?'mine':'')} key={m.id||i} ref={i === latestReplyIndex ? latestReply : null}><div className={'bubble '+m.role}>{m.role === 'assistant' ? <TutorReply content={m.content}/> : m.content}</div></div>)}{busy&&<div className="thinking">답변을 준비하고 학습 표현을 정리하는 중...</div>}</div><form className="compose" onSubmit={ask}><input value={message} disabled={busy} onChange={e=>setMessage(e.target.value)} placeholder="공부하고 싶은 단어·문장·질문을 입력하세요..." maxLength={2000}/><button className="primary send" type="submit" disabled={busy||!message.trim()}><Send size={18}/></button></form><p className="note">학습 대화와 주요 영어 표현은 로그인 계정에 저장됩니다. 개인 비밀번호 등 민감정보는 입력하지 마세요.</p></section></div>}
 {tab==='quiz'&&<section className="panel"><div className="panelHead"><div><ClipboardCheck size={19}/><strong>Weekly Review</strong></div><button className="secondary" onClick={generate} disabled={busy}><RefreshCw size={15}/>{busy?'생성 중...':'이번 주 시험 만들기'}</button></div>{!data.quizzes.length?<div className="empty"><BookOpen size={34}/><h3>아직 시험이 없습니다.</h3><p>영어 공부를 시작한 후 ‘이번 주 시험 만들기’를 눌러 보세요.<br/>매주 일요일에도 자동 생성됩니다.</p></div>:<><div className="quizSelect"><label>시험 선택</label><select value={selected?.id||''} onChange={e=>{setQuizId(e.target.value);setAnswers({});setResult(null);}}>{data.quizzes.map(q=><option value={q.id} key={q.id}>{q.week_key} · {q.title}</option>)}</select></div>{already&&!result?<div className="submitted"><CheckCircle2 size={24}/><h3>이미 응시한 시험입니다.</h3><p>점수: <strong>{already.score}점</strong> · 다른 주의 시험을 선택하거나 학습 성적 탭을 확인하세요.</p></div>:result?<div className="results"><div className="scoreCard"><CheckCircle2 size={28}/><span>이번 시험 점수</span><strong>{result.score}<small> / 100</small></strong></div>{result.detail.map((d,i)=><div className={'answerCard '+(d.correct?'correct':'wrong')} key={i}><b>{i+1}. {d.stem}</b><p>{d.correct?'✓ 정답입니다.':'✗ 오답입니다.'} 정답: {selected.questions[i].options[d.correctIndex]}</p><div>{d.explanation}</div></div>)}</div>:<div className="questions">{selected.questions.map((q,i)=><div className="question" key={i}><div className="qNum">QUESTION {String(i+1).padStart(2,'0')}</div><h3>{q.stem}</h3><div className="options">{q.options.map((o,j)=><button key={j} className={answers[i]===j?'picked':''} onClick={()=>setAnswers(a=>({...a,[i]:j}))}><span>{'ABCD'[j]}</span>{o}</button>)}</div></div>)}<button className="primary submit" onClick={submit} disabled={busy}>시험 제출하고 채점받기</button></div>}</>}</section>}
 {tab==='terms'&&<section className="panel"><div className="panelHead"><div><LibraryBig size={19}/><strong>My Vocabulary Library</strong></div><span className="pill">{data.terms.length} expressions</span></div>{!data.terms.length?<div className="empty"><LibraryBig size={32}/><p>영어 원서 공부에서 새로운 표현을 배우면 여기에 자동으로 쌓입니다.</p></div>:<div className="termGrid">{data.terms.map(t=><article className="term" key={t.id}><div className="termTop"><span className="pill">{t.kind}</span>{t.wrong_count>0&&<span className="mistake">오답 {t.wrong_count}회</span>}</div><h3>{t.expression}</h3><strong>{t.meaning}</strong><p>{t.example}</p></article>)}</div>}</section>}
 {tab==='progress'&&<section className="panel"><div className="panelHead"><div><ChartNoAxesColumnIncreasing size={19}/><strong>학습 이력</strong></div></div>{!data.attempts.length?<div className="empty"><ChartNoAxesColumnIncreasing size={32}/><p>첫 주간 복습시험을 마치면 점수가 여기에 기록됩니다.</p></div>:<div className="history">{data.attempts.map((a,i)=><div className="historyRow" key={i}><span>{new Date(a.created_at).toLocaleDateString('ko-KR')}</span><div className="progressBar"><div style={{width:`${a.score}%`}}/></div><strong>{a.score}점</strong><small>오답 {a.wrong_expressions?.length||0}개</small></div>)}</div>}</section>}
 <footer className="appFoot">My English Reading Studio · Private learning space</footer></div></main></div>;
}
