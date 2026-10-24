import React, { useState, useEffect } from 'react';
import { 
  Clock, BookOpen, FileText, CheckCircle, LogOut, User, Play, AlertTriangle, 
  ArrowRight, LayoutDashboard, History, Check, Plus, Trash2, Edit3, Users, 
  Lock, Image as ImageIcon, Sun, Moon, X, Copy
} from 'lucide-react';

import { initializeApp } from "firebase/app";
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
  getFirestore, doc, getDoc, setDoc, addDoc, collection, onSnapshot, 
  serverTimestamp, deleteDoc, updateDoc, query, where
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

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
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const appId = "exam-portal-71a9b";

const authorizedTeacherEmails = (import.meta.env.VITE_TEACHER_EMAILS || '')
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

const Modal = ({ isOpen, title, children, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 text-left">{title}</h3>
        <div className="text-slate-600 dark:text-slate-300 text-left">{children}</div>
        {onClose && (
           <div className="mt-6 flex justify-end">
             <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
               Close
             </button>
           </div>
        )}
      </div>
    </div>
  );
};

const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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

type AssessmentQuestion = {
  id: string;
  type: 'mcq' | 'select' | 'text' | 'number' | string;
  section?: 'listening' | 'reading' | 'writing' | 'general';
  questionType?: IELTSQuestionFormat;
  passageNumber?: 1 | 2 | 3;
  listeningSectionNumber?: 1 | 2 | 3 | 4;
  satDomain?: string;
  satSkill?: string;
  correctAnswer?: string | number;
  acceptedAnswers?: Array<string | number>;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  points?: number;
  writingTaskType?: 1 | 2;
  writingFormat?: string;
  options?: string[];
  text?: string;
  imageUrl?: string;
};

type AssessmentRecord = {
  id?: string;
  title?: string;
  type?: string;
  durationSeconds?: number;
  groupCode?: string;
  questions?: AssessmentQuestion[];
  sections?: {
    listening?: { instructions?: string; audioUrl?: string; parts?: Array<{ sectionNumber: number; instructions?: string; audioUrl?: string }> };
    reading?: { instructions?: string; passage?: string; passages?: Array<{ passageNumber: number; title?: string; content?: string }> };
    writing?: { instructions?: string };
  };
};

