import React, { useState, useEffect } from 'react';
import { 
  Clock, BookOpen, FileText, CheckCircle, LogOut, User, Play, AlertTriangle, 
  ArrowRight, LayoutDashboard, History, Check, Plus, Trash2, Edit3, Users, Lock, Image as ImageIcon
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
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, onSnapshot, serverTimestamp, deleteDoc } from "firebase/firestore";

// Your exact database configuration!
const firebaseConfig = {
  apiKey: "AIzaSyBj6nrhP7w-KbMeYHV7wtEMk-yHftG8H4c",
  authDomain: "exam-portal-71a9b.firebaseapp.com",
  projectId: "exam-portal-71a9b",
  storageBucket: "exam-portal-71a9b.firebasestorage.app",
  messagingSenderId: "1020660422457",
  appId: "1:1020660422457:web:31c02371e24694e423e0e8",
  measurementId: "G-WH8LWEWDGR"
};

// Initialize Firebase (NO STORAGE NEEDED - 100% FREE URL METHOD)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "exam-portal-71a9b";

const Modal = ({ isOpen, title, children, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-gray-800 mb-4">{title}</h3>
        <div>{children}</div>
        {onClose && (
           <div className="mt-6 flex justify-end">
             <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 font-medium rounded-lg hover:bg-slate-300 transition-colors">
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
    case 'Exam': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'Homework': return 'bg-orange-100 text-orange-700 border-orange-200';
    default: return 'bg-blue-100 text-blue-700 border-blue-200';
  }
};

// MAGIC EXTRACTOR: Finds the direct image link even if the user pastes BBCode or HTML!
const extractImageUrl = (input) => {
  if (!input) return '';
  // Check for BBCode like [img]https://...[/img]
  const bbMatch = input.match(/\[img\](.*?)\[\/img\]/i);
  if (bbMatch) return bbMatch[1];
  // Check for HTML like <img src="https://...">
  const htmlMatch = input.match(/src=["'](.*?)["']/i);
  if (htmlMatch) return htmlMatch[1];
  // Return raw input if no match
  return input.trim();
};

const LoginScreen = ({ onAuthAction }) => {
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onAuthAction(isLogin ? 'login' : 'signup', { email, password, name, role });
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
      await onAuthAction('google', { role });
    } catch (err) {
      console.error(err);
      // IPHONE AND MINI-BROWSER FIX
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/popup-blocked' || err.message.includes('popup')) {
        setError('Popup Blocked! If you are on an iPhone or using Instagram/WhatsApp, please tap the Compass icon or open this website directly in Safari/Chrome.');
      } else {
        setError(err.message.replace('Firebase: ', ''));
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-center text-slate-800 mb-2">EduPortal</h2>
        <p className="text-center text-slate-500 mb-8">{isLogin ? 'Login to your account' : 'Create a new account'}</p>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required={!isLogin}
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength="6"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 mt-2">I am a...</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`py-2 px-4 rounded-lg border font-medium flex items-center justify-center gap-2 transition-all ${role === 'student' ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  <User className="w-4 h-4" /> Student
                </button>
                <button
                  type="button"
                  onClick={() => setRole('teacher')}
                  className={`py-2 px-4 rounded-lg border font-medium flex items-center justify-center gap-2 transition-all ${role === 'teacher' ? 'bg-purple-50 border-purple-500 text-purple-700 ring-1 ring-purple-500' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  <Users className="w-4 h-4" /> Teacher
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 mt-4 shadow-md"
          >
            {loading ? 'Processing...' : (isLogin ? 'Login with Email' : 'Create Account')} <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between">
          <span className="border-b border-slate-200 w-1/5 lg:w-1/4"></span>
          <span className="text-xs text-center text-slate-500 uppercase font-semibold">Or continue with</span>
          <span className="border-b border-slate-200 w-1/5 lg:w-1/4"></span>
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full mt-4 bg-white border border-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-70 shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            <path fill="none" d="M1 1h22v22H1z" />
          </svg>
          Google
        </button>

        <div className="mt-6 text-center text-sm text-slate-500">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }} 
            className="text-blue-600 font-semibold hover:underline"
          >
            {isLogin ? 'Sign up' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TeacherDashboard = ({ user, tests, onLogout }) => {
  const [isBuildingTest, setIsBuildingTest] = useState(false);
  const [newTest, setNewTest] = useState({
    title: '', type: 'IELTS', category: 'Exam', durationMinutes: 30, description: '', questions: [], pin: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddQuestion = (type) => {
    setNewTest(prev => ({
      ...prev,
      questions: [...prev.questions, {
        id: `q_${Date.now()}`,
        type,
        text: '',
        imageUrl: '',
        options: type === 'mcq' ? ['', '', '', ''] : undefined,
        correctAnswer: ''
      }]
    }));
  };

  const handleUpdateQuestion = (index, field, value) => {
    const updated = [...newTest.questions];
    // Magic Image Link Extractor
    if (field === 'imageUrl') {
      updated[index][field] = extractImageUrl(value);
    } else {
      updated[index][field] = value;
    }
    setNewTest({ ...newTest, questions: updated });
  };

  const handleUpdateOption = (qIndex, optIndex, value) => {
    const updated = [...newTest.questions];
    updated[qIndex].options[optIndex] = extractImageUrl(value);
    setNewTest({ ...newTest, questions: updated });
  };

  const handleRemoveQuestion = (index) => {
    const updated = [...newTest.questions];
    updated.splice(index, 1);
    setNewTest({ ...newTest, questions: updated });
  };

  const saveTest = async () => {
    if (!newTest.title || newTest.questions.length === 0) return alert("Title and at least 1 question required.");
    setIsSubmitting(true);
    try {
      const testToSave = {
        ...newTest,
        durationSeconds: newTest.durationMinutes * 60,
        createdAt: new Date().toISOString(),
        authorId: user.uid,
        authorName: user.name
      };
      delete testToSave.durationMinutes;

      const testsRef = collection(db, 'artifacts', appId, 'public', 'data', 'tests');
      await addDoc(testsRef, testToSave);
      
      setIsBuildingTest(false);
      setNewTest({ title: '', type: 'IELTS', category: 'Exam', durationMinutes: 30, description: '', questions: [], pin: '' });
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-600" />
              <span className="font-bold text-xl text-slate-800">Teacher Portal</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-600">Prof. {user?.name}</span>
              <button onClick={onLogout} className="text-slate-500 hover:text-red-600 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {!isBuildingTest ? (
          <div>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Manage Assessments</h1>
                <p className="text-slate-500 mt-1">Create and monitor exams and homework.</p>
              </div>
              <button 
                onClick={() => setIsBuildingTest(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" /> Create New Assessment
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tests.map(test => (
                <div key={test.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getStatusColor(test.category)}`}>
                      {test.category} • {test.type}
                    </span>
                    <div className="flex items-center gap-2">
                      {test.pin && <Lock className="w-4 h-4 text-amber-500" title="PIN Protected" />}
                      <button onClick={() => deleteTest(test.id)} className="text-slate-400 hover:text-red-500 ml-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">{test.title}</h3>
                  <p className="text-sm text-slate-600 mb-4 flex-grow line-clamp-2">{test.description}</p>
                  <div className="flex justify-between items-center text-sm text-slate-500 border-t border-slate-100 pt-4 mt-auto">
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {Math.floor(test.durationSeconds / 60)} mins</span>
                    <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> {test.questions?.length || 0} Qs</span>
                  </div>
                </div>
              ))}
              {tests.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
                  <Edit3 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">No assessments created yet.</p>
                  <p className="text-slate-500 text-sm mt-1">Click the button above to create your first test.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
             <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-slate-800">Test Builder</h2>
                <button onClick={() => setIsBuildingTest(false)} className="text-slate-500 hover:text-slate-800 font-medium">Cancel</button>
             </div>

             <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Assessment Title</label>
                    <input type="text" value={newTest.title} onChange={e => setNewTest({...newTest, title: e.target.value})} placeholder="e.g. Midterm Physics Exam" className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description / Instructions</label>
                    <textarea value={newTest.description} onChange={e => setNewTest({...newTest, description: e.target.value})} placeholder="Paste instructions or reading materials from your PDF here..." rows="3" className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <select value={newTest.category} onChange={e => setNewTest({...newTest, category: e.target.value})} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none">
                      <option value="Exam">Exam</option>
                      <option value="Homework">Homework</option>
                      <option value="Practice">Practice</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                    <select value={newTest.type} onChange={e => setNewTest({...newTest, type: e.target.value})} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none">
                      <option value="IELTS">IELTS</option>
                      <option value="SAT">SAT</option>
                      <option value="NUET">NUET</option>
                      <option value="General">General / Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Time Limit (Minutes)</label>
                    <input type="number" min="1" value={newTest.durationMinutes} onChange={e => setNewTest({...newTest, durationMinutes: parseInt(e.target.value)})} className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-500"/> Secret PIN (Optional)
                    </label>
                    <input type="text" value={newTest.pin || ''} onChange={e => setNewTest({...newTest, pin: e.target.value})} placeholder="e.g. NUET2026" className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200">
                  <h3 className="font-bold text-slate-800 mb-4">Questions</h3>
                  
                  {newTest.questions.map((q, qIndex) => (
                    <div key={q.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                       <div className="flex justify-between mb-2">
                          <span className="font-semibold text-slate-700">Question {qIndex + 1} ({q.type.toUpperCase()})</span>
                          <button onClick={() => handleRemoveQuestion(qIndex)} className="text-red-500 text-sm hover:underline">Remove</button>
                       </div>
                       
                       <textarea value={q.text} onChange={e => handleUpdateQuestion(qIndex, 'text', e.target.value)} placeholder="Type the question text here..." rows="2" className="w-full p-3 rounded-lg border border-slate-300 mb-3 outline-none"></textarea>

                       {/* MAGIC URL Image Link Field */}
                       <div className="mb-4 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                            <ImageIcon className="w-4 h-4 text-blue-500" /> Attach Figure / Image (Optional)
                          </label>
                          <input 
                            type="text"
                            value={q.imageUrl || ''}
                            onChange={(e) => handleUpdateQuestion(qIndex, 'imageUrl', e.target.value)}
                            placeholder="Paste ImgBB BBCode here!"
                            className="w-full p-2 text-sm rounded border border-blue-300 outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50"
                          />
                          <p className="text-xs text-blue-600 font-medium mt-1">
                            ✨ Magic Extractor Active: Choose "BBCode full linked" on ImgBB and paste the whole text above!
                          </p>
                          {q.imageUrl && q.imageUrl.startsWith('http') && (
                            <div className="mt-3 flex justify-center">
                              <img src={q.imageUrl} alt="Preview
