import { demoNarration } from './voice-narration';

const maleNames = /\b(male|david|daniel|james|george|mark|guy|alex|oliver|ryan|matthew|aaron|tom)\b/i;
let requestId = 0;
let audio: HTMLAudioElement | null = null;
// Keep the active utterance alive until completion, including between chunks.
let utterance: SpeechSynthesisUtterance | null = null;
let finish: (() => void) | null = null;
let cleanups: (() => void)[] = [];
let status = '';
const listeners = new Set<(status: string) => void>();
function report(value: string) { status = value; listeners.forEach(listener => listener(value)); }
export function subscribeVoiceStatus(listener: (status: string) => void) {
  listeners.add(listener); listener(status);
  return () => { listeners.delete(listener); };
}
export function prepareSpeechFromGesture() { window.speechSynthesis?.getVoices(); window.speechSynthesis?.resume(); }
export function stopMoveMateSpeech() {
  ++requestId;
  cleanups.forEach(cleanup => cleanup()); cleanups = [];
  if (utterance) { utterance.onstart = null; utterance.onend = null; utterance.onerror = null; }
  utterance = null;
  window.speechSynthesis?.cancel();
  if (audio) { audio.onplaying = null; audio.onended = null; audio.onerror = null; audio.pause(); }
  finish?.(); finish = null;
  report('');
}
function recordingFor(text: string) {
  const patterns: [RegExp, string][] = [
    [/what should we call you/i, 'welcome'], [/where are you moving from/i, 'country'],
    [/do you have a job offer/i, 'job'], [/what salary range/i, 'salary'],
    [/how are you making the move/i, 'family'], [/who will be joining/i, 'household'],
    [/how far along/i, 'arrival'], [/when do you expect to arrive/i, 'date'],
    [/where will you commute/i, 'housing'], [/monthly rent budget/i, 'budget'],
    [/what should i optimize/i, 'commute'], [/based on what you shared.*al reem/i, 'central'],
    [/point you to the bank guide/i, 'bank'], [/well done/i, 'celebrate'], [/speak my replies/i, 'voice'],
  ];
  return patterns.find(([pattern]) => pattern.test(text))?.[1] ?? 'generic';
}
export function sayMoveMate(text: string, enabled: boolean, onSpeaking: (value: boolean) => void, preferBrowser = false) {
  stopMoveMateSpeech();
  if (!enabled || !text.trim()) { onSpeaking(false); return; }
  const id = requestId;
  const current = () => id === requestId;
  finish = () => onSpeaking(false);
  let fallbackStarted = false;
  const fallback = (reason: string) => {
    if (!current() || fallbackStarted) return;
    fallbackStarted = true;
    cleanups.forEach(cleanup => cleanup()); cleanups = [];
    if (utterance) { utterance.onstart = null; utterance.onend = null; utterance.onerror = null; }
    utterance = null;
    window.speechSynthesis?.cancel();
    onSpeaking(false);
    const player = audio ?? (audio = new Audio());
    const key = recordingFor(text);
    player.src = demoNarration[key]; player.volume = 1; player.muted = false;
    const label = key === 'generic' ? 'Recorded cue · read the full reply above' : 'Recorded demo narration';
    report(`${reason} · starting narration`);
    player.onplaying = () => { if (current()) { onSpeaking(true); report(label); } };
    player.onended = () => { if (current()) { onSpeaking(false); report(`${reason} · tap Play voice to retry`); } };
    player.onerror = () => { if (current()) { onSpeaking(false); report('Audio unavailable · open this link in Chrome or Safari'); } };
    void player.play().catch(() => { if (current()) { onSpeaking(false); report('Audio blocked · tap Play voice to enable sound'); } });
  };
  // Demo playback starts immediately; browser speech remains explicitly testable.
  if (!preferBrowser) { fallback('Demo voice ready'); return; }
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') { fallback('Browser speech unavailable'); return; }
  // Short chunks keep lengthy replies from stalling on device speech engines.
  const words = text.replace(/https?:\/\/\S+/g, '').split(/\s+/);
  const chunks: string[] = [];
  for (const word of words) {
    if (!chunks.length || chunks[chunks.length - 1].length + word.length > 180) chunks.push(word);
    else chunks[chunks.length - 1] += ` ${word}`;
  }
  let index = 0;
  const speakChunk = () => {
    if (!current() || fallbackStarted) return;
    const voices = synth.getVoices();
    const english = voices.filter(voice => voice.lang.toLowerCase().startsWith('en'));
    const selected = english.find(voice => maleNames.test(voice.name)) ?? english.find(voice => voice.default) ?? english[0];
    const next = new SpeechSynthesisUtterance(chunks[index]);
    utterance = next;
    next.lang = selected?.lang ?? 'en-GB';
    if (selected) next.voice = selected;
    next.rate = 0.94; next.pitch = 0.88; next.volume = 1;
    const startTimer = window.setTimeout(() => fallback('Browser speech did not start'), 5000);
    // A started engine can also stop delivering events. Avoid a permanently moving mouth.
    const endTimer = window.setTimeout(() => fallback('Browser speech stopped responding'), 45000);
    cleanups.push(() => { window.clearTimeout(startTimer); window.clearTimeout(endTimer); });
    next.onstart = () => { if (current() && !fallbackStarted) { window.clearTimeout(startTimer); onSpeaking(true); report(`Browser voice${selected ? ` · ${selected.name}` : ''}`); } };
    next.onend = () => {
      if (!current() || fallbackStarted) return;
      window.clearTimeout(startTimer); window.clearTimeout(endTimer);
      if (++index < chunks.length) speakChunk();
      else { utterance = null; onSpeaking(false); report('Browser voice ready'); }
    };
    next.onerror = event => { if (current()) fallback(event.error === 'not-allowed' ? 'Browser speech blocked' : 'Browser speech unavailable'); };
    try { synth.resume(); synth.speak(next); } catch { fallback('Browser speech unavailable'); }
  };
  report('Preparing browser voice…');
  if (synth.getVoices().length) speakChunk();
  else {
    // Voice inventories often arrive asynchronously. Try the browser's default
    // engine too: an empty inventory does not prove speech is unsupported.
    let waiting = true;
    const start = () => {
      if (!waiting || !current()) return;
      waiting = false; synth.removeEventListener('voiceschanged', changed);
      window.clearTimeout(timer); speakChunk();
    };
    const changed = () => { if (synth.getVoices().length) start(); };
    const timer = window.setTimeout(start, 1500);
    synth.addEventListener('voiceschanged', changed);
    cleanups.push(() => { waiting = false; window.clearTimeout(timer); synth.removeEventListener('voiceschanged', changed); });
  }
}
