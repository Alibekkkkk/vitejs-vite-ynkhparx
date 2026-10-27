import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, BookOpen, FileText, CheckCircle, LogOut, User, Play,
  ArrowRight, LayoutDashboard, History, Check, Plus, Edit3, Users,
  Lock, Image as ImageIcon, Sun, Moon, X, Copy, Archive, RotateCcw
} from 'lucide-react';

import { initializeApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend, type Part } from 'firebase/ai';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { 
  getFirestore, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc, collection, collectionGroup, onSnapshot,
  serverTimestamp, updateDoc, query, where, orderBy, limit, writeBatch, startAfter
} from "firebase/firestore";
import {
  gradeQuestion,
  normalizeQuestion,
  resolveResponseType,
  RESPONSE_TYPE_LABELS,
  validateQuestion,
  isAnswerPresent,
  type EngineQuestion,
  type ResponseType,
} from './questionEngine';
import { parseQuestionBank } from './questionBank';
import { getLocalWritingSuggestions } from './writingSuggestions';
import { FormattedQuestionText } from './FormattedQuestionText';
import { QuestionTextEditor } from './QuestionTextEditor';
import { stripQuestionTextFormatting } from './questionTextFormatting';
import { PromptFigure } from './PromptFigure';
import { ResizableSplitPane } from './ResizableSplitPane';
import { WritingResourceTable } from './WritingResourceTable';
import { WritingResourceManager } from './WritingResourceManager';
import type { WritingResource } from './writingResources';
import { LEGACY_IMPORT_BATCH_SIZE, mapLegacyResult, parseLegacyResultPath } from './legacyMigration';
import { ANSWER_KEY_MIGRATION_VERSION, buildAnswerKeyQuestions, hasCompleteAnswerKey, stripPublicAnswerFields } from './answerKeyMigration';
import { buildReadingSessionViewModel } from './readingSession';
import {
  fetchFigureForAI,
  getFigureSource,
  normalizeFigureUrl,
  readFigureDimensions,
  requiresTaskFigure,
  validateFigureDimensions,
  validateFigureFile,
  verifyFigureUrl,
  type FigureAsset,
} from './figureAssets';

const firebaseConfig = {
  apiKey: "AIzaSyBj6nrhP7w-KbMeYHV7wtEMk-yHftG8H4c",
  authDomain: "exam-portal-71a9b.firebaseapp.com",
  projectId: "exam-portal-71a9b",
  storageBucket: "exam-portal-71a9b.firebasestorage.app",
  messagingSenderId: "1020660422457",
  appId: "1:1020660422457:web:31c02371e24694e423e0e8",
  measurementId: "G-WH8LWEWDGR"
};

const app = initializeApp(firebaseConfig);
const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY || '';
if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN === 'true') {
  (self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
if (appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const writingAI = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
  model: 'gemini-3.8-flash',
  generationConfig: { maxOutputTokens: 220, temperature: 0.3 },
});
const appId = "exam-portal-71a9b";
const removeUndefinedValues = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.filter(item => item !== undefined).map(item => removeUndefinedValues(item)) as T;
  }
  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, removeUndefinedValues(item)]),
    ) as T;
  }
  return value;
};
const SAMPLE_BANKS = [
  { file: 'ielts-academic-reading-full.json', title: 'IELTS Academic Reading — Full-Length Original Practice', type: 'IELTS', questionCount: 40, durationSeconds: 3600, passageCount: 3, description: 'Three original passages; exactly 40 questions; 60 minutes.' },
  { file: 'ielts-general-reading-full.json', title: 'IELTS General Training Reading — Full-Length Original Practice', type: 'IELTS', questionCount: 40, durationSeconds: 3600, passageCount: 3, description: 'Three original texts; exactly 40 questions; 60 minutes.' },
  { file: 'ielts-listening-full.json', title: 'IELTS Listening — Full-Length Original Practice (recordings required)', type: 'IELTS', questionCount: 40, durationSeconds: 1800, listeningSections: 4, description: 'Four original scripts and 40 questions; upload and verify four real recordings before publishing.' },
  { file: 'ielts-reading-pilot.json', title: 'IELTS Reading Pilot', type: 'IELTS', questionCount: 5, durationSeconds: 2400, passageCount: 3, description: 'Short illustrative pilot; not a full-length test.' },
  { file: 'ielts-listening-pilot.json', title: 'IELTS Listening Pilot', type: 'IELTS', questionCount: 5, durationSeconds: 1800, listeningSections: 4, description: 'Short pilot scripts; actual recordings must be added and verified before use.' },
  { file: 'ielts-writing-pilot.json', title: 'IELTS Writing Pilot', type: 'IELTS', questionCount: 2, durationSeconds: 3600, description: 'Short illustrative writing pilot.' },
  { file: 'ielts-academic-writing-full.json', title: 'IELTS Academic Writing — Full Practice Session', type: 'IELTS', questionCount: 2, durationSeconds: 3600, description: 'Original Task 1 and Task 2 prompts; 60 minutes total.' },
  { file: 'ielts-general-writing-full.json', title: 'IELTS General Training Writing — Full Practice Session', type: 'IELTS', questionCount: 2, durationSeconds: 3600, description: 'Original letter and essay tasks; 60 minutes total.' },
  { file: 'ielts-speaking-practice.json', title: 'IELTS Speaking Practice', type: 'IELTS', questionCount: 7, durationSeconds: 900, description: 'Original prompts for Parts 1, 2, and 3.' },
  { file: 'sat-reading-writing-pilot.json', title: 'SAT Reading and Writing Pilot', type: 'SAT', questionCount: 2, durationSeconds: 900, description: 'Short illustrative pilot; not a full-length section.' },
  { file: 'sat-reading-writing-full.json', title: 'Digital SAT Reading and Writing — Full-Length Original Practice', type: 'SAT', questionCount: 54, durationSeconds: 3840, description: '54 original questions in two 27-question modules; 64 minutes total.' },
  { file: 'sat-math-pilot.json', title: 'SAT Math Pilot', type: 'SAT', questionCount: 2, durationSeconds: 900, description: 'Short illustrative pilot; not a full-length section.' },
  { file: 'sat-math-full.json', title: 'Digital SAT Math — Full-Length Original Practice', type: 'SAT', questionCount: 44, durationSeconds: 4200, description: '44 questions in two 22-question modules; 70 minutes total.' },
  { file: 'nuet-regression-pilot.json', title: 'NUET Regression Pilot', type: 'NUET', questionCount: 2, durationSeconds: 1800, description: 'Small regression fixture for the existing NUET engine.' },
];

const authorizedTeacherEmails = (import.meta.env.VITE_TEACHER_EMAILS || 'alibek.alpysbayev@gmail.com,alibek.alpysbayev@nu.edu.kz,aalpysbayev2@gmail.com,nurbakyt.zholaman@nu.edu.kz')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const isClientAuthorizedTeacher = (firebaseUser) => Boolean(
  firebaseUser?.emailVerified
  && firebaseUser.providerData?.some((provider) => provider.providerId === 'google.com')
  && authorizedTeacherEmails.includes(firebaseUser.email?.trim().toLowerCase())
);

// The client allowlist controls the UI; Firestore rules independently enforce it.
const resolveAccountRole = async (profileRef, firebaseUser, storedRole, requestedRole = 'student') => {
  if ((storedRole === 'teacher' || requestedRole === 'teacher') && isClientAuthorizedTeacher(firebaseUser)) {
    if (storedRole === 'teacher') return 'teacher';
    try {
      await updateDoc(profileRef, { role: 'teacher' });
      return 'teacher';
    } catch (error) {
      console.error('Teacher promotion was rejected by Firestore rules:', error);
      if (requestedRole === 'teacher') {
        await signOut(auth);
        throw new Error('Your Google account is approved, but Firestore blocked teacher access. Publish the teacher authorization rules in Firebase Console, then try again.');
      }
    }
  }

  if (storedRole === 'teacher' && !isClientAuthorizedTeacher(firebaseUser)) {
    try {
      await updateDoc(profileRef, { role: 'student' });
    } catch (error) {
      console.error('Could not downgrade an unapproved teacher profile:', error);
    }
  }
  return 'student';
};

