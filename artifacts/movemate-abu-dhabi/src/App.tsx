import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Compass, Edit3, Heart, MapPin, Minus, Plus, ShieldCheck, Sparkles, UserRound, BriefcaseBusiness, Send, X, CircleCheck, Circle, Banknote, FileCheck2, Home, Smartphone, Users, LoaderCircle, RotateCcw, Globe2, Plane, Volume2, VolumeX, ExternalLink, CircleHelp, Move } from 'lucide-react';
import { useChatWithMoveMate, useExtractProfile, useGenerateMovePlan } from '@workspace/api-client-react';
import type { MovePlan, MoveProfile, MoveTask } from '@workspace/api-client-react';
import { answerChat as answerChatLocally, extractProfile as extractProfileLocally, generatePlan as generatePlanLocally } from '../../api-server/src/lib/movemate';
import mascot from './assets/movemate-mascot.png';
import DemoModules from './components/demo-modules';
import { prepareSpeechFromGesture, sayMoveMate, stopMoveMateSpeech, subscribeVoiceStatus } from './lib/movemate-voice';

type Profile = {
  name: string; nationality: string; jobStatus: 'offer' | 'no-offer' | ''; salaryRange: string;
  familyStatus: 'alone' | 'others' | ''; adults: number; children: number;
  arrivalStatus: 'date' | 'visa' | ''; arrivalDate: string; currentCity: string;
};
type ChatMessage = { role: 'assistant' | 'user'; text: string };
type Stored = {
  profile: Profile; step: string; completed: boolean; finishingAt?: number;
  structuredProfile?: MoveProfile; plan?: MovePlan; completedTaskIds?: string[]; chatHistory?: ChatMessage[];
};
const STORE_KEY = 'movemate-abu-dhabi-profile-v1';
const queryClient = new QueryClient();
const emptyProfile: Profile = { name: '', nationality: '', jobStatus: '', salaryRange: '', familyStatus: '', adults: 2, children: 0, arrivalStatus: '', arrivalDate: '', currentCity: '' };
const countries = ['Australia', 'Canada', 'China', 'France', 'Germany', 'India', 'Ireland', 'Italy', 'Japan', 'Kenya', 'Lebanon', 'Nigeria', 'Other', 'Pakistan', 'Philippines', 'Singapore', 'South Africa', 'Spain', 'United Kingdom', 'United States'];
const legacyCountryNames: Record<string, string> = { American: 'United States', Australian: 'Australia', British: 'United Kingdom', Canadian: 'Canada', Chinese: 'China', French: 'France', German: 'Germany', Indian: 'India', Irish: 'Ireland', Italian: 'Italy', Japanese: 'Japan', Kenyan: 'Kenya', Lebanese: 'Lebanon', Nigerian: 'Nigeria', Pakistani: 'Pakistan', Philippine: 'Philippines', Singaporean: 'Singapore', 'South African': 'South Africa', Spanish: 'Spain' };
const salaries = ['Under AED 10,000', 'AED 10,000–20,000', 'AED 20,000–30,000', 'AED 30,000–40,000', 'AED 40,000–60,000', 'AED 60,000–80,000', 'AED 80,000+'];
const taskPriorityOrder: Record<MoveTask['priority'], number> = { high: 0, medium: 1, low: 2 };
const taskScoreWeights: Record<MoveTask['category'], number> = { visa: 25, housing: 20, job: 20, bank: 10, 'id-medical': 10, community: 10, sim: 5 };
const SCORE_INCREMENT = 5;
const ASSISTANT_POSITION_KEY = 'movemate-assistant-position-v1';
function readAssistantPosition(): { x: number; y: number } | null { try { const value = JSON.parse(localStorage.getItem(ASSISTANT_POSITION_KEY) ?? 'null'); return value && Number.isFinite(value.x) && Number.isFinite(value.y) ? { x: Math.max(12, Math.min(window.innerWidth - 90, value.x)), y: Math.max(96, Math.min(window.innerHeight - 90, value.y)) } : null; } catch { return null; } }
function addressQuestion(name: string, question: string) { return name ? `${name}, ${question.charAt(0).toLowerCase()}${question.slice(1)}` : question; }
function useVoiceStatus() {
  const [status, setStatus] = useState('');
  useEffect(() => { prepareSpeechFromGesture(); return subscribeVoiceStatus(setStatus); }, []);
  return status;
}
const questionCopy: Record<string, { kicker: string; title: string; help: string }> = {
  name: { kicker: 'A good place to begin', title: 'What should we call you?', help: 'I’m MoveMate, your guide through this process.' },
  nationality: { kicker: 'A little about you', title: 'Where are you moving from?', help: 'Choose the country you’re moving from.' },
  job: { kicker: 'Work & life', title: 'Do you have a job offer in Abu Dhabi?', help: 'Your answer helps us shape a more useful move plan.' },
  salary: { kicker: 'A little more context', title: 'What salary range are you expecting?', help: 'Choose a monthly amount in AED. This stays on your device.' },
  family: { kicker: 'Your household', title: 'How are you making the move?', help: 'We’ll keep the plan relevant to who’s coming with you.' },
  arrival: { kicker: 'The timing', title: 'How far along is your move?', help: 'Whether you have a date or need visa guidance, we’ll meet you there.' },
  date: { kicker: 'Your arrival', title: 'When do you expect to arrive?', help: 'A rough date is perfectly fine. You can change it later.' },
};
function writeSaved(state: Stored) { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* Local storage can be unavailable in private browsing. */ } }
function normalizeStoredPlan(state: Stored): Stored {
  if (!state.plan) return state;
  const originalTasks = [...state.plan.beforeArrival, ...state.plan.week1, ...state.plan.week2];
  const jobOffer = state.structuredProfile?.jobStatus === 'offer' || state.profile.jobStatus === 'offer';
  const offerTaskScoringIsCurrent = !jobOffer || (
    originalTasks.find(task => task.id === 'prepare-work-arrival')?.scorePoints === SCORE_INCREMENT &&
    originalTasks.filter(task => task.category === 'community').reduce((sum, task) => sum + task.scorePoints, 0) === SCORE_INCREMENT
  );
  if (originalTasks.every(task => Number.isInteger(task.scorePoints) && task.scorePoints % SCORE_INCREMENT === 0) && offerTaskScoringIsCurrent) return state;

  let week1 = state.plan.week1;
  const screening = week1.find(task => task.id === 'complete-medical-screening');
  const insurance = week1.find(task => task.id === 'arrange-health-insurance');
  const completed = new Set(state.completedTaskIds ?? []);
  if (screening && insurance) {
    const merged: MoveTask = {
      ...screening,
      id: 'complete-medical-and-insurance',
      title: 'Complete medical screening and confirm health insurance',
      description: 'Follow your sponsor’s screening steps, then confirm when your health cover starts and who to contact for care.',
      scorePoints: 0,
    };
    week1 = week1.filter(task => task.id !== insurance.id).map(task => task.id === screening.id ? merged : task);
    const bothCompleted = completed.has(screening.id) && completed.has(insurance.id);
    completed.delete(screening.id);
    completed.delete(insurance.id);
    if (bothCompleted) completed.add(merged.id);
  }

  const normalizedPlan: MovePlan = { ...state.plan, week1 };
  const tasks = [...normalizedPlan.beforeArrival, ...normalizedPlan.week1, ...normalizedPlan.week2];
  const weights = { ...taskScoreWeights };
  if (jobOffer) {
    weights.job = SCORE_INCREMENT;
    weights.community -= SCORE_INCREMENT;
  }
  const pointsById = new Map<string, number>();
  for (const category of Object.keys(weights) as MoveTask['category'][]) {
    const categoryTasks = tasks.filter(task => task.category === category);
    const increments = weights[category] / SCORE_INCREMENT;
    for (let index = 0; index < increments && categoryTasks.length; index += 1) {
      const task = categoryTasks[index % categoryTasks.length];
      pointsById.set(task.id, (pointsById.get(task.id) ?? 0) + SCORE_INCREMENT);
    }
  }
  const withWholePoints = (items: MoveTask[]) => items.map(task => ({ ...task, scorePoints: pointsById.get(task.id) ?? 0 }));
  return {
    ...state,
    plan: {
      ...normalizedPlan,
      beforeArrival: withWholePoints(normalizedPlan.beforeArrival),
      week1: withWholePoints(normalizedPlan.week1),
      week2: withWholePoints(normalizedPlan.week2),
    },
    completedTaskIds: [...completed],
  };
}
function readSaved(): Stored | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Stored;
    const country = legacyCountryNames[saved.profile?.nationality];
    if (country) {
      saved.profile.nationality = country;
      if (saved.structuredProfile && legacyCountryNames[saved.structuredProfile.nationality]) saved.structuredProfile.nationality = country;
      writeSaved(saved);
    }
    const normalized = normalizeStoredPlan(saved);
    if (normalized !== saved) writeSaved(normalized);
    return normalized;
  } catch { return null; }
}
function getSteps(profile: Profile) {
  const steps = ['name', 'nationality', 'job'];
  if (profile.jobStatus === 'offer') steps.push('salary');
  steps.push('family');
  if (profile.familyStatus === 'others') steps.push('household');
  steps.push('arrival');
  if (profile.arrivalStatus === 'date') steps.push('date');
  return steps;
}
function toMoveProfile(profile: Profile): MoveProfile {
  return {
    name: profile.name.trim(), nationality: profile.nationality, jobStatus: profile.jobStatus === 'offer' ? 'offer' : 'no-offer',
    salaryRange: profile.salaryRange, familyStatus: profile.familyStatus === 'others' ? 'others' : 'alone',
    adults: profile.adults, children: profile.children, arrivalStatus: profile.arrivalStatus === 'visa' ? 'visa' : 'date',
    arrivalDate: profile.arrivalDate || null, currentCity: profile.currentCity.trim() || null,
  };
}
function Logo() { return <div className="brand" aria-label="MoveMate Abu Dhabi"><span className="brand-mark"><Compass size={20} strokeWidth={1.8} /></span><span>move<span style={{ color: '#c5795f' }}>mate</span></span></div>; }
function Header({ onboarding = false }: { onboarding?: boolean }) { return <header className="topbar"><Logo /><span className="topbar-note">{onboarding ? 'A softer landing starts here' : 'Your Abu Dhabi chapter, in one place'}</span></header>; }
function AppRouter() {
  const saved = useMemo(readSaved, []);
  const [, setLocation] = useLocation();
  useEffect(() => { if (window.location.pathname === '/') setLocation(saved?.completed ? '/dashboard' : '/onboarding'); }, [saved, setLocation]);
  return <Switch><Route path="/" component={() => <div />} /><Route path="/onboarding" component={Onboarding} /><Route path="/dashboard" component={Dashboard} /><Route component={NotFound} /></Switch>;
}
function Onboarding() {
  const voiceStatus = useVoiceStatus();
  useEffect(() => () => stopMoveMateSpeech(), []);
  const [, setLocation] = useLocation();
  const initial = useMemo(readSaved, []);
  const [profile, setProfile] = useState<Profile>(initial?.profile ?? emptyProfile);
  const [step, setStep] = useState(initial?.step ?? 'name');
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(Boolean(initial?.finishingAt && !initial?.completed));
  const [finishStage, setFinishStage] = useState<'extract' | 'plan'>('extract');
  const [companionSpeaking, setCompanionSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const extractProfile = useExtractProfile();
  const generatePlan = useGenerateMovePlan();
  const steps = getSteps(profile);
  const currentStep = steps.includes(step) ? step : 'name';
  const stepIndex = steps.indexOf(currentStep);
  useEffect(() => { if (!finishing) writeSaved({ profile, step: currentStep, completed: false }); }, [profile, currentStep, finishing]);
  async function finish(sourceProfile = profile) {
    setFinishing(true); setError(''); setFinishStage('extract');
    const started: Stored = { ...(readSaved() ?? {} as Stored), profile: sourceProfile, step: currentStep, completed: false, finishingAt: Date.now() };
    writeSaved(started);
    try {
      const answers = toMoveProfile(sourceProfile);
      const profileText = `Relocation answers for ${sourceProfile.name}: nationality ${sourceProfile.nationality}; ${sourceProfile.jobStatus === 'offer' ? `has an offer, salary ${sourceProfile.salaryRange}` : 'still exploring work'}; household ${sourceProfile.familyStatus}, ${sourceProfile.adults} adults and ${sourceProfile.children} children; ${sourceProfile.arrivalStatus === 'visa' ? 'needs visa guidance' : `arrival ${sourceProfile.arrivalDate || 'not set'}`}; moving from ${sourceProfile.currentCity || 'not specified'}.`;
      let structured: MoveProfile;
      try { structured = await extractProfile.mutateAsync({ data: { text: profileText, answers } }); }
      catch { structured = extractProfileLocally(profileText, answers); }
      setFinishStage('plan');
      let plan: MovePlan;
      try { plan = await generatePlan.mutateAsync({ data: { profile: structured } }); }
      catch { plan = generatePlanLocally(structured); }
      writeSaved({ ...started, profile: sourceProfile, structuredProfile: structured, plan, completed: true, completedTaskIds: [], chatHistory: [], finishingAt: undefined });
      setLocation('/dashboard');
    } catch {
      setError('We couldn’t prepare your plan just now. Your answers are saved here—please try again.');
      writeSaved({ ...started, profile: sourceProfile, completed: false, finishingAt: undefined });
    }
  }
  function update<K extends keyof Profile>(key: K, value: Profile[K]) { setProfile(prev => ({ ...prev, [key]: value })); setError(''); }
  function valid() {
    if (currentStep === 'name' && !profile.name.trim()) return 'Add your name to continue.';
    if (currentStep === 'nationality' && !profile.nationality) return 'Choose the country you’re moving from.';
    if (currentStep === 'job' && !profile.jobStatus) return 'Choose the answer that fits you best.';
    if (currentStep === 'salary' && !profile.salaryRange) return 'Choose a salary range to continue.';
    if (currentStep === 'family' && !profile.familyStatus) return 'Choose how you’re making the move.';
    if (currentStep === 'arrival' && !profile.arrivalStatus) return 'Choose the answer that fits your plans.';
    if (currentStep === 'date' && !profile.arrivalDate) return 'Choose an expected arrival date.';
    if (currentStep === 'date' && !profile.currentCity.trim()) return 'Add the city you’re moving from.';
    return '';
  }
  function continueFlow() {
    const issue = valid(); if (issue) { setError(issue); return; }
    prepareSpeechFromGesture();
    const index = steps.indexOf(currentStep);
    if (index < steps.length - 1) {
      const nextStep = steps[index + 1];
      setStep(nextStep);
      const nextCopy = nextStep === 'household' ? 'Who will be joining you?' : questionCopy[nextStep]?.title ?? 'Let’s keep going.';
      sayMoveMate(nextStep === 'nationality' ? nextCopy : addressQuestion(profile.name, nextCopy), voiceEnabled, setCompanionSpeaking);
    } else void finish();
  }
  function back() { setError(''); if (stepIndex > 0) setStep(steps[stepIndex - 1]); }
  function selectAnswer(key: 'jobStatus' | 'familyStatus' | 'arrivalStatus', value: 'offer' | 'no-offer' | 'alone' | 'others' | 'date' | 'visa') { prepareSpeechFromGesture(); update(key, value as never); window.setTimeout(() => { const nextProfile = { ...profile, [key]: value }; const nextSteps = getSteps(nextProfile); const index = nextSteps.indexOf(currentStep); if (index < nextSteps.length - 1) { const nextStep = nextSteps[index + 1]; setStep(nextStep); const nextCopy = nextStep === 'household' ? 'Who will be joining you?' : questionCopy[nextStep]?.title ?? 'Let’s keep going.'; const confirmation = key === 'jobStatus' ? value === 'offer' ? 'Great, I’ll tailor your work and banking prep around your offer.' : 'No problem. I’ll keep the plan useful while you explore roles.' : key === 'familyStatus' ? value === 'alone' ? 'Got it. I’ll shape the plan around a solo move.' : 'Got it. I’ll include the people moving with you.' : value === 'visa' ? 'We’ll make space for visa guidance as we go.' : 'Great, we’ll plan around your arrival date.'; const question = nextStep === 'nationality' ? nextCopy : addressQuestion(profile.name, nextCopy); sayMoveMate(`${confirmation} ${question}`, voiceEnabled, setCompanionSpeaking); } }, 260); }
  function useDemo() {
    const d = new Date(); d.setDate(d.getDate() + 21);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const demo: Profile = { name: 'James', nationality: 'United States', jobStatus: 'offer', salaryRange: 'AED 30,000–40,000', familyStatus: 'others', adults: 2, children: 0, arrivalStatus: 'date', arrivalDate: date, currentCity: 'Springfield (example)' };
    setProfile(demo); setStep('date'); setError(''); void finish(demo);
  }
  function changeCount(key: 'adults' | 'children', amount: number) { update(key, Math.max(key === 'adults' ? 1 : 0, Math.min(8, profile[key] + amount))); }
  if (finishing) return <main className="app-shell"><Header onboarding /><section className="page-wrap completion-screen"><div className="completion-card"><div className="arrival-globe" aria-label="MoveMate is flying your plan to Abu Dhabi"><Globe2 size={69} strokeWidth={1.25} /><span className="flight-plane"><Plane size={21} fill="currentColor" /></span><span className="arrival-pin">AUH</span><span className="globe-shine" /></div><div className="eyebrow" style={{ justifyContent: 'center', marginBottom: 13 }}>A moment, just for you</div><h1>{error ? <>A small pause<br />before your plan.</> : finishStage === 'extract' ? <>Putting your story<br />into shape…</> : <>Building your<br />first move plan…</>}</h1><p>{error ? 'Your answers are safe on this device. We can try again or let you review them.' : finishStage === 'extract' ? 'We’re gathering your answers into a helpful personal snapshot.' : 'Your steps are taking shape around the move you described.'} Your profile stays safely on this device.</p><div className="request-steps"><span className={finishStage === 'plan' ? 'done' : 'active'}><Check size={13} /> Profile</span><span className={finishStage === 'plan' ? 'active' : ''}><Sparkles size={13} /> Move plan</span></div>{error && <div className="field-error completion-error" role="alert" data-testid="status-plan-error">{error}<div><button onClick={() => void finish()} data-testid="button-retry-plan"><RotateCcw size={14} /> Try again</button><button onClick={() => { setFinishing(false); setError(''); }} data-testid="button-review-answers">Review my answers</button></div></div>}</div></section></main>;
  const copy = currentStep === 'name' && profile.name.trim()
    ? { ...questionCopy.name, title: `Hi ${profile.name.trim()}` }
    : currentStep === 'household'
      ? { kicker: 'Your household', title: 'Who will be joining you?', help: 'Count everyone in your household, including yourself.' }
      : questionCopy[currentStep] ?? questionCopy.name;
  const companionLine = currentStep === 'name'
    ? profile.name.trim() ? `Hi ${profile.name.trim()}! I’m MoveMate, your guide through this process.` : 'I’m MoveMate, your guide through this process.'
    : currentStep === 'nationality' ? copy.title : addressQuestion(profile.name, copy.title);
  return <main className="app-shell"><Header onboarding /><div className="page-wrap"><div className="onboard-layout"><aside className="intro-side"><div className="eyebrow">A more human move</div><h1 className="intro-title">Make room for<br />your <em>next chapter.</em></h1><p className="intro-copy">Moving countries is a lot. We’ll make the first steps feel a little more like yours.</p><div className="onboard-companion"><div className={`onboard-character${companionSpeaking ? ' mascot-speaking' : ''}`}><img src={mascot} alt="MoveMate character" /></div><div className="companion-speech"><span>MoveMate</span><p key={currentStep}>{companionLine}</p></div><button className="voice-toggle" type="button" onClick={() => { if (companionSpeaking) { stopMoveMateSpeech(); setVoiceEnabled(false); } else { setVoiceEnabled(true); sayMoveMate(companionLine, true, setCompanionSpeaking); } }} aria-label={companionSpeaking ? 'Stop MoveMate voice' : 'Play MoveMate voice'} title="Play or stop narration">{companionSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}<span>{companionSpeaking ? 'Stop' : 'Play voice'}</span></button></div><div className="voice-tools"><span className="voice-status" role="status">{voiceStatus || 'Demo voice ready · tap Play voice'}</span><button type="button" className="browser-voice-test" onClick={() => sayMoveMate(companionLine, true, setCompanionSpeaking, true)}>Test browser voice</button></div><div className="postmark" aria-hidden="true"><div className="postmark-inner">A new home<br />is on the horizon<br />your next chapter</div></div></aside><section className="form-card" aria-live="polite"><div className="form-content"><div className="progress-line"><div className="progress-track"><div className="progress-fill" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} /></div><div className="progress-label" data-testid="text-onboarding-progress">{stepIndex + 1} of {steps.length}</div></div><div className="question-kicker">{copy.kicker}</div><h2 className="question-title" data-testid="text-onboarding-question">{copy.title}</h2><p className="question-help">{copy.help}</p>
  {currentStep === 'name' && <div><label className="field-label" htmlFor="name">Your first name</label><input id="name" className="text-field" placeholder="For example, Maya" value={profile.name} onChange={e => update('name', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') continueFlow(); }} data-testid="input-name" autoComplete="given-name" /></div>}
  {currentStep === 'nationality' && <div><label className="field-label" htmlFor="nationality">Country you’re moving from</label><div style={{ position: 'relative' }}><select id="nationality" className="select-field" value={profile.nationality} onChange={e => update('nationality', e.target.value)} data-testid="select-nationality"><option value="">Select a country</option>{countries.map(country => <option key={country} value={country}>{country}</option>)}</select><ChevronDown size={17} style={{ position: 'absolute', right: 16, top: 18, pointerEvents: 'none', color: '#7a887f' }} /></div><div className="field-hint">We use this only to personalize your local preparation.</div></div>}
  {currentStep === 'job' && <div className="option-grid"><Option title="Yes, I have an offer" subtitle="I’m preparing to start a role" selected={profile.jobStatus === 'offer'} testId="option-job-offer" onClick={() => selectAnswer('jobStatus', 'offer')} /><Option title="Not yet" subtitle="I’m still exploring work options" selected={profile.jobStatus === 'no-offer'} testId="option-job-no-offer" onClick={() => selectAnswer('jobStatus', 'no-offer')} /></div>}
  {currentStep === 'salary' && <div className="option-grid salary-grid">{salaries.map((s, i) => <Option key={s} title={s} selected={profile.salaryRange === s} testId={`option-salary-${i}`} onClick={() => { update('salaryRange', s); sayMoveMate(`Thanks. I’ll keep your expected monthly salary of ${s} in mind.`, voiceEnabled, setCompanionSpeaking); window.setTimeout(continueFlow, 250); }} />)}</div>}
  {currentStep === 'family' && <div className="option-grid"><Option title="I’m moving on my own" subtitle="Just me, for now" selected={profile.familyStatus === 'alone'} testId="option-family-alone" onClick={() => selectAnswer('familyStatus', 'alone')} /><Option title="I’m moving with others" subtitle="Partner, family, or someone close" selected={profile.familyStatus === 'others'} testId="option-family-others" onClick={() => selectAnswer('familyStatus', 'others')} /></div>}
  {currentStep === 'household' && <div className="number-row">{(['adults', 'children'] as const).map(key => <div className="number-control" key={key}><label>{key === 'adults' ? 'Adults' : 'Children'}</label><div className="stepper"><button type="button" aria-label={`Remove one ${key}`} onClick={() => changeCount(key, -1)} data-testid={`button-decrease-${key}`}><Minus size={14} /></button><output data-testid={`value-${key}`}>{profile[key]}</output><button type="button" aria-label={`Add one ${key}`} onClick={() => changeCount(key, 1)} data-testid={`button-increase-${key}`}><Plus size={14} /></button></div></div>)}</div>}
  {currentStep === 'arrival' && <div className="option-grid"><Option title="I have an arrival date" subtitle="Let’s get ready for the day you land" selected={profile.arrivalStatus === 'date'} testId="option-arrival-date" onClick={() => selectAnswer('arrivalStatus', 'date')} /><Option title="I still need visa help" subtitle="I’m working out how and when to arrive" selected={profile.arrivalStatus === 'visa'} testId="option-arrival-visa" onClick={() => selectAnswer('arrivalStatus', 'visa')} /></div>}
  {currentStep === 'date' && <div className="date-city-grid"><div><label className="field-label" htmlFor="arrival-date">Expected arrival</label><input id="arrival-date" className="text-field" type="date" value={profile.arrivalDate} onChange={e => update('arrivalDate', e.target.value)} data-testid="input-arrival-date" /></div><div><label className="field-label" htmlFor="current-city">Where are you moving from?</label><input id="current-city" className="text-field" placeholder="Your current city" value={profile.currentCity} onChange={e => update('currentCity', e.target.value)} data-testid="input-current-city" /><div className="field-hint">A city is all we need. Please don’t add private documents or details.</div></div></div>}
  {error && <div className="field-error" role="alert" data-testid="text-validation-error">{error}</div>}
  <div className="form-footer"><button className="text-button" onClick={back} disabled={stepIndex === 0} data-testid="button-onboarding-back"><ArrowLeft size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />Back</button><button className="primary-button" onClick={continueFlow} data-testid="button-onboarding-continue">{stepIndex === steps.length - 1 ? 'Prepare my move' : 'Continue'}<ArrowRight size={16} /></button></div><div className="demo-wrap"><button className="demo-button" onClick={useDemo} data-testid="button-use-demo"><Sparkles size={14} />Use demo persona</button></div></div></section></div></div></main>;
}
function Option({ title, subtitle, selected, onClick, testId }: { title: string; subtitle?: string; selected: boolean; onClick: () => void; testId: string }) { return <button type="button" className={`option-card${selected ? ' selected' : ''}`} onClick={onClick} aria-pressed={selected} data-testid={testId}><span className="option-copy"><span className="option-title">{title}</span>{subtitle && <span className="option-subtitle">{subtitle}</span>}</span><span className="option-check"><Check size={13} /></span></button>; }
function taskIcon(category: string) {
  if (category === 'visa' || category === 'id-medical') return <FileCheck2 size={15} />;
  if (category === 'housing') return <Home size={15} />;
  if (category === 'job') return <BriefcaseBusiness size={15} />;
  if (category === 'bank') return <Banknote size={15} />;
  if (category === 'sim') return <Smartphone size={15} />;
  return <Users size={15} />;
}
function ChatBubble({ item, animate, onSpeakingChange, voiceEnabled }: { item: ChatMessage; animate: boolean; onSpeakingChange: (speaking: boolean) => void; voiceEnabled: boolean }) {
  const [visibleLength, setVisibleLength] = useState(animate ? 0 : item.text.length);
  useEffect(() => {
    if (!animate) {
      setVisibleLength(item.text.length);
      return;
    }
    let nextLength = 0;
    const step = Math.max(1, Math.ceil(item.text.length / 130));
    const useVoice = voiceEnabled && item.role === 'assistant';
    if (useVoice) sayMoveMate(item.text, true, onSpeakingChange);
    else onSpeakingChange(false);
    const timer = window.setInterval(() => {
      nextLength = Math.min(item.text.length, nextLength + step);
      setVisibleLength(nextLength);
      if (nextLength >= item.text.length) {
        window.clearInterval(timer);
        if (!useVoice) onSpeakingChange(false);
      }
    }, 18);
    return () => {
      window.clearInterval(timer);
      if (useVoice) stopMoveMateSpeech();
      if (animate) onSpeakingChange(false);
    };
  }, [animate, item.text, onSpeakingChange, voiceEnabled]);
  return <div className={`chat-bubble ${item.role}`} aria-label={animate ? item.text : undefined}>{item.role === 'assistant' && animate ? item.text.slice(0, visibleLength) : item.text}</div>;
}
function Dashboard() {
  const voiceStatus = useVoiceStatus();
  useEffect(() => () => stopMoveMateSpeech(), []);
  const [, setLocation] = useLocation();
  const [saved, setSaved] = useState<Stored | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatError, setChatError] = useState('');
  const [aiPowered, setAiPowered] = useState<boolean | null>(null);
  const [assistantSpeaking, setAssistantSpeaking] = useState(false);
  const [celebration, setCelebration] = useState<{ title: string; id: number } | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [assistantPosition, setAssistantPosition] = useState(readAssistantPosition);
  const dragState = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const [helpTopic, setHelpTopic] = useState<'housing' | 'medical' | null>(null);
  const chatMutation = useChatWithMoveMate();
  useEffect(() => {
    fetch('/api/assistant-status')
      .then(response => response.ok ? response.json() as Promise<{ aiPowered?: boolean }> : Promise.reject())
      .then(status => setAiPowered(Boolean(status.aiPowered)))
      .catch(() => setAiPowered(false));
  }, []);
  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(null), 1900);
    return () => window.clearTimeout(timer);
  }, [celebration]);
  useEffect(() => { const current = readSaved(); if (!current?.completed || !current.structuredProfile || !current.plan) setLocation('/onboarding'); else setSaved(current); }, [setLocation]);
  const profile = saved?.profile;
  const plan = saved?.plan;
  const structured = saved?.structuredProfile;
  const completed = saved?.completedTaskIds ?? [];
  const phases: { key: 'beforeArrival' | 'week1' | 'week2'; label: string; title: string; desc: string; icon: ReactNode; tasks: MoveTask[] }[] = plan ? [
    { key: 'beforeArrival', label: 'Before arrival', title: 'Before arrival', desc: 'A little preparation makes landing day lighter.', icon: <CalendarDays size={16} />, tasks: plan.beforeArrival },
    { key: 'week1', label: 'Week one', title: 'Your first week', desc: 'Find your feet and take care of the essentials.', icon: <MapPin size={16} />, tasks: plan.week1 },
    { key: 'week2', label: 'Week two', title: 'Finding your rhythm', desc: 'Start building the routines that make it home.', icon: <Heart size={16} />, tasks: plan.week2 },
  ] : [];
  const allTasks = phases.flatMap(phase => phase.tasks);
  const score = Math.min(100, Math.round((structured?.jobStatus === 'offer' ? 20 : 0) + allTasks.filter(task => completed.includes(task.id)).reduce((sum, task) => sum + task.scorePoints, 0)));
  const nextTask = allTasks.filter(task => !completed.includes(task.id)).sort((a, b) => taskPriorityOrder[a.priority] - taskPriorityOrder[b.priority])[0] ?? null;
  if (!saved || !profile || !plan || !structured) return <main className="app-shell"><Header /><div className="dashboard-wrap"><div className="skeleton-panel" aria-label="Loading your move plan"><div /><div /><div /></div></div></main>;
  const dateLabel = profile.arrivalStatus === 'date' && profile.arrivalDate ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${profile.arrivalDate}T12:00:00`)) : 'Still planning your arrival';
  function editAnswers() { stopMoveMateSpeech(); setVoiceEnabled(true); const current = readSaved(); if (current) writeSaved({ ...current, step: 'name', completed: false }); setLocation('/onboarding'); }
  function persist(update: Partial<Stored>) {
    const latest = readSaved();
    if (!latest) return;
    const next = { ...latest, ...update };
    writeSaved(next); setSaved(next);
  }
  function celebrateTask(title: string) {
    setCelebration({ title, id: Date.now() });
  }
  function startAssistantDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || event.target instanceof HTMLElement && event.target.closest('svg')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragState.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: rect.left, originY: rect.top, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveAssistant(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    const maxX = window.innerWidth - (chatOpen ? 50 : 80) - 8;
    const maxY = window.innerHeight - (chatOpen ? 50 : 80) - 8;
    setAssistantPosition({ x: Math.max(8, Math.min(maxX, drag.originX + dx)), y: Math.max(96, Math.min(maxY, drag.originY + dy)) });
  }
  function finishAssistantDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      const position = { x: Math.round(rect.left), y: Math.round(rect.top) };
      setAssistantPosition(position);
      try { localStorage.setItem(ASSISTANT_POSITION_KEY, JSON.stringify(position)); } catch { /* Position saving is optional. */ }
    }
    dragState.current = drag.moved ? { ...drag, moved: true } : null;
  }
  function restoreAssistantPosition() {
    setAssistantPosition(null);
    try { localStorage.removeItem(ASSISTANT_POSITION_KEY); } catch { /* Position saving is optional. */ }
  }
  function navigateToModule(module: 'bank' | 'sim' | 'housing') {
    document.getElementById(`demo-tab-${module}`)?.click();
    window.setTimeout(() => {
      if (module === 'bank') {
        const checklist = document.getElementById('bank-document-requirements') as HTMLDetailsElement | null;
        if (checklist) {
          checklist.open = true;
          checklist.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }
      document.getElementById('demo-hub')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }
  function openGuidanceInChat(topic: 'housing' | 'bank' | 'sim') {
    const prompts = {
      housing: 'I want to shortlist Abu Dhabi neighbourhoods. Ask me one question at a time about my work or school location, monthly rent budget, and commute preference. Then help compare areas. Keep this focused on housing.',
      bank: 'Help me figure out the right UAE bank to explore based on my move stage, job offer, and salary range. Explain why your starting suggestion fits and what I should verify with the bank.',
      sim: 'I need help with a UAE SIM for arrival. Ask whether I prefer an eSIM before arrival or buying a SIM at the airport, then guide me through the next step and the sample options below.',
    };
    const module = topic === 'housing' ? 'housing' : topic;
    navigateToModule(module);
    setChatOpen(true);
    window.setTimeout(() => void submitChat(prompts[topic]), 180);
  }
  function toggleTask(task: MoveTask) {
    const wasComplete = completed.includes(task.id);
    const ids = wasComplete ? completed.filter(id => id !== task.id) : [...completed, task.id];
    persist({ completedTaskIds: ids });
    if (!wasComplete) {
      celebrateTask(task.title);
      const next = allTasks.find(item => item.id !== task.id && !ids.includes(item.id));
      sayMoveMate(`Well done, ${task.title} is complete.${next ? ` Your next step is ${next.title}.` : ' You have completed your move plan.'}`, voiceEnabled, setAssistantSpeaking);
    }
  }
  function askAboutHelp(topic: 'housing' | 'medical') {
    setHelpTopic(null);
    setChatOpen(true);
    setMessage(topic === 'housing'
      ? `Help me shortlist Abu Dhabi neighbourhoods. Ask me for my work or school location, monthly rent budget, and commute preference, then guide me through comparing areas.`
      : `Walk me through arranging the Abu Dhabi residence visa medical screening. Help me check which SEHA screening centre and service fit my situation.`);
    sayMoveMate(topic === 'housing' ? 'Let’s make a useful home shortlist together.' : 'I can help you work out the next medical screening step.', voiceEnabled, setAssistantSpeaking);
  }
  async function submitChat(text = message) {
    const query = text.trim();
    if (!query || !plan || !structured || chatMutation.isPending) return;
    prepareSpeechFromGesture();
    setMessage(''); setChatError('');
    const priorHistory = saved.chatHistory ?? [];
    const userHistory = [...priorHistory, { role: 'user' as const, text: query }];
    persist({ chatHistory: userHistory });
    try {
      let result;
      const conversationHistory = priorHistory.slice(-10);
      try { result = await chatMutation.mutateAsync({ data: { message: query, profile: structured, plan, completedTaskIds: completed, conversationHistory } }); }
      catch { result = { ...answerChatLocally({ message: query, profile: structured, plan, completedTaskIds: completed, conversationHistory }), aiPowered: false }; }
      setAiPowered(result.aiPowered);
      const withReply = [...userHistory, { role: 'assistant' as const, text: result.reply }];
      const latest = readSaved();
      if (latest) {
        const newlyCompleted = result.completedTaskIds.find(id => !completed.includes(id));
        const next = { ...latest, chatHistory: withReply, completedTaskIds: result.completedTaskIds };
        writeSaved(next); setSaved(next);
        if (newlyCompleted) celebrateTask(allTasks.find(task => task.id === newlyCompleted)?.title ?? 'Move plan step');
      }
    } catch {
      setChatError('That didn’t reach your guide. Your message is still here—please try again.');
      const latest = readSaved();
      if (latest) { const next = { ...latest, chatHistory: priorHistory }; writeSaved(next); setSaved(next); }
      setMessage(query);
    }
  }
  const history = saved.chatHistory ?? [];
  const latestAssistantIndex = history.reduce((latest, item, index) => item.role === 'assistant' ? index : latest, -1);
  const quickPrompts = ['What should I do next?', 'Help me with a bank account', 'What documents do I need?'];
  const assistantStyle: CSSProperties | undefined = assistantPosition ? { left: assistantPosition.x, top: assistantPosition.y, right: 'auto', bottom: 'auto' } : undefined;
  const floatingPanelWidth = Math.min(390, Math.max(280, window.innerWidth - 24));
  const floatingPanelHeight = Math.min(570, Math.max(320, window.innerHeight - 24));
  const floatingPanelStyle: CSSProperties | undefined = assistantPosition ? {
    left: Math.max(12, Math.min(window.innerWidth - floatingPanelWidth - 12, assistantPosition.x < window.innerWidth / 2 ? assistantPosition.x : assistantPosition.x + (chatOpen ? 50 : 78) - floatingPanelWidth)),
    top: Math.max(12, Math.min(window.innerHeight - floatingPanelHeight - 12, assistantPosition.y < window.innerHeight / 2 ? assistantPosition.y + (chatOpen ? 50 : 78) + 12 : assistantPosition.y - floatingPanelHeight - 12)),
    width: floatingPanelWidth,
    height: floatingPanelHeight,
  } : undefined;
  return <main className="app-shell"><Header /><div className="dashboard-wrap"><div className="dash-top"><div><div className="eyebrow" style={{ marginBottom: 15 }}>Your move, made more manageable</div><h1 className="dash-greeting" data-testid="text-dashboard-greeting">Hello, <span>{profile.name || 'there'}.</span></h1><p className="dash-subtitle">A fresh start in Abu Dhabi, with a little more room to breathe.</p></div><button className="edit-button" onClick={editAnswers} data-testid="button-edit-answers"><Edit3 size={15} />Edit my answers</button></div>
  <section className="profile-strip" aria-label="Your move snapshot"><div className="profile-card"><div><div className="profile-caption">Your move snapshot</div><div className="profile-name" data-testid="text-profile-nationality">{profile.nationality || 'Your new chapter'} <span style={{ color: '#bd8164', fontSize: 16 }}>→</span> Abu Dhabi</div><div className="profile-detail" data-testid="text-profile-details">{profile.jobStatus === 'offer' ? `Job offer${profile.salaryRange ? ` · ${profile.salaryRange}` : ''}` : profile.jobStatus === 'no-offer' ? 'Exploring work options' : 'Move planning'} · {profile.familyStatus === 'alone' ? 'Moving solo' : profile.familyStatus === 'others' ? `Household of ${profile.adults + profile.children}` : 'Household details'}</div></div><div className="profile-icon"><UserRound size={24} /></div></div><div className="arrival-card"><div className="arrival-icon"><CalendarDays size={20} /></div><div><div className="arrival-caption">Arrival outlook</div><div className="arrival-value" data-testid="text-arrival-outlook">{dateLabel}</div><div className="arrival-note">{profile.arrivalStatus === 'visa' ? 'Visa guidance is part of your next chapter.' : profile.currentCity ? `Leaving from ${profile.currentCity}` : 'Your arrival details, at a glance.'}</div></div></div></section>
  <aside className="cohort-note" data-testid="arrival-demo-count"><span className="cohort-icon"><Users size={17} /></span><div><strong>18 newcomers arriving in Abu Dhabi today</strong><span>Sample cohort count for the demo · not live arrival data</span></div><span className="demo-tag">Example</span></aside>
  <section className="settlement-row" aria-label="Settlement progress"><div className="score-card"><div className="score-ring" style={{ '--score': `${score * 3.6}deg` } as CSSProperties & { '--score': string }}><div><strong data-testid="text-settlement-score">{score}</strong><span>/100</span></div></div><div><div className="phase-label">Your settlement score</div><h2>{score === 100 ? 'You’re finding your feet.' : 'Every small step counts.'}</h2><p>{completed.length} of {allTasks.length} plan steps complete · updates as you go</p></div></div><article className="next-step-card" data-testid="card-next-step"><div className="next-step-icon">{nextTask ? taskIcon(nextTask.category) : <CircleCheck size={18} />}</div><div className="next-step-copy"><span className="phase-label">Your next step</span><h3 data-testid="text-next-step">{nextTask?.title ?? 'Your first plan is complete'}</h3><p>{nextTask?.description ?? 'Take a breath. You’ve worked through every step in your plan.'}</p></div>{nextTask && <button onClick={() => { document.getElementById(`task-${nextTask.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} data-testid="button-go-next">See step <ArrowRight size={15} /></button>}</article></section>
  <section className="plan-section" aria-labelledby="plan-heading"><div className="section-heading"><div><div className="phase-label">Your first few chapters</div><h2 id="plan-heading">A move plan that unfolds</h2><p>Small, useful steps—shaped around your arrival.</p></div><div className="plan-count" data-testid="text-plan-progress">{completed.length} / {allTasks.length} done</div></div>
  <div className="phase-list">{phases.map((phase, index) => <article className="phase-card" key={phase.title} data-testid={`card-phase-${index}`}><div className="phase-head"><span className="phase-index">{phase.label}</span><span className="phase-icon">{phase.icon}</span></div><h3>{phase.title}</h3><p>{phase.desc}</p><div className="phase-progress">{phase.tasks.filter(task => completed.includes(task.id)).length} of {phase.tasks.length} steps complete</div></article>)}</div>
  <div className="task-phases">{phases.map((phase, index) => <section className="task-phase" key={phase.key} aria-labelledby={`phase-${phase.key}`}><div className="task-phase-heading"><div><span className="phase-label">{phase.label}</span><h3 id={`phase-${phase.key}`}>{phase.title}</h3></div><span className="task-total">{phase.tasks.filter(task => completed.includes(task.id)).length}/{phase.tasks.length}</span></div>{phase.tasks.length ? <div className="task-list">{phase.tasks.map(task => <div className="task-row-wrap" key={task.id}><label className={`task-row${completed.includes(task.id) ? ' task-done' : ''}`} id={`task-${task.id}`} data-testid={`task-row-${task.id}`}><input type="checkbox" checked={completed.includes(task.id)} onChange={() => toggleTask(task)} data-testid={`checkbox-task-${task.id}`} /><span className="task-check">{completed.includes(task.id) ? <CircleCheck size={19} /> : <Circle size={19} />}</span><span className="task-icon">{taskIcon(task.category)}</span><span className="task-text"><strong data-testid={`text-task-title-${task.id}`}>{task.title}</strong><small>{task.description}</small></span><span className={`priority priority-${task.priority}`}>{task.priority}</span>{task.officialSource && <span className="official-tag" data-testid={`tag-official-${task.id}`}>Official</span>}<span className="task-points">+{task.scorePoints}</span></label>
    {!completed.includes(task.id) && task.id === 'shortlist-home-areas' && <button className="task-help-button" type="button" onClick={() => openGuidanceInChat('housing')} data-testid="button-figure-out-housing"><CircleHelp size={14} />Figure this out</button>}
    {!completed.includes(task.id) && task.id === 'complete-medical-and-insurance' && <button className="task-help-button" type="button" onClick={() => setHelpTopic('medical')} aria-label="Figure out where to get visa medical screening"><CircleHelp size={14} />Figure this out</button>}
    {!completed.includes(task.id) && task.id === 'prepare-bank-documents' && <button className="task-help-button" type="button" onClick={() => navigateToModule('bank')} data-testid="button-bank-document-guide"><FileCheck2 size={14} />View bank document guide</button>}
    {!completed.includes(task.id) && task.id === 'open-bank-account' && <button className="task-help-button" type="button" onClick={() => openGuidanceInChat('bank')} data-testid="button-figure-out-bank"><CircleHelp size={14} />Figure out the right bank for me</button>}
    {!completed.includes(task.id) && task.id === 'choose-local-sim' && <button className="task-help-button" type="button" onClick={() => openGuidanceInChat('sim')} data-testid="button-figure-out-sim"><CircleHelp size={14} />Need SIM help?</button>}
  </div>)}</div> : <div className="empty-phase" data-testid={`empty-phase-${phase.key}`}>Your plan has no steps in this chapter yet. The rest of your journey is ready above.</div>}</section>)}</div></section>
  <section className="cost-section" aria-labelledby="cost-heading"><div className="cost-intro"><span className="phase-label">A little financial breathing room</span><h2 id="cost-heading">Your first month, in AED</h2><p>{plan.costNote}</p><span className="cost-estimate" data-testid="text-cost-estimate">AED {plan.estimatedFirstMonthCost.toLocaleString('en')}</span><small>estimated first-month total</small></div><div className="cost-breakdown">{plan.costBreakdown.length ? plan.costBreakdown.map((line, i) => <div className="cost-line" key={`${line.category}-${i}`} data-testid={`cost-line-${i}`}><span>{line.category}</span><strong>AED {line.lowAed.toLocaleString('en')}–{line.highAed.toLocaleString('en')}</strong></div>) : <div className="cost-empty" data-testid="empty-cost-breakdown">Cost categories will appear here as your plan is prepared.</div>}<p className="cost-disclaimer">Planning estimate only. Actual costs vary by provider and personal choices.</p></div></section>
  <DemoModules profile={{ jobStatus: profile.jobStatus, salaryRange: profile.salaryRange, arrivalStatus: profile.arrivalStatus }} />
  <div className="privacy-note" data-testid="text-privacy-note"><ShieldCheck size={14} />Your plan is saved in this browser. Don’t share passwords, ID numbers, or bank account details in chat.</div></div>
  {celebration && <div key={celebration.id} className="task-celebration" aria-live="polite" aria-label={`${celebration.title} complete`}><span className="celebration-message"><Sparkles size={16} />Step complete! <strong>{celebration.title}</strong></span>{Array.from({ length: 28 }, (_, index) => <i key={index} className="confetti-piece" style={{ '--confetti-index': index, '--confetti-x': `${((index * 47) % 190) - 95}px`, '--confetti-rotation': `${(index * 71) % 360}deg` } as CSSProperties} />)}</div>}
  {helpTopic && <div className="guide-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setHelpTopic(null); }}><section className="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title"><button className="guide-close" type="button" onClick={() => setHelpTopic(null)} aria-label="Close guide"><X size={18} /></button><div className="guide-avatar"><img src={mascot} alt="" /></div><span className="phase-label">MoveMate, let’s work it out</span>{helpTopic === 'housing' ? <><h2 id="guide-title">Build a home shortlist that fits you</h2><p>Start with three details. I can use them to help compare areas and viewing options with you.</p><ol className="guide-steps"><li><strong>Where will you commute?</strong><span>Share a work or school area, if you know it.</span></li><li><strong>What rent feels comfortable?</strong><span>Choose a monthly budget and whether you need furnished accommodation.</span></li><li><strong>What matters day to day?</strong><span>Set your commute limit, household needs, and access to shops or transit.</span></li><li><strong>Compare before you book.</strong><span>Shortlist a few areas, ask about viewing availability, and confirm tenancy and Tawtheeq details before paying.</span></li></ol></> : <><h2 id="guide-title">Find an approved screening centre</h2><p>SEHA’s Disease Prevention &amp; Screening Centres provide residence visa medical screening. A listed Abu Dhabi centre is at Hazza Bin Zayed Street, near Sheikh Khalifa Medical City.</p><div className="guide-fact"><strong>Regular visa screening</strong><span>The official page currently lists AED 250 for standard screening and results within 48 hours or earlier by SMS. Requirements and fees can change; confirm before visiting.</span></div><div className="guide-fact"><strong>Listed hours at the Abu Dhabi centre</strong><span>Regular screening: Monday–Friday 7am–7pm, Sunday 8am–5pm. Check last application times and appointment requirements first.</span></div><div className="guide-links"><a href="https://dpsc.seha.ae/EN-US/Services/Pages/visascreening.aspx" target="_blank" rel="noreferrer">Screening service details <ExternalLink size={13} /></a><a href="https://dpsc.seha.ae/EN-US/Centers/Pages/AbuDhabi.aspx" target="_blank" rel="noreferrer">Abu Dhabi centre and hours <ExternalLink size={13} /></a></div></>}<button className="guide-ask-button" type="button" onClick={() => askAboutHelp(helpTopic)}>Ask MoveMate to guide me <ArrowRight size={15} /></button></section></div>}
  <div className="assistant-shell" style={assistantStyle}>{chatOpen && <section className={`chat-panel${assistantPosition ? ' is-floating' : ''}`} style={floatingPanelStyle} aria-label="MoveMate assistant" data-testid="panel-assistant-chat"><header className="chat-header"><div className={`chat-avatar${assistantSpeaking ? ' mascot-speaking' : ''}`}><img src={mascot} alt="" /></div><div><strong>Your MoveMate</strong><span>{aiPowered ? 'GPT-6 Luna · here with you' : 'Your move guide · demo mode'}</span></div>{assistantPosition && <button type="button" onClick={restoreAssistantPosition} aria-label="Move MoveMate back to the corner" title="Return MoveMate to the corner"><Move size={15} /></button>}<button type="button" className="chat-voice-toggle" onClick={() => { if (assistantSpeaking) { stopMoveMateSpeech(); setVoiceEnabled(false); } else { setVoiceEnabled(true); sayMoveMate(history.filter(item => item.role === 'assistant').at(-1)?.text ?? 'I’ll speak my replies out loud.', true, setAssistantSpeaking); } }} aria-label={assistantSpeaking ? 'Stop MoveMate voice' : 'Play MoveMate voice'} title="Play or stop narration">{assistantSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}<span>{assistantSpeaking ? 'Stop' : 'Play voice'}</span></button><button onClick={() => setChatOpen(false)} aria-label="Close assistant" data-testid="button-close-assistant"><X size={17} /></button></header><div className="chat-body" aria-live="polite"><div className="assistant-welcome"><span className={`welcome-mascot${assistantSpeaking ? ' mascot-speaking' : ''}`}><img src={mascot} alt="" /></span><div>What would you like help with?</div></div>{history.map((item, i) => <div key={`${i}-${item.role}`} data-testid={`chat-message-${i}`}><ChatBubble item={item} animate={item.role === 'assistant' && i === latestAssistantIndex} onSpeakingChange={setAssistantSpeaking} voiceEnabled={voiceEnabled} /></div>)}{chatMutation.isPending && <div className="chat-loading" data-testid="status-chat-loading"><span /><span /><span />Putting together a helpful answer</div>}{chatError && <div className="chat-error" role="alert" data-testid="status-chat-error">{chatError}<button onClick={() => void submitChat()} data-testid="button-retry-chat">Retry</button></div>}{!history.length && <div className="quick-prompts">{quickPrompts.map((prompt, i) => <button key={prompt} onClick={() => void submitChat(prompt)} disabled={chatMutation.isPending} data-testid={`button-quick-prompt-${i}`}>{prompt}<ArrowRight size={13} /></button>)}</div>}</div><div className="voice-tools chat-voice-tools"><span className="voice-status" role="status">{voiceStatus || 'Demo voice ready'}</span><button type="button" className="browser-voice-test" onClick={() => sayMoveMate(history.filter(item => item.role === 'assistant').at(-1)?.text ?? 'I’ll speak my replies out loud.', true, setAssistantSpeaking, true)}>Test browser voice</button></div><div className="chat-caption">{aiPowered === true ? 'GPT-6 Luna · chat and move context are sent to OpenAI' : aiPowered === false ? 'Demo guide · add OPENAI_API_KEY as a server secret for GPT-6 Luna' : 'Checking MoveMate guide status'}</div><form className="chat-composer" onSubmit={e => { e.preventDefault(); void submitChat(); }}><input value={message} onChange={e => setMessage(e.target.value)} placeholder="Ask about your move…" aria-label="Message MoveMate" data-testid="input-chat-message" /><button type="submit" disabled={!message.trim() || chatMutation.isPending} aria-label="Send message" data-testid="button-send-chat"><Send size={17} /></button></form></section>}<button className={`assistant-launcher${chatOpen ? ' is-open' : ''}${assistantSpeaking ? ' mascot-speaking' : ''}`} onPointerDown={startAssistantDrag} onPointerMove={moveAssistant} onPointerUp={finishAssistantDrag} onPointerCancel={finishAssistantDrag} onClick={() => { if (dragState.current?.moved) { dragState.current = null; return; } setChatOpen(open => !open); }} aria-label={chatOpen ? 'Close MoveMate assistant or drag to move' : 'Open MoveMate assistant or drag to move'} title="Drag MoveMate to reposition; click to open" aria-expanded={chatOpen} data-testid="button-open-assistant">{chatOpen ? <X size={20} /> : <><img src={mascot} alt="MoveMate mascot" data-testid="img-assistant-mascot" /><span className="assistant-dot" /></>}</button></div>
  </main>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RoutedErrorBoundary><AppRouter /></RoutedErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;
