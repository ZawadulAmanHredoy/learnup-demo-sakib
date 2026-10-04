import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';
import { 
  Play, Plus, Trash2, Edit3, Clock, Award, Shield, 
  HelpCircle, ChevronRight, LogOut, Layers, AlertCircle, CheckCircle2 
} from 'lucide-react';

export default function QuizManager() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [launchingPin, setLaunchingPin] = useState(null);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizDescription, setNewQuizDescription] = useState('');
  const [newQuizRoundType, setNewQuizRoundType] = useState('TEAM_MCQ');

  // Question Form State
  const [qText, setQText] = useState('');
  const [qSegment, setQSegment] = useState('GENERAL');
  const [qType, setQType] = useState('MCQ');
  const [qTimeLimit, setQTimeLimit] = useState(20);
  const [qPoints, setQPoints] = useState(1000);
  const [qNegative, setQNegative] = useState(false);
  const [qExplanation, setQExplanation] = useState('');
  const [qOptions, setQOptions] = useState([
    { id: 'opt_a', text: '', isCorrect: false },
    { id: 'opt_b', text: '', isCorrect: true },
    { id: 'opt_c', text: '', isCorrect: false },
    { id: 'opt_d', text: '', isCorrect: false },
  ]);

  const loadQuizzes = async () => {
    try {
      const res = await apiRequest('/quizzes');
      if (res.success) {
        setQuizzes(res.data);
        if (res.data.length > 0 && !selectedQuiz) {
          loadQuizDetails(res.data[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to load quizzes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadQuizDetails = async (id) => {
    try {
      const res = await apiRequest(`/quizzes/${id}`);
      if (res.success) {
        setSelectedQuiz(res.data);
      }
    } catch (err) {
      console.error('Failed to load quiz details:', err);
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, []);

  // Launch live competition room
  const handleLaunchRoom = async (quizId) => {
    setLaunchingPin(quizId);
    try {
      const res = await apiRequest('/rooms', {
        method: 'POST',
        body: JSON.stringify({ quizId }),
      });
      if (res.success && res.data.pin) {
        navigate(`/admin/rooms/${res.data.pin}/control`);
      }
    } catch (err) {
      alert('Failed to launch room: ' + err.message);
    } finally {
      setLaunchingPin(null);
    }
  };

  // Create new Quiz
  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    if (!newQuizTitle.trim()) return;
    try {
      const res = await apiRequest('/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          title: newQuizTitle,
          description: newQuizDescription,
          roundType: newQuizRoundType,
        }),
      });
      if (res.success) {
        setShowCreateModal(false);
        setNewQuizTitle('');
        setNewQuizDescription('');
        await loadQuizzes();
        loadQuizDetails(res.data._id);
      }
    } catch (err) {
      alert('Error creating quiz: ' + err.message);
    }
  };

  // Add question to selected quiz
  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!qText.trim() || !selectedQuiz) return;
    try {
      const res = await apiRequest(`/quizzes/${selectedQuiz._id}/questions`, {
        method: 'POST',
        body: JSON.stringify({
          questionText: qText,
          segment: qSegment,
          type: qType,
          timeLimitSec: Number(qTimeLimit),
          points: Number(qPoints),
          negativeMarking: qNegative,
          explanation: qExplanation,
          options: qOptions,
        }),
      });

      if (res.success) {
        setShowAddQuestionModal(false);
        setQText('');
        setQExplanation('');
        loadQuizDetails(selectedQuiz._id);
        loadQuizzes();
      }
    } catch (err) {
      alert('Error adding question: ' + err.message);
    }
  };

  const setCorrectOption = (optId) => {
    setQOptions(qOptions.map(opt => ({
      ...opt,
      isCorrect: opt.id === optId,
    })));
  };

  const updateOptionText = (optId, text) => {
    setQOptions(qOptions.map(opt => (opt.id === optId ? { ...opt, text } : opt)));
  };

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-[#131D31]/90 backdrop-blur-md px-6 py-4 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-500 to-amber-300 flex items-center justify-center font-bold text-slate-950 shadow-md">
            LA
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight font-heading">
              LearnUp <span className="text-yellow-400">Live Arena</span>
            </h1>
            <p className="text-xs text-slate-400">Host Quiz Manager & Question Bank</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
            <Shield className="w-3.5 h-3.5 text-yellow-400" />
            <span>{user?.name || 'Tournament Host'}</span>
            <span className="text-slate-500">•</span>
            <span className="text-blue-400 uppercase font-semibold">{user?.institution || 'BUFT'}</span>
          </div>

          <button
            onClick={() => {
              logout();
              navigate('/admin/login');
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area: 2-Column Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Quizzes List (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-yellow-400" />
              <span>Available Quizzes ({quizzes.length})</span>
            </h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-yellow-500/10 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Quiz</span>
            </button>
          </div>

          {loading ? (
            <div className="glass-panel p-8 rounded-xl text-center text-slate-400 text-sm">
              Loading quizzes...
            </div>
          ) : (
            <div className="space-y-3">
              {quizzes.map((quiz) => {
                const isSelected = selectedQuiz?._id === quiz._id;
                return (
                  <div
                    key={quiz._id}
                    onClick={() => loadQuizDetails(quiz._id)}
                    className={`p-4 rounded-xl border transition cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-slate-800/90 border-yellow-500/60 shadow-lg shadow-yellow-500/5'
                        : 'glass-panel hover:bg-slate-800/50 border-slate-700/60'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-0 left-0 bottom-0 w-1 bg-yellow-400" />
                    )}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-white text-sm line-clamp-1">
                        {quiz.title}
                      </h3>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex-shrink-0">
                        {quiz.roundType.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-1 mb-3">
                      {quiz.description || 'Official competition segment'}
                    </p>

                    <div className="flex items-center justify-between text-xs text-slate-300 pt-2 border-t border-slate-700/60">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-slate-400">
                          <HelpCircle className="w-3.5 h-3.5 text-yellow-400" />
                          <span>{quiz.questionCount || 0} Questions</span>
                        </span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          <span>{quiz.defaultTimeLimitSec}s</span>
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLaunchRoom(quiz._id);
                        }}
                        disabled={launchingPin === quiz._id}
                        className="px-2.5 py-1 rounded bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-sm transition active:scale-95"
                      >
                        <Play className="w-3 h-3 fill-slate-950" />
                        <span>{launchingPin === quiz._id ? 'Launching...' : 'Launch'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Quiz Inspector & Question Editor (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {selectedQuiz ? (
            <div className="glass-panel rounded-2xl p-6 border border-slate-700/80 flex flex-col gap-6">
              {/* Quiz Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      {selectedQuiz.roundType}
                    </span>
                    <span className="text-xs text-slate-400">
                      Created by Tournament Director
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white font-heading">
                    {selectedQuiz.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedQuiz.description || 'Configured for live auditorium sync'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleLaunchRoom(selectedQuiz._id)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-400 hover:from-yellow-400 hover:to-amber-300 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-yellow-500/20 active:scale-95 transition cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>Launch Live Room</span>
                  </button>

                  <button
                    onClick={() => setShowAddQuestionModal(true)}
                    className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Question</span>
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Questions in this round ({selectedQuiz.questions?.length || 0})
                  </h3>
                  <span className="text-xs text-slate-400">
                    Host will broadcast sequentially in this order
                  </span>
                </div>

                {(!selectedQuiz.questions || selectedQuiz.questions.length === 0) ? (
                  <div className="p-8 rounded-xl border border-dashed border-slate-700 text-center text-slate-400 text-sm">
                    No questions added yet. Click &quot;Add Question&quot; to build the question pool.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedQuiz.questions.map((q, idx) => (
                      <div
                        key={q._id}
                        className="p-4 rounded-xl bg-[#0A0F1D]/80 border border-slate-800 hover:border-slate-700 transition"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-start gap-2.5">
                            <span className="w-6 h-6 rounded-md bg-yellow-500/20 text-yellow-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                  {q.segment}
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                                  {q.type}
                                </span>
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  <span>{q.timeLimitSec}s</span>
                                </span>
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                  <Award className="w-3 h-3 text-yellow-500" />
                                  <span>{q.points} pts</span>
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-white">
                                {q.questionText}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Options Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80">
                          {q.options?.map((opt, oIdx) => {
                            const optLetters = ['A', 'B', 'C', 'D'];
                            const isCorrect = opt.isCorrect;
                            return (
                              <div
                                key={opt.id || oIdx}
                                className={`px-3 py-2 rounded-lg text-xs flex items-center justify-between border ${
                                  isCorrect
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-medium'
                                    : 'bg-slate-800/40 border-slate-800 text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="font-bold text-slate-400">
                                    {optLetters[oIdx]}.
                                  </span>
                                  <span className="truncate">{opt.text}</span>
                                </div>
                                {isCorrect && (
                                  <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Correct</span>
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {q.explanation && (
                          <div className="mt-2.5 text-xs text-slate-400 italic bg-slate-900/60 p-2 rounded border border-slate-800">
                            💡 Explanation: {q.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-12 text-center text-slate-400">
              Select a quiz from the list to view and configure its questions.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Quiz */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-elevated max-w-md w-full rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Create New Tournament Quiz</h3>
            <form onSubmit={handleCreateQuiz} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Quiz Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BUFT National Quiz 2025 - Quarter Finals"
                  value={newQuizTitle}
                  onChange={(e) => setNewQuizTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0F1D] border border-slate-700 rounded-lg text-white text-sm focus:border-yellow-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Official tournament stage..."
                  value={newQuizDescription}
                  onChange={(e) => setNewQuizDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0F1D] border border-slate-700 rounded-lg text-white text-sm focus:border-yellow-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Competition Round Type</label>
                <select
                  value={newQuizRoundType}
                  onChange={(e) => setNewQuizRoundType(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0F1D] border border-slate-700 rounded-lg text-white text-sm focus:border-yellow-400 focus:outline-none"
                >
                  <option value="PRELIMINARY_MCQ">Preliminary Online MCQ</option>
                  <option value="TEAM_MCQ">Campus Live MCQ (133 Teams)</option>
                  <option value="SEMI_BUZZER">Semi-Final Buzzer Round (6 Teams)</option>
                  <option value="GRAND_RAPID_FIRE">Grand Finale Audio-Visual & Rapid Fire</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold text-xs shadow-md"
                >
                  Save Quiz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Question */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel-elevated max-w-xl w-full rounded-2xl p-6 border border-slate-700 shadow-2xl my-8">
            <h3 className="text-lg font-bold text-white mb-4">Add Question to Quiz</h3>
            <form onSubmit={handleAddQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Question Text</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter the question (supports English and Bengali text)..."
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0F1D] border border-slate-700 rounded-lg text-white text-sm focus:border-yellow-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tournament Segment</label>
                  <select
                    value={qSegment}
                    onChange={(e) => setQSegment(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0F1D] border border-slate-700 rounded-lg text-white text-xs focus:border-yellow-400 focus:outline-none"
                  >
                    <option value="GENERAL">General Knowledge</option>
                    <option value="BANGLADESH">Segment A: Bangladesh Round</option>
                    <option value="WORLD">Segment B: World Affairs</option>
                    <option value="SCIENCE_TECH">Segment C: Science & Tech (ICT)</option>
                    <option value="HISTORY_CULTURE">Segment D: History & Culture</option>
                    <option value="SPORTS_AFFAIRS">Segment E: Sports & Current Affairs</option>
                    <option value="AUDIO_VISUAL">Audio-Visual Clues</option>
                    <option value="RAPID_FIRE">Rapid-Fire Round</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Question Type</label>
                  <select
                    value={qType}
                    onChange={(e) => setQType(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0F1D] border border-slate-700 rounded-lg text-white text-xs focus:border-yellow-400 focus:outline-none"
                  >
                    <option value="MCQ">Standard 4-Option MCQ</option>
                    <option value="BUZZER">Buzzer Question</option>
                    <option value="AUDIO_VISUAL">Audio / Visual Clue</option>
                    <option value="RAPID_FIRE">Rapid Fire</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Time Limit (Sec)</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={qTimeLimit}
                    onChange={(e) => setQTimeLimit(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0F1D] border border-slate-700 rounded-lg text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Base Points</label>
                  <input
                    type="number"
                    value={qPoints}
                    onChange={(e) => setQPoints(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0F1D] border border-slate-700 rounded-lg text-white text-xs"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="negMark"
                    checked={qNegative}
                    onChange={(e) => setQNegative(e.target.checked)}
                    className="w-4 h-4 text-red-500 rounded bg-slate-900 border-slate-700"
                  />
                  <label htmlFor="negMark" className="text-xs font-semibold text-red-400">
                    Negative Marking
                  </label>
                </div>
              </div>

              {/* Options Config */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Options (Select radio button for the correct answer)
                </label>
                {qOptions.map((opt, i) => {
                  const letters = ['A', 'B', 'C', 'D'];
                  return (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={opt.isCorrect}
                        onChange={() => setCorrectOption(opt.id)}
                        className="w-4 h-4 text-emerald-500 focus:ring-emerald-500"
                        title="Mark as correct option"
                      />
                      <span className="w-5 text-xs font-bold text-slate-400">
                        {letters[i]}:
                      </span>
                      <input
                        type="text"
                        required
                        placeholder={`Option ${letters[i]} text...`}
                        value={opt.text}
                        onChange={(e) => updateOptionText(opt.id, e.target.value)}
                        className={`flex-1 px-3 py-1.5 bg-[#0A0F1D] border rounded-lg text-xs text-white focus:outline-none ${
                          opt.isCorrect ? 'border-emerald-500/80 bg-emerald-950/20' : 'border-slate-700'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Explanation (Optional)</label>
                <input
                  type="text"
                  placeholder="Explanation shown after answer is revealed..."
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0F1D] border border-slate-700 rounded-lg text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md"
                >
                  Add Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