const Modal = ({ isOpen, title, children, onClose, actions = [] }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
        <h3 id="modal-title" className="text-xl font-bold text-gray-800 dark:text-white mb-4 text-left">{title}</h3>
        <div className="text-slate-600 dark:text-slate-300 text-left">{children}</div>
        {actions.length > 0 ? (
          <div className="mt-6 flex justify-end gap-3">
            {actions.map((action, index) => (
              <button
                key={`${action.label}-${index}`}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={`px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${action.destructive ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600'} disabled:opacity-60`}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : onClose ? (
          <div className="mt-6 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const QuestionResponse = ({ question: rawQuestion, value, onChange, preview = false }) => {
  const question = normalizeQuestion(rawQuestion);
  const inputClass = 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 p-3 text-slate-800 dark:text-white';
  const choices = question.options || [];

  if (question.responseType === 'single-choice') return (
    <div className="space-y-2" role="radiogroup" aria-label="Answer choices">
      {choices.map((choice, index) => <label key={`${question.id}-choice-${index}`} className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-600 p-3 cursor-pointer">
        <input type="radio" name={`answer-${question.id}-${preview ? 'preview' : 'exam'}`} checked={value === choice} onChange={() => onChange(choice)} />
        <span>{choice}</span>
      </label>)}
    </div>
  );

  if (question.responseType === 'multiple-select') {
    const selected = Array.isArray(value) ? value : [];
    return <div className="space-y-2">{choices.map((choice, index) => <label key={`${question.id}-multi-${index}`} className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-600 p-3 cursor-pointer">
      <input type="checkbox" checked={selected.includes(choice)} onChange={event => onChange(event.target.checked ? [...selected, choice] : selected.filter(item => item !== choice))} />
      <span>{choice}</span>
    </label>)}</div>;
  }

  if (question.responseType === 'multi-blank' || question.responseType === 'matching') {
    const answers = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const slots = question.answerSlots || [];
    const choicesForMatching = question.sharedChoices || [];
    return <div className="space-y-3">{slots.map((slot, index) => {
      const selected = answers[slot.id] || '';
      const usedByOtherSlot = new Set(slots.filter(other => other.id !== slot.id).map(other => answers[other.id]).filter(Boolean));
      return <label key={`${question.id}-${slot.id}`} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        <span className="block mb-1">{slot.label || `Answer ${index + 1}`}{slot.prompt ? ` — ${slot.prompt}` : ''}</span>
        {question.responseType === 'matching' ? <select className={inputClass} value={selected} onChange={event => onChange({ ...answers, [slot.id]: event.target.value })}>
          <option value="">Choose…</option>{choicesForMatching.map((choice, choiceIndex) => <option key={`${slot.id}-shared-${choiceIndex}`} value={choice} disabled={!question.allowChoiceReuse && usedByOtherSlot.has(choice)}>{choice}</option>)}
        </select> : <input className={inputClass} value={selected} onChange={event => onChange({ ...answers, [slot.id]: event.target.value })} placeholder="Type your answer" />}
      </label>;
    })}</div>;
  }

  if (question.responseType === 'ordering') {
    const ordered = Array.isArray(value) ? value : [];
    const available = choices.filter(choice => !ordered.includes(choice));
    return <div className="space-y-3">{choices.map((_, index) => <label key={`${question.id}-order-${index}`} className="block text-sm font-medium text-slate-700 dark:text-slate-200">Position {index + 1}
      <select className={inputClass} value={ordered[index] || ''} onChange={event => {
        const next = [...ordered];
        const previousIndex = next.indexOf(event.target.value);
        if (previousIndex >= 0 && previousIndex !== index) next[previousIndex] = next[index] || '';
        next[index] = event.target.value;
        onChange(next);
      }}><option value="">Choose an item…</option>{[...new Set([...available, ordered[index]].filter(Boolean))].map(item => <option key={item} value={item}>{item}</option>)}</select>
    </label>)}</div>;
  }

  if (question.responseType === 'numeric') return <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Enter a number
    <input className={inputClass} type="number" step="any" value={value ?? ''} onChange={event => onChange(event.target.value)} />
  </label>;
  if (question.responseType === 'long-text') return <textarea rows={8} maxLength={12000} className={inputClass} placeholder="Write your response" value={value ?? ''} onChange={event => onChange(event.target.value)} />;
  return <input className={inputClass} value={value ?? ''} onChange={event => onChange(event.target.value)} placeholder="Type your answer" />;
};

const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const formatAnswerForReview = (answer: unknown) => answer == null || answer === ''
  ? 'No answer'
  : typeof answer === 'object' ? JSON.stringify(answer) : String(answer);

const renderTeacherAnnotatedAnswer = (answer: unknown, annotations: unknown) => {
  const text = formatAnswerForReview(answer);
  if (typeof answer !== 'string' || !Array.isArray(annotations)) return text;
  const ranges = annotations
    .filter((item): item is { quote: string; comment: string; start?: number } => Boolean(
      item && typeof item.quote === 'string' && item.quote && typeof item.comment === 'string' && item.comment
    ))
    .map(item => {
      const savedStart = Number.isInteger(item.start) && text.slice(item.start, item.start + item.quote.length) === item.quote
        ? item.start
        : text.indexOf(item.quote);
      return { ...item, start: savedStart };
    })
    .filter(item => item.start >= 0)
    .sort((left, right) => left.start - right.start || right.quote.length - left.quote.length);
  const rendered: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((item, index) => {
    if (item.start < cursor) return;
    if (item.start > cursor) rendered.push(text.slice(cursor, item.start));
    rendered.push(<mark key={`annotation-${index}`} title={item.comment} className="rounded bg-amber-200 px-0.5 text-amber-950 dark:bg-amber-700 dark:text-white">{item.quote}</mark>);
    cursor = item.start + item.quote.length;
  });
  if (cursor < text.length) rendered.push(text.slice(cursor));
  return rendered.length ? rendered : text;
};

const getStatusColor = (category) => {
  switch (category) {
    case 'Exam': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800';
    case 'Homework': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800';
    default: return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800';
  }
};

const extractImageUrl = (input) => {
  if (!input) return '';
  const bbMatch = input.match(/\[img\](.*?)\[\/img\]/i);
  if (bbMatch) return bbMatch[1];
  const htmlMatch = input.match(/src=["'](.*?)["']/i);
  if (htmlMatch) return htmlMatch[1];
  return input.trim();
};

const createEmptyTest = () => ({
  title: '',
  type: 'IELTS',
  category: 'Exam',
  durationMinutes: 30,
  description: '',
  questions: [],
  pin: '',
  groupCode: '',
  sections: {
    listening: {
      instructions: '',
      audioUrl: '',
      parts: [1, 2, 3, 4].map(sectionNumber => ({ sectionNumber, instructions: '', audioUrl: '' }))
    },
    reading: {
      instructions: '',
      passage: '',
      passages: [1, 2, 3].map(passageNumber => ({ passageNumber, title: `Passage ${passageNumber}`, content: '' }))
    },
    writing: { instructions: '' }
  }
});

type IELTSQuestionFormat =
  | 'multiple-choice'
  | 'true-false-not-given'
  | 'yes-no-not-given'
  | 'matching-headings'
  | 'matching-information'
  | 'matching-features'
  | 'sentence-endings'
  | 'completion'
  | 'map-labeling'
  | 'short-answer'
  | 'writing-task'
  | 'sat-student-produced-response';

type AssessmentQuestion = EngineQuestion & {
  id: string;
  type: 'mcq' | 'select' | 'text' | 'number' | string;
  section?: 'listening' | 'reading' | 'writing' | 'general';
  questionType?: IELTSQuestionFormat;
  passageNumber?: 1 | 2 | 3;
  listeningSectionNumber?: 1 | 2 | 3 | 4;
  satDomain?: string;
  satSkill?: string;
  correctAnswer?: string | number | string[];
  acceptedAnswers?: Array<string | number>;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  points?: number;
  writingTaskType?: 1 | 2;
  writingFormat?: string;
  options?: string[];
  responseType?: ResponseType;
  answerSlots?: Array<{ id: string; label: string; prompt?: string; correctAnswers?: Array<string | number> }>;
  sharedChoices?: string[];
  correctOrder?: string[];
  numericTolerance?: number;
  allowChoiceReuse?: boolean;
  manualReview?: boolean;
  ungraded?: boolean;
  text?: string;
  imageUrl?: string;
  imageAlt?: string;
  figureCaption?: string;
  figureMode?: 'visual' | 'text-only';
  imageAsset?: FigureAsset;
};

type AssessmentRecord = {
  id?: string;
  title?: string;
  type?: string;
  durationSeconds?: number;
  groupCode?: string;
  questions?: AssessmentQuestion[];
  sections?: {
    listening?: { instructions?: string; audioUrl?: string; audioVerified?: boolean; parts?: Array<{ sectionNumber: number; instructions?: string; audioUrl?: string; audioVerified?: boolean }> };
    reading?: { instructions?: string; passage?: string; passages?: Array<{ passageNumber: number; title?: string; content?: string }> };
    writing?: { instructions?: string };
  };
};

const SAT_SKILLS: Record<string, string[]> = {
  'Information and Ideas': ['Central ideas, details, and quantitative evidence', 'Central Ideas and Details', 'Inferences', 'Command of Evidence', 'Command of Evidence: Textual', 'Command of Evidence: Quantitative'],
  'Craft and Structure': ['Words in context and text structure', 'Words in Context', 'Text Structure and Purpose', 'Cross-Text Connections'],
  'Expression of Ideas': ['Transitions and rhetorical synthesis', 'Rhetorical Synthesis', 'Transitions'],
  'Standard English Conventions': ['Boundaries, form, and sentence structure', 'Boundaries', 'Form, Structure, and Sense'],
  Algebra: ['Linear equations', 'Linear inequalities', 'Systems of linear equations', 'Linear functions', 'Linear equations in one variable', 'Linear equations in two variables', 'Systems of two linear equations in two variables', 'Linear inequalities in one or two variables'],
  'Advanced Math': ['Equivalent expressions', 'Nonlinear equations', 'Nonlinear functions', 'Nonlinear equations in one variable', 'Systems of equations in two variables'],
  'Problem-Solving and Data Analysis': ['Ratios, rates, and units', 'Percentages', 'Data and statistics', 'Probability', 'Ratios, rates, proportional relationships, and units', 'One-variable data: distributions and measures of center and spread', 'Two-variable data: models and scatterplots', 'Probability and conditional probability', 'Inference from sample statistics and margin of error', 'Evaluating statistical claims: observational studies and experiments'],
  'Geometry and Trigonometry': ['Area and volume', 'Lines and angles', 'Right triangles', 'Circles', 'Lines, angles, and triangles', 'Right triangles and trigonometry']
};

const IELTS_QUESTION_FORMATS = [
  ['multiple-choice', 'Multiple choice'],
  ['true-false-not-given', 'True / False / Not Given'],
  ['yes-no-not-given', 'Yes / No / Not Given'],
  ['matching-headings', 'Matching headings'],
  ['matching-information', 'Matching information'],
  ['matching-features', 'Matching features'],
  ['sentence-endings', 'Matching sentence endings'],
  ['completion', 'Form / note / table / summary completion'],
  ['map-labeling', 'Map / plan labelling'],
  ['short-answer', 'Short answer'],
  ['writing-task', 'Writing task'],
  ['sat-student-produced-response', 'Numerical response']
];

const getSelectOptions = (question: AssessmentQuestion): string[] => question.options || (
  question.questionType === 'true-false-not-given' ? ['True', 'False', 'Not Given']
    : question.questionType === 'yes-no-not-given' ? ['Yes', 'No', 'Not Given']
    : []
);

const getListeningAudioUrl = (test: AssessmentRecord, sectionNumber: number) => {
  const section = test?.sections?.listening;
  const part = section?.parts?.find(item => item.sectionNumber === sectionNumber);
  if (part?.audioUrl && part.audioVerified === true) return part.audioUrl;
  return sectionNumber === 1 && section?.audioUrl && section.audioVerified === true ? section.audioUrl : '';
};

const PRIVATE_QUESTION_FIELDS = ['correctAnswer', 'acceptedAnswers', 'correctOrder', 'explanation', 'answerKey', 'solution', 'teacherNotes', 'teacherOnlyNotes'];
const PRIVATE_SECTION_FIELDS = ['recordingScript', 'recordingNotes', 'transcript', 'teacherInstructions'];

const cloneData = (value: any) => value == null ? {} : JSON.parse(JSON.stringify(value));

const extractTeacherOnlySections = (sections: any) => {
  const listening = sections?.listening;
  if (!listening) return {};
  const teacherListening: any = {};
  for (const field of PRIVATE_SECTION_FIELDS) if (listening[field] != null) teacherListening[field] = listening[field];
  const parts = (listening.parts || []).map((part: any) => {
    const privatePart: any = { sectionNumber: part.sectionNumber };
    for (const field of PRIVATE_SECTION_FIELDS) if (part[field] != null) privatePart[field] = part[field];
    return privatePart;
  }).filter((part: any) => Object.keys(part).length > 1);
  if (parts.length) teacherListening.parts = parts;
  return Object.keys(teacherListening).length ? { listening: teacherListening } : {};
};

const sanitizePublicSections = (sections: any) => {
  const visible = cloneData(sections);
  const listening = visible.listening;
  if (!listening) return visible;
  for (const field of PRIVATE_SECTION_FIELDS) delete listening[field];
  if (Array.isArray(listening.parts)) listening.parts = listening.parts.map((part: any) => {
    const publicPart = { ...part };
    for (const field of PRIVATE_SECTION_FIELDS) delete publicPart[field];
    return publicPart;
  });
  return visible;
};

const mergeTeacherSections = (publicSections: any, teacherSections: any) => {
  const sections = cloneData(publicSections);
  if (!teacherSections?.listening) return sections;
  const privateListening = teacherSections.listening;
  sections.listening = { ...sections.listening, ...Object.fromEntries(PRIVATE_SECTION_FIELDS.filter(field => privateListening[field] != null).map(field => [field, privateListening[field]])) };
  const privateParts = new Map((privateListening.parts || []).map((part: any) => [part.sectionNumber, part]));
  if (Array.isArray(sections.listening.parts)) sections.listening.parts = sections.listening.parts.map((part: any) => {
    const privatePart: any = privateParts.get(part.sectionNumber);
    return privatePart ? { ...part, ...privatePart } : part;
  });
  return sections;
};

const hasPublicAnswerKeys = (questions: any[]) => questions.some(question =>
  PRIVATE_QUESTION_FIELDS.some(field => question?.[field] != null)
  || (question?.answerSlots || []).some((slot: any) => slot.correctAnswers != null)
);

const hasPublicTeacherScripts = (sections: any) => {
  const listening = sections?.listening;
  return Boolean(listening && (PRIVATE_SECTION_FIELDS.some(field => listening[field] != null)
    || (listening.parts || []).some((part: any) => PRIVATE_SECTION_FIELDS.some(field => part[field] != null))));
};

const splitQuestionKeys = (questions: any[], sections: any) => ({
  publicSections: sanitizePublicSections(sections),
  teacherSections: extractTeacherOnlySections(sections),
  publicQuestions: questions.map(question => {
    const visible = { ...question };
    for (const field of PRIVATE_QUESTION_FIELDS) delete visible[field];
    if (Array.isArray(question.answerSlots)) visible.answerSlots = question.answerSlots.map((slot: any) => {
      const publicSlot = { ...slot };
      delete publicSlot.correctAnswers;
      return publicSlot;
    });
    return visible;
  }),
  answerKeyQuestions: questions.map(question => ({
    id: question.id,
    correctAnswer: question.correctAnswer ?? null,
    acceptedAnswers: question.acceptedAnswers || [],
    answerSlots: (question.answerSlots || []).map((slot: any) => ({ id: slot.id, correctAnswers: slot.correctAnswers || [] })),
    correctOrder: question.correctOrder || [],
    explanation: question.explanation || '',
    ...Object.fromEntries(PRIVATE_QUESTION_FIELDS.filter(field => !['correctAnswer', 'acceptedAnswers', 'correctOrder', 'explanation'].includes(field) && question[field] != null).map(field => [field, question[field]])),
  })),
});

const mergeQuestionKeys = (questions: any[], keys: any[]) => {
  const byId = new Map(keys.map(question => [question.id, question]));
  return questions.map(question => {
    const key = byId.get(question.id) || {};
    return { ...question, ...key, answerSlots: (question.answerSlots || []).map((slot: any) => ({ ...slot, ...(key.answerSlots || []).find((keySlot: any) => keySlot.id === slot.id) })) };
  });
};

const createTeacherReviewRows = (questions: any[], answers: Record<string, unknown>) => questions.map((question: any) => {
  const studentAnswer = answers?.[question.id] ?? null;
  const grade = gradeQuestion(question, studentAnswer);
  return {
    questionId: question.id,
    questionText: question.text || '',
    section: question.section || '',
    passageNumber: question.passageNumber || null,
    listeningSectionNumber: question.listeningSectionNumber || null,
    writingTaskType: question.writingTaskType || null,
    satDomain: question.satDomain || '',
    satSkill: question.satSkill || '',
    responseType: resolveResponseType(question),
    studentAnswer,
    points: Math.max(0, Number(question.points ?? 1) || 0),
    status: grade.status,
    isCorrect: grade.isCorrect,
    earnedPoints: grade.status === 'graded' ? grade.earnedPoints : null,
    answerKey: { responseType: resolveResponseType(question), correctAnswer: question.correctAnswer ?? null, acceptedAnswers: question.acceptedAnswers || [], answerSlots: question.answerSlots || [], correctOrder: question.correctOrder || [] },
    acceptedAnswers: question.acceptedAnswers || [],
    explanation: question.explanation || '',
  };
});

const getReadingPassage = (test: AssessmentRecord, passageNumber: number) => {
  const reading = test?.sections?.reading;
  const passage = reading?.passages?.find(item => item.passageNumber === passageNumber);
  return passage?.content || (passageNumber === 1 ? reading?.passage || '' : '');
};

const LoginScreen = ({ onAuthAction }) => {
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [groupCode, setGroupCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isLogin && role === 'teacher') {
      setError('Teacher registration is available only through Google sign-in for approved accounts.');
      return;
    }
    setLoading(true);
    try {
      await onAuthAction(isLogin ? 'login' : 'signup', { email, password, name, role, groupCode });
    } catch (err) {
      console.error(err);
      setError(err.message.replace('Firebase: ', ''));
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await onAuthAction('google', { role: isLogin ? 'student' : role, groupCode, isSignup: !isLogin });
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/popup-blocked' || err.message.includes('popup')) {
        setError('Popup Blocked! If you are using an app like Telegram or Instagram, please tap the Compass/Browser icon in the corner to open this in Safari or Chrome to log in.');
      } else {
        setError(err.message.replace('Firebase: ', ''));
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-100 dark:border-slate-700">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-center text-slate-800 dark:text-white mb-2">EduPortal</h2>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-8">{isLogin ? 'Login to your account' : 'Create a new account'}</p>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium leading-relaxed text-left">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">I am registering as a...</label>
              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setRole('student')} className={`py-2 px-4 rounded-lg border font-medium flex items-center justify-center gap-2 transition-all ${role === 'student' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400 ring-1 ring-blue-500' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                  <User className="w-4 h-4" /> Student
                </button>
                <button type="button" onClick={() => setRole('teacher')} className={`py-2 px-4 rounded-lg border font-medium flex items-center justify-center gap-2 transition-all ${role === 'teacher' ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-400 ring-1 ring-purple-500' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                  <Users className="w-4 h-4" /> Teacher
                </button>
              </div>
              {role === 'teacher' && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Teacher registration requires Google and one of the four approved accounts.</p>}
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Naruto Uzumaki" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" required={!isLogin} />
            </div>
          )}

          {!isLogin && role === 'student' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Student group code (optional)</label>
              <input type="text" value={groupCode} onChange={(e) => setGroupCode(e.target.value)} placeholder="Enter the code from your teacher" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Your teacher must give you the exact group code to see that group’s exams.</p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 mt-4 shadow-md">
            {loading ? 'Processing...' : (isLogin ? 'Login with Email' : 'Create Account')} <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between">
          <span className="border-b border-slate-200 dark:border-slate-700 w-1/5 lg:w-1/4"></span>
          <span className="text-xs text-center text-slate-500 dark:text-slate-400 uppercase font-semibold">Or continue with</span>
          <span className="border-b border-slate-200 dark:border-slate-700 w-1/5 lg:w-1/4"></span>
        </div>

        <button onClick={handleGoogle} disabled={loading} className="w-full mt-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-3 disabled:opacity-70 shadow-sm">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            <path fill="none" d="M1 1h22v22H1z" />
          </svg>
          Google
        </button>

        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => { setIsLogin(!isLogin); setRole('student'); setError(''); }} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
            {isLogin ? 'Sign up' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TeacherReviewFields = ({ attempt, review, onSaveReview }) => {
  const [feedback, setFeedback] = useState(review.teacherReview?.feedback || '');
  const [points, setPoints] = useState(review.teacherReview?.points ?? '');
  const [annotations, setAnnotations] = useState<Array<{ id: string; quote: string; comment: string; start: number; end: number }>>(
    Array.isArray(review.teacherReview?.annotations) ? review.teacherReview.annotations : []
  );
  const [selectedText, setSelectedText] = useState<{ quote: string; start: number; end: number } | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [alertState, setAlertState] = useState<null | { title: string; message: string }>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const responseText = typeof review.studentAnswer === 'string' ? review.studentAnswer : '';
  const captureSelection = () => {
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!range || !responseRef.current
      || !responseRef.current.contains(range.startContainer)
      || !responseRef.current.contains(range.endContainer)) return;
    if (typeof review.studentAnswer !== 'string') return;
    const rawText = selection?.toString() || '';
    const leadingWhitespace = rawText.length - rawText.trimStart().length;
    const quote = rawText.trim().slice(0, 1000);
    if (!quote) return;
    const prefix = range.cloneRange();
    prefix.selectNodeContents(responseRef.current);
    prefix.setEnd(range.startContainer, range.startOffset);
    const start = prefix.toString().length + leadingWhitespace;
    setSelectedText({ quote, start, end: start + quote.length });
  };
  const addAnnotation = () => {
    const comment = commentDraft.trim();
    if (!selectedText || !comment) return;
    if (annotations.length >= 50) {
      setAlertState({ title: 'Comment limit reached', message: 'A response can have up to 50 phrase comments.' });
      return;
    }
    setAnnotations(current => [...current, {
      id: crypto.randomUUID(),
      quote: selectedText.quote,
      comment: comment.slice(0, 1000),
      start: selectedText.start,
      end: selectedText.end,
    }]);
    setSelectedText(null);
    setCommentDraft('');
    window.getSelection()?.removeAllRanges();
  };
  const save = async () => {
    setSaving(true);
    if (points === '') {
      setSaving(false);
      setAlertState({ title: 'Review incomplete', message: 'Enter the awarded points before saving this review.' });
      return;
    }
    try { await onSaveReview(attempt.id, review.questionId, { feedback: feedback.trim().slice(0, 2000), points: Number(points), annotations }); }
    catch (error) {
      setAlertState({
        title: 'Save failed',
        message: error instanceof Error ? error.message : 'Could not save this review.'
      });
    }
    finally { setSaving(false); }
  };
  return <>
    <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4 dark:border-blue-900 dark:bg-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-white">Review this response</h4>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Select a word, phrase, or sentence in the response to attach a comment to it.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          Score
          <span className="flex items-center gap-1">
            <input type="number" min="0" max={review.points ?? 0} step="0.5" value={points} onChange={event => setPoints(event.target.value)} aria-label="Reviewed points" className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-700" />
            <span className="text-slate-500 dark:text-slate-400">/ {review.points ?? 0}</span>
          </span>
        </label>
      </div>

      <div
        ref={responseRef}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
        className="mt-4 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-800 selection:bg-amber-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:selection:bg-amber-700"
        aria-label="Student response; select text to comment"
      >
        {responseText || formatAnswerForReview(review.studentAnswer)}
      </div>

      {selectedText && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">Comment on selected text</p>
          <button type="button" onClick={() => setSelectedText(null)} className="text-xs font-medium text-slate-600 underline dark:text-slate-300">Cancel</button>
        </div>
        <blockquote className="mt-2 border-l-2 border-amber-500 pl-3 text-sm text-slate-800 dark:text-slate-100">“{selectedText.quote}”</blockquote>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <textarea value={commentDraft} onChange={event => setCommentDraft(event.target.value)} maxLength={1000} aria-label="Comment on selected text" placeholder="Explain what works or how to improve this part…" rows={2} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-700" />
          <button type="button" onClick={addAnnotation} disabled={!commentDraft.trim()} className="self-end rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-50">Add comment</button>
        </div>
      </div>}

      {annotations.length > 0 && <section className="mt-4 space-y-2" aria-label="Phrase comments">
        <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Phrase comments ({annotations.length})</h5>
        {annotations.map((annotation, index) => <div key={annotation.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <blockquote className="border-l-2 border-blue-500 pl-3 text-sm font-medium text-slate-800 dark:text-slate-100">“{annotation.quote}”</blockquote>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{annotation.comment}</p>
          </div>
          <button type="button" onClick={() => setAnnotations(current => current.filter(item => item.id !== annotation.id))} aria-label={`Remove comment ${index + 1}`} className="shrink-0 rounded px-2 py-1 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40">Remove</button>
        </div>)}
      </section>}

      <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
        Overall feedback
        <textarea value={feedback} onChange={event => setFeedback(event.target.value)} maxLength={2000} aria-label="Overall teacher feedback" placeholder="Add a summary or next step for the student…" rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-700" />
      </label>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">Your phrase comments and overall feedback will appear in the student’s results.</p>
        <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save review'}</button>
      </div>
    </div>
    {alertState && (
      <Modal isOpen={true} title={alertState.title} onClose={() => setAlertState(null)}>
        <p className="whitespace-pre-wrap text-left">{alertState.message}</p>
      </Modal>
    )}
  </>;
};

const TeacherDashboard = ({ user, tests, resources, resourceError, onSaveResource, onDeleteResource, submissions, submissionsLoading, submissionsError, onSaveReview, onBackfillLegacy, onSecureAnswerKeys, onLogout }) => {
  const [teacherArea, setTeacherArea] = useState<'assessments' | 'results' | 'samples' | 'resources'>('assessments');
  const [assessmentView, setAssessmentView] = useState<'active' | 'archived'>('active');
  const [resultSearch, setResultSearch] = useState('');
  const [resultGroup, setResultGroup] = useState('');
  const [resultAssessment, setResultAssessment] = useState('');
  const [resultType, setResultType] = useState('');
  const [resultStatus, setResultStatus] = useState('');
  const [resultFrom, setResultFrom] = useState('');
  const [resultTo, setResultTo] = useState('');
  const [selectedSample, setSelectedSample] = useState<any>(null);
  const [legacyCursor, setLegacyCursor] = useState(() => {
    try { return sessionStorage.getItem(`legacy-result-cursor:${user?.uid}`) || ''; } catch { return ''; }
  });
  const [legacyInfoOpen, setLegacyInfoOpen] = useState(false);
  const [legacyConfirmOpen, setLegacyConfirmOpen] = useState(false);
  const [legacyDryRun, setLegacyDryRun] = useState<any>(null);
  const [answerKeyInfoOpen, setAnswerKeyInfoOpen] = useState(false);
  const [answerKeyConfirmOpen, setAnswerKeyConfirmOpen] = useState(false);
  const [answerKeyPreview, setAnswerKeyPreview] = useState<any>(null);
  const [answerKeyReport, setAnswerKeyReport] = useState<any>(null);
  const [legacyMigrationMessage, setLegacyMigrationMessage] = useState('');
  const [migratingLegacy, setMigratingLegacy] = useState(false);
  const [securingAnswerKeys, setSecuringAnswerKeys] = useState(false);
  const [isBuildingTest, setIsBuildingTest] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newTest, setNewTest] = useState<any>(createEmptyTest);
  const [activeQuestionSection, setActiveQuestionSection] = useState('listening');
  const [activeListeningSection, setActiveListeningSection] = useState(1);
  const [activeReadingPassage, setActiveReadingPassage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
  const [previewQuestionId, setPreviewQuestionId] = useState<string | null>(null);
  const [questionBankError, setQuestionBankError] = useState('');
  const [figureStates, setFigureStates] = useState<Record<string, { status: 'uploading' | 'available' | 'error'; message: string }>>({});
  const [figureTestRevision, setFigureTestRevision] = useState<Record<string, number>>({});
  const [confirmPrompt, setConfirmPrompt] = useState<null | { title: string; message: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void; onCancel: () => void; }>(null);
  const [alertPrompt, setAlertPrompt] = useState<null | { title: string; message: string; onClose: () => void; }>(null);

  const showConfirmDialog = async (title: string, message: string, confirmLabel = 'Confirm', destructive = false) => {
    return await new Promise<boolean>(resolve => {
      setConfirmPrompt({
        title,
        message,
        confirmLabel,
        destructive,
        onConfirm: () => { setConfirmPrompt(null); resolve(true); },
        onCancel: () => { setConfirmPrompt(null); resolve(false); },
      });
    });
  };

  const showAlertDialog = async (title: string, message: string) => {
    await new Promise<void>(resolve => {
      setAlertPrompt({ title, message, onClose: () => { setAlertPrompt(null); resolve(); } });
    });
  };

  const previewLegacyImport = async () => {
    setMigratingLegacy(true);
    setLegacyMigrationMessage('');
    try {
      const summary = await onBackfillLegacy(legacyCursor, true);
      setLegacyDryRun(summary);
      setLegacyMigrationMessage('');
    } catch (error) {
      setLegacyMigrationMessage(error instanceof Error ? error.message : 'Could not preview older results.');
    } finally {
      setMigratingLegacy(false);
    }
  };

  const runLegacyImport = async () => {
    setLegacyConfirmOpen(false);
    setMigratingLegacy(true);
    setLegacyMigrationMessage('');
    try {
      const result = await onBackfillLegacy(legacyCursor, false);
      const nextCursor = result.nextCursorPath || '';
      setLegacyCursor(nextCursor);
      try {
        const key = `legacy-result-cursor:${user?.uid}`;
        if (nextCursor) sessionStorage.setItem(key, nextCursor);
        else sessionStorage.removeItem(key);
      } catch (error) {
        console.warn('Could not persist the legacy import cursor for this session:', error);
      }
      setLegacyMigrationMessage(`${result.migrated} legacy result${result.migrated === 1 ? '' : 's'} copied into the teacher list. ${result.alreadyImported} already existed. ${nextCursor ? 'Select preview to continue with the next batch.' : 'This batch reached the end of the legacy history.'}`);
      setLegacyDryRun(null);
    } catch (error) {
      setLegacyMigrationMessage(error instanceof Error ? error.message : 'Could not import older results.');
    } finally {
      setMigratingLegacy(false);
    }
  };

  const previewAnswerKeyMigration = async () => {
    setSecuringAnswerKeys(true);
    setLegacyMigrationMessage('');
    setAnswerKeyReport(null);
    try {
      setAnswerKeyPreview(await onSecureAnswerKeys(true));
    } catch (error) {
      setLegacyMigrationMessage(error instanceof Error ? error.message : 'Could not preview answer-key security migration.');
    } finally {
      setSecuringAnswerKeys(false);
    }
  };

  const runAnswerKeyMigration = async () => {
    setAnswerKeyConfirmOpen(false);
    setSecuringAnswerKeys(true);
    setLegacyMigrationMessage('');
    try {
      const report = await onSecureAnswerKeys(false);
      setAnswerKeyReport(report);
      setLegacyMigrationMessage(`Answer-key migration finished: ${report.secured} secured, ${report.alreadySecured} already secure, ${report.skipped} skipped, ${report.incomplete} incomplete, ${report.failed} failed.`);
      setAnswerKeyPreview(null);
    } catch (error) {
      setLegacyMigrationMessage(error instanceof Error ? error.message : 'Could not secure existing answer keys.');
    } finally {
      setSecuringAnswerKeys(false);
    }
  };

  const importSampleAsDraft = async (bank: any, file: string) => {
    const existingCopies = tests.filter((item: any) => item.sourceBank === file);
    if (existingCopies.length) {
      const confirmed = await showConfirmDialog('Duplicate sample?', `This sample bank was already imported as ${existingCopies.map((item: any) => item.title).join(', ')}. Create another separate draft with fresh question IDs?`, 'Create draft', false);
      if (!confirmed) return;
    }
    bank = parseQuestionBank(bank);
    const sourceQuestions = Array.isArray(bank.questions) ? bank.questions : [];
    const idMap = new Map(sourceQuestions.map((question: any, index: number) => [question.id, `q_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`]));
    const questions = sourceQuestions.map((question: any) => ({ ...question, id: idMap.get(question.id),
      answerSlots: question.answerSlots?.map((slot: any, index: number) => ({ ...slot, id: `${idMap.get(question.id)}_slot_${index + 1}` })) }));
    const minutes = Math.max(1, Math.round(Number(bank.durationSeconds || 1800) / 60));
    setNewTest({ ...createEmptyTest(), ...bank, id: undefined, sourceBank: file, title: `${bank.title || 'Sample bank'} (draft)`, category: 'Practice', durationMinutes: minutes, groupCode: '', published: false, status: 'draft', questions });
    setEditingId(null);
    setActiveQuestionSection(bank.type === 'IELTS' ? 'listening' : 'general');
    setTeacherArea('assessments');
    setIsBuildingTest(true);
  };

  const loadSampleBankFile = async (event: React.ChangeEvent<HTMLInputElement>, expectedFile: string) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.name.toLowerCase() !== expectedFile.toLowerCase()) {
    await showAlertDialog('Choose the expected sample file', `Please choose ${expectedFile} from the repository's sample-data folder.`);
      return;
    }
    try {
      const bank = parseQuestionBank(JSON.parse(await file.text()));
      const descriptor = SAMPLE_BANKS.find(item => item.file === expectedFile);
      if (descriptor && bank.type !== descriptor.type) throw new Error(`This file is not a ${descriptor.type} bank.`);
      setSelectedSample({ file: expectedFile, bank });
    } catch (error) {
      await showAlertDialog('Sample bank error', error instanceof Error ? `Could not load this bank: ${error.message}` : 'Could not read this question bank.');
    }
  };

  const visibleSubmissions = submissions.filter((submission: any) => {
    const queryText = resultSearch.trim().toLowerCase();
    const haystack = [submission.studentName, submission.studentEmail, submission.studentUid, submission.groupCode, submission.assessmentTitle, submission.assessmentId, submission.examType].join(' ').toLowerCase();
    const at = new Date(submission.submittedAtMs || submission.submittedAt || 0).getTime();
    const day = Number.isFinite(at) ? new Date(at).toISOString().slice(0, 10) : '';
    return (!queryText || haystack.includes(queryText))
      && (!resultGroup || submission.groupCode === resultGroup)
      && (!resultAssessment || submission.assessmentId === resultAssessment)
      && (!resultType || submission.examType === resultType)
      && (!resultStatus || submission.reviewStatus === resultStatus)
      && (!resultFrom || day >= resultFrom) && (!resultTo || day <= resultTo);
  }).map((submission: any) => {
    const sourceAssessmentIds = submission.assessmentIds?.length ? submission.assessmentIds : [submission.assessmentId];
    const sourceAssessments = sourceAssessmentIds.map((id: string) => tests.find((item: any) => item.id === id)).filter(Boolean);
    const sourceQuestions = sourceAssessments.flatMap((assessment: any) => assessment.questions || []);
    const questionsById = new Map(sourceQuestions.map((question: any) => [question.id, question]));
    return {
      ...submission,
      questionReviews: (submission.questionReviews?.length ? submission.questionReviews : createTeacherReviewRows(sourceQuestions, submission.answers || {})).map((review: any) => {
        const question: any = questionsById.get(review.questionId);
        return question ? {
          ...review,
          points: Math.max(0, Number(question.points ?? 1) || 0),
          answerKey: { responseType: resolveResponseType(question), correctAnswer: question.correctAnswer ?? null, acceptedAnswers: question.acceptedAnswers || [], answerSlots: question.answerSlots || [], correctOrder: question.correctOrder || [] },
          explanation: question.explanation || '',
        } : review;
      }),
    };
  });

  const exportSubmissionsCsv = () => {
    const columns = ['studentName','studentEmail','studentUid','groupCode','assessmentTitle','examType','assessmentId','submittedAt','score','maxAutoScore','percentage','durationSeconds','isAutoSubmitted','answeredCount','unansweredCount','correctCount','incorrectCount','pendingReviewCount','reviewStatus'];
    const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [columns.join(','), ...visibleSubmissions.map((item: any) => columns.map(key => quote(item[key])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'exam-submissions.csv'; link.click(); URL.revokeObjectURL(url);
  };

  const handleAddQuestion = (type, section = activeQuestionSection) => {
    const writing = section === 'writing';
    const responseType: ResponseType = writing ? 'long-text' : type === 'mcq' ? 'single-choice' : 'short-text';
    setNewTest(prev => ({
      ...prev,
      questions: [...prev.questions, {
        id: `q_${Date.now()}`,
        type,
        ...(section === 'general' ? {} : { section }),
        ...(section === 'listening' ? { listeningSectionNumber: activeListeningSection } : {}),
        ...(section === 'reading' ? { passageNumber: activeReadingPassage } : {}),
        questionType: writing ? 'writing-task' : type === 'mcq' ? 'multiple-choice' : 'short-answer',
        responseType,
        ...(writing ? { manualReview: true } : {}),
        ...(writing ? { writingTaskType: 2, writingFormat: 'essay', figureMode: 'visual' } : {}),
        text: '',
        imageUrl: '',
        options: type === 'mcq' ? ['', '', '', ''] : undefined,
        correctAnswer: ''
      }]
    }));
  };

  const updateSection = (sectionId, field, value) => {
    setNewTest(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionId]: {
          ...prev.sections?.[sectionId],
          [field]: value
        }
      }
    }));
  };

  const updateListeningPart = (sectionNumber, field, value) => {
    setNewTest(prev => {
      const listening = prev.sections?.listening || {};
      const parts = listening.parts || [1, 2, 3, 4].map(number => ({ sectionNumber: number, instructions: '', audioUrl: '' }));
      return {
        ...prev,
        sections: {
          ...prev.sections,
          listening: {
            ...listening,
            ...(sectionNumber === 1 && field === 'audioUrl' ? { audioUrl: value } : {}),
            parts: parts.map(part => part.sectionNumber === sectionNumber ? { ...part, [field]: value } : part)
          }
        }
      };
    });
  };

  const updateReadingPassage = (passageNumber, field, value) => {
    setNewTest(prev => {
      const reading = prev.sections?.reading || {};
      const passages = reading.passages || [1, 2, 3].map(number => ({ passageNumber: number, title: `Passage ${number}`, content: '' }));
      return {
        ...prev,
        sections: {
          ...prev.sections,
          reading: {
            ...reading,
            ...(passageNumber === 1 && field === 'content' ? { passage: value } : {}),
            passages: passages.map(passage => passage.passageNumber === passageNumber ? { ...passage, [field]: value } : passage)
          }
        }
      };
    });
  };

  const duplicateTest = async (test) => {
    try {
      const sourceTest = { ...test };
      delete sourceTest.id;
      delete sourceTest.createdAt;
      delete sourceTest.updatedAt;
      const copiedTest = {
        ...sourceTest,
        title: `${test.title} (Copy)`,
        answerKeysSecured: false,
        groupCode: '',
        pin: '',
        status: 'draft',
        published: false,
        authorId: user.uid,
        authorName: user.name,
        createdAt: new Date().toISOString(),
        questions: (test.questions || []).map((question, index) => ({
          ...question,
          id: `q_${Date.now()}_${index}`,
          ...(question.options ? { options: [...question.options] } : {}),
          ...(question.sharedChoices ? { sharedChoices: [...question.sharedChoices] } : {}),
          ...(question.correctOrder ? { correctOrder: [...question.correctOrder] } : {}),
          ...(question.answerSlots ? { answerSlots: question.answerSlots.map((slot, slotIndex) => ({ ...slot, id: `slot_${index}_${slotIndex}_${Date.now()}` })) } : {})
        })),
        ...(test.sections ? {
          sections: Object.fromEntries(Object.entries(test.sections).map(([sectionId, section]) => [sectionId, { ...(section as Record<string, any>) }]))
        } : {})
      };
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tests'), copiedTest);
    } catch (err) {
      console.error(err);
      await showAlertDialog('Duplicate failed', 'Failed to duplicate this assessment.');
    }
  };

  const handleUpdateQuestion = (index, field, value) => {
    const questionId = newTest.questions[index]?.id;
    if (field === 'imageUrl' && questionId) {
      setFigureStates(previous => {
        const next = { ...previous };
        delete next[questionId];
        return next;
      });
    }
    setNewTest(prev => {
      const updated = [...prev.questions];
      updated[index] = { ...updated[index] };
    if (field === 'imageUrl') {
      updated[index][field] = extractImageUrl(value);
      delete updated[index].imageAsset;
    } else if (field === 'imageAlt' && updated[index].imageAsset) {
      updated[index].imageAlt = value;
      updated[index].imageAsset = { ...updated[index].imageAsset, alt: value };
    } else if (field === 'figureCaption' && updated[index].imageAsset) {
      updated[index].figureCaption = value;
      updated[index].imageAsset = { ...updated[index].imageAsset, caption: value };
    } else if (field === 'responseType') {
      const responseType = value as ResponseType;
      updated[index].responseType = responseType;
      updated[index].type = responseType === 'single-choice' || responseType === 'multiple-select' ? 'mcq'
        : responseType === 'matching' ? 'select' : responseType === 'numeric' ? 'number' : 'text';
      if (['single-choice', 'multiple-select', 'ordering'].includes(responseType) && !updated[index].options?.length) updated[index].options = ['', '', ''];
      if (['multi-blank', 'matching'].includes(responseType) && !updated[index].answerSlots?.length) updated[index].answerSlots = [{ id: `slot_${Date.now()}`, label: 'Answer 1', correctAnswers: [] }];
      if (responseType === 'matching' && !updated[index].sharedChoices?.length) updated[index].sharedChoices = ['', ''];
      if (responseType === 'long-text' && !updated[index].ungraded) updated[index].manualReview = true;
      if (responseType === 'multiple-select') updated[index].correctAnswer = Array.isArray(updated[index].correctAnswer) ? updated[index].correctAnswer : [];
      if (responseType !== 'multiple-select' && Array.isArray(updated[index].correctAnswer)) updated[index].correctAnswer = '';
    } else if (field === 'questionType') {
      updated[index][field] = value;
      const nextResponseType: ResponseType = value === 'writing-task' ? 'long-text'
        : value === 'sat-student-produced-response' ? 'numeric'
        : ['matching-headings', 'matching-information', 'matching-features', 'sentence-endings'].includes(value) ? 'matching'
        : value === 'completion' || value === 'map-labeling' ? 'multi-blank'
        : value === 'short-answer' ? 'short-text' : 'single-choice';
      updated[index].responseType = nextResponseType;
      if (nextResponseType === 'long-text' && !updated[index].ungraded) updated[index].manualReview = true;
      updated[index].type = nextResponseType === 'single-choice' ? 'mcq' : nextResponseType === 'numeric' ? 'number' : nextResponseType === 'matching' ? 'select' : 'text';
      if (value === 'true-false-not-given') updated[index].options = ['True', 'False', 'Not Given'];
      else if (value === 'yes-no-not-given') updated[index].options = ['Yes', 'No', 'Not Given'];
      else if (nextResponseType === 'single-choice' && !updated[index].options?.length) updated[index].options = ['', '', '', ''];
      else if (nextResponseType !== 'single-choice') delete updated[index].options;
      if (nextResponseType === 'multi-blank' && !updated[index].answerSlots?.length) updated[index].answerSlots = [{ id: `slot_${Date.now()}`, label: 'Blank 1', correctAnswers: [] }];
      if (nextResponseType === 'matching' && !updated[index].answerSlots?.length) updated[index].answerSlots = [{ id: `slot_${Date.now()}`, label: 'Item 1', correctAnswers: [] }];
      if (nextResponseType === 'matching' && !updated[index].sharedChoices?.length) updated[index].sharedChoices = ['', ''];
    } else if (field === 'writingTaskType') {
      updated[index].writingTaskType = value;
      updated[index].writingFormat = value === 1 ? 'chart' : 'essay';
    } else {
      updated[index][field] = value;
      if (field === 'options' && resolveResponseType(updated[index]) === 'ordering') updated[index].correctOrder = value.filter(Boolean);
    }
      return { ...prev, questions: updated };
    });
  };

  const uploadQuestionFigure = async (index: number, file?: File) => {
    if (!file) return;
    const question = newTest.questions[index];
    if (!question) return;
    const fileError = validateFigureFile(file);
    if (fileError) {
      setFigureStates(previous => ({ ...previous, [question.id]: { status: 'error', message: fileError } }));
      return;
    }

    setFigureStates(previous => ({ ...previous, [question.id]: { status: 'uploading', message: 'Validating and uploading figure…' } }));
    try {
      const dimensions = await readFigureDimensions(file);
      const dimensionError = validateFigureDimensions(dimensions.width, dimensions.height);
      if (dimensionError) throw new Error(dimensionError);
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
      const assessmentFolder = editingId || 'draft';
      const assetId = crypto.randomUUID();
      const path = `assessment-assets/${user.uid}/${assessmentFolder}/${question.id}/${assetId}.${extension}`;
      const reference = storageRef(storage, path);
      await uploadBytes(reference, file, {
        contentType: file.type,
        customMetadata: { uploadedBy: user.uid, assetVersion: String((question.imageAsset?.assetVersion || 0) + 1) },
      });
      const downloadUrl = await getDownloadURL(reference);
      const asset: FigureAsset = {
        storagePath: path,
        downloadUrl,
        contentType: file.type,
        byteSize: file.size,
        width: dimensions.width,
        height: dimensions.height,
        alt: question.imageAlt || '',
        caption: question.figureCaption || '',
        assetVersion: (question.imageAsset?.assetVersion || 0) + 1,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.uid,
      };
      setNewTest(previous => ({
        ...previous,
        questions: previous.questions.map((item, itemIndex) => itemIndex === index
          ? { ...item, imageUrl: downloadUrl, imageAsset: asset }
          : item),
      }));
      setFigureStates(previous => ({ ...previous, [question.id]: { status: 'available', message: 'Figure uploaded successfully. Its asset URL will be saved with this assessment.' } }));
    } catch (error) {
      console.error('Figure upload failed:', error);
      setFigureStates(previous => ({
        ...previous,
        [question.id]: {
          status: 'error',
          message: error instanceof Error
            ? `Figure upload failed: ${error.message}`
            : 'Figure upload failed. Confirm Firebase Storage is enabled and its rules are deployed.',
        },
      }));
    }
  };

  const testQuestionFigureUrl = async (question: AssessmentQuestion) => {
    const normalizedUrl = normalizeFigureUrl(question.imageUrl || question.imageAsset?.downloadUrl || '');
    if (!normalizedUrl) {
      setFigureStates(previous => ({ ...previous, [question.id]: { status: 'error', message: 'Enter a valid HTTPS image URL first.' } }));
      return;
    }
    setFigureStates(previous => ({ ...previous, [question.id]: { status: 'uploading', message: 'Testing whether this browser can render the image…' } }));
    try {
      await verifyFigureUrl(normalizedUrl);
      setFigureStates(previous => ({ ...previous, [question.id]: { status: 'available', message: 'The URL loaded as an image in this browser.' } }));
      setFigureTestRevision(previous => ({ ...previous, [question.id]: (previous[question.id] || 0) + 1 }));
    } catch (error) {
      setFigureStates(previous => ({
        ...previous,
        [question.id]: { status: 'error', message: error instanceof Error ? error.message : 'The image URL could not be rendered.' },
      }));
    }
  };

  const handleUpdateOption = (qIndex, optIndex, value) => {
    setNewTest(prev => {
      const updated = [...prev.questions];
      updated[qIndex] = { ...updated[qIndex], options: [...(updated[qIndex].options || [])] };
      updated[qIndex].options[optIndex] = extractImageUrl(value);
      if (resolveResponseType(updated[qIndex]) === 'ordering') updated[qIndex].correctOrder = updated[qIndex].options.filter(Boolean);
      return { ...prev, questions: updated };
    });
  };

  const handleAddOption = (qIndex) => {
    setNewTest(prev => {
      const updated = [...prev.questions];
      updated[qIndex] = { ...updated[qIndex], options: [...(updated[qIndex].options || []), ''] };
      if (resolveResponseType(updated[qIndex]) === 'ordering') updated[qIndex].correctOrder = updated[qIndex].options.filter(Boolean);
      return { ...prev, questions: updated };
    });
  };

  const handleRemoveOption = (qIndex, optIndex) => {
    setNewTest(prev => {
      const updated = [...prev.questions];
      const options = [...(updated[qIndex].options || [])];
      const removedOption = options.splice(optIndex, 1)[0];
      updated[qIndex] = { ...updated[qIndex], options, correctAnswer: updated[qIndex].correctAnswer === removedOption ? '' : updated[qIndex].correctAnswer };
      if (resolveResponseType(updated[qIndex]) === 'ordering') updated[qIndex].correctOrder = options.filter(Boolean);
      return { ...prev, questions: updated };
    });
  };

  const updateAnswerSlot = (qIndex: number, slotIndex: number, field: string, value: unknown) => {
    setNewTest(prev => {
      const questions = [...prev.questions];
      const question = { ...questions[qIndex] };
      const slots = [...(question.answerSlots || [])];
      slots[slotIndex] = { ...slots[slotIndex], [field]: value };
      question.answerSlots = slots;
      questions[qIndex] = question;
      return { ...prev, questions };
    });
  };

  const updateSlotAnswers = (qIndex: number, slotIndex: number, value: string) => updateAnswerSlot(qIndex, slotIndex, 'correctAnswers', value.split('\n').map(answer => answer.trim()).filter(Boolean));

  const duplicateQuestion = (index: number) => setNewTest(prev => {
    const original = prev.questions[index];
    const copy = { ...original, id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, options: original.options ? [...original.options] : undefined,
      answerSlots: original.answerSlots?.map(slot => ({ ...slot, id: `${slot.id}_copy`, correctAnswers: [...(slot.correctAnswers || [])] })),
      sharedChoices: original.sharedChoices ? [...original.sharedChoices] : undefined,
      correctOrder: original.correctOrder ? [...original.correctOrder] : undefined };
    const questions = [...prev.questions];
    questions.splice(index + 1, 0, copy);
    return { ...prev, questions };
  });

  const moveQuestion = (index: number, direction: -1 | 1) => setNewTest(prev => {
    const target = index + direction;
    if (target < 0 || target >= prev.questions.length) return prev;
    const questions = [...prev.questions];
    [questions[index], questions[target]] = [questions[target], questions[index]];
    return { ...prev, questions };
  });

  const duplicateChoice = (qIndex: number, field: 'options' | 'sharedChoices', choiceIndex: number, value: string) => setNewTest(prev => {
    const questions = [...prev.questions];
    const q = { ...questions[qIndex], [field]: [...(questions[qIndex][field] || [])] };
    q[field][choiceIndex] = value;
    questions[qIndex] = q;
    return { ...prev, questions };
  });

  const importQuestionBank = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setQuestionBankError('');
    try {
      if (file.size > 2_000_000) throw new Error('Choose a JSON file smaller than 2 MB.');
      const bank = parseQuestionBank(JSON.parse(await file.text()));
      if (editingId || newTest.title || newTest.questions.length) {
        const confirmed = await showConfirmDialog('Replace editor draft?', 'Replace this editor content with the imported bank as a new unpublished draft? Saved assessments will not be changed.', 'Replace draft');
        if (!confirmed) return;
      }
      const idMap = new Map(bank.questions.map((question: any, index) => [question.id, `q_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`]));
      const questions = bank.questions.map((question: any) => ({ ...question, sourceId: question.id, id: idMap.get(question.id), answerSlots: question.answerSlots?.map((slot: any, index: number) => ({ ...slot, id: `${idMap.get(question.id)}_slot_${index + 1}` })) }));
      setEditingId(null);
      setNewTest({ ...createEmptyTest(), ...bank, id: undefined, durationMinutes: Math.max(1, Math.round(Number(bank.durationSeconds || 1800) / 60)), groupCode: '', status: 'draft', published: false, questions });
    } catch (error) {
      setQuestionBankError(error instanceof Error ? error.message : 'Could not import this question bank.');
    } finally {
      event.target.value = '';
    }
  };

  const exportQuestionBank = () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, title: newTest.title, description: newTest.description, type: newTest.type, category: newTest.category, durationSeconds: Number(newTest.durationMinutes || 30) * 60, settings: { groupCode: newTest.groupCode || '', status: 'draft' }, sections: newTest.sections, questions: newTest.questions }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${String(newTest.title || 'question-bank').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRemoveQuestion = (index) => {
    setNewTest(prev => ({ ...prev, questions: prev.questions.filter((_, questionIndex) => questionIndex !== index) }));
  };

  const saveTest = async () => {
    if (!newTest.title || newTest.questions.length === 0) {
      await showAlertDialog('Assessment incomplete', 'Title and at least 1 question required.');
      return;
    }
    const errors = Object.fromEntries(newTest.questions.map((question, index) => {
      const messages = validateQuestion(question);
      if (newTest.type === 'IELTS' && question.section === 'reading') {
        const passageNumber = Number(question.passageNumber || 1);
        if (!getReadingPassage(newTest, passageNumber).trim()) messages.push(`Question refers to Passage ${passageNumber}, but that passage has no text.`);
      }
      if (newTest.type === 'SAT' && (!question.satDomain || !question.satSkill)) messages.push('Choose a SAT domain and skill.');
      if (newTest.type === 'IELTS' && question.section === 'writing' && ![1, 2].includes(Number(question.writingTaskType || 0))) messages.push('Choose IELTS Writing Task 1 or Task 2.');
      const figureInput = question.imageUrl || question.imageAsset?.downloadUrl || '';
      if (figureInput && !normalizeFigureUrl(figureInput)) messages.push('Task figure URLs must use HTTPS and be a direct image URL.');
      if (newTest.groupCode.trim() && requiresTaskFigure(question) && !normalizeFigureUrl(figureInput)) {
        messages.push('Add and test a Task 1 figure, or explicitly mark this prompt as text-only before publishing.');
      }
      return [question.id || String(index), messages];
    }).filter(([, messages]) => messages.length));
    setValidationErrors(errors);
    if (Object.keys(errors).length) {
      const firstIndex = newTest.questions.findIndex(question => errors[question.id || String(newTest.questions.indexOf(question))]);
      await showAlertDialog('Fix the assessment', `Please fix question ${firstIndex + 1}: ${Object.values(errors)[0][0]}`);
      return;
    }
    setIsSubmitting(true);
    try {
      const testToSave: any = {
        ...newTest,
        questions: newTest.type === 'IELTS'
          ? [...newTest.questions].map(question => ({ ...question, responseType: resolveResponseType(question) })).sort((a, b) => {
              const order = { listening: 0, reading: 1, writing: 2, general: 3 };
              return (order[a.section || 'general'] ?? 3) - (order[b.section || 'general'] ?? 3);
            })
          : newTest.questions.map(question => ({ ...question, responseType: resolveResponseType(question) })),
        groupCode: newTest.groupCode.trim().toLowerCase(),
        status: newTest.groupCode.trim() ? 'published' : 'draft',
        published: Boolean(newTest.groupCode.trim()),
        durationSeconds: newTest.durationMinutes * 60,
        authorId: user.uid,
        authorName: user.name
      };
      delete testToSave.durationMinutes;

      if (testToSave.groupCode && testToSave.type === 'IELTS') {
        const listeningQuestions = testToSave.questions.filter((question: any) => question.section === 'listening');
        const sectionsMissingAudio = [...new Set<number>(listeningQuestions.map((question: any) => Number(question.listeningSectionNumber || 1)))].filter(sectionNumber => !getListeningAudioUrl(testToSave, sectionNumber));
        if (sectionsMissingAudio.length) {
          setIsSubmitting(false);
          await showAlertDialog('Publishing blocked', `This assessment cannot be published yet. Add a browser-playable recording for Listening section${sectionsMissingAudio.length > 1 ? 's' : ''} ${sectionsMissingAudio.join(', ')}, test playback, and mark each recording verified.`);
          return;
        }
      }

      if (testToSave.groupCode) {
        const confirmed = await showConfirmDialog('Publish assessment?', `Publish “${testToSave.title}” to student group “${testToSave.groupCode}” now? Students in that group will be able to see it.`, 'Publish', false);
        if (!confirmed) {
          setIsSubmitting(false);
          return;
        }
      }

      const { publicQuestions, answerKeyQuestions, publicSections, teacherSections } = splitQuestionKeys(testToSave.questions, testToSave.sections);
      testToSave.questions = publicQuestions;
      testToSave.sections = publicSections;
      testToSave.answerKeysSecured = true;
      testToSave.answerKeyVersion = 1;
      if (editingId) testToSave.updatedAt = new Date().toISOString();
      else testToSave.createdAt = new Date().toISOString();
      const testCollection = collection(db, 'artifacts', appId, 'public', 'data', 'tests');
      const testRef = editingId ? doc(db, 'artifacts', appId, 'public', 'data', 'tests', editingId) : doc(testCollection);
      const answerKeyRef = doc(db, 'artifacts', appId, 'teacher', 'data', 'answerKeys', testRef.id);
      // Imported drafts intentionally have id: undefined. Store the real
      // Firestore document ID, and remove optional undefined fields throughout
      // nested question/section data before either write.
      testToSave.id = testRef.id;
      const batch = writeBatch(db);
      batch.set(answerKeyRef, removeUndefinedValues({ assessmentId: testRef.id, questions: answerKeyQuestions, teacherSections, updatedAt: serverTimestamp() }));
      batch.set(testRef, removeUndefinedValues(testToSave));
      await batch.commit();
      
      setIsBuildingTest(false);
      setEditingId(null);
      setNewTest(createEmptyTest());
      setActiveQuestionSection('listening');
      await showAlertDialog(
        'Assessment saved',
        testToSave.groupCode
          ? `Published “${testToSave.title}” for group ${testToSave.groupCode} (assessment ID ${testRef.id}). It is visible to that group.`
          : `Saved “${testToSave.title}” as a draft. Assessment ID: ${testRef.id}`
      );
    } catch (err) {
      const firebaseError = err as { code?: string; message?: string };
      console.error('Failed to save assessment to Firestore:', err);
      const code = firebaseError?.code || 'unknown';
      const guidance = code === 'permission-denied'
        ? 'Firestore denied the write. Publish the latest firestore.rules, and confirm you are signed in with one of the four approved Google teacher accounts.'
        : code === 'unauthenticated'
          ? 'Your sign-in session expired. Sign out, sign in again with an approved Google teacher account, and retry.'
          : code === 'resource-exhausted'
            ? 'Firestore rejected the document because it exceeded a storage or quota limit. Try reducing large images or imported content.'
            : firebaseError?.message || 'Check your connection and the browser console for the Firestore error.';
      await showAlertDialog('Save failed', `Could not save the assessment (${code}). ${guidance}`);
    }
    setIsSubmitting(false);
  };

  const archiveTest = async (testId) => {
    const confirmed = await showConfirmDialog('Archive assessment?', 'Archive this assessment? It will be hidden from students, while the answer key and historical results are preserved.', 'Archive', true);
    if (!confirmed) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tests', testId), { status: 'archived', published: false, groupCode: '', archivedAt: new Date().toISOString() });
    } catch(err) {
      console.error(err);
      await showAlertDialog('Archive failed', 'Could not archive this assessment. Please check your connection and try again.');
    }
  }

  const unpublishTest = async (test: any) => {
    const confirmed = await showConfirmDialog('Return to draft?', `Return “${test.title}” to draft? Students will no longer see it. Existing submissions and results will be kept.`, 'Return to draft', false);
    if (!confirmed) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tests', test.id), { groupCode: '', published: false, status: 'draft', updatedAt: new Date().toISOString() });
      await showAlertDialog('Assessment returned to draft', `“${test.title}” is now a draft. Historical submissions remain available.`);
    } catch (error) {
      await showAlertDialog('Could not unpublish', error instanceof Error ? error.message : 'Could not return this assessment to draft.');
    }
  };

  const restoreArchivedTest = async (test: any) => {
    const confirmed = await showConfirmDialog('Return archived assessment to drafts?', `Move “${test.title}” back to your active assessments as an unpublished draft? Students will not see it until you publish it again. Historical results will be kept.`, 'Return to drafts', false);
    if (!confirmed) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tests', test.id), { groupCode: '', published: false, status: 'draft', updatedAt: new Date().toISOString() });
    } catch (error) {
      await showAlertDialog('Could not restore assessment', error instanceof Error ? error.message : 'Could not return this assessment to drafts.');
    }
  };

  const handleEditTest = (test) => {
    const defaults = createEmptyTest();
    const oldListening = test.sections?.listening || {};
    const oldReading = test.sections?.reading || {};
    const normalizedParts = oldListening.parts || [
      { sectionNumber: 1, instructions: oldListening.instructions || '', audioUrl: oldListening.audioUrl || '' },
      ...[2, 3, 4].map(sectionNumber => ({ sectionNumber, instructions: '', audioUrl: '' }))
    ];
    const normalizedPassages = oldReading.passages || [
      { passageNumber: 1, title: 'Passage 1', content: oldReading.passage || '' },
      { passageNumber: 2, title: 'Passage 2', content: '' },
      { passageNumber: 3, title: 'Passage 3', content: '' }
    ];
    setNewTest({
      ...defaults,
      ...test,
      sections: {
        ...defaults.sections,
        ...test.sections,
        listening: { ...defaults.sections.listening, ...oldListening, parts: normalizedParts },
        reading: { ...defaults.sections.reading, ...oldReading, passages: normalizedPassages },
        writing: { ...defaults.sections.writing, ...test.sections?.writing }
      },
      questions: (test.questions || []).map(question => normalizeQuestion(question)),
      groupCode: test.groupCode || '',
      durationMinutes: Math.floor(test.durationSeconds / 60)
    });
    const firstTaggedSection = test.questions?.find(question => question.section)?.section;
    setActiveQuestionSection(firstTaggedSection || (test.questions?.length ? 'general' : (test.type === 'IELTS' ? 'listening' : 'general')));
    setActiveListeningSection(test.questions?.find(question => question.listeningSectionNumber)?.listeningSectionNumber || 1);
    setActiveReadingPassage(test.questions?.find(question => question.passageNumber)?.passageNumber || 1);
    setEditingId(test.id);
    setIsBuildingTest(true);
  };

  const cancelEdit = () => {
    setIsBuildingTest(false);
    setEditingId(null);
    setNewTest(createEmptyTest());
    setActiveQuestionSection('listening');
  };

  return (
    <>
      {confirmPrompt && (
        <Modal
          isOpen={true}
          title={confirmPrompt.title}
          onClose={confirmPrompt.onCancel}
          actions={[
            { label: 'Cancel', onClick: confirmPrompt.onCancel },
            { label: confirmPrompt.confirmLabel, destructive: confirmPrompt.destructive, onClick: confirmPrompt.onConfirm },
          ]}
        >
          <p className="whitespace-pre-wrap text-left">{confirmPrompt.message}</p>
        </Modal>
      )}
      {alertPrompt && (
        <Modal isOpen={true} title={alertPrompt.title} onClose={alertPrompt.onClose}>
          <p className="whitespace-pre-wrap text-left">{alertPrompt.message}</p>
        </Modal>
      )}
      <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 transition-colors w-full">
        <div className="w-full px-4 sm:px-8 lg:px-12 mx-auto">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              <span className="font-bold text-xl text-slate-800 dark:text-white">Teacher Portal</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Prof. {user?.name}</span>
              <button onClick={onLogout} className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-8 lg:px-12 py-8 mx-auto">
        {!isBuildingTest && <nav className="flex flex-wrap gap-2 mb-6" aria-label="Teacher dashboard">
          {([['assessments', 'Assessments'], ['results', 'Results & submissions'], ['resources', 'Writing resources'], ['samples', 'Sample banks']] as const).map(([id, label]) => <button key={id} onClick={() => setTeacherArea(id)} className={`px-4 py-2 rounded-lg border text-sm font-semibold ${teacherArea === id ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'}`}>{label}</button>)}
        </nav>}
        {!isBuildingTest && teacherArea === 'results' ? (
          <section className="text-left space-y-5">
            <Modal isOpen={legacyInfoOpen} title="About legacy results import" onClose={() => setLegacyInfoOpen(false)}>
              <p>This copies older student result records from each student’s private historical results path into the teacher’s central Results &amp; submissions list. It does not recalculate scores, change student answers, or verify historical grading. Imported records are marked “Legacy — unverified”; existing records are not duplicated.</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div><dt className="font-semibold">Source</dt><dd>artifacts/{appId}/users/&#123;studentUid&#125;/results/&#123;attemptId&#125;</dd></div>
                <div><dt className="font-semibold">Destination</dt><dd>artifacts/{appId}/public/data/submissions/legacy_&#123;studentUid&#125;_&#123;attemptId&#125;</dd></div>
                <div><dt className="font-semibold">Effect</dt><dd>Dry run is read-only. Import creates central historical copies in batches of up to {LEGACY_IMPORT_BATCH_SIZE} records and stores a continuation cursor only in this browser session.</dd></div>
                <div><dt className="font-semibold">Access and recovery</dt><dd>Run only while signed in as an authorized teacher. This operation is not automatically reversible; copied records require a controlled teacher-only maintenance action to remove.</dd></div>
              </dl>
            </Modal>
            <Modal isOpen={answerKeyInfoOpen} title="About answer-key security migration" onClose={() => setAnswerKeyInfoOpen(false)}>
              <p>This copies answer data from public assessment documents into teacher-only answer-key documents, then removes private answer fields from public questions. It prevents students from downloading correct answers before submitting.</p>
              <p className="mt-3">Student-facing prompt text, figures, captions, sources, reading passages, vocabulary resources, and audio URLs are preserved. The migration does not delete assessments or alter student submissions and scores. It is idempotent and only reports an assessment as secured after verifying the private key contains every expected question ID.</p>
            </Modal>
            <Modal isOpen={answerKeyConfirmOpen} title="Confirm answer-key security migration" onClose={() => setAnswerKeyConfirmOpen(false)} actions={[
              { label: 'Cancel', onClick: () => setAnswerKeyConfirmOpen(false) },
              { label: securingAnswerKeys ? 'Securing…' : 'Secure assessment keys', onClick: runAnswerKeyMigration, disabled: securingAnswerKeys || !answerKeyPreview?.needingMigration },
            ]}>
              <p>This changes where answer keys are stored. It does not delete assessments or student submissions. Public answers are removed only in the same atomic batch that writes the teacher-only key.</p>
            </Modal>
            <Modal isOpen={legacyConfirmOpen} title="Confirm legacy result import" onClose={() => setLegacyConfirmOpen(false)} actions={[
              { label: 'Cancel', onClick: () => setLegacyConfirmOpen(false) },
              { label: migratingLegacy ? 'Importing…' : 'Import this batch', onClick: runLegacyImport, disabled: migratingLegacy || !legacyDryRun?.candidates },
            ]}>
              <p>This will create {Math.max(0, (legacyDryRun?.candidates || 0) - (legacyDryRun?.alreadyImported || 0))} historical copy/copies in the teacher list. Existing results will not be overwritten. No scores are recalculated.</p>
            </Modal>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h1 className="text-2xl font-bold text-slate-800 dark:text-white">Results &amp; submissions</h1><p className="mt-1 text-slate-500 dark:text-slate-400">Latest 500 attempts, newest first. Import prior attempts and secure old assessment keys below.</p></div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setLegacyInfoOpen(true)} className="rounded-lg border px-4 py-2 dark:border-slate-600">Legacy import — Learn more</button>
                <button onClick={() => void previewLegacyImport()} disabled={migratingLegacy} className="rounded-lg border px-4 py-2 dark:border-slate-600 disabled:opacity-50">{migratingLegacy ? 'Checking…' : 'Preview legacy import'}</button>
                {legacyCursor && <button onClick={() => { setLegacyCursor(''); setLegacyDryRun(null); try { sessionStorage.removeItem(`legacy-result-cursor:${user?.uid}`); } catch (error) { console.warn('Could not clear the legacy import cursor:', error); } }} className="rounded-lg border px-4 py-2 dark:border-slate-600">Restart import cursor</button>}
                <button onClick={() => setAnswerKeyInfoOpen(true)} className="rounded-lg border px-4 py-2 dark:border-slate-600">Answer keys — Learn more</button>
                <button onClick={() => void previewAnswerKeyMigration()} disabled={securingAnswerKeys} className="rounded-lg border border-amber-400 px-4 py-2 text-amber-800 dark:text-amber-200 disabled:opacity-50">{securingAnswerKeys ? 'Checking…' : 'Preview answer-key migration'}</button>
                <button onClick={exportSubmissionsCsv} disabled={!visibleSubmissions.length} className="rounded-lg bg-purple-600 px-4 py-2 text-white disabled:opacity-50">Export filtered CSV</button>
              </div>
            </div>
            {legacyDryRun && <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-100">
              <p className="font-semibold">Read-only batch preview</p>
              <p>Read {legacyDryRun.recordsRead} record(s); {legacyDryRun.candidates} matched the expected historical path; {legacyDryRun.alreadyImported} already exist; {Math.max(0, legacyDryRun.candidates - legacyDryRun.alreadyImported)} would be imported.</p>
              {legacyDryRun.nextCursorPath && <p>This batch has a continuation cursor. Import this batch first, then preview again to continue.</p>}
              <button type="button" onClick={() => setLegacyConfirmOpen(true)} disabled={!legacyDryRun.candidates || migratingLegacy} className="mt-2 rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50">Confirm import of this batch</button>
            </div>}
            {answerKeyPreview && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
              <p className="font-semibold">Read-only answer-key migration preview</p>
              <p>{answerKeyPreview.total} scanned; {answerKeyPreview.alreadySecured} already secured; {answerKeyPreview.needingMigration} need migration; {answerKeyPreview.publicAnswerFields} contain public answer fields; {answerKeyPreview.incomplete} have missing/incomplete keys; {answerKeyPreview.skipped} will be skipped.</p>
              <button type="button" onClick={() => setAnswerKeyConfirmOpen(true)} disabled={!answerKeyPreview.needingMigration || securingAnswerKeys} className="mt-2 rounded bg-amber-700 px-3 py-2 text-white disabled:opacity-50">Confirm migration</button>
            </div>}
            {answerKeyReport?.details?.some((item: any) => ['failed', 'incomplete', 'skipped'].includes(item.status)) && <details className="rounded-lg border p-3 dark:border-slate-600"><summary>Assessment migration details</summary><ul className="mt-2 list-disc pl-5">{answerKeyReport.details.filter((item: any) => ['failed', 'incomplete', 'skipped'].includes(item.status)).map((item: any) => <li key={`${item.assessmentId}-${item.status}`}>{item.assessmentId}: {item.status}{item.reason ? ` — ${item.reason}` : ''}</li>)}</ul></details>}
            {legacyMigrationMessage && <p role="status" className="p-3 rounded bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">{legacyMigrationMessage}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4">
              <input aria-label="Search submissions" value={resultSearch} onChange={e => setResultSearch(e.target.value)} placeholder="Search student / test" className="lg:col-span-2 p-2 rounded border dark:bg-slate-700 dark:border-slate-600" />
              <select aria-label="Filter group" value={resultGroup} onChange={e => setResultGroup(e.target.value)} className="p-2 rounded border dark:bg-slate-700 dark:border-slate-600"><option value="">All groups</option>{[...new Set<string>(submissions.map((item: any) => String(item.groupCode || '')).filter(Boolean))].map(group => <option key={group} value={group}>{group}</option>)}</select>
              <select aria-label="Filter assessment" value={resultAssessment} onChange={e => setResultAssessment(e.target.value)} className="p-2 rounded border dark:bg-slate-700 dark:border-slate-600"><option value="">All assessments</option>{[...new Map<string, string>(submissions.map((item: any) => [String(item.assessmentId || ''), String(item.assessmentTitle || item.assessmentId || '')] as [string, string])).entries()].filter(([id]) => id).map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select>
              <select aria-label="Filter exam type" value={resultType} onChange={e => setResultType(e.target.value)} className="p-2 rounded border dark:bg-slate-700 dark:border-slate-600"><option value="">All types</option>{['IELTS','SAT','NUET','General'].map(type => <option key={type}>{type}</option>)}</select>
              <select aria-label="Filter review status" value={resultStatus} onChange={e => setResultStatus(e.target.value)} className="p-2 rounded border dark:bg-slate-700 dark:border-slate-600"><option value="">All statuses</option>{['pending-review','reviewed','auto-submitted','submitted'].map(status => <option key={status}>{status}</option>)}</select>
              <div className="flex gap-1"><input aria-label="Submitted from" type="date" value={resultFrom} onChange={e => setResultFrom(e.target.value)} className="min-w-0 w-1/2 p-2 rounded border dark:bg-slate-700 dark:border-slate-600"/><input aria-label="Submitted to" type="date" value={resultTo} onChange={e => setResultTo(e.target.value)} className="min-w-0 w-1/2 p-2 rounded border dark:bg-slate-700 dark:border-slate-600"/></div>
            </div>
            {submissionsLoading && <p role="status" className="p-4">Loading submissions…</p>}{submissionsError && <p role="alert" className="p-4 rounded bg-red-50 text-red-700">Could not load submissions: {submissionsError}</p>}
            {!submissionsLoading && !submissionsError && visibleSubmissions.length === 0 && <p className="p-8 text-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">No submissions match these filters yet.</p>}
            <div className="space-y-3">{visibleSubmissions.map((attempt: any) => <details key={attempt.id} className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4">
              <summary className="cursor-pointer list-none"><div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center"><div><strong>{attempt.studentName || 'Student'}</strong><div className="text-xs text-slate-500">{attempt.studentEmail || 'Email unavailable'} · UID {attempt.studentUid}</div></div><div><strong>{attempt.assessmentTitle}</strong><div className="text-xs text-slate-500">{attempt.examType} · {attempt.assessmentId}{attempt.sectionOrSkill ? ` · ${attempt.sectionOrSkill}` : ''}</div></div><div className="text-sm">{new Date(attempt.submittedAtMs || attempt.legacyHistoricalData?.submittedAtMs || attempt.legacyHistoricalData?.submittedAt || attempt.submittedAt || 0).toLocaleString()} · Group: {attempt.groupCode || '—'}</div><div className="text-sm">{attempt.gradingMode === 'legacy-unverified' ? `Legacy — unverified${attempt.legacyHistoricalData?.score == null ? '' : ` · historical score ${attempt.legacyHistoricalData.score}`}` : `${attempt.score == null ? 'Pending' : `${attempt.score} / ${attempt.maxPossibleScore ?? attempt.maxAutoScore ?? '—'}`} · ${attempt.reviewStatus || 'submitted'}`}</div></div><div className="mt-2 text-xs text-slate-500">{attempt.gradingMode === 'legacy-unverified' ? 'Historical grading has not been recalculated or verified.' : `Answered ${attempt.answeredCount ?? 0} · unanswered ${attempt.unansweredCount ?? 0} · correct ${attempt.correctCount ?? 0} · incorrect ${attempt.incorrectCount ?? 0} · pending review ${attempt.pendingReviewCount ?? 0} · ${attempt.isAutoSubmitted ? 'auto-submitted' : 'submitted'}${attempt.durationSeconds ? ` · ${Math.round(attempt.durationSeconds / 60)} min` : ''}`}</div></summary>
              <div className="mt-4 border-t dark:border-slate-700 pt-3 space-y-4">
                {attempt.gradingMode === 'legacy-unverified' ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
                  <p className="font-semibold">Legacy — unverified</p>
                  <p>These are preserved historical values, not trusted or recalculated scores. This portal will not grade or edit the legacy record.</p>
                  <p className="mt-2">Original source: {attempt.legacySourcePath}</p>
                  <details className="mt-2"><summary>Historical display data</summary><pre className="mt-2 whitespace-pre-wrap break-words text-xs">{JSON.stringify(attempt.legacyHistoricalData || {}, null, 2)}</pre></details>
                </div> : <>
                  <button onClick={async () => { try { await onSaveReview(attempt.id, '__finalize__', { feedback: '', points: null }); } catch (error) { await showAlertDialog('Could not save grading', error instanceof Error ? error.message : 'Could not save grading. Try again.'); } }} className="px-3 py-2 rounded bg-blue-600 text-white text-sm font-semibold">Save objective grading and results</button>
                  <p className="text-xs text-slate-500">Uses the saved teacher-only answer key. Written responses remain pending until you review them.</p>
                </>}
                {(attempt.questionReviews || []).map((review: any, index: number) => <article key={review.questionId || index} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Question {index + 1}</h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">{review.status === 'manual-review' ? (review.teacherReview?.reviewedAt ? 'Reviewed' : 'Needs review') : review.status}</span>
                      {review.teacherReview?.points != null && <span className="rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">{review.teacherReview.points} / {review.points} points</span>}
                    </div>
                  </header>
                  <div className="space-y-4 p-4">
                    <section>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Question prompt</h4>
                      <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800 dark:text-slate-100"><FormattedQuestionText text={review.questionText || ''} /></div>
                    </section>
                    {review.status !== 'manual-review' && <section>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Student response</h4>
                      <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-800 dark:bg-slate-900 dark:text-slate-100">{formatAnswerForReview(review.studentAnswer)}</p>
                    </section>}
                    <p className="text-sm text-slate-600 dark:text-slate-300">Status: {review.status}{review.earnedPoints != null ? ` · ${review.earnedPoints}/${review.points} points` : ''}</p>
                    {(review.answerKey || review.acceptedAnswers?.length || review.explanation) && <details className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                      <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">Marking guide</summary>
                      <div className="mt-2 space-y-1 text-slate-600 dark:text-slate-300">
                        {review.answerKey && <p>Answer key: {formatAnswerForReview(review.answerKey)}</p>}
                        {review.acceptedAnswers?.length > 0 && <p>Accepted answers: {review.acceptedAnswers.join(', ')}</p>}
                        {review.explanation && <p>Explanation: {review.explanation}</p>}
                      </div>
                    </details>}
                    {review.teacherReview?.feedback && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">Overall feedback: {review.teacherReview.feedback}</p>}
                    {review.status === 'manual-review' && <TeacherReviewFields attempt={attempt} review={review} onSaveReview={onSaveReview} />}
                  </div>
                </article>)}
              </div>
            </details>)}</div>
          </section>
        ) : !isBuildingTest && teacherArea === 'resources' ? (
          <WritingResourceManager resources={resources} resourceError={resourceError} tests={tests} teacherUid={user.uid} onSave={onSaveResource} onDelete={onDeleteResource} />
        ) : !isBuildingTest && teacherArea === 'samples' ? (
          <section className="text-left space-y-5">
            <div><h1 className="text-2xl font-bold text-slate-800 dark:text-white">Sample banks</h1><p className="text-slate-500 dark:text-slate-400 mt-1">Original, unofficial practice. Preview first, then import as a draft. A bank is never published until you choose a student group and save it.</p></div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{SAMPLE_BANKS.map(({ file, title, type, questionCount, durationSeconds, passageCount, listeningSections, description }: any) => {
              const imported = tests.filter((item: any) => item.sourceBank === file);
              const bank = selectedSample?.file === file ? selectedSample.bank : null;
              const listeningParts = bank?.sections?.listening?.parts || [];
              const usedAudioSections: number[] = [...new Set<number>((bank?.questions || []).filter((question: any) => question.section === 'listening').map((question: any) => Number(question.listeningSectionNumber || 1)))];
              const missingAudio = usedAudioSections.filter((number: number) => {
                const recording = listeningParts.find((part: any) => part.sectionNumber === number);
                return !recording?.audioUrl || recording.audioVerified !== true;
              });
              const passages = passageCount || bank?.sections?.reading?.passages?.length || 0;
              const duration = Math.round(Number(durationSeconds || bank?.durationSeconds || 0) / 60);
              return <article key={file} className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5">
                <h2 className="font-bold text-lg">{title}</h2>
                <p className="text-sm text-slate-500 mt-1">{type} · {questionCount} questions · {duration ? `${duration} min` : 'untimed'} · JSON v1</p>
                <p className="text-sm my-3">{description}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{passages ? `${passages} reading passages · ` : ''}{listeningSections ? `${listeningSections} listening sections · ` : ''}{listeningSections ? missingAudio.length || !bank ? 'Draft only · local audio files must be supplied and verified.' : 'Audio metadata loaded; verify each recording before publishing.' : bank ? 'File loaded and validated; ready for teacher review.' : 'Choose the matching local JSON file to inspect this bank.'}</p>
                {imported.length > 0 && <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">Already imported: {imported.map((item: any) => item.title).join(', ')}</p>}
                <input id={`sample-bank-${file}`} type="file" accept="application/json,.json" className="hidden" onChange={event => loadSampleBankFile(event, file)} />
                <div className="flex flex-wrap gap-2 mt-3"><button onClick={() => document.getElementById(`sample-bank-${file}`)?.click()} className="px-3 py-2 rounded border dark:border-slate-600">{bank ? 'Choose another file' : 'Choose JSON and preview'}</button><button disabled={!bank} onClick={() => bank && importSampleAsDraft(bank, file)} className="px-3 py-2 rounded bg-purple-600 text-white disabled:opacity-50">Import as draft</button></div>
                {bank && selectedSample?.file === file && <div className="mt-4 space-y-3 max-h-[36rem] overflow-y-auto"><h3 className="font-semibold">Preview: {bank.title}</h3>{(bank.questions || []).map((question: any, index: number) => <div key={question.id || index} className="p-3 rounded-lg border dark:border-slate-600"><p className="font-medium">{index + 1}. <FormattedQuestionText text={question.text || ''} /></p><QuestionResponse question={question} value={undefined} onChange={() => {}} preview /><p className="text-xs text-slate-500 mt-2">{question.section || question.satDomain || 'Practice'} · {resolveResponseType(question)}</p></div>)}</div>}
              </article>;
            })}</div>
          </section>
        ) : !isBuildingTest ? (
          <div>
            <div className="flex justify-between items-center mb-8">
              <div className="text-left">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Manage Assessments</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Create and monitor exams and homework.</p>
              </div>
              <button onClick={() => setIsBuildingTest(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm">
                <Plus className="w-5 h-5" /> Create New Assessment
              </button>
            </div>

            <div className="flex gap-2 mb-6" role="tablist" aria-label="Assessment status">
              {([
                ['active', 'Active assessments', tests.filter(test => test.status !== 'archived').length],
                ['archived', 'Archived', tests.filter(test => test.status === 'archived').length],
              ] as const).map(([view, label, count]) => (
                <button
                  key={view}
                  role="tab"
                  aria-selected={assessmentView === view}
                  onClick={() => setAssessmentView(view)}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold ${assessmentView === view ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}
                >
                  {label} <span className="ml-1 opacity-80">({count})</span>
                </button>
              ))}
            </div>

            {(() => {
              const shownTests = tests.filter(test => assessmentView === 'archived' ? test.status === 'archived' : test.status !== 'archived');
              return shownTests.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 text-left">
              {shownTests.map(test => (
                <div key={test.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col transition-colors">
                  {(() => {
                    const failed = answerKeyReport?.details?.some((item: any) => item.assessmentId === test.id && item.status === 'failed');
                    const securityStatus = test.status === 'draft' || test.published !== true
                      ? 'Draft/not applicable'
                      : failed ? 'Migration failed'
                        : test.answerKeysSecured && test.teacherKeyComplete ? 'Secure'
                          : test.answerKeysSecured ? 'Missing teacher key' : 'Needs security migration';
                    const style = securityStatus === 'Secure' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                      : securityStatus === 'Draft/not applicable' ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                        : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200';
                    return <p className={`mb-3 w-fit rounded-full px-3 py-1 text-xs font-semibold ${style}`} aria-label={`Answer-key status: ${securityStatus}`}>{securityStatus}</p>;
                  })()}
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getStatusColor(test.category)}`}>
                      {test.category} • {test.type} • {test.status || (test.groupCode ? 'Published' : 'Draft')}
                    </span>
                    <div className="flex items-center gap-2">
                      {test.pin && <Lock className="w-4 h-4 text-amber-500" aria-label="PIN protected" />}
                      {test.groupCode && <button onClick={() => unpublishTest(test)} className="text-xs px-2 py-1 rounded border border-amber-300 text-amber-700 dark:text-amber-300" title="Hide from students and preserve all results">Unpublish</button>}
                      {assessmentView === 'archived' ? (
                        <button onClick={() => restoreArchivedTest(test)} className="ml-2 text-slate-400 hover:text-emerald-600 dark:text-slate-500" title="Return assessment to active drafts" aria-label={`Restore ${test.title} to drafts`}>
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      ) : (
                        <>
                          <button onClick={() => duplicateTest(test)} className="ml-2 text-slate-400 hover:text-purple-500 dark:text-slate-500" title="Duplicate assessment" aria-label={`Duplicate ${test.title}`}>
                            <Copy className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleEditTest(test)} className="ml-2 text-slate-400 hover:text-blue-500 dark:text-slate-500" title="Edit assessment" aria-label={`Edit ${test.title}`}>
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => archiveTest(test.id)} className="ml-2 text-slate-400 hover:text-amber-600 dark:text-slate-500" title="Move to archive; preserve results" aria-label={`Archive ${test.title}`}>
                            <Archive className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{test.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex-grow line-clamp-2">{test.description}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Group: {test.groupCode === 'all' ? 'All students' : test.groupCode || 'Not assigned (hidden from students)'}</p>
                  <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-4 mt-auto">
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {Math.floor(test.durationSeconds / 60)} mins</span>
                    <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> {test.questions?.length || 0} Qs</span>
                  </div>
                </div>
              ))}
            </div>
              ) : (
                <div className="py-12 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <Archive className="mx-auto mb-3 h-12 w-12 text-slate-400" />
                  <p className="font-medium text-slate-700 dark:text-slate-200">{assessmentView === 'archived' ? 'No archived assessments.' : 'No active assessments yet.'}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{assessmentView === 'archived' ? 'Archived items will appear here and stay hidden from students.' : 'Create an assessment or restore one from the archive.'}</p>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8 transition-colors text-left">
             <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">{editingId ? 'Edit Assessment' : 'Test Builder'}</h2>
                <button onClick={cancelEdit} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-medium transition-colors">Cancel</button>
             </div>

             <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assessment Title</label>
                    <input type="text" value={newTest.title} onChange={e => setNewTest({...newTest, title: e.target.value})} placeholder="e.g. Midterm Physics Exam" className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description / Instructions</label>
                  <textarea value={newTest.description} onChange={e => setNewTest({...newTest, description: e.target.value})} placeholder="Paste instructions or reading materials from your PDF here..." rows={3} className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                    <select value={newTest.category} onChange={e => setNewTest({...newTest, category: e.target.value})} className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none">
                      <option value="Exam">Exam</option>
                      <option value="Homework">Homework</option>
                      <option value="Practice">Practice</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                    <select value={newTest.type} onChange={e => { const type = e.target.value; setNewTest({...newTest, type}); setActiveQuestionSection(type === 'IELTS' ? 'listening' : 'general'); }} className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none">
                      <option value="IELTS">IELTS</option>
                      <option value="SAT">SAT</option>
                      <option value="NUET">NUET</option>
                      <option value="General">General / Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Time Limit (Minutes)</label>
                    <input type="number" min="1" value={newTest.durationMinutes} onChange={e => setNewTest({...newTest, durationMinutes: parseInt(e.target.value)})} className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-500 dark:text-slate-400"/> Secret PIN (Optional)
                    </label>
                    <input type="text" value={newTest.pin || ''} onChange={e => setNewTest({...newTest, pin: e.target.value})} placeholder="e.g. NUET2026" className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Student group code</label>
                    <input type="text" value={newTest.groupCode || ''} onChange={e => setNewTest({...newTest, groupCode: e.target.value})} placeholder="Example: group-a-october" className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none" />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enter the exact code used by the assigned students. Leave blank to keep this exam hidden. Enter <strong>all</strong> to show it to every student. Codes are not case-sensitive.</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                  <h3 className="font-bold text-slate-800 dark:text-white mb-4">{newTest.type === 'IELTS' ? 'IELTS Sections' : 'Questions'}</h3>

                  <div className="flex flex-wrap gap-2 mb-5" role="tablist" aria-label="Question section">
                    {(newTest.type === 'IELTS'
                      ? [
                          ...(newTest.questions.some(question => !['listening', 'reading', 'writing'].includes(question.section)) ? [{ id: 'general', label: 'General / Existing Questions' }] : []),
                          { id: 'listening', label: 'Listening' },
                          { id: 'reading', label: 'Reading' },
                          { id: 'writing', label: 'Writing' }
                        ]
                      : [{ id: 'general', label: 'Questions' }]
                    ).map(section => (
                      <button
                        key={section.id}
                        type="button"
                        role="tab"
                        aria-selected={activeQuestionSection === section.id}
                        onClick={() => setActiveQuestionSection(section.id)}
                        className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${activeQuestionSection === section.id ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-purple-50 dark:hover:bg-slate-600'}`}
                      >
                        {section.label}
                      </button>
                    ))}
                  </div>

                  {newTest.type === 'IELTS' && activeQuestionSection !== 'general' && (
                    <div className="mb-5 p-4 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-900/20 space-y-3">
                      <h4 className="font-semibold text-slate-800 dark:text-white">{activeQuestionSection[0].toUpperCase() + activeQuestionSection.slice(1)} section material</h4>
                      {activeQuestionSection === 'listening' && (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2" aria-label="Listening section number">
                            {[1, 2, 3, 4].map(number => <button key={number} type="button" onClick={() => setActiveListeningSection(number)} className={`px-3 py-1.5 rounded border text-sm ${activeListeningSection === number ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'}`}>Section {number}</button>)}
                          </div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Section instructions
                            <textarea value={newTest.sections?.listening?.parts?.find(part => part.sectionNumber === activeListeningSection)?.instructions || ''} onChange={event => updateListeningPart(activeListeningSection, 'instructions', event.target.value)} rows={2} placeholder={`Instructions for Listening Section ${activeListeningSection}`} className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500" />
                          </label>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Audio URL
                            <input type="url" value={newTest.sections?.listening?.parts?.find(part => part.sectionNumber === activeListeningSection)?.audioUrl || ''} onChange={event => updateListeningPart(activeListeningSection, 'audioUrl', event.target.value)} placeholder="Paste a direct link to a browser-playable audio file" className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500" />
                          </label>
                          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" checked={newTest.sections?.listening?.parts?.find(part => part.sectionNumber === activeListeningSection)?.audioVerified === true} onChange={event => updateListeningPart(activeListeningSection, 'audioVerified', event.target.checked)} /><span>I played this recording through and verified it matches this section.</span></label>
                        </div>
                      )}
                      {activeQuestionSection === 'reading' && (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2" aria-label="Reading passage number">
                            {[1, 2, 3].map(number => <button key={number} type="button" onClick={() => setActiveReadingPassage(number)} className={`px-3 py-1.5 rounded border text-sm ${activeReadingPassage === number ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'}`}>Passage {number}</button>)}
                          </div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Passage title
                            <input type="text" value={newTest.sections?.reading?.passages?.find(passage => passage.passageNumber === activeReadingPassage)?.title || `Passage ${activeReadingPassage}`} onChange={event => updateReadingPassage(activeReadingPassage, 'title', event.target.value)} className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500" />
                          </label>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Reading passage
                            <textarea value={newTest.sections?.reading?.passages?.find(passage => passage.passageNumber === activeReadingPassage)?.content || ''} onChange={event => updateReadingPassage(activeReadingPassage, 'content', event.target.value)} rows={6} placeholder="Paste this passage's text" className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500" />
                          </label>
                        </div>
                      )}
                      {activeQuestionSection === 'writing' && (
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Writing section instructions
                          <textarea value={newTest.sections?.writing?.instructions || ''} onChange={event => updateSection('writing', 'instructions', event.target.value)} rows={3} placeholder="Instructions displayed before the writing tasks" className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500" />
                        </label>
                      )}
                    </div>
                  )}

                  {newTest.questions
                    .map((question, index) => ({ question, index }))
                    .filter(({ question }) => (question.section || 'general') === activeQuestionSection)
                    .filter(({ question }) => activeQuestionSection !== 'listening' || (question.listeningSectionNumber || 1) === activeListeningSection)
                    .filter(({ question }) => activeQuestionSection !== 'reading' || (question.passageNumber || 1) === activeReadingPassage)
                    .map(({ question: q, index: qIndex }, sectionQuestionIndex) => (
                    <div key={q.id} className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-200 dark:border-slate-600 mb-4 transition-colors text-left">
                       <div className="flex justify-between mb-2">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{newTest.type === 'IELTS' ? `${activeQuestionSection[0].toUpperCase() + activeQuestionSection.slice(1)} ` : ''}Question {sectionQuestionIndex + 1} ({q.type.toUpperCase()})</span>
                          <div className="flex flex-wrap gap-2 text-sm">
                            <button type="button" onClick={() => moveQuestion(qIndex, -1)} disabled={qIndex === 0} className="text-blue-600 disabled:opacity-40" aria-label="Move question up">↑</button>
                            <button type="button" onClick={() => moveQuestion(qIndex, 1)} disabled={qIndex === newTest.questions.length - 1} className="text-blue-600 disabled:opacity-40" aria-label="Move question down">↓</button>
                            <button type="button" onClick={() => duplicateQuestion(qIndex)} className="text-blue-600">Duplicate</button>
                            <button type="button" onClick={() => setPreviewQuestionId(previewQuestionId === q.id ? null : q.id)} className="text-blue-600">{previewQuestionId === q.id ? 'Hide preview' : 'Preview'}</button>
                            <button type="button" onClick={() => handleRemoveQuestion(qIndex)} className="text-red-500 dark:text-red-400">Remove</button>
                          </div>
                       </div>
                       
                       <QuestionTextEditor value={q.text || ''} onChange={value => handleUpdateQuestion(qIndex, 'text', value)} />

                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                         <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Question format
                           <select value={q.questionType || (q.type === 'mcq' ? 'multiple-choice' : 'short-answer')} onChange={event => handleUpdateQuestion(qIndex, 'questionType', event.target.value)} className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
                             {(newTest.type === 'IELTS' ? IELTS_QUESTION_FORMATS.filter(([value]) => activeQuestionSection === 'writing' ? value === 'writing-task' : value !== 'writing-task' && value !== 'sat-student-produced-response') : [['multiple-choice', 'Multiple choice'], ['short-answer', 'Short answer'], ['sat-student-produced-response', 'Numerical response']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                           </select>
                         </label>
                         <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Student response format
                           <select value={q.responseType || resolveResponseType(q)} onChange={event => handleUpdateQuestion(qIndex, 'responseType', event.target.value)} className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
                             {RESPONSE_TYPE_LABELS.map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                           </select>
                         </label>
                         <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Difficulty
                           <select value={q.difficulty || ''} onChange={event => handleUpdateQuestion(qIndex, 'difficulty', event.target.value)} className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
                             <option value="">Not set</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                           </select>
                         </label>
                         {newTest.type === 'IELTS' && activeQuestionSection === 'reading' && (
                           <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Reading passage
                             <select value={q.passageNumber || activeReadingPassage} onChange={event => handleUpdateQuestion(qIndex, 'passageNumber', Number(event.target.value))} className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
                               {[1, 2, 3].map(number => <option key={number} value={number}>Passage {number}</option>)}
                             </select>
                           </label>
                         )}
                         {newTest.type === 'IELTS' && activeQuestionSection === 'writing' && (
                           <>
                             <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Writing task
                               <select value={q.writingTaskType || 2} onChange={event => handleUpdateQuestion(qIndex, 'writingTaskType', Number(event.target.value))} className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
                                 <option value={1}>Task 1</option><option value={2}>Task 2</option>
                               </select>
                             </label>
                             <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Task format
                               <select value={q.writingFormat || (q.writingTaskType === 1 ? 'chart' : 'essay')} onChange={event => handleUpdateQuestion(qIndex, 'writingFormat', event.target.value)} className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
                                 {(Number(q.writingTaskType || 2) === 1 ? ['chart', 'table', 'graph', 'process', 'map', 'other visual'] : ['agree / disagree', 'discussion', 'advantages / disadvantages', 'problem / solution', 'two-part question', 'other essay']).map(format => <option key={format} value={format}>{format}</option>)}
                               </select>
                             </label>
                           </>
                         )}
                         {newTest.type === 'SAT' && (
                           <>
                             <label className="text-sm font-medium text-slate-700 dark:text-slate-300">SAT domain
                               <select value={q.satDomain || ''} onChange={event => { handleUpdateQuestion(qIndex, 'satDomain', event.target.value); handleUpdateQuestion(qIndex, 'satSkill', ''); }} className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
                                 <option value="">Choose a domain</option>{Object.keys(SAT_SKILLS).map(domain => <option key={domain} value={domain}>{domain}</option>)}
                               </select>
                             </label>
                             <label className="text-sm font-medium text-slate-700 dark:text-slate-300">SAT skill
                               <select value={q.satSkill || ''} onChange={event => handleUpdateQuestion(qIndex, 'satSkill', event.target.value)} disabled={!q.satDomain} className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white disabled:opacity-60">
                                 <option value="">Choose a skill</option>{(SAT_SKILLS[q.satDomain] || []).map(skill => <option key={skill} value={skill}>{skill}</option>)}
                               </select>
                             </label>
                           </>
                         )}
                         <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Points
                           <input type="number" min="0" value={q.points ?? 1} onChange={event => handleUpdateQuestion(qIndex, 'points', Number(event.target.value))} className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
                         </label>
                       </div>
                        {(resolveResponseType(q) === 'short-text' || resolveResponseType(q) === 'numeric') && (
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Correct answer
                           <input type={q.type === 'number' ? 'number' : 'text'} value={q.correctAnswer || ''} onChange={event => handleUpdateQuestion(qIndex, 'correctAnswer', event.target.value)} placeholder="Leave blank for a manually reviewed writing response" className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
                         </label>
                       )}
                        {q.type === 'select' && resolveResponseType(q) === 'single-choice' && (
                         <div className="space-y-2 ml-1 mb-3 text-sm text-slate-700 dark:text-slate-300">
                           <p className="font-medium">Answer choices — select the correct answer.</p>
                           {getSelectOptions(q).map((option, optionIndex) => (
                             <div key={`${q.id}-choice-${optionIndex}`} className="flex items-center gap-2">
                               <input type="radio" name={`correct_${q.id}`} checked={q.correctAnswer === option && option !== ''} onChange={() => handleUpdateQuestion(qIndex, 'correctAnswer', option)} aria-label={`Set option ${optionIndex + 1} as correct`} />
                               <input type="text" value={option} onChange={event => handleUpdateOption(qIndex, optionIndex, event.target.value)} placeholder={`Choice ${optionIndex + 1}`} className="flex-grow p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
                               {q.questionType !== 'true-false-not-given' && q.questionType !== 'yes-no-not-given' && getSelectOptions(q).length > 2 && <button onClick={() => handleRemoveOption(qIndex, optionIndex)} className="text-red-500" aria-label={`Remove choice ${optionIndex + 1}`}>Remove</button>}
                             </div>
                           ))}
                           {!['true-false-not-given', 'yes-no-not-given'].includes(q.questionType) && <button onClick={() => handleAddOption(qIndex)} className="text-blue-600 dark:text-blue-400 hover:underline">+ Add choice</button>}
                         </div>
                       )}
                        {(resolveResponseType(q) === 'short-text' || resolveResponseType(q) === 'numeric') && (
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Accepted answer alternatives (one per line)
                           <textarea value={(q.acceptedAnswers || []).join('\n')} onChange={event => handleUpdateQuestion(qIndex, 'acceptedAnswers', event.target.value.split('\n').map(answer => answer.trim()).filter(Boolean))} rows={2} className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
                         </label>
                       )}
                        {(q.responseType === 'multi-blank' || q.responseType === 'matching') && (
                          <div className="mb-4 space-y-3 rounded-lg border border-slate-200 dark:border-slate-600 p-3">
                            <h4 className="font-semibold text-slate-700 dark:text-slate-200">Answer parts and keys</h4>
                            {(q.answerSlots || []).map((slot, slotIndex) => <div key={slot.id} className="grid gap-2 sm:grid-cols-2 rounded bg-white dark:bg-slate-800 p-3">
                              <label className="text-sm">Label<input className="mt-1 w-full rounded border p-2 dark:bg-slate-700" value={slot.label || ''} onChange={event => updateAnswerSlot(qIndex, slotIndex, 'label', event.target.value)} /></label>
                              <label className="text-sm">Prompt / target<input className="mt-1 w-full rounded border p-2 dark:bg-slate-700" value={slot.prompt || ''} onChange={event => updateAnswerSlot(qIndex, slotIndex, 'prompt', event.target.value)} /></label>
                              <label className="text-sm sm:col-span-2">{q.responseType === 'matching' ? 'Correct shared choice' : 'Accepted answers, one per line'}
                                {q.responseType === 'matching' ? <select className="mt-1 w-full rounded border p-2 dark:bg-slate-700" value={slot.correctAnswers?.[0] || ''} onChange={event => updateAnswerSlot(qIndex, slotIndex, 'correctAnswers', event.target.value ? [event.target.value] : [])}><option value="">Choose the key…</option>{(q.sharedChoices || []).filter(Boolean).map((choice, choiceIndex) => <option key={`${slot.id}-key-${choiceIndex}`}>{choice}</option>)}</select>
                                  : <textarea className="mt-1 w-full rounded border p-2 dark:bg-slate-700" rows={2} value={(slot.correctAnswers || []).join('\n')} onChange={event => updateSlotAnswers(qIndex, slotIndex, event.target.value)} />}
                              </label>
                              {(q.answerSlots || []).length > 1 && <button type="button" className="text-left text-red-500" onClick={() => handleUpdateQuestion(qIndex, 'answerSlots', q.answerSlots.filter((_, index) => index !== slotIndex))}>Remove answer part</button>}
                            </div>)}
                            <button type="button" className="text-blue-600" onClick={() => handleUpdateQuestion(qIndex, 'answerSlots', [...(q.answerSlots || []), { id: `slot_${Date.now()}`, label: `Answer ${(q.answerSlots || []).length + 1}`, correctAnswers: [] }])}>+ Add answer part</button>
                            {q.responseType === 'matching' && <>
                              <p className="font-medium text-sm">Shared choices</p>
                              {(q.sharedChoices || []).map((choice, choiceIndex) => <div key={`${q.id}-shared-${choiceIndex}`} className="flex gap-2"><input className="flex-1 rounded border p-2 dark:bg-slate-800" value={choice} onChange={event => duplicateChoice(qIndex, 'sharedChoices', choiceIndex, event.target.value)} /><button type="button" className="text-red-500" onClick={() => handleUpdateQuestion(qIndex, 'sharedChoices', q.sharedChoices.filter((_, index) => index !== choiceIndex))}>Remove</button></div>)}
                              <button type="button" className="text-blue-600" onClick={() => handleUpdateQuestion(qIndex, 'sharedChoices', [...(q.sharedChoices || []), ''])}>+ Add shared choice</button>
                              <label className="flex gap-2 text-sm"><input type="checkbox" checked={!q.allowChoiceReuse} onChange={event => handleUpdateQuestion(qIndex, 'allowChoiceReuse', !event.target.checked)} />Do not reuse choices</label>
                            </>}
                          </div>
                        )}
                        {(q.responseType === 'multiple-select' || q.responseType === 'ordering') && <div className="mb-4 space-y-2 rounded-lg border p-3 dark:border-slate-600">
                          <p className="font-medium">{q.responseType === 'ordering' ? 'Items — set their correct order' : 'Choices — tick every correct option'}</p>
                          {(q.options || []).map((option, optionIndex) => <div key={`${q.id}-typed-choice-${optionIndex}`} className="flex items-center gap-2">
                            {q.responseType === 'multiple-select' ? <input type="checkbox" checked={(Array.isArray(q.correctAnswer) ? q.correctAnswer : []).includes(option) && Boolean(option)} onChange={event => { const existing = Array.isArray(q.correctAnswer) ? q.correctAnswer : []; handleUpdateQuestion(qIndex, 'correctAnswer', event.target.checked ? [...existing, option].filter(Boolean) : existing.filter(item => item !== option)); }} /> : <div className="flex gap-1"><button type="button" disabled={!optionIndex} onClick={() => { const values = [...q.options]; [values[optionIndex - 1], values[optionIndex]] = [values[optionIndex], values[optionIndex - 1]]; handleUpdateQuestion(qIndex, 'options', values); handleUpdateQuestion(qIndex, 'correctOrder', values.filter(Boolean)); }}>↑</button><button type="button" disabled={optionIndex === q.options.length - 1} onClick={() => { const values = [...q.options]; [values[optionIndex + 1], values[optionIndex]] = [values[optionIndex], values[optionIndex + 1]]; handleUpdateQuestion(qIndex, 'options', values); handleUpdateQuestion(qIndex, 'correctOrder', values.filter(Boolean)); }}>↓</button></div>}
                            <input className="flex-1 rounded border p-2 dark:bg-slate-800" value={option} onChange={event => handleUpdateOption(qIndex, optionIndex, event.target.value)} placeholder={`Choice ${optionIndex + 1}`} />
                            <button type="button" className="text-red-500" onClick={() => handleRemoveOption(qIndex, optionIndex)}>Remove</button>
                          </div>)}
                          <button type="button" className="text-blue-600" onClick={() => handleAddOption(qIndex)}>+ Add choice/item</button>
                        </div>}
                        {q.responseType === 'numeric' && <label className="block text-sm mb-3">Numeric tolerance (optional)<input type="number" min="0" step="any" value={q.numericTolerance ?? 0} onChange={event => handleUpdateQuestion(qIndex, 'numericTolerance', Number(event.target.value))} className="mt-1 w-full rounded border p-2 dark:bg-slate-700" /></label>}
                        {q.responseType === 'long-text' && <div className="mb-3 space-y-2 text-sm"><p className="text-slate-600 dark:text-slate-300">Written responses are excluded from automatic scoring and flagged for teacher review.</p><label className="flex gap-2"><input type="checkbox" checked={Boolean(q.ungraded)} onChange={event => handleUpdateQuestion(qIndex, 'ungraded', event.target.checked)} />Treat as ungraded practice</label></div>}
                        {q.responseType !== 'long-text' && <label className="mb-3 flex gap-2 text-sm text-slate-700 dark:text-slate-200"><input type="checkbox" checked={Boolean(q.manualReview)} onChange={event => handleUpdateQuestion(qIndex, 'manualReview', event.target.checked)} />Mark for manual teacher review (exclude from automatic score)</label>}
                       <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Answer explanation (optional)
                         <textarea value={q.explanation || ''} onChange={event => handleUpdateQuestion(qIndex, 'explanation', event.target.value)} rows={2} className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
                       </label>

                       <div className="mb-4 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-left dark:border-blue-800 dark:bg-blue-900/20">
                         <h4 className="flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-300">
                           <ImageIcon className="h-4 w-4" /> Task figure
                         </h4>
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                           Upload from this device (PNG, JPEG, or WebP; maximum 5 MB)
                           <input
                             type="file"
                             accept="image/png,image/jpeg,image/webp"
                             onChange={event => {
                               const file = event.target.files?.[0];
                               void uploadQuestionFigure(qIndex, file);
                               event.target.value = '';
                             }}
                             className="mt-1 block w-full text-sm"
                           />
                         </label>
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                           Or use a trusted direct HTTPS image URL
                           <input
                             type="url"
                             value={q.imageUrl || q.imageAsset?.downloadUrl || ''}
                             onChange={event => handleUpdateQuestion(qIndex, 'imageUrl', event.target.value)}
                             placeholder="https://example.com/task-figure.png"
                             className="mt-1 w-full rounded border border-blue-300 bg-white p-2 text-sm text-slate-800 dark:border-blue-700 dark:bg-slate-800 dark:text-white"
                           />
                         </label>
                         <div className="grid gap-3 sm:grid-cols-2">
                           <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                             Alternative text
                             <input value={q.imageAlt || q.imageAsset?.alt || ''} onChange={event => handleUpdateQuestion(qIndex, 'imageAlt', event.target.value)} className="mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-800" />
                           </label>
                           <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                             Figure caption / source (optional)
                             <input value={q.figureCaption || q.imageAsset?.caption || ''} onChange={event => handleUpdateQuestion(qIndex, 'figureCaption', event.target.value)} className="mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-800" />
                           </label>
                         </div>
                         <button type="button" onClick={() => void testQuestionFigureUrl(q)} disabled={figureStates[q.id]?.status === 'uploading'} className="rounded border border-blue-400 px-3 py-1.5 text-sm font-medium text-blue-800 disabled:opacity-50 dark:border-blue-700 dark:text-blue-300">
                           {figureStates[q.id]?.status === 'uploading' ? 'Checking…' : 'Test image URL'}
                         </button>
                         {figureStates[q.id] && <p className={`text-sm ${figureStates[q.id].status === 'error' ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'}`} role={figureStates[q.id].status === 'error' ? 'alert' : 'status'}>{figureStates[q.id].message}</p>}
                         <PromptFigure key={`${q.id}-${figureTestRevision[q.id] || 0}`} question={q} assessmentId={editingId || newTest.id || 'draft'} teacherFacing />
                         {q.section === 'writing' && Number(q.writingTaskType || 2) === 1 && (
                           <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                             <input type="checkbox" checked={q.figureMode === 'text-only'} onChange={event => handleUpdateQuestion(qIndex, 'figureMode', event.target.checked ? 'text-only' : 'visual')} />
                             <span>This is a text-only Task 1 prompt; all information needed is included in the prompt text.</span>
                           </label>
                         )}
                       </div>

                        {previewQuestionId === q.id && <div className="mb-4 rounded-lg border border-blue-300 bg-white p-4 dark:bg-slate-800"><p className="font-medium mb-3">Student preview: <FormattedQuestionText text={q.text || 'Question prompt'} /></p><PromptFigure question={q} assessmentId={editingId || newTest.id || 'draft'} teacherFacing /><QuestionResponse question={q} value={undefined} onChange={() => {}} preview /></div>}
                        {(validationErrors[q.id] || []).map(message => <p key={message} className="mb-2 text-sm text-red-600" role="alert">{message}</p>)}
                        {resolveResponseType(q) === 'single-choice' && q.type === 'mcq' && (
                         <div className="space-y-2 ml-4 border-l-2 border-slate-200 dark:border-slate-600 pl-4 text-left">
                            {(q.options || []).map((opt, oIndex) => (
                              <div key={oIndex} className="flex items-center gap-2 w-full">
                                <input type="radio" name={`correct_${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => handleUpdateQuestion(qIndex, 'correctAnswer', opt)} className="w-4 h-4 flex-shrink-0" />
                                <input type="text" value={opt} onChange={e => handleUpdateOption(qIndex, oIndex, e.target.value)} placeholder={`Option ${oIndex + 1} (Text or Image Link)`} className="flex-grow p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm outline-none text-left min-w-0" />
                                
                                {q.options.length > 2 && (
                                   <button onClick={() => handleRemoveOption(qIndex, oIndex)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1 flex-shrink-0" title="Remove this option">
                                     <X className="w-4 h-4" />
                                   </button>
                                )}
                              </div>
                           ))}
                           <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-1">Select the radio button next to the correct answer for auto-grading.</p>
                           
                           {q.options.length < 8 && (
                             <button onClick={() => handleAddOption(qIndex)} className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium mt-2 flex items-center gap-1">
                               <Plus className="w-4 h-4" /> Add Another Option
                             </button>
                           )}
                         </div>
                       )}
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-3 mt-4">
                    {activeQuestionSection !== 'writing' && <button onClick={() => handleAddQuestion('mcq', activeQuestionSection)} className="px-4 py-2 bg-white dark:bg-slate-700 border border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-slate-600 text-sm font-medium transition-colors">
                      + Add Multiple Choice
                    </button>}
                    <button onClick={() => handleAddQuestion('text', activeQuestionSection)} className="px-4 py-2 bg-white dark:bg-slate-700 border border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-slate-600 text-sm font-medium transition-colors">
                      {activeQuestionSection === 'writing' ? '+ Add Writing Task' : '+ Add Written Response'}
                    </button>
                    <label className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium cursor-pointer">Import question bank JSON<input type="file" accept="application/json,.json" onChange={importQuestionBank} className="sr-only" /></label>
                    <button type="button" onClick={exportQuestionBank} disabled={!newTest.questions.length} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium disabled:opacity-50">Export questions JSON</button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Import appends validated questions. Exported files include answer keys; keep them private.</p>
                  {questionBankError && <p className="mt-2 text-sm text-red-600" role="alert">{questionBankError}</p>}
                </div>

                <div className="flex justify-end pt-6 border-t border-slate-200 dark:border-slate-700">
                  <button onClick={saveTest} disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-2">
                    {isSubmitting ? 'Saving...' : (editingId ? 'Update Assessment' : 'Publish Assessment')} <CheckCircle className="w-5 h-5" />
                  </button>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
    </>
  )
}

const WritingPractice = ({ tests, resources, resourceError, userId, onBack }) => {
  const taskOptions: Array<1 | 2> = [1, 2];
  const [taskType, setTaskType] = useState<1 | 2>(1);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [draft, setDraft] = useState('');
  const [checklist, setChecklist] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(20 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiPhraseOptions, setAiPhraseOptions] = useState<string[]>([]);
  const [aiInlineSuggestion, setAiInlineSuggestion] = useState('');
  const [aiFigureIncluded, setAiFigureIncluded] = useState(false);
  const [aiError, setAiError] = useState('');
  const [localSuggestionDismissed, setLocalSuggestionDismissed] = useState(false);
  const [draftRevision, setDraftRevision] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<null | { title: string; message: string; onConfirm: () => void; onCancel: () => void; }>(null);
  const textareaRef = React.useRef(null);
  const responseCache = React.useRef(new Map());
  const aiUsage = React.useRef({ date: '', count: 0, lastRequest: 0 });
  const autoSuggestionTimer = React.useRef<number | null>(null);
  const lastAutoSuggestionAt = React.useRef(0);

  const prompts = tests.flatMap(test => (test.questions || [])
    .filter(question => question.section === 'writing' && Number(question.writingTaskType || 2) === taskType)
    .map(question => ({ id: `${test.id}_${question.id}`, test, question })));
  const getDraftStorageKey = (promptId, task = taskType) => `ieltsWritingDraft:${userId}:${task}:${promptId}`;
  const loadDraft = (promptId, task = taskType) => {
    try { return localStorage.getItem(getDraftStorageKey(promptId, task)) || ''; } catch { return ''; }
  };
  const selectedPrompt = prompts.find(prompt => prompt.id === selectedPromptId) || prompts[0];
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const checklistItems = taskType === 1
    ? ['Paraphrase the task in an introduction', 'Write a clear overview', 'Select key details for comparison', 'Check figures, units, and tense']
    : ['Identify the question and choose an approach', 'State a clear position', 'Develop each body paragraph with support', 'Connect ideas and write a conclusion'];

  useEffect(() => {
    setSelectedPromptId(prompts[0]?.id || '');
    setDraft(prompts[0] ? loadDraft(prompts[0].id, taskType) : '');
    setChecklist({});
    setSecondsLeft(taskType === 1 ? 20 * 60 : 40 * 60);
    setTimerRunning(false);
    setAiMessage('');
    setAiPhraseOptions([]);
    setAiInlineSuggestion('');
    setAiFigureIncluded(false);
    setAiError('');
    setDraftRevision(0);
  }, [taskType]);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const timer = window.setInterval(() => setSecondsLeft(previous => {
      if (previous <= 1) {
        setTimerRunning(false);
        return 0;
      }
      return previous - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  const localSuggestions = getLocalWritingSuggestions({
    taskType,
    draft,
    format: selectedPrompt?.question?.writingFormat || (taskType === 1 ? 'chart' : 'essay'),
    promptText: selectedPrompt?.question?.text || '',
    figure: {
      url: selectedPrompt?.question?.imageUrl || '',
      alt: selectedPrompt?.question?.imageAlt || 'Writing prompt figure',
      caption: selectedPrompt?.question?.figureCaption || '',
      description: selectedPrompt?.question?.figureDescription || '',
      units: selectedPrompt?.question?.figureUnits || '',
      categories: Array.isArray(selectedPrompt?.question?.categories) ? selectedPrompt.question.categories : [],
      years: Array.isArray(selectedPrompt?.question?.years) ? selectedPrompt.question.years : [],
      isValid: Boolean(selectedPrompt?.question?.imageUrl),
    },
  });

  const insertPhrase = (phrase) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? draft.length;
    const end = textarea?.selectionEnd ?? draft.length;
    const suffix = draft.slice(end);
    const insertion = `${phrase}${/\s$/.test(phrase) || /^\s/.test(suffix) ? '' : ' '}`;
    const updated = `${draft.slice(0, start)}${insertion}${suffix}`;
    setDraft(updated);
    setLocalSuggestionDismissed(true);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + insertion.length, start + insertion.length);
    });
  };

  const parsePhraseOptions = (message: string) => message
    .split(/\r?\n/)
    .map(line => line.trim().replace(/^(?:[-*•]|\d+[.)])\s*/, '').replace(/^["'“”‘’]|["'“”‘’]$/g, '').trim())
    .filter(Boolean)
    .slice(0, 3);

  const showConfirm = async (title: string, message: string) => new Promise<boolean>(resolve => {
    setConfirmDialog({ title, message, onConfirm: () => { setConfirmDialog(null); resolve(true); }, onCancel: () => { setConfirmDialog(null); resolve(false); } });
  });

  const requestCoach = async (kind: 'hint' | 'feedback' | 'final' | 'phrases' | 'inline') => {
    if (!selectedPrompt || !draft.trim() || aiBusy) return;
    if (draft.length > 5000) {
      setAiError('For privacy and request limits, shorten your draft to 5,000 characters before requesting feedback.');
      return;
    }
    const promptText = stripQuestionTextFormatting(String(selectedPrompt.question.text || '')).slice(0, 1500);
    const figureSource = getFigureSource(selectedPrompt.question);
    const figureVersion = selectedPrompt.question.imageAsset?.assetVersion || '';
    const visualText = figureSource
      ? `VISUAL CONTEXT:\nTitle: ${selectedPrompt.question.figureCaption || selectedPrompt.question.imageAlt || 'Prompt image'}\nCaption: ${selectedPrompt.question.figureCaption || ''}\nAlt text: ${selectedPrompt.question.imageAlt || ''}\nDescription: ${selectedPrompt.question.figureDescription || selectedPrompt.question.text || ''}`
      : 'VISUAL CONTEXT:\nNo uploaded figure is associated with this task.';
    const cacheKey = `${kind}:${taskType}:${selectedPrompt.id}:${promptText}:${figureSource}:${figureVersion}:${visualText}:${draft.trim()}`;
    if (responseCache.current.has(cacheKey)) {
      const cachedMessage = responseCache.current.get(cacheKey);
      if (kind === 'phrases') {
        setAiPhraseOptions(parsePhraseOptions(cachedMessage));
        setAiMessage('');
      } else if (kind === 'inline') {
        setAiInlineSuggestion(parsePhraseOptions(cachedMessage)[0] || '');
        setAiFigureIncluded(Boolean(figureSource));
      } else {
        setAiPhraseOptions([]);
        setAiMessage(cachedMessage);
      }
      return;
    }
    const consentKey = `writingCoachConsent:v2:${userId}`;
    try {
      if (!localStorage.getItem(consentKey)) {
        const figureNotice = figureSource ? ' The uploaded prompt figure will also be sent for visual analysis.' : '';
        const accepted = await showConfirm('AI opt-in required', `Before the first AI request: the selected IELTS Task prompt and your current draft (up to 5,000 characters) will be sent to Google Gemini through Firebase AI Logic for processing.${figureNotice} This is optional formative feedback, not an official IELTS score. The Gemini Developer API free tier may use submitted content to improve Google products. Continue?`);
        if (!accepted) return;
        localStorage.setItem(consentKey, 'accepted');
      }
    } catch {
      const figureNotice = figureSource ? ' The uploaded prompt figure will also be sent for visual analysis.' : '';
      const accepted = await showConfirm('AI optional consent', `Your browser cannot save the AI notice preference. The selected prompt and draft will be sent to Google Gemini for optional formative feedback.${figureNotice} Continue this request?`);
      if (!accepted) return;
    }
    if (!appCheckSiteKey) {
    setAiError('AI setup is incomplete: add the Firebase App Check reCAPTCHA Enterprise site key to VITE_RECAPTCHA_ENTERPRISE_SITE_KEY. Local phrase suggestions still work.');
      return;
    }
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    if (aiUsage.current.date !== today) aiUsage.current = { date: today, count: 0, lastRequest: 0 };
    if (now - aiUsage.current.lastRequest < 15000) {
      setAiError('Please wait 15 seconds between AI requests.');
      return;
    }
    if (aiUsage.current.count >= 8) {
      setAiError('You have reached this browser’s limit of 8 requests today. Gemini free-tier quotas may also run out. Local phrase suggestions remain available.');
      return;
    }
    aiUsage.current = { date: today, count: aiUsage.current.count + 1, lastRequest: now };
    const dayKey = `writingCoachUsage:${userId}:${today}`;
    try {
      const usage = JSON.parse(localStorage.getItem(dayKey) || '{"count":0,"lastRequest":0}');
      if (now - Number(usage.lastRequest || 0) < 15000) {
        setAiError('Please wait 15 seconds between AI requests.');
        return;
      }
      if (Number(usage.count || 0) >= 8) {
        setAiError('You have reached this browser’s limit of 8 requests today. Gemini free-tier quotas may also run out. Local phrase suggestions remain available.');
        return;
      }
      localStorage.setItem(dayKey, JSON.stringify({ count: Number(usage.count || 0) + 1, lastRequest: now }));
    } catch { /* App Check and the provider quota remain active when browser storage is unavailable. */ }
    setAiBusy(true);
    setAiError('');
    setAiMessage('');
    setAiPhraseOptions([]);
    setAiInlineSuggestion('');
    setAiFigureIncluded(false);
    try {
      const figureData = figureSource ? await fetchFigureForAI(figureSource) : null;
      const taskFormat = selectedPrompt.question.writingFormat || (taskType === 1 ? 'chart or visual report' : 'essay');
      const mode = kind === 'phrases'
        ? `Suggest exactly three short, natural sentence starters suited to the next step in this draft. Return one starter per line with no numbering, bullets, explanation, or completed answer. Do not invent figures or details${taskType === 1 ? ' for the visual' : ''}.`
        : kind === 'inline'
          ? `Suggest exactly ONE concise next sentence or sentence starter to continue the student's own writing, with no quotes, bullets, label, or explanation. For Task 1, identify the visual type and describe only trends or values that can actually be verified in the supplied figure; never guess unreadable numbers. For Task 2, use the exact essay question and the student's stated position; do not invent examples or write a full argument. Make it easy for the student to adapt.`
        : kind === 'hint'
          ? 'Give one concise next-step hint without rewriting the student text.'
          : kind === 'final'
            ? 'Review the complete current response and give a concise final review with strengths and up to three prioritized improvements. Do not assign an IELTS band score.'
            : 'Give concise, specific formative feedback: one strength and up to two actionable improvements. Do not assign an IELTS band score.';
      const taskGuidance = taskType === 1
        ? 'Task 1 coaching must be a factual visual report: paraphrase the task, identify the overall trend, compare key features, and use specific figures only when legible in the supplied visual. Never add an opinion.'
        : 'Task 2 coaching must address every part of the essay question, help the writer develop a clear position and supported paragraphs, and use counterarguments only when relevant. Never treat it as a chart report.';
      const requestText = `You are a supportive IELTS writing practice coach. This is IELTS Writing Task ${taskType} (${taskFormat}). ${taskGuidance} Use the exact task prompt, the supplied visual when present, and the student's current draft. ${mode} Do not claim to calculate an official score. Keep feedback under 140 words.\n\nTASK PROMPT:\n${promptText}\n\n${visualText}\n\nSTUDENT DRAFT:\n${draft.slice(0, 5000)}`;
      const requestParts: Part[] = [{ text: requestText }];
      if (figureData) requestParts.push({ inlineData: figureData });
      const response = await writingAI.generateContent(requestParts);
      const message = response.response.text();
      if (typeof message !== 'string' || !message.trim()) throw new Error('Gemini returned no feedback.');
      if (kind === 'phrases' || kind === 'inline') {
        const options = parsePhraseOptions(message);
        if (!options.length) {
          setAiError('The AI response did not contain usable phrase options. Try requesting suggestions again.');
          return;
        }
        responseCache.current.set(cacheKey, message);
        if (kind === 'inline') {
          setAiInlineSuggestion(options[0]);
          setAiFigureIncluded(Boolean(figureData));
        } else {
          setAiPhraseOptions(options);
        }
      } else {
        responseCache.current.set(cacheKey, message);
        setAiMessage(message);
      }
    } catch (error) {
      console.error('Writing coach request failed:', error);
      if (error instanceof Error && /prompt figure|cross-origin|image URL|AI upload limit|image type|downloaded empty|browser could not read/i.test(error.message)) {
        setAiError(`Could not create a figure-aware suggestion: ${error.message}`);
        return;
      }
      const code = String(error?.code || '').toLowerCase();
      const details = String(error?.message || '').toLowerCase();
      setAiError(code.includes('quota') || code.includes('resource-exhausted') || details.includes('quota') || details.includes('rate')
        ? 'The Gemini free-tier quota or request limit is currently exhausted. Try later; no paid service is used. Local phrase suggestions remain available.'
        : code.includes('permission') || details.includes('app check') || details.includes('app_check')
          ? 'Firebase denied this AI request. Check that Firebase AI Logic is enabled and the current site has a valid App Check registration/token.'
          : code.includes('api-not-enabled') || code.includes('no-project-id') || code.includes('no-api-key')
            ? 'Firebase AI Logic is not enabled or its Firebase app configuration is incomplete. Local phrase suggestions remain available.'
            : 'AI coaching is temporarily unavailable, possibly because of a network problem. Your draft is still saved locally; local phrase suggestions remain available.');
    } finally {
      setAiBusy(false);
    }
  };

  useEffect(() => {
    if (!draftRevision || !selectedPrompt || draft.trim().length < 30 || aiBusy) return undefined;
    if (autoSuggestionTimer.current) window.clearTimeout(autoSuggestionTimer.current);
    const cooldownRemaining = Math.max(0, 15000 - (Date.now() - lastAutoSuggestionAt.current));
    autoSuggestionTimer.current = window.setTimeout(() => {
      lastAutoSuggestionAt.current = Date.now();
      void requestCoach('inline');
    }, Math.max(1200, cooldownRemaining));
    return () => {
      if (autoSuggestionTimer.current) {
        window.clearTimeout(autoSuggestionTimer.current);
        autoSuggestionTimer.current = null;
      }
    };
  }, [draftRevision, selectedPromptId, taskType, aiBusy]);

  return (
    <>
      {confirmDialog && (
        <Modal isOpen={true} title={confirmDialog.title} onClose={confirmDialog.onCancel} actions={[
          { label: 'Cancel', onClick: confirmDialog.onCancel },
          { label: 'Continue', onClick: confirmDialog.onConfirm },
        ]}>
          <p className="whitespace-pre-wrap text-left">{confirmDialog.message}</p>
        </Modal>
      )}
      <div className="space-y-5 text-left">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold text-slate-800 dark:text-white">IELTS Writing Practice</h2><p className="text-sm text-slate-500 dark:text-slate-400">Suggestions are optional. Your writing is never replaced automatically.</p></div>
        <button onClick={onBack} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200">Back</button>
      </div>
      <div className="flex gap-2" role="tablist" aria-label="Writing task">
        {taskOptions.map(task => <button key={task} role="tab" aria-selected={taskType === task} onClick={() => setTaskType(task)} className={`px-4 py-2 rounded-lg font-semibold ${taskType === task ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'}`}>Task {task}</button>)}
      </div>
      {!selectedPrompt ? (
        <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300">
          No Task {taskType} prompt is available yet. Ask your teacher to publish an IELTS Writing question and label it Task {taskType}.
        </div>
      ) : (
        <ResizableSplitPane
          workspaceKey={`ielts-writing:${userId}`}
          leftLabel="Writing task and draft"
          rightLabel="Resource panel"
          left={<div className="space-y-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Prompt
                <select value={selectedPromptId || selectedPrompt.id} onChange={event => { setSelectedPromptId(event.target.value); setDraft(loadDraft(event.target.value)); setDraftRevision(previous => previous + 1); setAiMessage(''); setAiPhraseOptions([]); setAiInlineSuggestion(''); setAiFigureIncluded(false); setAiError(''); }} className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
                  {prompts.map(prompt => <option key={prompt.id} value={prompt.id}>{prompt.test.title}: {stripQuestionTextFormatting(prompt.question.text || '').slice(0, 90)}</option>)}
                </select>
              </label>
              <p className="mt-4 whitespace-pre-wrap text-slate-800 dark:text-slate-100"><FormattedQuestionText text={selectedPrompt.question.text} /></p>
              <PromptFigure question={selectedPrompt.question} assessmentId={selectedPrompt.test.id} />
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Suggested practice length: {taskType === 1 ? 'about 150 words' : 'about 250 words'}. This is guidance, not scoring. {taskType === 1 ? 'Describe the visual accurately; do not add an opinion.' : 'Answer the full essay question and support your position.'}</p>
            </div>
            <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="font-semibold text-slate-800 dark:text-white">Your draft</h3>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span aria-live="polite">{wordCount} words</span>
                  <span className="font-mono">{formatTime(secondsLeft)}</span>
                  <button onClick={() => setTimerRunning(previous => !previous)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600">{timerRunning ? 'Pause' : 'Start'}</button>
                </div>
              </div>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={event => {
                    const value = event.target.value;
                    setDraft(value);
                    setDraftRevision(previous => previous + 1);
                    setLocalSuggestionDismissed(false);
                    setAiMessage('');
                    setAiPhraseOptions([]);
                    setAiInlineSuggestion('');
                    setAiFigureIncluded(false);
                    setAiError('');
                    try { if (selectedPrompt) localStorage.setItem(getDraftStorageKey(selectedPrompt.id), value); } catch { /* Storage may be unavailable in private browsing. */ }
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Tab' && aiInlineSuggestion) {
                      event.preventDefault();
                      insertPhrase(aiInlineSuggestion);
                      setAiInlineSuggestion('');
                    } else if (event.key === 'Tab' && localSuggestions[0] && !localSuggestionDismissed) {
                      event.preventDefault();
                      insertPhrase(localSuggestions[0].phrase);
                    } else if (event.key === 'Escape' && aiInlineSuggestion) {
                      event.preventDefault();
                      setAiInlineSuggestion('');
                    } else if (event.key === 'Escape' && localSuggestions[0] && !localSuggestionDismissed) {
                      event.preventDefault();
                      setLocalSuggestionDismissed(true);
                    }
                  }}
                  rows={16}
                  maxLength={12000}
                  placeholder="Write your response here. After your one-time consent, AI suggestions are requested online after you pause typing."
                  className="w-full p-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white leading-relaxed"
                />
                {aiBusy && (
                  <p className="mt-2 text-xs text-indigo-700 dark:text-indigo-300" role="status">
                    AI coach is considering your draft{getFigureSource(selectedPrompt.question) ? ' and uploaded figure' : ''}…
                  </p>
                )}
                {aiInlineSuggestion && (
                  <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-900/30" role="status" aria-live="polite">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">AI next-sentence suggestion{aiFigureIncluded ? ' · figure-aware' : ''}</p>
                      <button type="button" onClick={() => insertPhrase(aiInlineSuggestion)} className="rounded bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800">Insert at cursor</button>
                    </div>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{aiInlineSuggestion}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Review and adapt it. Nothing is inserted unless you choose to accept it.</p>
                  </div>
                )}
              </div>
              {localSuggestions[0] && !localSuggestionDismissed && (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300" role="status">
                  Offline suggestion: <span className="font-medium">{localSuggestions[0].phrase}</span> Press Tab to insert it when no AI suggestion is showing, or Escape to dismiss.
                </p>
              )}
            </div>
          </div>}
          right={<aside className="space-y-4">
            <section className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" aria-labelledby="writing-resource-heading">
              <h3 id="writing-resource-heading" className="font-semibold text-slate-800 dark:text-white mb-3">Resource panel</h3>
              {resourceError && <p role="alert" className="mb-3 text-red-700 dark:text-red-300">Could not load writing resources: {resourceError}</p>}
              <WritingResourceTable resources={resources} taskType={taskType} assessmentId={selectedPrompt.test.id} questionId={selectedPrompt.question.id} />
            </section>
            <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-white mb-3">Structure checklist</h3>
              {checklistItems.map(item => <label key={item} className="flex gap-2 items-start text-sm text-slate-700 dark:text-slate-300 mb-3"><input type="checkbox" checked={Boolean(checklist[item])} onChange={event => setChecklist(previous => ({ ...previous, [item]: event.target.checked }))} /><span>{item}</span></label>)}
            </div>
            <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-white mb-1">Phrase suggestions</h3>
              <p className="mb-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">Local suggestions are always available, including offline. After you consent, online AI suggestions are requested after you pause typing and appear below the writing box; accept one to insert it.</p>
              {!appCheckSiteKey && <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200" role="status">Online AI is not configured for this deployment. The offline suggestions still work; configure Firebase AI Logic and the App Check site key to enable Gemini.</p>}
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">After your consent, the prompt, draft, and attached figure (when present) are sent to Gemini after you pause typing or request coaching. Google’s free-tier terms and quotas can change; there is no paid fallback.</p>
              <div className="space-y-2">{localSuggestions.map(suggestion => <div key={suggestion.phrase} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700"><button onClick={() => insertPhrase(suggestion.phrase)} className="text-left font-semibold text-blue-700 dark:text-blue-300 underline">{suggestion.phrase}</button><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{suggestion.why}</p></div>)}</div>
              <button onClick={() => requestCoach('phrases')} disabled={aiBusy || !draft.trim()} className="w-full mt-4 px-3 py-2 rounded-lg bg-indigo-600 text-white font-semibold disabled:opacity-50">{aiBusy ? 'Preparing suggestions…' : 'Suggest 3 AI phrase options'}</button>
              {aiPhraseOptions.length > 0 && <div className="mt-3 space-y-2" aria-label="AI phrase options">{aiPhraseOptions.map((phrase, index) => <div key={`${phrase}-${index}`} className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30"><button onClick={() => insertPhrase(phrase)} className="text-left font-semibold text-indigo-800 dark:text-indigo-200 underline">{phrase}</button><p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Select to insert at your cursor. Adapt it to your own ideas.</p></div>)}</div>}
              <button onClick={() => requestCoach('hint')} disabled={aiBusy || !draft.trim()} className="w-full mt-4 px-3 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50">{aiBusy ? 'Getting hint…' : 'Ask for a focused AI hint'}</button>
              <button onClick={() => requestCoach('feedback')} disabled={aiBusy || !draft.trim()} className="w-full mt-2 px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-semibold disabled:opacity-50">Request feedback</button>
              <button onClick={() => requestCoach('final')} disabled={aiBusy || !draft.trim()} className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold disabled:opacity-50">Finish and request final review</button>
              {aiError && <p role="status" className="text-sm text-amber-700 dark:text-amber-300 mt-3">{aiError}</p>}
              {aiMessage && <div role="status" className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap"><p className="font-semibold mb-1">Formative coaching (not an official IELTS band score)</p>{aiMessage}</div>}
            </div>
          </aside>}
        />
      )}
    </div>
    </>
  );
};

const ReadingPracticeWorkspace = ({ test, userId, questions, answers, currentIndex, setCurrentIndex, currentQuestion, renderAnswerInput, disabled }) => {
  const [activePassageNumber, setActivePassageNumber] = useState(Number(currentQuestion?.passageNumber || 1));
  const [visitedQuestionIds, setVisitedQuestionIds] = useState<string[]>(currentQuestion?.id ? [currentQuestion.id] : []);
  const passageScroll = React.useRef<Record<string, number>>({});
  const questionScroll = React.useRef<Record<string, number>>({});
  const passagePaneRef = React.useRef<HTMLDivElement>(null);
  const questionPaneRef = React.useRef<HTMLDivElement>(null);
  const readingSession = buildReadingSessionViewModel({
    configuredPassages: test?.sections?.reading?.passages || [],
    questions,
    activePassageId: String(activePassageNumber),
    activeQuestionId: String(currentQuestion?.id || ''),
    answers,
    visitedQuestionIds,
    leftScrollTopByPassage: passageScroll.current,
    rightScrollTopByPassage: questionScroll.current,
  });
  const passageNumbers = readingSession.passageIds.map(Number);
  const questionIdsByPassage = readingSession.questionIdsByPassage;
  const activeQuestionId = readingSession.activeQuestionId;

  useEffect(() => {
    const questionPassage = Number(currentQuestion?.passageNumber || 1);
    if (questionPassage !== activePassageNumber) setActivePassageNumber(questionPassage);
    if (currentQuestion?.id) setVisitedQuestionIds(previous => previous.includes(currentQuestion.id) ? previous : [...previous, currentQuestion.id]);
  }, [currentQuestion?.id]);

  useEffect(() => {
    if (passagePaneRef.current) passagePaneRef.current.scrollTop = passageScroll.current[String(activePassageNumber)] || 0;
    if (questionPaneRef.current) questionPaneRef.current.scrollTop = questionScroll.current[String(activePassageNumber)] || 0;
  }, [activePassageNumber]);

  const passageQuestions = questions
    .map((question: any, index: number) => ({ question, index }))
    .filter(({ question }: any) => Number(question.passageNumber || 1) === activePassageNumber);
  const passage = (test?.sections?.reading?.passages || []).find((item: any) => Number(item.passageNumber) === activePassageNumber);
  const passageText = getReadingPassage(test, activePassageNumber);
  const moveQuestion = (questionId: string) => {
    const index = questions.findIndex((question: any) => String(question.id) === questionId);
    if (index >= 0) {
      const nextPassage = Number(questions[index].passageNumber || 1);
      setActivePassageNumber(nextPassage);
      setCurrentIndex(index);
    }
  };
  const changePassage = (number: number) => {
    const firstQuestionId = questionIdsByPassage[String(number)]?.[0];
    setActivePassageNumber(number);
    if (firstQuestionId) moveQuestion(firstQuestionId);
  };

  return (
    <div className="reading-workspace">
      <ResizableSplitPane
        workspaceKey={`ielts-reading:${userId}`}
        leftLabel={`Reading passage ${activePassageNumber}`}
        rightLabel={`Reading questions for passage ${activePassageNumber}`}
        defaultLeftPercent={50}
        minLeftPercent={35}
        maxLeftPercent={65}
        left={<div className="space-y-3">
          <div className="sticky top-0 z-10 rounded-lg border bg-white p-3 dark:border-slate-600 dark:bg-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-white">{passage?.title || `Passage ${activePassageNumber}`}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">Passage {activePassageNumber} of {passageNumbers.length || 1}</p>
            <nav className="mt-2 flex flex-wrap gap-2" aria-label="Passage navigation">
              {passageNumbers.map(number => <button key={number} type="button" onClick={() => changePassage(number)} aria-current={activePassageNumber === number ? 'page' : undefined} className={`rounded border px-3 py-1.5 ${activePassageNumber === number ? 'bg-blue-600 text-white' : 'dark:border-slate-600 dark:text-slate-100'}`}>Passage {number}</button>)}
            </nav>
          </div>
          {passageText.trim()
            ? <div ref={passagePaneRef} onScroll={event => { passageScroll.current[String(activePassageNumber)] = event.currentTarget.scrollTop; }} className="reading-workspace__scroll rounded-lg bg-white p-5 dark:bg-slate-800">
                <p className="whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-100">{passageText}</p>
              </div>
            : <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100" role="status">The passage text for Passage {activePassageNumber} is not available. Please ask your teacher to complete this reading content.</div>}
        </div>}
        right={<div className="space-y-4">
          <div className="rounded-lg border bg-white p-3 dark:border-slate-600 dark:bg-slate-800">
            <h3 className="font-bold text-slate-800 dark:text-white">Questions for Passage {activePassageNumber}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">{passageQuestions.length} question(s) · {questions.length} total</p>
            <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-8" aria-label="Question navigator">
              {questionIdsByPassage[String(activePassageNumber)]?.map(questionId => {
                const index = questions.findIndex((question: any) => String(question.id) === questionId);
                const question = questions[index];
                const answered = isAnswerPresent(answers[question.id]);
                return <button key={questionId} type="button" aria-current={activeQuestionId === questionId ? 'step' : undefined} aria-label={`Question ${index + 1}, ${answered ? 'answered' : 'unanswered'}${visitedQuestionIds.includes(questionId) ? ', visited' : ''}`} onClick={() => moveQuestion(questionId)} className={`rounded border px-2 py-1 text-sm ${activeQuestionId === questionId ? 'bg-blue-600 text-white' : answered ? 'border-emerald-500 text-emerald-800 dark:text-emerald-200' : 'dark:border-slate-600 dark:text-slate-100'}`}>{index + 1}</button>;
              })}
            </div>
          </div>
          {passageQuestions.length && currentQuestion ? (
            <div ref={questionPaneRef} onScroll={event => { questionScroll.current[String(activePassageNumber)] = event.currentTarget.scrollTop; }} className="reading-workspace__scroll space-y-4 rounded-lg border bg-white p-5 dark:border-slate-600 dark:bg-slate-800">
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-300">{IELTS_QUESTION_FORMATS.find(item => item[0] === currentQuestion.questionType)?.[1] || currentQuestion.questionType || 'Reading question'} · Question {currentIndex + 1} of {questions.length}</p>
                <p className="mt-2 whitespace-pre-wrap font-medium text-slate-800 dark:text-slate-100"><FormattedQuestionText text={currentQuestion.text || 'Question prompt'} /></p>
                <PromptFigure question={currentQuestion} assessmentId={test?.practiceSourceTestId || test?.id || 'unknown'} />
              </div>
              {renderAnswerInput()}
              <div className="flex justify-between gap-2 border-t pt-3 dark:border-slate-600">
                <button type="button" onClick={() => moveQuestion(String(questions[currentIndex - 1]?.id || ''))} disabled={disabled || currentIndex === 0} className="rounded border px-3 py-2 disabled:opacity-50">Previous question</button>
                <button type="button" onClick={() => moveQuestion(String(questions[currentIndex + 1]?.id || ''))} disabled={disabled || currentIndex >= questions.length - 1} className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50">Next question</button>
              </div>
            </div>
          ) : <p className="rounded-lg border border-dashed p-5 text-slate-600 dark:border-slate-600 dark:text-slate-300">No questions are assigned to Passage {activePassageNumber}.</p>}
        </div>}
      />
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
        {questions.filter((question: any) => isAnswerPresent(answers[question.id])).length} of {questions.length} questions answered · {visitedQuestionIds.length} visited
      </p>
    </div>
  );
};

const ExamInterface = ({ test, onComplete, userId, writingResources, writingResourcesError, isDark, onToggleTheme }) => {
  const questions = Array.isArray(test?.questions) ? test.questions : [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [finishConfirmationOpen, setFinishConfirmationOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const [attemptId] = useState(() => crypto.randomUUID());
  const [startedAtMs] = useState(() => Date.now());
  const durationSeconds = Number(test?.durationSeconds);
  const hasTimeLimit = Number.isFinite(durationSeconds) && durationSeconds > 0;
  const [secondsRemaining, setSecondsRemaining] = useState(() => hasTimeLimit ? Math.ceil(durationSeconds) : null);
  const [timeExpired, setTimeExpired] = useState(false);
  const submissionStarted = React.useRef(false);
  const deadlineMs = React.useRef(startedAtMs + (hasTimeLimit ? durationSeconds * 1000 : 0));
  const submitAttemptRef = React.useRef<(autoSubmitted?: boolean) => Promise<void>>(async () => {});
  const currentQuestion = questions[currentIndex] || null;
  const currentResponseType = currentQuestion ? resolveResponseType(normalizeQuestion(currentQuestion as any)) : 'short-text';
  const currentValue = currentQuestion ? answers[currentQuestion.id] ?? '' : '';
  const unansweredCount = questions.filter(question => !isAnswerPresent(answers[question.id])).length;
  const isReadingPractice = test?.practiceMetadata?.kind === 'reading';
  const isWritingQuestion = Boolean(currentQuestion && (
    currentQuestion.section === 'writing'
    || currentQuestion.questionType === 'writing-task'
    || (test?.type === 'IELTS' && [1, 2].includes(Number(currentQuestion.writingTaskType)))
  ));
  const writingTaskType: 1 | 2 = Number(currentQuestion?.writingTaskType || 2) === 1 ? 1 : 2;

  const updateAnswer = (value: unknown) => {
    if (!currentQuestion) return;
    setAnswers(previous => ({ ...previous, [currentQuestion.id]: value }));
  };

  const questionHeader = currentQuestion ? `${currentIndex + 1} / ${questions.length}` : '0 / 0';

  const renderAnswerInput = () => {
    if (!currentQuestion) return null;

    const question = currentQuestion as any;
    const baseClass = 'mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-white';

    if (currentResponseType === 'single-choice') {
      return (
        <div className="mt-3 space-y-2">
          {(question.options || []).map((option: string, optionIndex: number) => (
            <label key={`${question.id}-option-${optionIndex}`} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-600">
              <input
                type="radio"
                name={question.id}
                checked={String(currentValue) === String(option)}
                onChange={() => updateAnswer(option)}
                disabled={timeExpired || isSubmitting}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    }

    if (currentResponseType === 'multiple-select') {
      const selected = Array.isArray(currentValue) ? currentValue : [];
      return (
        <div className="mt-3 space-y-2">
          {(question.options || []).map((option: string, optionIndex: number) => (
            <label key={`${question.id}-option-${optionIndex}`} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-600">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                disabled={timeExpired || isSubmitting}
                onChange={() => {
                  const next = selected.includes(option)
                    ? selected.filter(item => item !== option)
                    : [...selected, option];
                  updateAnswer(next);
                }}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    }

    if (currentResponseType === 'numeric') {
      return <input type="number" value={currentValue as string | number} onChange={event => updateAnswer(event.target.value)} disabled={timeExpired || isSubmitting} className={baseClass} />;
    }

    if (currentResponseType === 'long-text' || currentResponseType === 'short-text') {
      return <textarea value={String(currentValue || '')} onChange={event => updateAnswer(event.target.value)} rows={6} disabled={timeExpired || isSubmitting} className={baseClass} placeholder="Type your response here" />;
    }

    return <input type="text" value={String(currentValue || '')} onChange={event => updateAnswer(event.target.value)} disabled={timeExpired || isSubmitting} className={baseClass} placeholder="Answer" />;
  };

  const handleSubmit = async (autoSubmitted = false) => {
    if (submissionStarted.current) return;
    submissionStarted.current = true;
    setIsSubmitting(true);
    setSubmissionError('');
    try {
      await onComplete?.({
        attemptId,
        answers,
        startedAtMs,
        submittedAt: new Date().toISOString(),
        isAutoSubmitted: autoSubmitted,
      });
    } catch (error) {
      console.error('Failed to submit assessment:', error);
      setSubmissionError(error instanceof Error ? error.message : 'Could not submit your answers. Please try again.');
      submissionStarted.current = false;
      setIsSubmitting(false);
    }
  };
  submitAttemptRef.current = handleSubmit;

  useEffect(() => {
    if (!hasTimeLimit) return undefined;
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((deadlineMs.current - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        setTimeExpired(true);
        setFinishConfirmationOpen(false);
        void submitAttemptRef.current(true);
        return true;
      }
      return false;
    };
    if (updateTimer()) return undefined;
    const timer = window.setInterval(() => {
      if (updateTimer()) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasTimeLimit]);

  if (!questions.length) {
    return (
      <section className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 text-left shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">No questions available</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-300">This assessment does not contain any public questions yet.</p>
      </section>
    );
  }

  return (
    <>
    <Modal
      isOpen={finishConfirmationOpen}
      title="Finish and submit exam?"
      onClose={() => { if (!isSubmitting) setFinishConfirmationOpen(false); }}
      actions={[
        { label: 'Keep working', onClick: () => setFinishConfirmationOpen(false), disabled: isSubmitting },
        { label: isSubmitting ? 'Submitting…' : 'Submit answers', onClick: handleSubmit, disabled: isSubmitting },
      ]}
    >
      <p>
        Are you sure you want to finish <strong>{test?.title || 'this exam'}</strong>? You will not be able to change your answers after submitting.
      </p>
      {unansweredCount > 0 && (
        <p className="mt-3 font-medium text-amber-700 dark:text-amber-300" role="status">
          {unansweredCount} {unansweredCount === 1 ? 'question is' : 'questions are'} unanswered.
        </p>
      )}
      {submissionError && <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{submissionError}</p>}
    </Modal>
    <section className={`${isWritingQuestion ? 'exam-interface--writing' : 'mx-auto max-w-4xl'} rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm dark:border-slate-700 dark:bg-slate-800`}>
      <div className="exam-interface__header mb-5 flex items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">Exam</p>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">{test?.title || 'Practice exam'}</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-800 shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
          </button>
          {hasTimeLimit ? (
            <span
              role="timer"
              aria-label={`Time remaining ${formatTime(secondsRemaining)}`}
              className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${secondsRemaining <= 300 ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'}`}
            >
              <Clock className="mr-1 inline h-4 w-4" />{formatTime(secondsRemaining)}
            </span>
          ) : <span className="text-sm text-slate-500 dark:text-slate-400">No time limit</span>}
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{questionHeader}</span>
        </div>
      </div>

      {timeExpired && (
        <p className="mb-4 text-sm font-medium text-amber-800 dark:text-amber-200" role={submissionError ? 'alert' : 'status'}>
          {submissionError ? `Time expired, but submission could not be completed: ${submissionError}` : 'Time is up. Your answers are being submitted.'}
        </p>
      )}

      {isReadingPractice ? (
        <ReadingPracticeWorkspace
          test={test}
          userId={userId}
          questions={questions}
          answers={answers}
          currentIndex={currentIndex}
          setCurrentIndex={setCurrentIndex}
          currentQuestion={currentQuestion}
          renderAnswerInput={renderAnswerInput}
          disabled={timeExpired || isSubmitting}
        />
      ) : isWritingQuestion ? <ResizableSplitPane
        workspaceKey={`exam-writing-v2:${userId}:${test?.id}:${currentQuestion.id}`}
        leftLabel="Writing task and response"
        rightLabel="Vocabulary resource"
        className="exam-writing-workspace"
        defaultLeftPercent={50}
        minLeftPercent={35}
        maxLeftPercent={65}
        left={<div className="space-y-5">
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700/50">
            <p className="whitespace-pre-wrap text-base font-medium text-slate-800 dark:text-slate-100"><FormattedQuestionText text={currentQuestion.text || 'Question prompt'} /></p>
            <PromptFigure question={currentQuestion} assessmentId={test?.id || 'unknown'} />
          </div>
          {renderAnswerInput()}
        </div>}
        right={<aside className="space-y-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-700/50">
          <h3 className="font-semibold text-slate-800 dark:text-white">Vocabulary resource</h3>
          {writingResourcesError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">Could not load writing resources: {writingResourcesError}</p>}
          <WritingResourceTable
            resources={writingResources || []}
            taskType={writingTaskType}
            assessmentId={test?.practiceSourceTestId || test?.id}
            questionId={currentQuestion.id}
          />
        </aside>}
      /> : <div className="space-y-5">
        <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700/50">
          <p className="whitespace-pre-wrap text-base font-medium text-slate-800 dark:text-slate-100"><FormattedQuestionText text={currentQuestion.text || 'Question prompt'} /></p>
          <PromptFigure question={currentQuestion} assessmentId={test?.id || 'unknown'} />
        </div>

        {renderAnswerInput()}
      </div>}

      <div className="exam-interface__footer mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
        {isReadingPractice ? timeExpired ? (
          <button
            type="button"
            onClick={() => void handleSubmit(true)}
            disabled={isSubmitting || !submissionError}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting…' : 'Retry submission'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setFinishConfirmationOpen(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Finish exam
          </button>
        ) : <>
          <button
            type="button"
            onClick={() => setCurrentIndex(previous => Math.max(0, previous - 1))}
            disabled={currentIndex === 0 || timeExpired || isSubmitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
          >
            Previous
          </button>
          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex(previous => Math.min(questions.length - 1, previous + 1))}
              disabled={timeExpired || isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Next
            </button>
          ) : timeExpired ? (
            <button
              type="button"
              onClick={() => void handleSubmit(true)}
              disabled={isSubmitting || !submissionError}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting…' : 'Retry submission'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setFinishConfirmationOpen(true)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Finish exam
            </button>
          )}
        </>}
      </div>
    </section>
    </>
  );
};

const SpeakingPractice = ({ bank, userId, onBack }) => {
  const prompts = bank?.questions || [];
  const [selectedId, setSelectedId] = useState(prompts[0]?.id || '');
  const selected = prompts.find((item: any) => item.id === selectedId) || prompts[0];
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(`speakingDrafts:${userId}`) || '{}'); } catch { return {}; }
  });
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'preparation' | 'speaking' | 'finished'>('ready');
  const [recording, setRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [speakingAlert, setSpeakingAlert] = useState<null | { title: string; message: string; onClose: () => void }>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const part = Number(selected?.speakingPart || 1);
  const responseSeconds = Number(selected?.responseSeconds || (part === 2 ? 120 : 60));
  const preparationSeconds = Number(selected?.preparationSeconds ?? (part === 2 ? 60 : 0));

  useEffect(() => {
    try { localStorage.setItem(`speakingDrafts:${userId}`, JSON.stringify(drafts)); } catch { /* Device storage may be unavailable. */ }
  }, [drafts, userId]);

  useEffect(() => {
    if (phase !== 'preparation' && phase !== 'speaking') return;
    const timer = window.setInterval(() => setSeconds(previous => {
      if (previous <= 1) {
        window.clearInterval(timer);
        if (phase === 'preparation') { setPhase('speaking'); return responseSeconds; }
        if (recorderRef.current?.state === 'recording') { recorderRef.current.stop(); setRecording(false); }
        setPhase('finished');
        return 0;
      }
      return previous - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [phase, responseSeconds]);

  useEffect(() => () => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, [recordingUrl]);

  const showStudentAlert = async (title: string, message: string) => {
    await new Promise<void>(resolve => {
      setSpeakingAlert({ title, message, onClose: () => { setSpeakingAlert(null); resolve(); } });
    });
  };

  const choosePrompt = (id: string) => { setSelectedId(id); setPhase('ready'); setSeconds(0); setRecordingUrl(''); };
  const begin = () => {
    setRecordingUrl('');
    if (preparationSeconds > 0) { setPhase('preparation'); setSeconds(preparationSeconds); }
    else { setPhase('speaking'); setSeconds(responseSeconds); }
  };
  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setRecordingUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };
      recorder.start();
      setRecording(true);
    } catch {
      await showStudentAlert('Microphone unavailable', 'Microphone access was not available. You can still practise by speaking aloud and writing a short reflection.');
    }
  };
  const stopRecording = () => { recorderRef.current?.stop(); setRecording(false); };

  if (!selected) return <section className="space-y-4"><p>No Speaking prompts are available.</p><button onClick={onBack} className="px-3 py-2 rounded border">Back</button></section>;
  return <>
    {speakingAlert && (
      <Modal isOpen={true} title={speakingAlert.title} onClose={speakingAlert.onClose}>
        <p className="whitespace-pre-wrap text-left">{speakingAlert.message}</p>
      </Modal>
    )}
    <section className="space-y-5 text-left">
    <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">IELTS Speaking practice</h2><p className="text-sm text-slate-500">Original, unofficial prompts. This tool does not calculate an official speaking score.</p></div><button onClick={onBack} className="px-3 py-2 rounded-lg border dark:border-slate-600">Back</button></div>
    <label className="block max-w-3xl text-sm font-semibold">Prompt
      <select value={selected.id} onChange={event => choosePrompt(event.target.value)} className="mt-1 w-full p-3 rounded-lg border dark:bg-slate-700 dark:border-slate-600">
        {prompts.map((prompt: any) => <option key={prompt.id} value={prompt.id}>Part {prompt.speakingPart}: {prompt.text.slice(0, 90)}</option>)}
      </select>
    </label>
    <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 space-y-4">
      <p className="font-semibold whitespace-pre-wrap">Part {part} · {selected.text}</p>
      <div className="flex items-center gap-3"><button onClick={begin} disabled={phase === 'preparation' || phase === 'speaking'} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50">{phase === 'ready' ? (preparationSeconds ? `Start ${preparationSeconds}s preparation` : 'Start response timer') : phase === 'finished' ? 'Start again' : phase === 'preparation' ? 'Preparing…' : 'Speaking…'}</button><span className="font-mono text-lg" role="timer">{['preparation', 'speaking'].includes(phase) ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '—'}</span>{phase === 'preparation' && <span className="text-sm text-slate-500">Preparation time</span>}{phase === 'speaking' && <span className="text-sm text-slate-500">Response time</span>}</div>
      <label className="block text-sm font-medium">Speaking notes / reflection
        <textarea value={drafts[selected.id] || ''} onChange={event => setDrafts(previous => ({ ...previous, [selected.id]: event.target.value }))} rows={5} placeholder="After speaking, note what went well and what you want to improve." className="mt-1 w-full p-3 rounded-lg border dark:bg-slate-700 dark:border-slate-600" />
      </label>
      <div className="flex flex-wrap items-center gap-3"><button onClick={recording ? stopRecording : startRecording} disabled={phase === 'preparation'} className="px-4 py-2 rounded border disabled:opacity-50">{recording ? 'Stop recording' : 'Record locally'}</button><span className="text-xs text-slate-500">Recording stays in this page and is not uploaded. It is cleared when you leave or refresh.</span>{recordingUrl && <audio controls src={recordingUrl} />}</div>
      {typeof MediaRecorder === 'undefined' && <p className="text-xs text-slate-500">Audio recording is not supported by this browser; use the notes box to review your response.</p>}
    </div>
  </section>
  </>
};

const IELTS_SPEAKING_BANK = { questions: [
  { id: 'sp_p1_routine', speakingPart: 1, text: 'What is the busiest part of your usual day? Why?', responseSeconds: 45 },
  { id: 'sp_p1_learning', speakingPart: 1, text: 'What is something you recently learned to do? How did you learn it?', responseSeconds: 45 },
  { id: 'sp_p1_place', speakingPart: 1, text: 'Is there a place in your town where you like to spend time? What makes it pleasant?', responseSeconds: 45 },
  { id: 'sp_p2_skill', speakingPart: 2, text: 'Describe a useful skill you learned. Say what the skill is, when and how you learned it, who helped you, and explain how you use it now.', preparationSeconds: 60, responseSeconds: 120 },
  { id: 'sp_p3_teaching', speakingPart: 3, text: 'Should practical skills be taught at school? Explain your view with an example.', responseSeconds: 90 },
  { id: 'sp_p3_independent', speakingPart: 3, text: 'How has online learning changed the way adults develop new skills?', responseSeconds: 90 },
  { id: 'sp_p3_lifelong', speakingPart: 3, text: 'Why might people continue learning after they finish formal education?', responseSeconds: 90 },
] };

const PracticeHub = ({ tests, resources, resourceError, user, onStartTest }) => {
  const [subject, setSubject] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [readingMode, setReadingMode] = useState('question-type');
  const [readingType, setReadingType] = useState('');
  const [passageNumber, setPassageNumber] = useState(1);
  const [listeningSection, setListeningSection] = useState('all');
  const [satDomain, setSatDomain] = useState('');
  const [satSkill, setSatSkill] = useState('');
  const [satDifficulty, setSatDifficulty] = useState('all');
  const [satQuestionCount, setSatQuestionCount] = useState('all');
  const [satMode, setSatMode] = useState('skill');
  const [satFullTestId, setSatFullTestId] = useState('');

  const ieltsTests = tests.filter(test => test.type === 'IELTS' && (test.questions || []).length > 0);
  const satTests = tests.filter(test => test.type === 'SAT' && (test.questions || []).length > 0);
  const satFullTests = satTests.filter(test => {
    const section = test.sections?.sat?.section;
    const count = test.questions?.length || 0;
    const expected = section === 'reading-writing' ? 54 : section === 'math' ? 44 : 0;
    const moduleSize = section === 'reading-writing' ? 27 : 22;
    return expected > 0 && count === expected && test.questions?.filter(question => question.satModule === 1).length === moduleSize && test.questions?.filter(question => question.satModule === 2).length === moduleSize;
  });
  const selectedSatFullTest = satFullTests.find(test => test.id === satFullTestId) || satFullTests[0];
  const sourceTests = subject === 'sat' ? satTests : ieltsTests;
  const selectedTest = sourceTests.find(test => test.id === sourceId) || sourceTests[0];

  useEffect(() => {
    setSourceId('');
    setReadingType('');
    setSatDomain('');
    setSatSkill('');
    setSatDifficulty('all');
    setSatQuestionCount('all');
  }, [subject]);

  const readingQuestions = (test) => (test?.questions || []).filter(question => {
    if (question.section) return question.section === 'reading';
    return Boolean(test.sections?.reading?.passage || test.sections?.reading?.passages?.some(passage => passage.content));
  });
  const listeningQuestions = (test) => (test?.questions || []).filter(question => {
    if (question.section) return question.section === 'listening';
    return Boolean(test.sections?.listening?.audioUrl || test.sections?.listening?.parts?.some(part => part.audioUrl));
  });
  const distinct = (values: any[]): any[] => [...new Set(values.filter(Boolean))];
  const readingTypes = distinct(readingQuestions(selectedTest).map(question => question.questionType));
  const readingQuestionsAll = readingQuestions(selectedTest);
  const readingPassageOptions = distinct([
    ...(selectedTest?.sections?.reading?.passages || []).map((passage: any) => Number(passage.passageNumber)),
    ...readingQuestionsAll.map(question => Number(question.passageNumber || 1)),
  ]).sort((a, b) => a - b);
  const readingPassageIssues = readingQuestionsAll.filter(question => !getReadingPassage(selectedTest, Number(question.passageNumber || 1)).trim());
  const readingQuestionsForMode = readingQuestions(selectedTest).filter(question => {
    if (readingMode === 'question-type') return Boolean(readingType) && question.questionType === readingType;
    if (readingMode === 'passage') return (question.passageNumber || 1) === passageNumber;
    return true;
  });
  const readingFullReady = readingQuestionsAll.length > 0
    && readingPassageOptions.some(number => getReadingPassage(selectedTest, number).trim() && readingQuestionsAll.some(question => Number(question.passageNumber || 1) === number))
    && readingPassageIssues.length === 0;
  const listeningQuestionsForMode = listeningQuestions(selectedTest).filter(question => listeningSection === 'all' || (question.listeningSectionNumber || 1) === Number(listeningSection));
  const allListeningQuestions = listeningQuestions(selectedTest);
  const listeningFullReady = allListeningQuestions.length === 40
    && [1, 2, 3, 4].every(number => getListeningAudioUrl(selectedTest, number) && allListeningQuestions.filter(question => (question.listeningSectionNumber || 1) === number).length === 10);

  const launchPractice = (test, questions, durationSeconds, title, practiceMetadata) => {
    if (!test || questions.length === 0) return;
    const orderedQuestions = [...questions].sort((a, b) => {
      if (practiceMetadata.kind === 'reading') return (a.passageNumber || 1) - (b.passageNumber || 1);
      if (practiceMetadata.kind === 'listening') return (a.listeningSectionNumber || 1) - (b.listeningSectionNumber || 1);
      return 0;
    });
    onStartTest({
      ...test,
      practiceSourceTestId: test.id,
      practiceSourceTestIds: practiceMetadata.sourceTestIds || [test.id],
      id: `practice-${test.id}-${Date.now()}`,
      title,
      durationSeconds,
      questions: orderedQuestions,
      isPractice: true,
      practiceMetadata
    });
  };

  if (subject === 'writing') return <WritingPractice tests={ieltsTests} resources={resources} resourceError={resourceError} userId={user?.uid} onBack={() => setSubject('')} />;
  if (subject === 'speaking') return <SpeakingPractice bank={IELTS_SPEAKING_BANK} userId={user?.uid} onBack={() => setSubject('')} />;

  if (!subject) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          ['reading', 'IELTS Reading', 'Practice by question type, passage, or all three passages.'],
          ['listening', 'IELTS Listening', 'Practice one listening section or all four continuously.'],
          ['writing', 'IELTS Writing', 'Work on Task 1 or Task 2 with a checklist and optional coaching.'],
          ['speaking', 'IELTS Speaking', 'Practise Parts 1, 2, and 3 with preparation, response timing, notes, and optional local audio recording.'],
          ['sat', 'SAT Skills', 'Practice Reading and Writing or Math by domain and skill.']
        ].map(([id, title, description]) => <button key={id} onClick={() => setSubject(id)} className="p-6 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left hover:border-blue-400"><h3 className="font-bold text-slate-800 dark:text-white">{title}</h3><p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{description}</p></button>)}
      </div>
    );
  }

  const startReading = () => {
    const allQuestions = readingQuestions(selectedTest);
    let matching = allQuestions;
    let title = `${selectedTest?.title || 'IELTS Reading'} — Practice`;
    let duration = selectedTest?.durationSeconds || 20 * 60;
    if (readingMode === 'question-type') {
      matching = allQuestions.filter(question => question.questionType === readingType);
      title += ` — ${readingType}`;
      duration = 20 * 60;
    } else if (readingMode === 'passage') {
      matching = allQuestions.filter(question => (question.passageNumber || 1) === passageNumber);
      title += ` — Passage ${passageNumber}`;
      duration = 20 * 60;
    } else {
      matching = readingQuestionsForMode;
      title += ' — Full Reading Practice';
      duration = 60 * 60;
    }
    launchPractice(selectedTest, matching, duration, title, { kind: 'reading', mode: readingMode, questionType: readingType, passageNumber: readingMode === 'passage' ? passageNumber : null });
  };

  const startListening = () => {
    const matching = listeningQuestionsForMode;
    const duration = listeningSection === 'all'
      ? (selectedTest?.durationSeconds || 30 * 60)
      : Math.ceil((selectedTest?.durationSeconds || 30 * 60) / 4);
    launchPractice(selectedTest, matching, duration, `${selectedTest?.title || 'IELTS Listening'} — ${listeningSection === 'all' ? 'All Sections' : `Section ${listeningSection}`}`, { kind: 'listening', section: listeningSection });
  };

  const startSat = () => {
    const available = satMatchingQuestions;
    const matching = satQuestionCount === 'all' ? available : available.slice(0, Number(satQuestionCount));
    launchPractice(selectedTest, matching, selectedTest?.durationSeconds || 15 * 60, `${selectedTest?.title || 'SAT'} — ${satSkill}`, { kind: 'sat', domain: satDomain, skill: satSkill });
  };

  const startFullSat = () => {
    if (!selectedSatFullTest) return;
    const section = selectedSatFullTest.sections?.sat?.section;
    const moduleSize = section === 'reading-writing' ? 27 : 22;
    const moduleDurationSeconds = Math.round(Number(selectedSatFullTest.durationSeconds || 0) / 2);
    launchPractice(
      selectedSatFullTest,
      selectedSatFullTest.questions || [],
      selectedSatFullTest.durationSeconds || 0,
      `Digital SAT ${section === 'math' ? 'Math' : 'Reading and Writing'} — full-length practice`,
      { kind: 'sat-full-length', section, moduleSize, moduleDurationSeconds, scoreNotice: 'Unofficial practice; no SAT scaled score.' },
    );
  };

  const startCombinedSat = () => {
    const readingWriting = satFullTests.find(test => test.sections?.sat?.section === 'reading-writing');
    const math = satFullTests.find(test => test.sections?.sat?.section === 'math');
    if (!readingWriting || !math) return;
    const questions = [...readingWriting.questions, ...math.questions];
    if (questions.length !== 98 || new Set(questions.map(question => question.id)).size !== 98) return;
    const modulePlan = [
      { start: 0, end: 27, durationSeconds: 32 * 60, label: 'Reading and Writing Module 1' },
      { start: 27, end: 54, durationSeconds: 32 * 60, label: 'Reading and Writing Module 2', breakAfter: true },
      { start: 54, end: 76, durationSeconds: 35 * 60, label: 'Math Module 1' },
      { start: 76, end: 98, durationSeconds: 35 * 60, label: 'Math Module 2' },
    ];
    launchPractice(readingWriting, questions, 134 * 60, 'Digital SAT — combined full-length practice', {
      kind: 'sat-combined', section: 'combined', modulePlan, breakSeconds: 10 * 60,
      sourceTestIds: [readingWriting.id, math.id],
      scoreNotice: 'Unofficial practice only. Module progression is fixed; no adaptive routing or official SAT scaled score is calculated.',
    });
  };

  const emptyBank = subject === 'reading' ? readingQuestions(selectedTest).length === 0
      : subject === 'listening' ? listeningQuestions(selectedTest).length === 0
    : subject === 'sat' ? (selectedTest?.questions || []).filter(question => question.satDomain && question.satSkill).length === 0
    : false;
  const satMatchingQuestions = (selectedTest?.questions || []).filter(question => question.satDomain === satDomain && question.satSkill === satSkill && (satDifficulty === 'all' || question.difficulty === satDifficulty));

  return (
    <div className="space-y-5 text-left">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-slate-800 dark:text-white">{subject === 'sat' ? 'SAT Skill Practice' : `IELTS ${subject[0].toUpperCase()}${subject.slice(1)} Practice`}</h2><p className="text-sm text-slate-500 dark:text-slate-400">Choose from published assessments available to your student group.</p></div><button onClick={() => setSubject('')} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200">Back</button></div>
      <label className="block max-w-2xl text-sm font-medium text-slate-700 dark:text-slate-300">Question bank
        <select value={selectedTest?.id || ''} onChange={event => setSourceId(event.target.value)} className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
          {sourceTests.map(test => <option key={test.id} value={test.id}>{test.title}</option>)}
        </select>
      </label>
      {sourceTests.length === 0 ? <p className="p-5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">No published {subject === 'sat' ? 'SAT' : 'IELTS'} question bank is available for your group yet.</p> : (
        <>
          {subject === 'reading' && <div className="space-y-4">
            <label className="block max-w-2xl text-sm font-medium text-slate-700 dark:text-slate-300">Practice mode
              <select value={readingMode} onChange={event => setReadingMode(event.target.value)} className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"><option value="question-type">By question type</option><option value="passage">By passage</option><option value="full">Full Reading (60 minutes)</option></select>
            </label>
            {readingMode === 'question-type' && <label className="block max-w-2xl text-sm font-medium text-slate-700 dark:text-slate-300">Question type
              <select value={readingType} onChange={event => setReadingType(event.target.value)} className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"><option value="">Select a type</option>{readingTypes.map(type => <option key={type} value={type}>{IELTS_QUESTION_FORMATS.find(item => item[0] === type)?.[1] || type}</option>)}</select>
            </label>}
            {readingMode === 'passage' && <label className="block max-w-2xl text-sm font-medium text-slate-700 dark:text-slate-300">Passage<select value={passageNumber} onChange={event => setPassageNumber(Number(event.target.value))} className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">{readingPassageOptions.map(number => <option key={number} value={number}>Passage {number}</option>)}</select></label>}
            {emptyBank && <p className="text-amber-700 dark:text-amber-300">This assessment has no tagged Reading questions yet. A teacher can add them in IELTS Reading and assign a question type and passage number.</p>}
            {readingMode === 'question-type' && !readingTypes.length && !emptyBank && <p className="text-amber-700 dark:text-amber-300">Question-type practice needs published Reading questions with a question-format tag.</p>}
            {readingMode === 'full' && readingPassageIssues.length > 0 && <p className="text-amber-700 dark:text-amber-300" role="alert">{readingPassageIssues.length} Reading question(s) reference missing passage text. Ask your teacher to complete the referenced passage before starting.</p>}
            {readingMode === 'full' && !readingFullReady && <p className="text-amber-700 dark:text-amber-300">A full Reading session needs questions linked to at least one passage with available text.</p>}
            {readingMode !== 'full' && selectedTest && readingMode !== 'question-type' && readingQuestionsForMode.length === 0 && <p className="text-amber-700 dark:text-amber-300">No questions are tagged for Passage {passageNumber} in this assessment yet.</p>}
            <button onClick={startReading} disabled={!selectedTest || emptyBank || readingQuestionsForMode.length === 0 || (readingMode === 'question-type' && !readingType) || (readingMode === 'full' && !readingFullReady)} className="px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50">Start Reading Practice</button>
          </div>}
          {subject === 'listening' && <div className="space-y-4">
            <label className="block max-w-2xl text-sm font-medium text-slate-700 dark:text-slate-300">Practice mode<select value={listeningSection} onChange={event => setListeningSection(event.target.value)} className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"><option value="all">All four sections</option>{[1, 2, 3, 4].map(number => <option key={number} value={number}>Section {number}</option>)}</select></label>
            {emptyBank && <p className="text-amber-700 dark:text-amber-300">This assessment has no tagged Listening questions yet. Add audio and questions to one or more Listening sections in the teacher editor.</p>}
            {selectedTest && listeningSection !== 'all' && listeningQuestionsForMode.length === 0 && <p className="text-amber-700 dark:text-amber-300">No questions are tagged for Listening Section {listeningSection} yet.</p>}
            {selectedTest && listeningSection !== 'all' && listeningQuestionsForMode.length > 0 && !getListeningAudioUrl(selectedTest, Number(listeningSection)) && <p className="text-amber-700 dark:text-amber-300">Add audio for this Listening section before starting practice.</p>}
            {selectedTest && listeningSection === 'all' && !listeningFullReady && <p className="text-amber-700 dark:text-amber-300">A full Listening session requires exactly 40 questions (10 per section) and a tested, verified recording in each section. The pilot bank is not a complete test. You can practise an individual section once its recording is verified.</p>}
            <button onClick={startListening} disabled={!selectedTest || emptyBank || listeningQuestionsForMode.length === 0 || (listeningSection === 'all' ? !listeningFullReady : !getListeningAudioUrl(selectedTest, Number(listeningSection)))} className="px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50">Start Listening Practice</button>
          </div>}
          {subject === 'sat' && <div className="space-y-4">
            <label className="block max-w-2xl text-sm font-medium text-slate-700 dark:text-slate-300">Practice mode<select value={satMode} onChange={event => setSatMode(event.target.value)} className="mt-1 w-full p-3 rounded-lg border dark:bg-slate-700 dark:border-slate-600"><option value="skill">Practice by domain and skill</option><option value="full">Full-length section</option></select></label>
            {satMode === 'full' ? <div className="space-y-4">
              {satFullTests.length > 0 ? <>
                <label className="block max-w-2xl text-sm font-medium">Full-length SAT section<select value={selectedSatFullTest?.id || ''} onChange={event => setSatFullTestId(event.target.value)} className="mt-1 w-full p-3 rounded-lg border dark:bg-slate-700 dark:border-slate-600">{satFullTests.map(test => <option key={test.id} value={test.id}>{test.title} · {test.questions?.length} questions · {Math.floor((test.durationSeconds || 0) / 60)} minutes</option>)}</select></label>
                <p className="text-sm text-amber-700 dark:text-amber-300">Unofficial practice only. The portal does not calculate an official SAT scaled score. Module navigation locks answers from the previous module.</p>
                <button onClick={startFullSat} disabled={!selectedSatFullTest} className="px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50">Start full-length section</button>
                {satFullTests.some(test => test.sections?.sat?.section === 'reading-writing') && satFullTests.some(test => test.sections?.sat?.section === 'math') && <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-2"><h3 className="font-semibold text-slate-800 dark:text-white">Combined Digital SAT practice</h3><p className="text-sm text-slate-600 dark:text-slate-300">98 questions · 134 minutes of testing · optional 10-minute break after Reading and Writing. This fixed practice sequence does not reproduce adaptive routing or official scaled scoring.</p><button onClick={startCombinedSat} className="px-5 py-3 rounded-lg bg-indigo-600 text-white font-semibold">Start combined SAT practice</button></div>}
              </> : <p className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200">No complete full-length SAT section is published for your group. The teacher must publish a 54-question Reading and Writing bank or a 44-question Math bank with 27/27 or 22/22 module tags.</p>}
            </div> : <div className="space-y-4">
            <label className="block max-w-2xl text-sm font-medium text-slate-700 dark:text-slate-300">Domain<select value={satDomain} onChange={event => { setSatDomain(event.target.value); setSatSkill(''); }} className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"><option value="">Choose a domain</option>{Object.keys(SAT_SKILLS).map(domain => <option key={domain} value={domain}>{domain}</option>)}</select></label>
            <label className="block max-w-2xl text-sm font-medium text-slate-700 dark:text-slate-300">Skill<select value={satSkill} onChange={event => setSatSkill(event.target.value)} disabled={!satDomain} className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white disabled:opacity-50"><option value="">Choose a skill</option>{(SAT_SKILLS[satDomain] || []).map(skill => <option key={skill} value={skill}>{skill}</option>)}</select></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Difficulty<select value={satDifficulty} onChange={event => setSatDifficulty(event.target.value)} className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"><option value="all">Any difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Question count<select value={satQuestionCount} onChange={event => setSatQuestionCount(event.target.value)} className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"><option value="all">All matching questions</option><option value="5">5 questions</option><option value="10">10 questions</option><option value="20">20 questions</option></select></label>
            </div>
            {emptyBank && <p className="text-amber-700 dark:text-amber-300">No SAT questions with domain and skill tags are available yet. Ask a teacher to classify SAT questions in the assessment editor.</p>}
            {!emptyBank && satDomain && satSkill && satMatchingQuestions.length === 0 && <p className="text-amber-700 dark:text-amber-300">No questions match that domain, skill, and difficulty. Choose another filter or ask a teacher to add matching content.</p>}
            <button onClick={startSat} disabled={!selectedTest || !satDomain || !satSkill || satMatchingQuestions.length === 0} className="px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50">Start SAT Skill Practice</button>
            </div>}
          </div>}
        </>
      )}
    </div>
  );
};

const StudentDashboard = ({ user, tests, results, writingResources, writingResourcesError, onStartTest, onSaveGroupCode, onLogout }) => {
  const [activeTab, setActiveTab] = useState('tests');
  const [pinModal, setPinModal] = useState({ isOpen: false, test: null, enteredPin: '', error: '' });
  const [groupCodeInput, setGroupCodeInput] = useState(user?.groupCode || '');
  const [isSavingGroupCode, setIsSavingGroupCode] = useState(false);
  const [studentAlert, setStudentAlert] = useState<null | { title: string; message: string; onClose: () => void }>(null);

  const showStudentAlert = async (title: string, message: string) => {
    await new Promise<void>(resolve => {
      setStudentAlert({ title, message, onClose: () => { setStudentAlert(null); resolve(); } });
    });
  };

  const normalizedGroupCode = (user?.groupCode || '').trim().toLowerCase();
  const visibleTests = tests.filter((test) => {
    const testGroupCode = (test.groupCode || '').trim().toLowerCase();
    return testGroupCode === 'all' || (!!normalizedGroupCode && testGroupCode === normalizedGroupCode);
  });

  const saveGroupCode = async () => {
    if (user?.groupCode) return;
    setIsSavingGroupCode(true);
    try {
      await onSaveGroupCode(groupCodeInput.trim().toLowerCase());
    } catch (error) {
      console.error(error);
      await showStudentAlert('Group code not saved', 'Could not save the group code. Please try again.');
    } finally {
      setIsSavingGroupCode(false);
    }
  };

  const hasCompletedTest = (testId) => results.some(r => r.testId === testId);

  const handleStartClick = (test) => {
    if (test.pin && test.pin.trim() !== '') {
      setPinModal({ isOpen: true, test, enteredPin: '', error: '' });
    } else {
      onStartTest(test);
    }
  };

  const submitPin = () => {
    if (pinModal.enteredPin === pinModal.test.pin) {
      onStartTest(pinModal.test);
      setPinModal({ isOpen: false, test: null, enteredPin: '', error: '' });
    } else {
      setPinModal(prev => ({ ...prev, error: 'Incorrect PIN. Please try again.' }));
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 w-full">
        <div className="w-full px-4 sm:px-8 lg:px-12 mx-auto">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span className="font-bold text-xl text-slate-800 dark:text-white">EduPortal</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-full">
                <User className="w-4 h-4" />
                {user?.name || 'Student'}
              </div>
              <button onClick={onLogout} className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-8 lg:px-12 py-8 mx-auto text-left">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Welcome back, {user?.name}!</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Ready to ace your next exam or homework?</p>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-2 max-w-xl">
            <div className="flex-grow">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Your student group code</label>
              <input type="text" value={groupCodeInput} onChange={e => setGroupCodeInput(e.target.value)} disabled={Boolean(user?.groupCode)} placeholder="Enter the code provided by your teacher" className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70" />
            </div>
            <button onClick={saveGroupCode} disabled={isSavingGroupCode || Boolean(user?.groupCode)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium disabled:opacity-60">{isSavingGroupCode ? 'Saving...' : user?.groupCode ? 'Group saved' : 'Save group'}</button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Ask your teacher for the exact code. Group assignment can only be set once from your account.</p>
        </div>

      {studentAlert && (
        <Modal isOpen={true} title={studentAlert.title} onClose={studentAlert.onClose}>
          <p className="whitespace-pre-wrap text-left">{studentAlert.message}</p>
        </Modal>
      )}
      <div className="flex flex-wrap gap-x-4 border-b border-slate-200 dark:border-slate-700 mb-6">
          <button onClick={() => setActiveTab('tests')} className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'tests' ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <LayoutDashboard className="w-4 h-4" /> Available Tasks
          </button>
          <button onClick={() => setActiveTab('results')} className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'results' ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <History className="w-4 h-4" /> Past Results
          </button>
          <button onClick={() => setActiveTab('practice')} className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'practice' ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <Play className="w-4 h-4" /> Practice
          </button>
        </div>

        {activeTab === 'practice' && (
          <div className="space-y-4">
            <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-100">
              Practice is self-directed skill work. IELTS Writing practice includes always-available local suggestions and optional AI coaching. AI coaching is not available during assigned tasks.
            </p>
            <PracticeHub tests={visibleTests} resources={writingResources} resourceError={writingResourcesError} user={user} onStartTest={onStartTest} />
          </div>
        )}

        {activeTab === 'tests' && (
          <>
          <p className="mb-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Available Tasks are assessments assigned by your teacher. They are timed when a time limit is shown, and your submitted answers are sent for review. For coaching and AI suggestions, open Practice instead.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visibleTests.length === 0 && (
               <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400">
                 No exams are available for your group yet. Check that you entered the correct group code.
               </div>
            )}
            {visibleTests.map((test) => {
              const completed = hasCompletedTest(test.id);
              return (
                <div key={test.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col transition-shadow hover:shadow-md">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getStatusColor(test.category)}`}>
                      {test.category} • {test.type}
                    </span>
                    <span className="flex items-center text-slate-500 dark:text-slate-400 text-sm gap-1">
                      <Clock className="w-4 h-4" /> {formatTime(test.durationSeconds)}
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                      {test.pin && <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500" aria-label="PIN required" />} {test.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 flex-grow line-clamp-3">{test.description}</p>
                  
                  <div className="mt-auto">
                    {completed ? (
                      <button disabled className="w-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200 dark:border-slate-600">
                        <Check className="w-5 h-5" /> Completed
                      </button>
                    ) : (
                      <button onClick={() => handleStartClick(test)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
                        <Play className="w-5 h-5" /> Start Task
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}

        {activeTab === 'results' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden max-w-5xl mx-auto">
            {results.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center">
                <FileText className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
                <p>No results yet. Complete a test or homework to see your scores.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {results.map((result, idx) => {
                   const testInfo = tests.find(t => t.id === result.testId) || { title: result.displayTitle || 'Practice Session', type: result.practiceMetadata?.kind || 'Unknown' };
                   return (
                     <div key={idx} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                       <div className="text-left">
                         <div className="flex items-center gap-3 mb-1">
                           <h4 className="font-semibold text-slate-800 dark:text-white">{result.displayTitle || testInfo.title}</h4>
                           <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                             {testInfo.type}
                           </span>
                         </div>
                         <p className="text-sm text-slate-500 dark:text-slate-400">
                           Submitted on: {new Date(result.submittedAt).toLocaleDateString()} at {new Date(result.submittedAt).toLocaleTimeString()}
                         </p>
                         {result.practiceMetadata && <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Practice: {[result.practiceMetadata.domain, result.practiceMetadata.skill, result.practiceMetadata.mode, result.practiceMetadata.questionType].filter(Boolean).join(' • ') || result.practiceMetadata.kind}</p>}
                         {result.questionReviews?.length > 0 && <details className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                           <summary className="cursor-pointer font-medium">Review answers and explanations</summary>
                           <div className="space-y-3 mt-3">{result.questionReviews.map((review, reviewIndex) => <div key={review.questionId || reviewIndex} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                             <p className="font-medium">{reviewIndex + 1}. {review.questionText}</p>
                             <p className="mt-1 whitespace-pre-wrap">Your answer: {renderTeacherAnnotatedAnswer(review.studentAnswer, review.teacherReview?.annotations)}</p>
                             {review.status === 'graded' ? <p className={review.isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>{review.isCorrect ? 'Correct' : `Incorrect. Answer key: ${formatAnswerForReview(review.answerKey)}`}{review.earnedPoints > 0 && !review.isCorrect ? ` — ${review.earnedPoints} / ${review.points} points` : ''}{review.acceptedAnswers?.length ? ` (also accepted: ${review.acceptedAnswers.join(', ')})` : ''}</p>
                               : review.status === 'manual-review' ? <div className="text-amber-700 dark:text-amber-300">{review.teacherReview?.reviewedAt ? <p>Teacher reviewed this response{review.teacherReview.points != null ? ` · awarded ${review.teacherReview.points}/${review.points} points` : ''}.</p> : <p>Awaiting teacher review; excluded from the automatic score.</p>}{review.teacherReview?.feedback && <p className="mt-1 text-slate-700 dark:text-slate-200">Teacher feedback: {review.teacherReview.feedback}</p>}</div>
                                 : review.status === 'ungraded' ? <p>This response is ungraded practice.</p>
                                   : <p>Unanswered.</p>}
                             {review.teacherReview?.annotations?.length > 0 && <section className="mt-3 space-y-2" aria-label="Teacher comments on your response">
                               <h5 className="font-semibold text-slate-800 dark:text-slate-100">Comments on your writing</h5>
                               {review.teacherReview.annotations.map((annotation, annotationIndex) => <article key={annotation.id || annotationIndex} className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                                 <blockquote className="border-l-2 border-amber-500 pl-3 font-medium text-slate-800 dark:text-slate-100">“{annotation.quote}”</blockquote>
                                 <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">{annotation.comment}</p>
                               </article>)}
                             </section>}
                             {review.explanation && <p className="mt-1">{review.explanation}</p>}
                           </div>)}</div>
                         </details>}
                       </div>
                       <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                         <div className="text-center">
                           <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Your Results</div>
                           <div className="font-bold text-xl text-blue-600 dark:text-blue-400">
                           {result.score == null ? '—' : result.score} <span className="text-sm text-slate-400 dark:text-slate-500 font-normal">/ {result.maxPossibleScore == null ? '—' : result.maxPossibleScore}</span>
                           </div>
                           {(result.manualReviewCount > 0 || result.ungradedCount > 0) && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{result.manualReviewCount ? `${result.manualReviewCount} awaiting review` : ''}{result.manualReviewCount && result.ungradedCount ? ' · ' : ''}{result.ungradedCount ? `${result.ungradedCount} ungraded` : ''}</p>}
                         </div>
                       </div>
                     </div>
                   );
                })}
              </div>
            )}
          </div>
        )}

        <Modal isOpen={pinModal.isOpen} title="Enter Secret PIN" onClose={() => setPinModal({ isOpen: false, test: null, enteredPin: '', error: '' })}>
          <p className="text-slate-600 dark:text-slate-300 mb-4 text-left">This assessment is protected. Please enter the PIN provided by your teacher to begin.</p>
          <input
            type="text"
            value={pinModal.enteredPin}
            onChange={(e) => setPinModal(prev => ({ ...prev, enteredPin: e.target.value, error: '' }))}
            onKeyDown={(e) => e.key === 'Enter' && submitPin()}
            placeholder="e.g. NUET2026"
            className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white mb-2 focus:ring-2 focus:ring-blue-500 outline-none text-left"
            autoFocus
          />
          {pinModal.error && <p className="text-red-500 dark:text-red-400 text-sm mb-4 text-left">{pinModal.error}</p>}
          <div className="mt-4 flex gap-3">
             <button onClick={() => setPinModal({ isOpen: false, test: null, enteredPin: '', error: '' })} className="px-4 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-medium rounded-lg transition-colors">
              Cancel
             </button>
            <button onClick={submitPin} className="flex-grow bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors shadow-sm">
              Unlock Assessment
            </button>
          </div>
        </Modal>

      </main>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [tests, setTests] = useState<any[]>([]);
  const [writingResources, setWritingResources] = useState<WritingResource[]>([]);
  const [writingResourcesError, setWritingResourcesError] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState('');
  const [currentView, setCurrentView] = useState('loading');
  const [activeTest, setActiveTest] = useState<any>(null);
  const [modalInfo, setModalInfo] = useState({ isOpen: false, title: '', message: '' });
  
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    if (!auth) {
      setLoadingAuth(false);
      setCurrentView('login');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profileRef = doc(db, 'artifacts', appId, 'users', firebaseUser.uid, 'profile', 'info');
          const profileSnap = await getDoc(profileRef);
          
          if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            const role = await resolveAccountRole(profileRef, firebaseUser, profileData.role);
            const userData = { uid: firebaseUser.uid, ...profileData, role, email: firebaseUser.email };
            setUser(userData);
            let savedExam = null;
            try { savedExam = JSON.parse(localStorage.getItem(`activeExam:${firebaseUser.uid}`) || 'null'); } catch { savedExam = null; }
            if (role === 'student' && savedExam?.questions?.length) {
              setActiveTest(savedExam);
              setCurrentView('exam');
            } else {
              setActiveTest(null);
              setCurrentView(role === 'teacher' ? 'teacher_dashboard' : 'student_dashboard');
            }
          } else {
            setUser(null);
            setCurrentView('login');
          }
        } catch (err) {
          console.error("Error fetching profile:", err);
          setCurrentView('login');
        }
      } else {
        setCurrentView('login');
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setWritingResources([]);
      setWritingResourcesError('');
      return;
    }
    const testsRef = collection(db, 'artifacts', appId, 'public', 'data', 'tests');
    const testsQuery = user.role === 'teacher'
      ? testsRef
          : query(
              testsRef,
              where('answerKeysSecured', '==', true),
              where('published', '==', true),
              where('groupCode', 'in', user.groupCode
                ? [...new Set([user.groupCode.trim().toLowerCase(), 'all'])]
                : ['all'])
            );
    const unsubTests = onSnapshot(testsQuery, async (snapshot) => {
      let testsData: any[] = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      if (user.role === 'teacher') {
        testsData = await Promise.all(testsData.map(async test => {
          const keySnapshot = await getDoc(doc(db, 'artifacts', appId, 'teacher', 'data', 'answerKeys', test.id));
          return keySnapshot.exists() ? {
            ...test,
            teacherKeyComplete: hasCompleteAnswerKey(test.questions || [], keySnapshot.data().questions || []),
            sections: mergeTeacherSections(test.sections, keySnapshot.data().teacherSections),
            questions: mergeQuestionKeys(test.questions || [], keySnapshot.data().questions || []),
          } : { ...test, teacherKeyComplete: false };
        }));
      }
      testsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTests(testsData);
    }, err => console.error(err));

    const resourcesRef = collection(db, 'artifacts', appId, 'public', 'data', 'writingResources');
    const resourcesQuery = user.role === 'teacher' ? resourcesRef : query(resourcesRef, where('status', '==', 'published'));
    setWritingResourcesError('');
    const unsubWritingResources = onSnapshot(resourcesQuery, snapshot => {
      setWritingResources(snapshot.docs.map(item => ({ ...item.data(), id: item.id })) as WritingResource[]);
    }, error => {
      console.error('Could not load writing resources:', error);
      setWritingResourcesError(error.message || 'Permission or network error.');
      setWritingResources([]);
    });

    let unsubResults = () => {};
    let unsubSubmissions = () => {};
    if (user.role === 'student') {
      const resultsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'results');
      unsubResults = onSnapshot(resultsRef, (snapshot) => {
        const data: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        setResults(data);
      }, err => console.error(err));
    }

    if (user.role === 'teacher') {
      setSubmissionsLoading(true);
      setSubmissionsError('');
      const submissionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'submissions');
      unsubSubmissions = onSnapshot(query(submissionsRef, orderBy('submittedAtMs', 'desc'), limit(500)), (snapshot) => {
        setSubmissions(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
        setSubmissionsLoading(false);
      }, error => { setSubmissionsError(error.message || 'Permission or network error.'); setSubmissionsLoading(false); });
    } else {
      setSubmissions([]);
    }

    return () => { unsubTests(); unsubResults(); unsubSubmissions(); unsubWritingResources(); };
  }, [user]);

  const handleAuthAction = async (action, data) => {
    if (!auth) return;
    
    if (action === 'signup') {
      const userCred = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const uid = userCred.user.uid;
      const profileRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'info');
      const role = 'student';
      await setDoc(profileRef, { name: data.name, role, groupCode: (data.groupCode || '').trim().toLowerCase(), createdAt: serverTimestamp() });
      const resolvedRole = await resolveAccountRole(profileRef, userCred.user, role);
      
      setUser({ uid, name: data.name, role: resolvedRole, groupCode: (data.groupCode || '').trim().toLowerCase() });
      setCurrentView(resolvedRole === 'teacher' ? 'teacher_dashboard' : 'student_dashboard');
    } else if (action === 'login') {
      await signInWithEmailAndPassword(auth, data.email, data.password);
    } else if (action === 'google') {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCred = await signInWithPopup(auth, provider);

      if (data.isSignup && data.role === 'teacher' && !isClientAuthorizedTeacher(userCred.user)) {
        await signOut(auth);
        throw new Error('This Google account is not approved for teacher access. Choose Student or use one of the four approved Google accounts.');
      }

      const uid = userCred.user.uid;
      const requestedRole = data.isSignup ? data.role : 'student';
      
      const profileRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'info');
      const profileSnap = await getDoc(profileRef);
      
      if (!profileSnap.exists()) {
        const role = 'student';
        const groupCode = (data.groupCode || '').trim().toLowerCase();
        await setDoc(profileRef, { name: userCred.user.displayName || 'New User', role, groupCode, createdAt: serverTimestamp() });
        const resolvedRole = await resolveAccountRole(profileRef, userCred.user, role, requestedRole);
        setUser({ uid, name: userCred.user.displayName, role: resolvedRole, groupCode });
        setCurrentView(resolvedRole === 'teacher' ? 'teacher_dashboard' : 'student_dashboard');
      } else {
        const existingData = profileSnap.data();
        const role = await resolveAccountRole(profileRef, userCred.user, existingData.role, requestedRole);
        setUser({ uid, ...existingData, role, email: userCred.user.email });
        setCurrentView(role === 'teacher' ? 'teacher_dashboard' : 'student_dashboard');
      }
    }
  };

  const handleLogout = async () => {
    // Keep active attempt data in this browser so an accidental sign-out does not erase work.
    if (auth) {
      await signOut(auth);
    }
    setUser(null);
    setCurrentView('login');
  };

  const startTest = (test) => {
    const testGroupCode = (test.groupCode || '').trim().toLowerCase();
    const studentGroupCode = (user?.groupCode || '').trim().toLowerCase();
    if (user?.role === 'student' && (!testGroupCode || (testGroupCode !== 'all' && testGroupCode !== studentGroupCode))) {
      setModalInfo({ isOpen: true, title: 'Exam not available', message: 'This exam is assigned to a different student group.' });
      return;
    }
    try { localStorage.setItem(`activeExam:${user.uid}`, JSON.stringify(test)); } catch (error) { console.warn('Could not save the active assessment snapshot:', error); }
    setActiveTest(test);
    setCurrentView('exam');
  };

  const saveStudentGroupCode = async (groupCode) => {
    if (!user || user.role !== 'student') return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    await updateDoc(profileRef, { groupCode });
    setUser((previousUser) => ({ ...previousUser, groupCode }));
  };

  const completeTest = async (resultData) => {
    if (!user || !db) throw new Error('You are no longer signed in.');
    try {
      const attemptId = resultData.attemptId || crypto.randomUUID();
      const assessment = activeTest;
      if (!assessment) throw new Error('The assessment is no longer open.');
      const questions = Array.isArray(assessment.questions) ? assessment.questions : [];
      const submittedAt = new Date().toISOString();
      const submittedAtMs = Date.now();
      const answeredCount = questions.filter((question: any) => isAnswerPresent(resultData.answers?.[question.id])).length;
      const result = {
        testId: assessment.practiceSourceTestId || assessment.id,
        attemptId,
        answers: resultData.answers || {},
        displayTitle: assessment.title || 'Assessment',
        submittedAt,
        submittedAtMs,
        isAutoSubmitted: Boolean(resultData.isAutoSubmitted),
        durationSeconds: Math.max(0, Math.floor((submittedAtMs - Number(resultData.startedAtMs || submittedAtMs)) / 1000)),
        score: null,
        maxPossibleScore: null,
        maxAutoScore: null,
        answeredCount,
        unansweredCount: questions.length - answeredCount,
        pendingReviewCount: questions.filter((question: any) => gradeQuestion(question, resultData.answers?.[question.id]).status === 'manual-review').length,
        reviewStatus: 'pending-review',
        gradingMode: 'teacher-review-required',
        assessmentIds: assessment.practiceSourceTestIds || [assessment.practiceSourceTestId || assessment.id],
        secondaryAssessmentId: (assessment.practiceSourceTestIds || [])[1] || '',
      };
      const centralId = `${user.uid}_${attemptId}`;
      const submissionRef = doc(db, 'artifacts', appId, 'public', 'data', 'submissions', centralId);
      const resultRef = doc(db, 'artifacts', appId, 'users', user.uid, 'results', attemptId);
      const existingSubmission = await getDoc(submissionRef);
      if (!existingSubmission.exists()) {
        const batch = writeBatch(db);
        batch.set(submissionRef, {
          ...result,
          id: centralId,
          studentUid: user.uid,
          studentName: user.name || 'Student',
          studentEmail: user.email || '',
          groupCode: user.groupCode || '',
          assessmentId: assessment.practiceSourceTestId || assessment.id,
          assessmentIds: assessment.practiceSourceTestIds || [assessment.practiceSourceTestId || assessment.id],
          secondaryAssessmentId: (assessment.practiceSourceTestIds || [])[1] || '',
          assessmentTitle: assessment.title || 'Assessment',
          examType: assessment.type || 'General',
        });
        batch.set(resultRef, result);
        await batch.commit();
      }
      try {
        localStorage.removeItem(`examAttempt:${user.uid}:${activeTest?.id}`);
        localStorage.removeItem(`activeExam:${user.uid}`);
      } catch (error) {
        console.warn('Could not clear the completed exam attempt:', error);
      }
      setActiveTest(null);
      setCurrentView('student_dashboard');
      setModalInfo({ 
        isOpen: true, 
        title: 'Answers submitted',
        message: `Your ${resultData.isAutoSubmitted ? 'time ran out and your ' : ''}answers have been saved privately. A teacher must review them before a score is available.`
      });
    } catch (err) {
      console.error(err);
      throw new Error('Failed to save results. Your saved answers are still available to retry.', { cause: err });
    }
  };

  const saveTeacherReview = async (submissionId: string, questionId: string, reviewData: { feedback: string; points: number | null; annotations?: Array<{ id: string; quote: string; comment: string; start: number; end: number }> }) => {
    const submissionRef = doc(db, 'artifacts', appId, 'public', 'data', 'submissions', submissionId);
    const snapshot = await getDoc(submissionRef);
    if (!snapshot.exists()) throw new Error('Submission not found.');
    const submission = snapshot.data();
    if (submission.gradingMode === 'legacy-unverified') {
      throw new Error('Legacy historical results are not recalculated or edited through the current grading workflow.');
    }
    const sourceAssessmentIds = submission.assessmentIds?.length ? submission.assessmentIds : [submission.assessmentId];
    const sourceAssessments = sourceAssessmentIds.map((id: string) => tests.find((item: any) => item.id === id)).filter(Boolean);
    const trustedQuestions = sourceAssessments.flatMap((assessment: any) => assessment.questions || []);
    if (!trustedQuestions.length) throw new Error('The saved assessment is unavailable; grading was not saved.');
    const previousReviews = new Map<string, any>((submission.questionReviews || []).map((item: any) => [item.questionId, item]));
    const questionReviews = createTeacherReviewRows(trustedQuestions, submission.answers || {}).map((item: any) => ({
      ...item,
      teacherReview: previousReviews.get(item.questionId)?.teacherReview,
    }));
    if (questionId !== '__finalize__') {
      const question = questionReviews.find((item: any) => item.questionId === questionId);
      if (!question || question.status !== 'manual-review') throw new Error('This response is not awaiting review.');
      const questionMaximum = question.points;
      if (reviewData.points == null) throw new Error('Enter awarded points before saving the review.');
      if (reviewData.points < 0 || reviewData.points > questionMaximum) throw new Error('Points must be within the assessment question maximum.');
      const annotations = reviewData.annotations ?? question.teacherReview?.annotations ?? [];
      if (!Array.isArray(annotations) || annotations.length > 50) throw new Error('A response can have up to 50 phrase comments.');
      const responseText = typeof question.studentAnswer === 'string' ? question.studentAnswer : '';
      const safeAnnotations = annotations.map(annotation => {
        const id = typeof annotation?.id === 'string' ? annotation.id.trim().slice(0, 100) : '';
        const quote = typeof annotation?.quote === 'string' ? annotation.quote.trim().slice(0, 1000) : '';
        const comment = typeof annotation?.comment === 'string' ? annotation.comment.trim().slice(0, 1000) : '';
        const start = Number.isInteger(annotation?.start) ? annotation.start : -1;
        const end = Number.isInteger(annotation?.end) ? annotation.end : -1;
        if (!id || !quote || !comment || start < 0 || end !== start + quote.length || responseText.slice(start, end) !== quote) {
          throw new Error('Each phrase comment must match selected text in the student response.');
        }
        return { id, quote, comment, start, end };
      });
      question.teacherReview = {
        feedback: reviewData.feedback.trim().slice(0, 2000),
        points: reviewData.points,
        annotations: safeAnnotations,
        reviewedAt: new Date().toISOString()
      };
    }
    const pendingReviewCount = questionReviews.filter((item: any) => item.status === 'manual-review' && !item.teacherReview?.reviewedAt).length;
    const maxPossibleScore = trustedQuestions.filter((item: any) => !item.ungraded).reduce((total: number, item: any) => total + Math.max(0, Number(item.points ?? 1) || 0), 0);
    const score = questionReviews.reduce((total: number, item: any) => {
      if (item.status === 'graded') return total + Math.max(0, Math.min(item.points, Number(item.earnedPoints || 0)));
      if (item.status === 'manual-review' && item.teacherReview?.reviewedAt) return total + Math.max(0, Math.min(item.points, Number(item.teacherReview.points || 0)));
      return total;
    }, 0);
    const scoredRows = questionReviews.filter((item: any) => item.status === 'graded' || (item.status === 'manual-review' && item.teacherReview?.reviewedAt));
    const correctCount = scoredRows.filter((item: any) => item.status === 'graded' ? item.isCorrect === true : Number(item.teacherReview.points) >= item.points).length;
    const incorrectCount = scoredRows.length - correctCount;
    const answeredCount = questionReviews.filter((item: any) => item.status !== 'unanswered').length;
    const unansweredCount = questionReviews.length - answeredCount;
    const reviewedAt = new Date().toISOString();
    const ungradedCount = questionReviews.filter((item: any) => item.status === 'ungraded').length;
    const reviewSummary = { questionReviews: questionReviews, pendingReviewCount, manualReviewCount: pendingReviewCount, ungradedCount, reviewStatus: pendingReviewCount ? 'pending-review' : 'reviewed', score, maxPossibleScore, maxAutoScore: maxPossibleScore, correctCount, incorrectCount, answeredCount, unansweredCount, reviewedAt };
    await updateDoc(submissionRef, reviewSummary);
    const studentResultRef = doc(db, 'artifacts', appId, 'users', submission.studentUid, 'results', submission.attemptId);
    const studentResult = await getDoc(studentResultRef);
    if (studentResult.exists()) await updateDoc(studentResultRef, reviewSummary);
  };

  const backfillLegacySubmissions = async (cursorPath: string, dryRun = false) => {
    const firebaseUser = auth.currentUser;
    if (user?.role !== 'teacher' || !isClientAuthorizedTeacher(firebaseUser)) {
      throw new Error('Legacy results import is restricted to an authorized, verified Google teacher. Sign in with an approved teacher account.');
    }

    const queryPath = `collectionGroup(results) under artifacts/${appId}/users/{studentUid}/results`;
    let recordsRead = 0;
    const authorized = isClientAuthorizedTeacher(firebaseUser);
    try {
      let legacyQuery = query(collectionGroup(db, 'results'), orderBy('submittedAt', 'desc'), limit(LEGACY_IMPORT_BATCH_SIZE));
      if (cursorPath) {
        const parsedCursor = parseLegacyResultPath(cursorPath, appId);
        if (!parsedCursor) throw new Error('Saved continuation cursor is malformed. Clear the current browser session cursor and run a new dry run.');
        const cursorSnapshot = await getDoc(doc(db, cursorPath));
        if (!cursorSnapshot.exists()) throw new Error('Saved continuation cursor no longer exists. Run a new dry run from the start.');
        legacyQuery = query(legacyQuery, startAfter(cursorSnapshot));
      }

      const snapshot = await getDocs(legacyQuery);
      recordsRead = snapshot.size;
      const batch = writeBatch(db);
      let migrated = 0;
      let alreadyImported = 0;
      let candidates = 0;
      for (const legacy of snapshot.docs) {
        const path = legacy.ref.path;
        const parsed = parseLegacyResultPath(path, appId);
        if (!parsed) continue;
        candidates++;
        const target = doc(db, 'artifacts', appId, 'public', 'data', 'submissions', `legacy_${parsed.studentUid}_${parsed.resultId}`);
        const existing = await getDoc(target);
        if (existing.exists()) {
          alreadyImported++;
          continue;
        }
        if (!dryRun) {
          batch.set(target, mapLegacyResult(
            legacy.data(),
            path,
            appId,
            firebaseUser.uid,
            serverTimestamp(),
          ));
          migrated++;
        }
      }
      if (!dryRun && migrated) await batch.commit();
      return {
        migrated,
        candidates,
        alreadyImported,
        recordsRead,
        dryRun,
        nextCursorPath: snapshot.size === LEGACY_IMPORT_BATCH_SIZE ? snapshot.docs[snapshot.docs.length - 1].ref.path : null,
      };
    } catch (error) {
      const code = String(error?.code || 'unknown');
      const detail = error instanceof Error ? error.message : String(error);
      console.error('Legacy result import failed', {
        code,
        detail,
        signedInEmail: firebaseUser?.email || 'unavailable',
        emailVerified: Boolean(firebaseUser?.emailVerified),
        googleProvider: Boolean(firebaseUser?.providerData?.some(provider => provider.providerId === 'google.com')),
        authorizedTeacher: authorized,
        appId,
        queryPath,
        recordsRead,
        continuationCursorPresent: Boolean(cursorPath),
      });
      throw new Error(
        `Legacy import failed (${code}). Account: ${firebaseUser?.email || 'unknown'}; authorized teacher: ${authorized ? 'yes' : 'no'}; Google: ${firebaseUser?.providerData?.some(provider => provider.providerId === 'google.com') ? 'yes' : 'no'}; email verified: ${firebaseUser?.emailVerified ? 'yes' : 'no'}; app/project: ${appId}; operation: ${dryRun ? 'dry run' : 'import'}; query: ${queryPath}; records read: ${recordsRead}; continuation cursor: ${cursorPath ? 'present' : 'none'}. The client cannot inspect the deployed rules version; publish and verify this repository's rules_version 2 policy, including authorized teacher collection-group reads and legacy imports. Details: ${detail}`,
      );
    }
  };

  const secureExistingAnswerKeys = async (dryRun = false) => {
    if (user?.role !== 'teacher' || !isClientAuthorizedTeacher(auth.currentUser)) {
      throw new Error('Answer-key security migration is restricted to an authorized, verified Google teacher.');
    }
    const testsSnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'tests'));
    const report = { total: testsSnapshot.size, secured: 0, alreadySecured: 0, skipped: 0, failed: 0, incomplete: 0, publicAnswerFields: 0, needingMigration: 0, details: [] as Array<{ assessmentId: string; status: string; reason?: string }> };
    for (const testDoc of testsSnapshot.docs) {
      const test = testDoc.data();
      const keyRef = doc(db, 'artifacts', appId, 'teacher', 'data', 'answerKeys', testDoc.id);
      const keySnapshot = await getDoc(keyRef);
      const questions = Array.isArray(test.questions) ? test.questions : [];
      const existingKeys = keySnapshot.exists() ? keySnapshot.data() : {};
      const hasPublicFields = hasPublicAnswerKeys(questions) || hasPublicTeacherScripts(test.sections);
      const complete = keySnapshot.exists() && hasCompleteAnswerKey(questions, existingKeys.questions || []);
      const preparedKeys = buildAnswerKeyQuestions(questions, existingKeys.questions || [], PRIVATE_QUESTION_FIELDS);
      const preparedKeyErrors = !hasCompleteAnswerKey(questions, preparedKeys)
        ? ['The private key does not cover every question and answer slot.']
        : questions.flatMap((question: any) => validateQuestion(normalizeQuestion(mergeQuestionKeys([question], preparedKeys)[0])));
      if (hasPublicFields) report.publicAnswerFields++;
      if (test.answerKeysSecured === true && complete && !hasPublicFields) {
        report.alreadySecured++;
        report.details.push({ assessmentId: testDoc.id, status: 'already-secured' });
        continue;
      }
      if (!questions.length) {
        report.skipped++;
        report.details.push({ assessmentId: testDoc.id, status: 'skipped', reason: 'Assessment contains no questions.' });
        continue;
      }
      report.needingMigration++;
      if (!dryRun) {
        try {
          const privateSections = mergeTeacherSections(existingKeys.teacherSections, extractTeacherOnlySections(test.sections));
          if (preparedKeyErrors.length) {
            report.incomplete++;
            report.details.push({ assessmentId: testDoc.id, status: 'incomplete', reason: preparedKeyErrors.join(' ') });
            continue;
          }
          const answerKeyQuestions = preparedKeys;
          const oldVersion = Number(test.answerKeyVersion || 0);
          const batch = writeBatch(db);
          const auditRef = doc(collection(db, 'artifacts', appId, 'teacher', 'data', 'answerKeyMigrationAudit'));
          batch.set(keyRef, {
            assessmentId: testDoc.id,
            questions: answerKeyQuestions,
            teacherSections: privateSections,
            migrationVersion: ANSWER_KEY_MIGRATION_VERSION,
            updatedAt: serverTimestamp(),
          });
          batch.set(auditRef, {
            actorUid: auth.currentUser.uid,
            actorEmail: auth.currentUser.email || '',
            migratedAt: serverTimestamp(),
            assessmentId: testDoc.id,
            oldKeyVersion: oldVersion,
            newKeyVersion: ANSWER_KEY_MIGRATION_VERSION,
            result: 'secured',
          });
          batch.update(testDoc.ref, {
            sections: sanitizePublicSections(test.sections),
            questions: stripPublicAnswerFields(questions, PRIVATE_QUESTION_FIELDS),
            answerKeysSecured: true,
            answerKeyVersion: ANSWER_KEY_MIGRATION_VERSION,
          });
          await batch.commit();

          const [verifiedKey, verifiedTest] = await Promise.all([getDoc(keyRef), getDoc(testDoc.ref)]);
          const verifiedPublic = verifiedTest.data();
          if (!verifiedKey.exists()
            || !hasCompleteAnswerKey(questions, verifiedKey.data().questions || [])
            || verifiedPublic.answerKeysSecured !== true
            || hasPublicAnswerKeys(verifiedPublic.questions || [])
            || hasPublicTeacherScripts(verifiedPublic.sections)) {
            throw new Error('Post-write verification failed; the assessment is not reported as secured.');
          }
          report.secured++;
          report.details.push({ assessmentId: testDoc.id, status: 'secured' });
        } catch (error) {
          report.failed++;
          report.details.push({ assessmentId: testDoc.id, status: 'failed', reason: error instanceof Error ? error.message : String(error) });
          console.error(`Answer-key migration failed for assessment ${testDoc.id}:`, error);
          try {
            await addDoc(collection(db, 'artifacts', appId, 'teacher', 'data', 'answerKeyMigrationAudit'), {
                actorUid: auth.currentUser.uid,
                actorEmail: auth.currentUser.email || '',
                migratedAt: serverTimestamp(),
                assessmentId: testDoc.id,
                oldKeyVersion: Number(test.answerKeyVersion || 0),
                newKeyVersion: ANSWER_KEY_MIGRATION_VERSION,
                result: 'failed',
                reason: error instanceof Error ? error.message : String(error),
            });
          } catch (auditError) {
            console.error(`Could not record answer-key migration failure for ${testDoc.id}:`, auditError);
          }
        }
      } else {
        if (!complete || preparedKeyErrors.length) report.incomplete++;
        report.details.push({
          assessmentId: testDoc.id,
          status: complete && !preparedKeyErrors.length ? 'needs-public-field-removal' : 'needs-migration',
          ...(!complete || preparedKeyErrors.length ? { reason: preparedKeyErrors.join(' ') || 'Private key is missing or does not cover all question IDs and slots.' } : {}),
        });
      }
    }
    return { ...report, dryRun };
  };

  const saveWritingResource = async (resource: WritingResource) => {
    if (user?.role !== 'teacher' || !isClientAuthorizedTeacher(auth.currentUser)) {
      throw new Error('Only an authorized, verified Google teacher can save writing resources.');
    }
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'writingResources', resource.id), resource);
  };

  const deleteWritingResource = async (resourceId: string) => {
    if (user?.role !== 'teacher' || !isClientAuthorizedTeacher(auth.currentUser)) {
      throw new Error('Only an authorized, verified Google teacher can delete writing resources.');
    }
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'writingResources', resourceId));
  };

  if (loadingAuth || currentView === 'loading') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {currentView === 'exam' ? null : (
        <button
          onClick={() => setIsDark(!isDark)}
          className="fixed bottom-24 sm:bottom-6 right-6 p-4 rounded-full bg-slate-800 dark:bg-white text-white dark:text-slate-800 shadow-xl z-50 hover:scale-110 transition-transform flex items-center justify-center"
          title="Toggle Dark Mode"
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        >
          {isDark ? <Sun className="w-6 h-6"/> : <Moon className="w-6 h-6" />}
        </button>
      )}

      {currentView === 'login' && <LoginScreen onAuthAction={handleAuthAction} />}
      {currentView === 'teacher_dashboard' && <TeacherDashboard user={user} tests={tests} resources={writingResources} resourceError={writingResourcesError} onSaveResource={saveWritingResource} onDeleteResource={deleteWritingResource} submissions={submissions} submissionsLoading={submissionsLoading} submissionsError={submissionsError} onSaveReview={saveTeacherReview} onBackfillLegacy={backfillLegacySubmissions} onSecureAnswerKeys={secureExistingAnswerKeys} onLogout={handleLogout} />}
      {currentView === 'student_dashboard' && <StudentDashboard user={user} tests={tests} results={results} writingResources={writingResources} writingResourcesError={writingResourcesError} onStartTest={startTest} onSaveGroupCode={saveStudentGroupCode} onLogout={handleLogout} />}
      {currentView === 'exam' && activeTest && user && <ExamInterface key={`${user.uid}:${activeTest.id}`} test={activeTest} userId={user.uid} writingResources={writingResources} writingResourcesError={writingResourcesError} isDark={isDark} onToggleTheme={() => setIsDark(previous => !previous)} onComplete={completeTest} />}

      <Modal isOpen={modalInfo.isOpen} title={modalInfo.title} onClose={() => setModalInfo(prev => ({ ...prev, isOpen: false }))}>
        <p className="whitespace-pre-wrap text-left">{modalInfo.message}</p>
      </Modal>
    </>
  );
}
