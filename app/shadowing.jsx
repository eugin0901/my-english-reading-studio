'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';
import { encodeMonoWav, RECORDING_SECONDS, RECORDING_SAMPLE_RATE } from '../lib/shadowing-audio';

export default function Shadowing({ sentence, token }) {
  const [status, setStatus] = useState('idle');
  const [recording, setRecording] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const active = useRef(null);
  const alive = useRef(false);
  const audio = useRef(null);
  const utterance = useRef(null);
  const pending = useRef(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pending.current?.abort();
      const take = active.current;
      if (take) {
        clearTimeout(take.timer);
        take.recorder.onstop = null;
        if (take.recorder.state !== 'inactive') take.recorder.stop();
        take.stream.getTracks().forEach(track => track.stop());
      }
      if (utterance.current) window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recording) URL.revokeObjectURL(recording.url);
    };
  }, [recording]);

  function listen(rate) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setError('이 브라우저에서는 문장 읽기를 지원하지 않습니다.');
      return;
    }
    setError('');
    audio.current?.pause();
    const speech = new SpeechSynthesisUtterance(sentence);
    const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase() === 'en-us');
    if (voice) speech.voice = voice;
    speech.lang = 'en-US';
    speech.rate = rate;
    speech.onend = () => { if (utterance.current === speech) utterance.current = null; };
    speech.onerror = event => {
      if (utterance.current !== speech) return;
      utterance.current = null;
      if (!['canceled', 'interrupted'].includes(event.error)) setError('영어 음성을 재생할 수 없습니다. 브라우저의 음성 설정을 확인해 주세요.');
    };
    window.speechSynthesis.cancel();
    utterance.current = speech;
    window.speechSynthesis.speak(speech);
  }

  async function startRecording() {
    const AudioDecoder = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !AudioDecoder) {
      setError('이 브라우저에서는 녹음을 지원하지 않습니다. 마이크를 사용할 수 있는 브라우저에서 열어 주세요.');
      return;
    }
    setStatus('requesting');
    setError('');
    audio.current?.pause();
    window.speechSynthesis?.cancel();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      const recorder = new MediaRecorder(stream);
      const pieces = [];
      const take = { recorder, stream, timer: null, failed: false };
      active.current = take;
      recorder.ondataavailable = event => { if (event.data.size) pieces.push(event.data); };
      recorder.onerror = () => {
        take.failed = true;
        clearTimeout(take.timer);
        stream.getTracks().forEach(track => track.stop());
        active.current = null;
        if (alive.current) {
          setError('녹음을 계속할 수 없습니다. 다시 시도해 주세요.');
          setStatus('idle');
        }
      };
      recorder.onstop = async () => {
        clearTimeout(take.timer);
        stream.getTracks().forEach(track => track.stop());
        if (active.current === take) active.current = null;
        if (!alive.current || take.failed) return;
        setStatus('preparing');
        try {
          const input = new Blob(pieces, { type: recorder.mimeType });
          const decoded = await new AudioDecoder(1, 1, RECORDING_SAMPLE_RATE).decodeAudioData(await input.arrayBuffer());
          if (decoded.duration < 0.25) throw new Error();
          const blob = encodeMonoWav(decoded);
          if (alive.current) setRecording({ blob, url: URL.createObjectURL(blob) });
        } catch {
          if (alive.current) setError('녹음을 읽을 수 없습니다. 문장을 다시 말해 주세요.');
        } finally {
          if (alive.current) setStatus('idle');
        }
      };
      recorder.start();
      setRecording(null);
      setFeedback('');
      setStatus('recording');
      take.timer = setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, RECORDING_SECONDS * 1_000);
    } catch (failure) {
      stream?.getTracks().forEach(track => track.stop());
      active.current = null;
      if (!alive.current) return;
      setStatus('idle');
      setError(failure.name === 'NotAllowedError' ? '마이크 사용을 허용한 뒤 다시 시도해 주세요.' : '마이크를 사용할 수 없습니다. 연결과 권한을 확인해 주세요.');
    }
  }

  async function requestFeedback() {
    if (!recording || !token || status !== 'idle') return;
    setStatus('evaluating');
    setError('');
    audio.current?.pause();
    window.speechSynthesis?.cancel();
    const controller = new AbortController();
    pending.current = controller;
    const form = new FormData();
    form.set('sentence', sentence);
    form.set('recording', recording.blob, 'reading.wav');
    try {
      const response = await fetch('/api/study/pronunciation', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: form,
        signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.feedback) throw new Error(result?.error || '발음 피드백을 받지 못했습니다.');
      if (alive.current) setFeedback(result.feedback);
    } catch (failure) {
      if (alive.current && !controller.signal.aborted) setError(failure.message);
    } finally {
      if (pending.current === controller) pending.current = null;
      if (alive.current) setStatus('idle');
    }
  }

  return <section className="shadowing" aria-label="듣고 따라 말하기">
    <h3><Volume2 size={18} aria-hidden="true"/> 듣고 따라 말하기</h3>
    <div className="shadowingControls">
      <button type="button" className="secondary" disabled={status !== 'idle'} onClick={() => listen(1)}>보통 속도로 듣기</button>
      <button type="button" className="secondary" disabled={status !== 'idle'} onClick={() => listen(0.75)}>느리게 듣기</button>
      {status === 'recording'
        ? <button type="button" className="secondary" onClick={() => {
          const recorder = active.current?.recorder;
          if (recorder?.state === 'recording') recorder.stop();
        }}>녹음 완료</button>
        : <button type="button" className="secondary" disabled={status !== 'idle'} onClick={startRecording}>
          <Mic size={15} aria-hidden="true"/>{recording ? '다시 말하기' : '따라 말하기'}
        </button>}
    </div>
    {status === 'requesting' && <p role="status">마이크 권한을 기다리고 있습니다.</p>}
    {status === 'recording' && <p role="status">녹음 중 · 최대 {RECORDING_SECONDS}초</p>}
    {status === 'preparing' && <p role="status">녹음을 준비하고 있습니다.</p>}
    {recording && <div className="shadowingRecording">
      <audio ref={audio} controls src={recording.url} aria-label="내 녹음 듣기" onPlay={() => window.speechSynthesis?.cancel()}/>
      <button type="button" className="primary" disabled={status !== 'idle'} onClick={requestFeedback}>
        {status === 'evaluating' ? '발음 확인 중…' : '발음 피드백 받기'}
      </button>
      <p>피드백을 요청할 때만 녹음이 AI에 전송됩니다.</p>
    </div>}
    {error && <p role="alert">{error}</p>}
    {feedback && <div className="shadowingFeedback" aria-live="polite">
      <h4>AI 발음 피드백</h4>
      <p>{feedback}</p>
    </div>}
  </section>;
}