const SAT_SKILLS: Record<string, string[]> = {
  'Information and Ideas': ['Central Ideas and Details', 'Inferences', 'Command of Evidence'],
  'Craft and Structure': ['Words in Context', 'Text Structure and Purpose', 'Cross-Text Connections'],
  'Expression of Ideas': ['Rhetorical Synthesis', 'Transitions'],
  'Standard English Conventions': ['Boundaries', 'Form, Structure, and Sense'],
  Algebra: ['Linear equations', 'Linear inequalities', 'Systems of linear equations', 'Linear functions'],
  'Advanced Math': ['Equivalent expressions', 'Nonlinear equations', 'Nonlinear functions'],
  'Problem-Solving and Data Analysis': ['Ratios, rates, and units', 'Percentages', 'Data and statistics', 'Probability'],
  'Geometry and Trigonometry': ['Area and volume', 'Lines and angles', 'Right triangles', 'Circles']
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

const normalizeAnswer = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

const acceptedAnswerValues = (question: AssessmentQuestion) => [question.correctAnswer, ...(question.acceptedAnswers || [])]
  .filter(answer => answer !== null && answer !== undefined && String(answer).trim() !== '')
  .map(normalizeAnswer);

const isQuestionCorrect = (question: AssessmentQuestion, answer: unknown) => {
  const accepted = acceptedAnswerValues(question);
  return accepted.length > 0 && accepted.includes(normalizeAnswer(answer));
};

const getSelectOptions = (question): any[] => question.options || (
  question.questionType === 'true-false-not-given' ? ['True', 'False', 'Not Given']
    : question.questionType === 'yes-no-not-given' ? ['Yes', 'No', 'Not Given']
    : []
);

const getListeningAudioUrl = (test: AssessmentRecord, sectionNumber: number) => {
  const section = test?.sections?.listening;
  const part = section?.parts?.find(item => item.sectionNumber === sectionNumber);
  return part?.audioUrl || (sectionNumber === 1 ? section?.audioUrl || '' : '');
};

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

const TeacherDashboard = ({ user, tests, onLogout }) => {
  const [isBuildingTest, setIsBuildingTest] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newTest, setNewTest] = useState<any>(createEmptyTest);
  const [activeQuestionSection, setActiveQuestionSection] = useState('listening');
  const [activeListeningSection, setActiveListeningSection] = useState(1);
  const [activeReadingPassage, setActiveReadingPassage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddQuestion = (type, section = activeQuestionSection) => {
    setNewTest(prev => ({
      ...prev,
      questions: [...prev.questions, {
        id: `q_${Date.now()}`,
        type,
        ...(section === 'general' ? {} : { section }),
        ...(section === 'listening' ? { listeningSectionNumber: activeListeningSection } : {}),
        ...(section === 'reading' ? { passageNumber: activeReadingPassage } : {}),
        questionType: type === 'mcq' ? 'multiple-choice' : 'short-answer',
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
        authorId: user.uid,
        authorName: user.name,
        createdAt: new Date().toISOString(),
        questions: (test.questions || []).map((question, index) => ({
          ...question,
          id: `q_${Date.now()}_${index}`,
          ...(question.options ? { options: [...question.options] } : {})
        })),
        ...(test.sections ? {
          sections: Object.fromEntries(Object.entries(test.sections).map(([sectionId, section]) => [sectionId, { ...(section as Record<string, any>) }]))
        } : {})
      };
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tests'), copiedTest);
    } catch (err) {
      console.error(err);
      alert('Failed to duplicate this assessment.');
    }
  };

  const handleUpdateQuestion = (index, field, value) => {
    setNewTest(prev => {
      const updated = [...prev.questions];
      updated[index] = { ...updated[index] };
    if (field === 'imageUrl') {
      updated[index][field] = extractImageUrl(value);
    } else if (field === 'questionType') {
      updated[index][field] = value;
      updated[index].type = value === 'multiple-choice' ? 'mcq'
        : ['true-false-not-given', 'yes-no-not-given', 'matching-headings', 'matching-features', 'sentence-endings', 'map-labeling'].includes(value) ? 'select'
        : value === 'sat-student-produced-response' ? 'number'
        : 'text';
      if (value === 'true-false-not-given') updated[index].options = ['True', 'False', 'Not Given'];
      else if (value === 'yes-no-not-given') updated[index].options = ['Yes', 'No', 'Not Given'];
      else if (['matching-headings', 'matching-features', 'sentence-endings', 'map-labeling'].includes(value)) updated[index].options = [];
      else delete updated[index].options;
    } else if (field === 'writingTaskType') {
      updated[index].writingTaskType = value;
      updated[index].writingFormat = value === 1 ? 'chart' : 'essay';
    } else {
      updated[index][field] = value;
    }
      return { ...prev, questions: updated };
    });
  };

  const handleUpdateOption = (qIndex, optIndex, value) => {
    setNewTest(prev => {
      const updated = [...prev.questions];
      updated[qIndex] = { ...updated[qIndex], options: [...(updated[qIndex].options || [])] };
      updated[qIndex].options[optIndex] = extractImageUrl(value);
      return { ...prev, questions: updated };
    });
  };

  const handleAddOption = (qIndex) => {
    setNewTest(prev => {
      const updated = [...prev.questions];
      updated[qIndex] = { ...updated[qIndex], options: [...(updated[qIndex].options || []), ''] };
      return { ...prev, questions: updated };
    });
  };

  const handleRemoveOption = (qIndex, optIndex) => {
    setNewTest(prev => {
      const updated = [...prev.questions];
      const options = [...(updated[qIndex].options || [])];
      const removedOption = options.splice(optIndex, 1)[0];
      updated[qIndex] = { ...updated[qIndex], options, correctAnswer: updated[qIndex].correctAnswer === removedOption ? '' : updated[qIndex].correctAnswer };
      return { ...prev, questions: updated };
    });
  };

  const handleRemoveQuestion = (index) => {
    setNewTest(prev => ({ ...prev, questions: prev.questions.filter((_, questionIndex) => questionIndex !== index) }));
  };

  const saveTest = async () => {
    if (!newTest.title || newTest.questions.length === 0) return alert("Title and at least 1 question required.");
    setIsSubmitting(true);
    try {
      const testToSave: any = {
        ...newTest,
        questions: newTest.type === 'IELTS'
          ? [...newTest.questions].sort((a, b) => {
              const order = { listening: 0, reading: 1, writing: 2, general: 3 };
              return (order[a.section || 'general'] ?? 3) - (order[b.section || 'general'] ?? 3);
            })
          : newTest.questions,
        groupCode: newTest.groupCode.trim().toLowerCase(),
        durationSeconds: newTest.durationMinutes * 60,
        authorId: user.uid,
        authorName: user.name
      };
      delete testToSave.durationMinutes;

      if (editingId) {
        testToSave.updatedAt = new Date().toISOString();
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tests', editingId), testToSave);
      } else {
        testToSave.createdAt = new Date().toISOString();
        const testsRef = collection(db, 'artifacts', appId, 'public', 'data', 'tests');
        await addDoc(testsRef, testToSave);
      }
      
      setIsBuildingTest(false);
      setEditingId(null);
      setNewTest(createEmptyTest());
      setActiveQuestionSection('listening');
    } catch (err) {
      console.error(err);
      alert("Failed to save test.");
    }
    setIsSubmitting(false);
  };

  const deleteTest = async (testId) => {
    if(!window.confirm("Delete this assessment permanently?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tests', testId));
    } catch(err) {
      console.error(err);
    }
  }

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
      questions: test.questions || [],
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
        {!isBuildingTest ? (
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 text-left">
              {tests.map(test => (
                <div key={test.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getStatusColor(test.category)}`}>
                      {test.category} • {test.type}
                    </span>
                    <div className="flex items-center gap-2">
                      {test.pin && <Lock className="w-4 h-4 text-amber-500" aria-label="PIN protected" />}
                      <button onClick={() => duplicateTest(test)} className="text-slate-400 dark:text-slate-500 hover:text-purple-500 ml-2" title="Duplicate Assessment">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEditTest(test)} className="text-slate-400 dark:text-slate-500 hover:text-blue-500 ml-2" title="Edit Assessment">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteTest(test.id)} className="text-slate-400 dark:text-slate-500 hover:text-red-500 ml-2" title="Delete Assessment">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
              {tests.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <Edit3 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600 dark:text-slate-300 font-medium">No assessments created yet.</p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Click the button above to create your first test.</p>
                </div>
              )}
            </div>
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
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Audio URL (optional)
                            <input type="url" value={newTest.sections?.listening?.parts?.find(part => part.sectionNumber === activeListeningSection)?.audioUrl || ''} onChange={event => updateListeningPart(activeListeningSection, 'audioUrl', event.target.value)} placeholder="Paste a direct link to a browser-playable audio file" className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500" />
                          </label>
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
                          <button onClick={() => handleRemoveQuestion(qIndex)} className="text-red-500 dark:text-red-400 text-sm hover:underline">Remove</button>
                       </div>
                       
                       <textarea value={q.text} onChange={e => handleUpdateQuestion(qIndex, 'text', e.target.value)} placeholder="Type the question text here..." rows={2} className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white mb-3 outline-none"></textarea>

                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                         <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Question format
                           <select value={q.questionType || (q.type === 'mcq' ? 'multiple-choice' : 'short-answer')} onChange={event => handleUpdateQuestion(qIndex, 'questionType', event.target.value)} className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
                             {(newTest.type === 'IELTS' ? IELTS_QUESTION_FORMATS.filter(([value]) => activeQuestionSection === 'writing' ? value === 'writing-task' : value !== 'writing-task' && value !== 'sat-student-produced-response') : [['multiple-choice', 'Multiple choice'], ['short-answer', 'Short answer'], ['sat-student-produced-response', 'Numerical response']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
                       {q.type !== 'mcq' && q.type !== 'select' && (
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Correct answer
                           <input type={q.type === 'number' ? 'number' : 'text'} value={q.correctAnswer || ''} onChange={event => handleUpdateQuestion(qIndex, 'correctAnswer', event.target.value)} placeholder="Leave blank for a manually reviewed writing response" className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
                         </label>
                       )}
                       {q.type === 'select' && (
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
                       {q.type !== 'mcq' && q.type !== 'select' && (
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Accepted answer alternatives (one per line)
                           <textarea value={(q.acceptedAnswers || []).join('\n')} onChange={event => handleUpdateQuestion(qIndex, 'acceptedAnswers', event.target.value.split('\n').map(answer => answer.trim()).filter(Boolean))} rows={2} className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
                         </label>
                       )}
                       <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Answer explanation (optional)
                         <textarea value={q.explanation || ''} onChange={event => handleUpdateQuestion(qIndex, 'explanation', event.target.value)} rows={2} className="mt-1 w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white" />
                       </label>

                       <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm text-left">
                          <label className="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                            <ImageIcon className="w-4 h-4 text-blue-500" /> ✨ Magic Extractor Active (Attach Figure)
                          </label>
                          <input 
                            type="text"
                            value={q.imageUrl || ''}
                            onChange={(e) => handleUpdateQuestion(qIndex, 'imageUrl', e.target.value)}
                            placeholder="Paste your link or ImgBB BBCode here!"
                            className="w-full p-2 text-sm rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
                            Paste the "BBCode full linked" from ImgBB. The app will magically extract the picture!
                          </p>
                          {q.imageUrl && q.imageUrl.startsWith('http') && (
                            <div className="mt-4 w-full bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 overflow-hidden flex justify-center">
                              <img src={q.imageUrl} alt="Preview" className="max-w-full h-auto object-contain rounded shadow-sm" />
                            </div>
                          )}
                       </div>

                       {q.type === 'mcq' && (
                         <div className="space-y-2 ml-4 border-l-2 border-slate-200 dark:border-slate-600 pl-4 text-left">
                           {q.options.map((opt, oIndex) => (
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
                  </div>
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
  )
}

const WritingPractice = ({ tests, userId, onBack }) => {
  const [taskType, setTaskType] = useState(1);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [draft, setDraft] = useState('');
  const [checklist, setChecklist] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(20 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiError, setAiError] = useState('');
  const textareaRef = React.useRef(null);
  const responseCache = React.useRef(new Map());

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
    setAiError('');
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

  const localSuggestions = taskType === 1
    ? (wordCount < 25
        ? [
            { phrase: 'The chart illustrates…', why: 'A concise opening to paraphrase the visual.' },
            { phrase: 'Overall, …', why: 'Introduce the main trend before details.' }
          ]
        : draft.toLowerCase().includes('overall')
          ? [
              { phrase: 'By contrast, …', why: 'Use this to compare a different category or period.' },
              { phrase: 'The most notable change was…', why: 'Bring attention to a key feature without listing every figure.' }
            ]
          : [
              { phrase: 'increased steadily', why: 'A precise description for a gradual upward trend.' },
              { phrase: 'remained relatively stable', why: 'Describe a category with little overall change.' }
            ])
    : (wordCount < 40
        ? [
            { phrase: 'This essay will argue that…', why: 'State your position directly after interpreting the prompt.' },
            { phrase: 'Although…, I believe…', why: 'Use this structure to acknowledge a counterpoint and state your view.' }
          ]
        : [
            { phrase: 'One reason for this is that…', why: 'Start a body paragraph with a clear supporting reason.' },
            { phrase: 'For example, …', why: 'Connect a specific example to the paragraph’s claim.' },
            { phrase: 'As a result, …', why: 'Make the consequence of your reasoning explicit.' }
          ]);

  const insertPhrase = (phrase) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? draft.length;
    const end = textarea?.selectionEnd ?? draft.length;
    const updated = `${draft.slice(0, start)}${phrase}${draft.slice(end)}`;
    setDraft(updated);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + phrase.length, start + phrase.length);
    });
  };

  const requestCoach = async (kind) => {
    if (!selectedPrompt || !draft.trim()) return;
    const cacheKey = `${kind}:${taskType}:${selectedPrompt.question.text}:${draft.trim()}`;
    if (responseCache.current.has(cacheKey)) {
      setAiMessage(responseCache.current.get(cacheKey));
      return;
    }
    setAiBusy(true);
    setAiError('');
    setAiMessage('');
    try {
      const coach = httpsCallable<any, { message: string }>(functions, 'writingCoach');
      const response = await coach({
        kind,
        taskType,
        prompt: selectedPrompt.question.text.slice(0, 1500),
        taskFormat: selectedPrompt.question.writingFormat || (taskType === 1 ? 'chart or visual report' : 'essay'),
        writing: draft.slice(0, 5000)
      });
      const message = response.data?.message;
      if (typeof message !== 'string' || !message.trim()) throw new Error('The coaching service returned no feedback.');
      responseCache.current.set(cacheKey, message);
      setAiMessage(message);
    } catch (error) {
      console.error('Writing coach request failed:', error);
      const code = String(error?.code || '');
      setAiError(code.endsWith('/failed-precondition')
        ? 'The secure AI coach is not configured yet. Your draft is safe, and local phrase suggestions still work.'
        : code.endsWith('/resource-exhausted')
          ? String(error?.message || 'AI coaching is temporarily rate limited. Your draft is safe.')
          : 'AI coaching is temporarily unavailable. Your draft is safe; local phrase suggestions remain available.');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="space-y-5 text-left">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold text-slate-800 dark:text-white">IELTS Writing Practice</h2><p className="text-sm text-slate-500 dark:text-slate-400">Suggestions are optional. Your writing is never replaced automatically.</p></div>
        <button onClick={onBack} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200">Back</button>
      </div>
      <div className="flex gap-2" role="tablist" aria-label="Writing task">
        {[1, 2].map(task => <button key={task} role="tab" aria-selected={taskType === task} onClick={() => setTaskType(task)} className={`px-4 py-2 rounded-lg font-semibold ${taskType === task ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'}`}>Task {task}</button>)}
      </div>
      {!selectedPrompt ? (
        <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300">
          No Task {taskType} prompt is available yet. Ask your teacher to publish an IELTS Writing question and label it Task {taskType}.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-5">
          <div className="space-y-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Prompt
                <select value={selectedPromptId || selectedPrompt.id} onChange={event => { setSelectedPromptId(event.target.value); setDraft(loadDraft(event.target.value)); setAiMessage(''); }} className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
                  {prompts.map(prompt => <option key={prompt.id} value={prompt.id}>{prompt.test.title}: {prompt.question.text.slice(0, 90)}</option>)}
                </select>
              </label>
              <p className="mt-4 whitespace-pre-wrap text-slate-800 dark:text-slate-100">{selectedPrompt.question.text}</p>
              {selectedPrompt.question.imageUrl && <img src={selectedPrompt.question.imageUrl} alt="Writing prompt figure" className="mt-4 max-w-full rounded-lg" />}
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Suggested practice length: {taskType === 1 ? 'about 150 words' : 'about 250 words'}. This is guidance, not scoring.</p>
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
              <textarea ref={textareaRef} value={draft} onChange={event => { const value = event.target.value; setDraft(value); try { if (selectedPrompt) localStorage.setItem(getDraftStorageKey(selectedPrompt.id), value); } catch { /* Storage may be unavailable in private browsing. */ } }} rows={16} maxLength={12000} placeholder="Write your response here. Your text stays on this device unless you explicitly request AI feedback." className="w-full p-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white leading-relaxed" />
            </div>
          </div>
          <aside className="space-y-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-white mb-3">Structure checklist</h3>
              {checklistItems.map(item => <label key={item} className="flex gap-2 items-start text-sm text-slate-700 dark:text-slate-300 mb-3"><input type="checkbox" checked={Boolean(checklist[item])} onChange={event => setChecklist(previous => ({ ...previous, [item]: event.target.checked }))} /><span>{item}</span></label>)}
            </div>
            <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-white mb-3">Phrase suggestions</h3>
              <div className="space-y-2">{localSuggestions.map(suggestion => <div key={suggestion.phrase} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700"><button onClick={() => insertPhrase(suggestion.phrase)} className="text-left font-semibold text-blue-700 dark:text-blue-300 underline">{suggestion.phrase}</button><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{suggestion.why}</p></div>)}</div>
              <button onClick={() => requestCoach('hint')} disabled={aiBusy || !draft.trim()} className="w-full mt-4 px-3 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50">{aiBusy ? 'Getting hint…' : 'Ask for a focused AI hint'}</button>
              <button onClick={() => requestCoach('feedback')} disabled={aiBusy || !draft.trim()} className="w-full mt-2 px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-semibold disabled:opacity-50">Request feedback</button>
              {aiError && <p role="status" className="text-sm text-amber-700 dark:text-amber-300 mt-3">{aiError}</p>}
              {aiMessage && <div role="status" className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap"><p className="font-semibold mb-1">Formative coaching (not an official IELTS band score)</p>{aiMessage}</div>}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

const PracticeHub = ({ tests, user, onStartTest }) => {
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

  const ieltsTests = tests.filter(test => test.type === 'IELTS' && (test.questions || []).length > 0);
  const satTests = tests.filter(test => test.type === 'SAT' && (test.questions || []).length > 0);
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
  const readingQuestionsForMode = readingQuestions(selectedTest).filter(question => {
    if (readingMode === 'question-type') return Boolean(readingType) && question.questionType === readingType;
    if (readingMode === 'passage') return (question.passageNumber || 1) === passageNumber;
    return [1, 2, 3].includes(question.passageNumber || 1);
  });
  const readingFullReady = [1, 2, 3].every(number => getReadingPassage(selectedTest, number).trim() && readingQuestions(selectedTest).some(question => (question.passageNumber || 1) === number));
  const listeningQuestionsForMode = listeningQuestions(selectedTest).filter(question => listeningSection === 'all' || (question.listeningSectionNumber || 1) === Number(listeningSection));
  const listeningFullReady = [1, 2, 3, 4].every(number => getListeningAudioUrl(selectedTest, number) && listeningQuestions(selectedTest).some(question => (question.listeningSectionNumber || 1) === number));

  const launchPractice = (test, questions, durationSeconds, title, practiceMetadata) => {
    if (!test || questions.length === 0) return;
    const orderedQuestions = [...questions].sort((a, b) => {
      if (practiceMetadata.kind === 'reading') return (a.passageNumber || 1) - (b.passageNumber || 1);
      if (practiceMetadata.kind === 'listening') return (a.listeningSectionNumber || 1) - (b.listeningSectionNumber || 1);
      return 0;
    });
    onStartTest({
      ...test,
      id: `practice-${test.id}-${Date.now()}`,
      title,
      durationSeconds,
      questions: orderedQuestions,
      isPractice: true,
      practiceMetadata
    });
  };

  if (subject === 'writing') return <WritingPractice tests={ieltsTests} userId={user?.uid} onBack={() => setSubject('')} />;

  if (!subject) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          ['reading', 'IELTS Reading', 'Practice by question type, passage, or all three passages.'],
          ['listening', 'IELTS Listening', 'Practice one listening section or all four continuously.'],
          ['writing', 'IELTS Writing', 'Work on Task 1 or Task 2 with a checklist and optional coaching.'],
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
            {readingMode === 'passage' && <label className="block max-w-2xl text-sm font-medium text-slate-700 dark:text-slate-300">Passage<select value={passageNumber} onChange={event => setPassageNumber(Number(event.target.value))} className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">{[1, 2, 3].map(number => <option key={number} value={number}>Passage {number}</option>)}</select></label>}
            {emptyBank && <p className="text-amber-700 dark:text-amber-300">This assessment has no tagged Reading questions yet. A teacher can add them in IELTS Reading and assign a question type and passage number.</p>}
            {readingMode === 'question-type' && !readingTypes.length && !emptyBank && <p className="text-amber-700 dark:text-amber-300">Question-type practice needs published Reading questions with a question-format tag.</p>}
            {readingMode === 'full' && !readingFullReady && <p className="text-amber-700 dark:text-amber-300">Full Reading needs a passage and tagged questions for each of Passages 1, 2, and 3. Complete those in the assessment editor first.</p>}
            {readingMode !== 'full' && selectedTest && readingMode !== 'question-type' && readingQuestionsForMode.length === 0 && <p className="text-amber-700 dark:text-amber-300">No questions are tagged for Passage {passageNumber} in this assessment yet.</p>}
            <button onClick={startReading} disabled={!selectedTest || emptyBank || readingQuestionsForMode.length === 0 || (readingMode === 'question-type' && !readingType) || (readingMode === 'full' && !readingFullReady)} className="px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50">Start Reading Practice</button>
          </div>}
          {subject === 'listening' && <div className="space-y-4">
            <label className="block max-w-2xl text-sm font-medium text-slate-700 dark:text-slate-300">Practice mode<select value={listeningSection} onChange={event => setListeningSection(event.target.value)} className="mt-1 w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"><option value="all">All four sections</option>{[1, 2, 3, 4].map(number => <option key={number} value={number}>Section {number}</option>)}</select></label>
            {emptyBank && <p className="text-amber-700 dark:text-amber-300">This assessment has no tagged Listening questions yet. Add audio and questions to one or more Listening sections in the teacher editor.</p>}
            {selectedTest && listeningSection !== 'all' && listeningQuestionsForMode.length === 0 && <p className="text-amber-700 dark:text-amber-300">No questions are tagged for Listening Section {listeningSection} yet.</p>}
            {selectedTest && listeningSection !== 'all' && listeningQuestionsForMode.length > 0 && !getListeningAudioUrl(selectedTest, Number(listeningSection)) && <p className="text-amber-700 dark:text-amber-300">Add audio for this Listening section before starting practice.</p>}
            {selectedTest && listeningSection === 'all' && !listeningFullReady && <p className="text-amber-700 dark:text-amber-300">Full Listening needs audio and tagged questions in all four sections. You can start a complete individual section while the rest is being prepared.</p>}
            <button onClick={startListening} disabled={!selectedTest || emptyBank || listeningQuestionsForMode.length === 0 || (listeningSection === 'all' ? !listeningFullReady : !getListeningAudioUrl(selectedTest, Number(listeningSection)))} className="px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50">Start Listening Practice</button>
          </div>}
          {subject === 'sat' && <div className="space-y-4">
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
        </>
      )}
    </div>
  );
};

const StudentDashboard = ({ user, tests, results, onStartTest, onSaveGroupCode, onLogout }) => {
  const [activeTab, setActiveTab] = useState('tests');
  const [pinModal, setPinModal] = useState({ isOpen: false, test: null, enteredPin: '', error: '' });
  const [groupCodeInput, setGroupCodeInput] = useState(user?.groupCode || '');
  const [isSavingGroupCode, setIsSavingGroupCode] = useState(false);

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
      alert('Could not save the group code. Please try again.');
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

        {activeTab === 'practice' && <PracticeHub tests={visibleTests} user={user} onStartTest={onStartTest} />}

        {activeTab === 'tests' && (
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
                           <h4 className="font-semibold text-slate-800 dark:text-white">{testInfo.title}</h4>
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
                             <p className="mt-1">Your answer: {review.studentAnswer || 'No answer'}</p>
                             {review.graded ? <p className={review.isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>{review.isCorrect ? 'Correct' : `Correct answer: ${review.correctAnswer}${review.acceptedAnswers?.length ? ` (also accepted: ${review.acceptedAnswers.join(', ')})` : ''}`}</p> : <p>Not automatically graded.</p>}
                             {review.explanation && <p className="mt-1">{review.explanation}</p>}
                           </div>)}</div>
                         </details>}
                       </div>
                       <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                         <div className="text-center">
                           <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Your Results</div>
                           <div className="font-bold text-xl text-blue-600 dark:text-blue-400">
                             {result.score} <span className="text-sm text-slate-400 dark:text-slate-500 font-normal">/ {result.maxPossibleScore}</span>
                           </div>
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

const ExamInterface = ({ test, user, onComplete }) => {
  const storageKey = `examAttempt:${user.uid}:${test.id}`;
  const [initialAttempt] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; }
  });
  const [deadlineTimestamp] = useState(initialAttempt?.deadlineTimestamp || Date.now() + test.durationSeconds * 1000);
  const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.ceil((deadlineTimestamp - Date.now()) / 1000)));
  const [answers, setAnswers] = useState<Record<string, string>>(initialAttempt?.answers || {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialAttempt?.currentQuestionIndex || 0);
  const [flaggedQuestions, setFlaggedQuestions] = useState<number[]>(initialAttempt?.flaggedQuestions || []);
  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState(false);

  useEffect(() => {
    const updateRemaining = () => setTimeLeft(Math.max(0, Math.ceil((deadlineTimestamp - Date.now()) / 1000)));
    updateRemaining();
    const timer = setInterval(updateRemaining, 500);
    return () => clearInterval(timer);
  }, [deadlineTimestamp]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ answers, currentQuestionIndex, flaggedQuestions, deadlineTimestamp }));
    } catch (error) {
      console.warn('Could not save this attempt in local storage:', error);
    }
  }, [answers, currentQuestionIndex, flaggedQuestions, deadlineTimestamp, storageKey]);

  useEffect(() => {
    if (timeLeft <= 0) handleAutoSubmit();
  }, [timeLeft]);

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const calculateScore = () => {
    let score = 0;
    let maxAutoScore = 0;
    const questionReviews = test.questions.map(question => {
      const accepted = acceptedAnswerValues(question);
      const points = Number(question.points) || 1;
      const graded = accepted.length > 0;
      const correct = graded && isQuestionCorrect(question, answers[question.id]);
      if (graded) {
        maxAutoScore += points;
        if (correct) score += points;
      }
      return {
        questionId: question.id,
        questionText: question.text,
        studentAnswer: answers[question.id] || '',
        correctAnswer: question.correctAnswer || '',
        acceptedAnswers: question.acceptedAnswers || [],
        explanation: question.explanation || '',
        section: question.section || '',
        satDomain: question.satDomain || '',
        satSkill: question.satSkill || '',
        graded,
        isCorrect: graded ? correct : null,
        points: graded ? points : 0
      };
    });
    return { score, maxAutoScore, questionReviews };
  };

  const submitTest = async (isAutoSubmit = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const { score, maxAutoScore, questionReviews } = calculateScore();
    await onComplete({
      testId: test.id,
      answers: answers,
      score: score,
      maxPossibleScore: maxAutoScore,
      questionReviews,
      displayTitle: test.title,
      practiceMetadata: test.practiceMetadata || null,
      submittedAt: new Date().toISOString(),
      isAutoSubmitted: isAutoSubmit
    });
  };

  const handleManualSubmit = () => {
    setIsConfirmSubmitOpen(true);
  };

  const handleAutoSubmit = () => submitTest(true);
  const toggleFlag = (questionIndex) => setFlaggedQuestions(previous => previous.includes(questionIndex)
    ? previous.filter(index => index !== questionIndex)
    : [...previous, questionIndex]);
  const isAnswered = (question) => Boolean(String(answers[question.id] || '').trim());

  const isWarningTime = timeLeft <= 60;
  const currentQuestion = test.questions && test.questions[currentQuestionIndex];
  const currentSectionId = currentQuestion?.section;
  const rawSection = currentSectionId && currentSectionId !== 'general' ? test.sections?.[currentSectionId] : null;
  const currentSection = currentSectionId === 'reading'
    ? (() => {
        const passage = rawSection?.passages?.find(item => item.passageNumber === (currentQuestion?.passageNumber || 1));
        return { ...rawSection, passage: passage?.content || rawSection?.passage || '', title: passage?.title || `Passage ${currentQuestion?.passageNumber || 1}` };
      })()
    : currentSectionId === 'listening'
      ? (() => {
          const partNumber = currentQuestion?.listeningSectionNumber || 1;
          const part = rawSection?.parts?.find(item => item.sectionNumber === partNumber);
          return { ...rawSection, ...part, audioUrl: part?.audioUrl || (partNumber === 1 ? rawSection?.audioUrl : '') };
        })()
      : rawSection;
  const currentSectionTitle = currentSectionId ? `${currentSectionId[0].toUpperCase()}${currentSectionId.slice(1)}` : '';
  const readingLayout = currentSectionId === 'reading';
  const unansweredQuestions = ((test.questions || []) as Array<{ id: string }>).reduce<number[]>((unanswered, question, index) => {
      const answer = answers[question.id];
      if (answer == null || answer.trim() === '') unanswered.push(index + 1);
      return unanswered;
    }, []);

  return (
    <div className="exam-interface min-h-screen w-full bg-slate-100 dark:bg-slate-900 flex flex-col font-sans transition-colors duration-300">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm sticky top-0 z-20 transition-colors w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between">
          <div className="text-left">
            <h2 className="font-bold text-lg text-slate-800 dark:text-white line-clamp-1">{test.title}</h2>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{test.type} {test.category}{currentSectionId ? ` • ${currentSectionTitle}${currentSectionId === 'listening' ? ` ${currentQuestion?.listeningSectionNumber || 1}` : currentSectionId === 'reading' ? ` ${currentQuestion?.passageNumber || 1}` : ''}` : ''}</div>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xl font-bold transition-colors ${isWarningTime ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 animate-pulse' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white'}`}>
            <Clock className="w-5 h-5" />
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      <div className="w-full bg-amber-50 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-400 flex items-center justify-center gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        The test submits automatically when the timer runs out. Refreshing resets the timer and discards your answers.
      </div>

      <main className="flex-grow max-w-6xl w-full mx-auto p-4 sm:p-8 text-left">
        <div className={readingLayout ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start text-left' : 'space-y-6 text-left'}>
          
          {test.description && (
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 sm:p-8 text-left transition-colors">
               <h3 className="font-bold text-slate-800 dark:text-white mb-2 border-b border-slate-100 dark:border-slate-700 pb-2">Instructions / Reading Material</h3>
               <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed text-sm text-left">{test.description}</p>
            </div>
          )}

          {currentSection && (
            <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-purple-200 dark:border-purple-800 p-5 sm:p-8 text-left">
              <h3 className="font-bold text-slate-800 dark:text-white mb-3">IELTS {currentSectionTitle}{currentSection.title ? ` — ${currentSection.title}` : ''}</h3>
              {currentSection.instructions && <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed mb-4">{currentSection.instructions}</p>}
              {currentSection.passage && <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-700 pt-4">{currentSection.passage}</div>}
              {currentSection.audioUrl && (
                <audio controls preload="metadata" className="w-full mt-2">
                  <source src={currentSection.audioUrl} />
                  Your browser does not support audio playback.
                </audio>
              )}
            </section>
          )}

          {currentQuestion && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8 animate-in fade-in duration-300 transition-colors w-full overflow-hidden">
              <div className="flex gap-4 text-left w-full overflow-hidden">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center font-bold text-sm">
                  {currentQuestionIndex + 1}
                </div>
                <div className="flex-grow min-w-0 space-y-4 text-left w-full overflow-hidden">
                  <div className="flex justify-end">
                    <button onClick={() => toggleFlag(currentQuestionIndex)} aria-pressed={flaggedQuestions.includes(currentQuestionIndex)} className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${flaggedQuestions.includes(currentQuestionIndex) ? 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
                      {flaggedQuestions.includes(currentQuestionIndex) ? 'Flagged for review' : 'Flag for review'}
                    </button>
                  </div>
                  <p className="text-lg text-slate-800 dark:text-white font-medium leading-relaxed whitespace-pre-wrap text-left w-full block">
                    {currentQuestion.text}
                  </p>
                  
                  {currentQuestion.imageUrl && (
                    <div className="my-6 w-full bg-slate-50 dark:bg-slate-900 rounded-lg p-2 border border-slate-100 dark:border-slate-700 overflow-hidden flex justify-center box-border">
                      <img src={currentQuestion.imageUrl} alt="Question Figure" className="max-w-full h-auto object-contain rounded shadow-sm" style={{ maxWidth: '100%', display: 'block' }} />
                    </div>
                  )}
                  
                  {currentQuestion.type === 'mcq' && (
                    <div className="space-y-3 mt-4 text-left w-full overflow-hidden">
                      {currentQuestion.options.map((option, optIdx) => (
                        <label key={optIdx} className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all w-full text-left overflow-hidden ${answers[currentQuestion.id] === option ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-900/30 dark:border-blue-500' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700'}`}>
                          <input type="radio" name={`question-${currentQuestion.id}`} value={option} checked={answers[currentQuestion.id] === option} onChange={() => handleAnswerChange(currentQuestion.id, option)} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500 flex-shrink-0 mt-0.5" />
                          
                          <span className="text-slate-700 dark:text-slate-200 text-left flex-grow break-words block w-full min-w-0 overflow-hidden">
                            {option.startsWith('http') ? (
                              <div className="w-full flex justify-start overflow-hidden">
                                <img src={option} alt={`Option ${optIdx + 1}`} className="max-w-full h-auto object-contain rounded border border-slate-200 dark:border-slate-600 mt-1" style={{ maxWidth: '100%' }} />
                              </div>
                            ) : (
                              option
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {currentQuestion.type === 'select' && getSelectOptions(currentQuestion).length > 0 && (
                    <div className="mt-4 text-left w-full">
                      <label htmlFor={`answer-${currentQuestion.id}`} className="block font-medium text-slate-700 dark:text-slate-200 mb-2">Choose an answer</label>
                      <select id={`answer-${currentQuestion.id}`} value={answers[currentQuestion.id] || ''} onChange={event => handleAnswerChange(currentQuestion.id, event.target.value)} className="w-full p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg">
                        <option value="">Select…</option>
                        {getSelectOptions(currentQuestion).map(option => <option key={String(option)} value={String(option)}>{String(option)}</option>)}
                      </select>
                    </div>
                  )}

                  {currentQuestion.type === 'text' && (
                    <div className="mt-4 text-left w-full">
                      <textarea rows={6} placeholder="Type your answer here..." value={answers[currentQuestion.id] || ''} onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)} className="w-full p-4 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y transition-all text-left"></textarea>
                    </div>
                  )}
                  {currentQuestion.type === 'number' && (
                    <div className="mt-4 text-left w-full">
                      <label htmlFor={`answer-${currentQuestion.id}`} className="block font-medium text-slate-700 dark:text-slate-200 mb-2">Enter a number</label>
                      <input id={`answer-${currentQuestion.id}`} type="number" value={answers[currentQuestion.id] || ''} onChange={event => handleAnswerChange(currentQuestion.id, event.target.value)} className="w-full p-4 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {test.questions && test.questions.length > 0 && (
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
              <div className="flex flex-wrap gap-2 mb-4" aria-label="Question navigation">
                {test.questions.map((question, index) => <button key={question.id} onClick={() => setCurrentQuestionIndex(index)} aria-current={index === currentQuestionIndex ? 'step' : undefined} aria-label={`Question ${index + 1}${isAnswered(question) ? ', answered' : ', unanswered'}${flaggedQuestions.includes(index) ? ', flagged for review' : ''}`} className={`w-10 h-10 rounded-lg border text-sm font-semibold ${index === currentQuestionIndex ? 'ring-2 ring-blue-500 border-blue-500' : ''} ${flaggedQuestions.includes(index) ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-100' : isAnswered(question) ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-200' : 'bg-slate-50 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'}`}>
                  {index + 1}
                </button>)}
              </div>
              <div className="flex justify-between items-center gap-3">
                <button onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))} disabled={currentQuestionIndex === 0} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">← Previous</button>
                <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">Question {currentQuestionIndex + 1} of {test.questions.length} • {test.questions.filter(isAnswered).length} answered • {flaggedQuestions.length} flagged</span>
                {currentQuestionIndex === test.questions.length - 1 ? <button onClick={handleManualSubmit} disabled={isSubmitting} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:opacity-70">Submit Final Answers</button> : <button onClick={() => setCurrentQuestionIndex(prev => Math.min(test.questions.length - 1, prev + 1))} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Next →</button>}
              </div>
            </div>
          )}

        </div>
      </main>

      <Modal
        isOpen={isConfirmSubmitOpen}
        title="Submit your answers?"
        onClose={() => setIsConfirmSubmitOpen(false)}
      >
        <p className="mb-4 text-slate-700 dark:text-slate-300">
          {unansweredQuestions.length > 0
            ? `You have not answered question${unansweredQuestions.length === 1 ? '' : 's'} ${unansweredQuestions.join(', ')}. Do you want to submit anyway?`
            : 'Are you sure you want to submit your answers? You will not be able to change them after submission.'}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setIsConfirmSubmitOpen(false)}
            className="px-5 py-3 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            No, review answers
          </button>
          <button
            onClick={() => submitTest(false)}
            disabled={isSubmitting}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:opacity-70"
          >
            {isSubmitting ? 'Submitting...' : 'Yes, submit'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [tests, setTests] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
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
    if (!user || !db) return;
    const testsRef = collection(db, 'artifacts', appId, 'public', 'data', 'tests');
    const testsQuery = user.role === 'teacher'
      ? testsRef
          : query(
              testsRef,
              where('groupCode', 'in', user.groupCode
                ? [...new Set([user.groupCode.trim().toLowerCase(), 'all'])]
                : ['all'])
            );
    const unsubTests = onSnapshot(testsQuery, (snapshot) => {
      const testsData: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      testsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTests(testsData);
    }, err => console.error(err));

    let unsubResults = () => {};
    if (user.role === 'student') {
      const resultsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'results');
      unsubResults = onSnapshot(resultsRef, (snapshot) => {
        const data: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        setResults(data);
      }, err => console.error(err));
    }

    return () => { unsubTests(); unsubResults(); };
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
    if (user?.uid) {
      try {
        if (activeTest?.id) localStorage.removeItem(`examAttempt:${user.uid}:${activeTest.id}`);
        localStorage.removeItem(`activeExam:${user.uid}`);
      } catch (error) {
        console.warn('Could not clear the saved exam attempt:', error);
      }
    }
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
    if (!user || !db) return;
    try {
      const resultsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'results');
      await addDoc(resultsRef, resultData);
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
        title: 'Task Submitted Successfully', 
        message: `Your ${resultData.isAutoSubmitted ? 'time ran out and your ' : ''}answers have been safely submitted.\n\nYour Results: ${resultData.score} / ${resultData.maxPossibleScore}` 
      });
    } catch (err) {
      console.error(err);
      setModalInfo({ isOpen: true, title: 'Error', message: 'Failed to save results.' });
    }
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
      <button 
        onClick={() => setIsDark(!isDark)} 
        className="fixed bottom-24 sm:bottom-6 right-6 p-4 rounded-full bg-slate-800 dark:bg-white text-white dark:text-slate-800 shadow-xl z-50 hover:scale-110 transition-transform flex items-center justify-center"
        title="Toggle Dark Mode"
      >
        {isDark ? <Sun className="w-6 h-6"/> : <Moon className="w-6 h-6" />}
      </button>

      {currentView === 'login' && <LoginScreen onAuthAction={handleAuthAction} />}
      {currentView === 'teacher_dashboard' && <TeacherDashboard user={user} tests={tests} onLogout={handleLogout} />}
      {currentView === 'student_dashboard' && <StudentDashboard user={user} tests={tests} results={results} onStartTest={startTest} onSaveGroupCode={saveStudentGroupCode} onLogout={handleLogout} />}
      {currentView === 'exam' && activeTest && user && <ExamInterface key={`${user.uid}:${activeTest.id}`} test={activeTest} user={user} onComplete={completeTest} />}

      <Modal isOpen={modalInfo.isOpen} title={modalInfo.title} onClose={() => setModalInfo(prev => ({ ...prev, isOpen: false }))}>
        <p className="whitespace-pre-wrap text-left">{modalInfo.message}</p>
      </Modal>
    </>
  );
}
