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
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Use your project ID to organize the database
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

const LoginScreen = ({ onAuthAction }) => {
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student'); // Default to Student
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
      setError(err.message.replace('Firebase: ', ''));
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
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
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
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
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
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
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
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
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
  const [uploadingImageForQ, setUploadingImageForQ] = useState(null); // Tracks which question is currently uploading an image

  const handleAddQuestion = (type) => {
    setNewTest(prev => ({
      ...prev,
      questions: [...prev.questions, {
        id: `q_${Date.now()}`,
        type,
        text: '',
        imageUrl: '', // New field for the image!
        options: type === 'mcq' ? ['', '', '', ''] : undefined,
        correctAnswer: ''
      }]
    }));
  };

  const handleUpdateQuestion = (index, field, value) => {
    const updated = [...newTest.questions];
    updated[index][field] = value;
    setNewTest({ ...newTest, questions: updated });
  };

  const handleUpdateOption = (qIndex, optIndex, value) => {
    const updated = [...newTest.questions];
    updated[qIndex].options[optIndex] = value;
    setNewTest({ ...newTest, questions: updated });
  };

  const handleRemoveQuestion = (index) => {
    const updated = [...newTest.questions];
    updated.splice(index, 1);
    setNewTest({ ...newTest, questions: updated });
  };

  // NEW: Handle uploading an image to Firebase Storage
  const handleImageUpload = async (qIndex, file) => {
    if (!file) return;
    setUploadingImageForQ(qIndex);
    try {
      // Create a reference to a unique file name in Storage
      const fileRef = ref(storage, `artifacts/${appId}/public/images/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);
      
      // Save the URL to the question
      handleUpdateQuestion(qIndex, 'imageUrl', downloadUrl);
    } catch (err) {
      console.error(err);
      alert("Failed to upload image. Did you turn on Firebase Storage in Test Mode?");
    }
    setUploadingImageForQ(null);
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
                       
                       <textarea value={q.text} onChange={e => handleUpdateQuestion(qIndex, 'text', e.target.value)} placeholder="Type the question here..." rows="2" className="w-full p-3 rounded-lg border border-slate-300 mb-3 outline-none"></textarea>

                       {/* NEW: Image Upload Field */}
                       <div className="mb-4 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                            <ImageIcon className="w-4 h-4 text-blue-500" /> Attach Figure / Image (Optional)
                          </label>
                          <input 
                            type="file" 
                            accept="image/png, image/jpeg, image/jpg"
                            onChange={(e) => handleImageUpload(qIndex, e.target.files[0])}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors cursor-pointer"
                          />
                          {uploadingImageForQ === qIndex && <p className="text-sm text-blue-600 mt-2 animate-pulse">Uploading image securely...</p>}
                          {q.imageUrl && (
                            <div className="mt-3 relative inline-block">
                              <img src={q.imageUrl} alt="Uploaded figure" className="max-h-40 rounded border border-slate-300 shadow-sm" />
                              <button onClick={() => handleUpdateQuestion(qIndex, 'imageUrl', '')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                       </div>

                       {q.type === 'mcq' && (
                         <div className="space-y-2 ml-4 border-l-2 border-slate-200 pl-4">
                           {q.options.map((opt, oIndex) => (
                              <div key={oIndex} className="flex items-center gap-2">
                                <input type="radio" name={`correct_${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => handleUpdateQuestion(qIndex, 'correctAnswer', opt)} className="w-4 h-4" />
                                <input type="text" value={opt} onChange={e => handleUpdateOption(qIndex, oIndex, e.target.value)} placeholder={`Option ${oIndex + 1}`} className="flex-grow p-2 rounded-md border border-slate-300 text-sm outline-none" />
                              </div>
                           ))}
                           <p className="text-xs text-slate-500 italic mt-1">Select the radio button next to the correct answer for grading.</p>
                         </div>
                       )}
                    </div>
                  ))}

                  <div className="flex gap-3 mt-4">
                    <button onClick={() => handleAddQuestion('mcq')} className="px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 text-sm font-medium transition-colors">
                      + Add Multiple Choice
                    </button>
                    <button onClick={() => handleAddQuestion('text')} className="px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 text-sm font-medium transition-colors">
                      + Add Written Response
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-slate-200">
                  <button onClick={saveTest} disabled={isSubmitting || uploadingImageForQ !== null} className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-2">
                    {isSubmitting ? 'Saving...' : 'Publish Assessment'} <CheckCircle className="w-5 h-5" />
                  </button>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  )
}

