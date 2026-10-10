import React, { useState, useEffect } from 'react';
import { 
  Clock, BookOpen, FileText, CheckCircle, LogOut, User, Play, AlertTriangle, 
  ArrowRight, LayoutDashboard, History, Check, Plus, Trash2, Edit3, Users, 
  Lock, Image as ImageIcon, Sun, Moon, X
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
  serverTimestamp, deleteDoc, updateDoc 
} from "firebase/firestore";

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
const appId = "exam-portal-71a9b";

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
      await onAuthAction('google', { role, groupCode });
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" required={!isLogin} />
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
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength="6" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 mt-2">I am a...</label>
              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setRole('student')} className={`py-2 px-4 rounded-lg border font-medium flex items-center justify-center gap-2 transition-all ${role === 'student' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400 ring-1 ring-blue-500' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                  <User className="w-4 h-4" /> Student
                </button>
                <button type="button" onClick={() => setRole('teacher')} className={`py-2 px-4 rounded-lg border font-medium flex items-center justify-center gap-2 transition-all ${role === 'teacher' ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-400 ring-1 ring-purple-500' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
                  <Users className="w-4 h-4" /> Teacher
                </button>
              </div>
            </div>
          )}

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
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
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
  const [newTest, setNewTest] = useState({
    title: '', type: 'IELTS', category: 'Exam', durationMinutes: 30, description: '', questions: [], pin: '', groupCode: ''
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

  const handleAddOption = (qIndex) => {
    const updated = [...newTest.questions];
    updated[qIndex].options.push('');
    setNewTest({ ...newTest, questions: updated });
  };

  const handleRemoveOption = (qIndex, optIndex) => {
    const updated = [...newTest.questions];
    const removedOption = updated[qIndex].options[optIndex];
    updated[qIndex].options.splice(optIndex, 1);
    if (updated[qIndex].correctAnswer === removedOption) {
      updated[qIndex].correctAnswer = '';
    }
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
      setNewTest({ title: '', type: 'IELTS', category: 'Exam', durationMinutes: 30, description: '', questions: [], pin: '', groupCode: '' });
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
    setNewTest({
      ...test,
      groupCode: test.groupCode || '',
      durationMinutes: Math.floor(test.durationSeconds / 60)
    });
    setEditingId(test.id);
    setIsBuildingTest(true);
  };

  const cancelEdit = () => {
    setIsBuildingTest(false);
    setEditingId(null);
    setNewTest({ title: '', type: 'IELTS', category: 'Exam', durationMinutes: 30, description: '', questions: [], pin: '', groupCode: '' });
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
                      {test.pin && <Lock className="w-4 h-4 text-amber-500" title="PIN Protected" />}
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
                    <textarea value={newTest.description} onChange={e => setNewTest({...newTest, description: e.target.value})} placeholder="Paste instructions or reading materials from your PDF here..." rows="3" className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"></textarea>
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
                    <select value={newTest.type} onChange={e => setNewTest({...newTest, type: e.target.value})} className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none">
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
                  <h3 className="font-bold text-slate-800 dark:text-white mb-4">Questions</h3>
                  
                  {newTest.questions.map((q, qIndex) => (
                    <div key={q.id} className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-200 dark:border-slate-600 mb-4 transition-colors text-left">
                       <div className="flex justify-between mb-2">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">Question {qIndex + 1} ({q.type.toUpperCase()})</span>
                          <button onClick={() => handleRemoveQuestion(qIndex)} className="text-red-500 dark:text-red-400 text-sm hover:underline">Remove</button>
                       </div>
                       
                       <textarea value={q.text} onChange={e => handleUpdateQuestion(qIndex, 'text', e.target.value)} placeholder="Type the question text here..." rows="2" className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white mb-3 outline-none"></textarea>

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

                  <div className="flex gap-3 mt-4">
                    <button onClick={() => handleAddQuestion('mcq')} className="px-4 py-2 bg-white dark:bg-slate-700 border border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-slate-600 text-sm font-medium transition-colors">
                      + Add Multiple Choice
                    </button>
                    <button onClick={() => handleAddQuestion('text')} className="px-4 py-2 bg-white dark:bg-slate-700 border border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-slate-600 text-sm font-medium transition-colors">
                      + Add Written Response
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
              <input type="text" value={groupCodeInput} onChange={e => setGroupCodeInput(e.target.value)} placeholder="Enter the code provided by your teacher" className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={saveGroupCode} disabled={isSavingGroupCode} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium disabled:opacity-60">{isSavingGroupCode ? 'Saving...' : 'Save group'}</button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Ask your teacher for the exact code. Leave it blank to see exams shared with everyone.</p>
        </div>

        <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-700 mb-6">
          <button onClick={() => setActiveTab('tests')} className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'tests' ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <LayoutDashboard className="w-4 h-4" /> Available Tasks
          </button>
          <button onClick={() => setActiveTab('results')} className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'results' ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <History className="w-4 h-4" /> Past Results
          </button>
        </div>

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
                    {test.pin && <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500" title="PIN Required" />} {test.title}
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
                   const testInfo = tests.find(t => t.id === result.testId) || { title: 'Unknown Test', type: 'Unknown' };
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

const ExamInterface = ({ test, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(test.durationSeconds);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0) {
      handleAutoSubmit();
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const calculateScore = () => {
    let score = 0;
    let maxAutoScore = 0;
    test.questions.forEach(q => {
      if (q.type === 'mcq') {
        maxAutoScore += 1;
        if (answers[q.id] === q.correctAnswer) score += 1;
      }
    });
    return { score, maxAutoScore };
  };

  const submitTest = async (isAutoSubmit = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const { score, maxAutoScore } = calculateScore();
    await onComplete({
      testId: test.id,
      answers: answers,
      score: score,
      maxPossibleScore: maxAutoScore,
      submittedAt: new Date().toISOString(),
      isAutoSubmitted: isAutoSubmit
    });
  };

  const handleManualSubmit = () => {
    setIsConfirmSubmitOpen(true);
  };

  const handleAutoSubmit = () => submitTest(true);

  const isWarningTime = timeLeft <= 60;
  const currentQuestion = test.questions && test.questions[currentQuestionIndex];
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
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{test.type} {test.category}</div>
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
        <div className="space-y-6 text-left">
          
          {test.description && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 sm:p-8 text-left transition-colors">
               <h3 className="font-bold text-slate-800 dark:text-white mb-2 border-b border-slate-100 dark:border-slate-700 pb-2">Instructions / Reading Material</h3>
               <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed text-sm text-left">{test.description}</p>
            </div>
          )}

          {currentQuestion && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8 animate-in fade-in duration-300 transition-colors w-full overflow-hidden">
              <div className="flex gap-4 text-left w-full overflow-hidden">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center font-bold text-sm">
                  {currentQuestionIndex + 1}
                </div>
                <div className="flex-grow min-w-0 space-y-4 text-left w-full overflow-hidden">
                  
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

                  {currentQuestion.type === 'text' && (
                    <div className="mt-4 text-left w-full">
                      <textarea rows="6" placeholder="Type your answer here..." value={answers[currentQuestion.id] || ''} onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)} className="w-full p-4 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y transition-all text-left"></textarea>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {test.questions && test.questions.length > 0 && (
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
              <button onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))} disabled={currentQuestionIndex === 0} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                ← Previous
              </button>
              <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                Question {currentQuestionIndex + 1} of {test.questions.length}
              </span>
              {currentQuestionIndex === test.questions.length - 1 ? (
                <button onClick={handleManualSubmit} disabled={isSubmitting} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors disabled:opacity-70">
                  Submit Final Answers
                </button>
              ) : (
                <button onClick={() => setCurrentQuestionIndex(prev => Math.min(test.questions.length - 1, prev + 1))} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                  Next →
                </button>
              )}
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
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);
  const [currentView, setCurrentView] = useState('loading');
  const [activeTest, setActiveTest] = useState(null);
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
            const userData = { uid: firebaseUser.uid, ...profileSnap.data() };
            setUser(userData);
            setCurrentView(userData.role === 'teacher' ? 'teacher_dashboard' : 'student_dashboard');
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
    const unsubTests = onSnapshot(testsRef, (snapshot) => {
      const testsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      testsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setTests(testsData);
    }, err => console.error(err));

    let unsubResults = () => {};
    if (user.role === 'student') {
      const resultsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'results');
      unsubResults = onSnapshot(resultsRef, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
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
      await setDoc(profileRef, { name: data.name, role: data.role, groupCode: data.role === 'student' ? (data.groupCode || '').trim().toLowerCase() : '', createdAt: serverTimestamp() });
      
      setUser({ uid, name: data.name, role: data.role, groupCode: data.role === 'student' ? (data.groupCode || '').trim().toLowerCase() : '' });
      setCurrentView(data.role === 'teacher' ? 'teacher_dashboard' : 'student_dashboard');
    } else if (action === 'login') {
      await signInWithEmailAndPassword(auth, data.email, data.password);
    } else if (action === 'google') {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCred = await signInWithPopup(auth, provider);
      const uid = userCred.user.uid;
      
      const profileRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'info');
      const profileSnap = await getDoc(profileRef);
      
      if (!profileSnap.exists()) {
        const role = data.role || 'student';
        const groupCode = role === 'student' ? (data.groupCode || '').trim().toLowerCase() : '';
        await setDoc(profileRef, { name: userCred.user.displayName || 'New User', role, groupCode, createdAt: serverTimestamp() });
        setUser({ uid, name: userCred.user.displayName, role, groupCode });
        setCurrentView((data.role || 'student') === 'teacher' ? 'teacher_dashboard' : 'student_dashboard');
      } else {
        const existingData = profileSnap.data();
        setUser({ uid, ...existingData });
        setCurrentView(existingData.role === 'teacher' ? 'teacher_dashboard' : 'student_dashboard');
      }
    }
  };

  const handleLogout = async () => {
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
      {currentView === 'exam' && activeTest && <ExamInterface test={activeTest} onComplete={completeTest} />}

      <Modal isOpen={modalInfo.isOpen} title={modalInfo.title} onClose={() => setModalInfo(prev => ({ ...prev, isOpen: false }))}>
        <p className="whitespace-pre-wrap text-left">{modalInfo.message}</p>
      </Modal>
    </>
  );
}