const StudentDashboard = ({ user, tests, results, onStartTest, onLogout }) => {
  const [activeTab, setActiveTab] = useState('tests');
  const [pinModal, setPinModal] = useState({ isOpen: false, test: null, enteredPin: '', error: '' });

  const hasCompletedTest = (testId) => results.some(r => r.testId === testId);

  const handleStartClick = (test) => {
    // PIN Check
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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-xl text-slate-800">EduPortal</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                <User className="w-4 h-4" />
                {user?.name || 'Student'}
              </div>
              <button onClick={onLogout} className="text-slate-500 hover:text-red-600 transition-colors" title="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Welcome back, {user?.name}!</h1>
          <p className="text-slate-500 mt-1">Ready to ace your next exam or homework?</p>
        </div>

        <div className="flex space-x-4 border-b border-slate-200 mb-6">
          <button onClick={() => setActiveTab('tests')} className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'tests' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <LayoutDashboard className="w-4 h-4" /> Available Tasks
          </button>
          <button onClick={() => setActiveTab('results')} className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'results' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <History className="w-4 h-4" /> Past Results
          </button>
        </div>

        {activeTab === 'tests' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tests.length === 0 && (
               <div className="col-span-full py-12 text-center text-slate-500">
                 No tests have been published by your teacher yet.
               </div>
            )}
            {tests.map((test) => {
              const completed = hasCompletedTest(test.id);
              return (
                <div key={test.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col transition-shadow hover:shadow-md">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getStatusColor(test.category)}`}>
                      {test.category} • {test.type}
                    </span>
                    <span className="flex items-center text-slate-500 text-sm gap-1">
                      <Clock className="w-4 h-4" /> {formatTime(test.durationSeconds)}
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                    {test.pin && <Lock className="w-4 h-4 text-slate-400" title="PIN Required" />} {test.title}
                  </h3>
                  <p className="text-sm text-slate-600 mb-6 flex-grow line-clamp-3">{test.description}</p>
                  
                  <div className="mt-auto">
                    {completed ? (
                      <button disabled className="w-full bg-slate-100 text-slate-500 font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200">
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {results.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                <FileText className="w-12 h-12 mb-3 text-slate-300" />
                <p>No results yet. Complete a test or homework to see your scores.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {results.map((result, idx) => {
                   const testInfo = tests.find(t => t.id === result.testId) || { title: 'Unknown Test', type: 'Unknown' };
                   return (
                     <div key={idx} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                       <div>
                         <div className="flex items-center gap-3 mb-1">
                           <h4 className="font-semibold text-slate-800">{testInfo.title}</h4>
                           <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                             {testInfo.type}
                           </span>
                         </div>
                         <p className="text-sm text-slate-500">
                           Submitted on: {new Date(result.submittedAt).toLocaleDateString()} at {new Date(result.submittedAt).toLocaleTimeString()}
                         </p>
                       </div>
                       <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100 shadow-sm">
                         <div className="text-center">
                           <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Your Results</div>
                           <div className="font-bold text-xl text-blue-600">
                             {result.score} <span className="text-sm text-slate-400 font-normal">/ {result.maxPossibleScore}</span>
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

        {/* PIN Entry Modal */}
        <Modal isOpen={pinModal.isOpen} title="Enter Secret PIN" onClose={() => setPinModal({ isOpen: false, test: null, enteredPin: '', error: '' })}>
          <p className="text-slate-600 mb-4">This assessment is protected. Please enter the PIN provided by your teacher to begin.</p>
          <input
            type="text"
            value={pinModal.enteredPin}
            onChange={(e) => setPinModal(prev => ({ ...prev, enteredPin: e.target.value, error: '' }))}
            onKeyDown={(e) => e.key === 'Enter' && submitPin()}
            placeholder="e.g. NUET2026"
            className="w-full p-3 rounded-lg border border-slate-300 mb-2 focus:ring-2 focus:ring-blue-500 outline-none"
            autoFocus
          />
          {pinModal.error && <p className="text-red-500 text-sm mb-4">{pinModal.error}</p>}
          <div className="mt-4 flex gap-3">
             <button onClick={() => setPinModal({ isOpen: false, test: null, enteredPin: '', error: '' })} className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors">
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
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Pagination State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

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
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < test.questions?.length && !window.confirm("You haven't answered all questions. Submit anyway?")) {
      return;
    }
    submitTest(false);
  };

  const handleAutoSubmit = () => submitTest(true);

  const isWarningTime = timeLeft <= 60;
  
  // Get current question based on pagination index
  const currentQuestion = test.questions && test.questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-slate-800 line-clamp-1">{test.title}</h2>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{test.type} {test.category}</div>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xl font-bold transition-colors ${isWarningTime ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-800'}`}>
            <Clock className="w-5 h-5" />
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800 flex items-center justify-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        Do not refresh this page. The test will auto-submit when time is up.
      </div>

      <main className="flex-grow max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24">
        <div className="space-y-6">
          
          {/* Instructions Block - Stays visible on every page */}
          {test.description && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-6">
               <h3 className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-2">Instructions / Reading Material</h3>
               <p className="whitespace-pre-wrap text-slate-700 leading-relaxed text-sm">{test.description}</p>
            </div>
          )}

          {/* Single Question Display (Pagination) */}
          {currentQuestion && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 animate-in fade-in duration-300">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
                  {currentQuestionIndex + 1}
                </div>
                <div className="flex-grow space-y-4">
                  <p className="text-lg text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                    {currentQuestion.text}
                  </p>
                  
                  {/* NEW: Render the Image if it exists */}
                  {currentQuestion.imageUrl && (
                    <div className="my-6 flex justify-center bg-slate-50 rounded-lg p-2 border border-slate-100">
                      <img 
                        src={currentQuestion.imageUrl} 
                        alt="Question Figure" 
                        className="max-w-full max-h-96 rounded shadow-sm"
                      />
                    </div>
                  )}
                  
                  {currentQuestion.type === 'mcq' && (
                    <div className="space-y-2 mt-4">
                      {currentQuestion.options.map((option, optIdx) => (
                        <label key={optIdx} className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${answers[currentQuestion.id] === option ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:bg-slate-50'}`}>
                          <input 
                            type="radio" 
                            name={`question-${currentQuestion.id}`} 
                            value={option} 
                            checked={answers[currentQuestion.id] === option} 
                            onChange={() => handleAnswerChange(currentQuestion.id, option)} 
                            className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" 
                          />
                          <span className="text-slate-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {currentQuestion.type === 'text' && (
                    <div className="mt-4">
                      <textarea 
                        rows="6" 
                        placeholder="Type your answer here..." 
                        value={answers[currentQuestion.id] || ''} 
                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)} 
                        className="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y transition-all"
                      ></textarea>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pagination Navigation */}
          {test.questions && test.questions.length > 1 && (
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <button 
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              
              <span className="text-slate-500 font-medium text-sm">
                Question {currentQuestionIndex + 1} of {test.questions.length}
              </span>
              
              <button 
                onClick={() => setCurrentQuestionIndex(prev => Math.min(test.questions.length - 1, prev + 1))}
                disabled={currentQuestionIndex === test.questions.length - 1}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Floating Submit Button (Always visible at bottom, removed cancel button) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30">
         <div className="max-w-4xl mx-auto flex justify-end">
            <button onClick={handleManualSubmit} disabled={isSubmitting} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-70">
              {isSubmitting ? 'Submitting...' : 'Submit Final Answers'} <CheckCircle className="w-5 h-5" />
            </button>
         </div>
      </div>

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
      await setDoc(profileRef, { name: data.name, role: data.role, createdAt: serverTimestamp() });
      
      setUser({ uid, name: data.name, role: data.role });
      setCurrentView(data.role === 'teacher' ? 'teacher_dashboard' : 'student_dashboard');
    } else if (action === 'login') {
      await signInWithEmailAndPassword(auth, data.email, data.password);
    } else if (action === 'google') {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      
      const profileRef = doc(db, 'artifacts', appId, 'users', googleUser.uid, 'profile', 'info');
      const profileSnap = await getDoc(profileRef);
      
      if (!profileSnap.exists()) {
        const newProfile = { 
          name: googleUser.displayName || 'Google User', 
          role: data.role, 
          createdAt: serverTimestamp() 
        };
        await setDoc(profileRef, newProfile);
        setUser({ uid: googleUser.uid, name: newProfile.name, role: newProfile.role });
        setCurrentView(newProfile.role === 'teacher' ? 'teacher_dashboard' : 'student_dashboard');
      } else {
        const existingData = profileSnap.data();
        setUser({ uid: googleUser.uid, ...existingData });
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
    setActiveTest(test);
    setCurrentView('exam');
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
        message: `Your ${resultData.isAutoSubmitted ? 'time ran out and your ' : ''}answers have been safely submitted. \n\nYour Results: ${resultData.score} / ${resultData.maxPossibleScore}` 
      });
    } catch (err) {
      console.error(err);
      setModalInfo({ isOpen: true, title: 'Error', message: 'Failed to save results.' });
    }
  };

  if (loadingAuth || currentView === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 font-medium">Loading Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {currentView === 'login' && <LoginScreen onAuthAction={handleAuthAction} />}
      {currentView === 'teacher_dashboard' && <TeacherDashboard user={user} tests={tests} onLogout={handleLogout} />}
      {currentView === 'student_dashboard' && <StudentDashboard user={user} tests={tests} results={results} onStartTest={startTest} onLogout={handleLogout} />}
      {currentView === 'exam' && activeTest && <ExamInterface test={activeTest} onComplete={completeTest} />}

      <Modal isOpen={modalInfo.isOpen} title={modalInfo.title} onClose={() => setModalInfo(prev => ({ ...prev, isOpen: false }))}>
        <p className="text-slate-600 whitespace-pre-wrap">{modalInfo.message}</p>
      </Modal>
    </>
  );
}
