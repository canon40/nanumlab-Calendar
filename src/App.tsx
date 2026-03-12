import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  MoreVertical,
  Trash2,
  Edit,
  AlertCircle,
  Lock,
  Unlock,
  Zap,
  Send,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { geminiService, Task } from './services/geminiService';

const CATEGORIES = {
  'Part 1': { name: '제조 (약품 안정)', time: '10:00 - 12:00', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  'Part 2': { name: '영업 (국내/해외)', time: '13:00 - 16:00', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  'Part 3': { name: '마케팅 및 정리', time: '16:00 - 18:00', color: 'bg-amber-50 border-amber-200 text-amber-700' },
};

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [smartInput, setSmartInput] = useState('');
  const [isSmartAdding, setIsSmartAdding] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly'>('Weekly');
  const [newTask, setNewTask] = useState({ 
    title: '', 
    category: 'Part 1', 
    deadline: '', 
    scheduled_date: new Date().toISOString().split('T')[0],
    impact: 3,
    urgency: 3,
    effort: 30,
    notes: '',
    status: 'pending',
    priority_score: undefined as number | undefined
  });
  const [report, setReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isRecommending, setIsRecommending] = useState<number | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null);
  const [tempNotes, setTempNotes] = useState('');

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(checkUpcomingTasks, 60000); // Check every minute
    
    // Fallback to stop loading after 5 seconds
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const checkUpcomingTasks = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Simple logic: if it's the start of a Part, show an alert
    if (currentMinute === 0) {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(() => {}); // Play sound (might be blocked by browser)
      
      if (currentHour === 10) alert('제조 파트(Part 1)가 시작되었습니다. 오늘의 Frog를 먼저 처리하세요!');
      if (currentHour === 13) alert('영업 파트(Part 2)가 시작되었습니다. 외부 채널 및 고객 대응에 집중하세요!');
      if (currentHour === 16) alert('마케팅 및 정리 파트(Part 3)가 시작되었습니다. 성과를 기록하고 내일을 준비하세요!');
    }
  };

  const syncCalendar = () => {
    alert('Google Calendar 연동 설정이 필요합니다. (OAuth Client ID/Secret 설정 후 활성화 가능)');
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTask) {
        await fetch(`/api/tasks/${editingTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTask),
        });
      } else {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTask),
        });
      }
      setIsModalOpen(false);
      setEditingTask(null);
      setNewTask({ 
        title: '', 
        category: 'Part 1', 
        deadline: '', 
        scheduled_date: todayStr,
        impact: 3,
        urgency: 3,
        effort: 30,
        notes: '',
        status: 'pending',
        priority_score: undefined
      });
      fetchTasks();
    } catch (err) {
      console.error('Failed to save task', err);
    }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setNewTask({
      title: task.title,
      category: task.category,
      deadline: task.deadline || '',
      scheduled_date: task.scheduled_date || todayStr,
      impact: task.impact,
      urgency: task.urgency,
      effort: task.effort,
      notes: task.notes || '',
      status: task.status || 'pending',
      priority_score: task.priority_score
    });
    setIsModalOpen(true);
  };

  const handleSmartAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smartInput.trim()) return;
    setIsSmartAdding(true);
    try {
      const expansion = await geminiService.smartIntegrateTask(smartInput, tasks);
      
      // 1. Add Main Task
      const mainRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expansion.main_task),
      });
      
      if (mainRes.ok) {
        const { id: parentId } = await mainRes.json();
        
        // 2. Add Sub Tasks (Task Expansion)
        for (const sub of expansion.sub_tasks) {
          await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...sub, parent_id: parentId }),
          });
        }
        
        setSmartInput('');
        fetchTasks();
      }
    } catch (err) {
      console.error('Failed to smart add task', err);
    } finally {
      setIsSmartAdding(false);
    }
  };

  const generateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const reportText = await geminiService.generateReport(tasks, reportPeriod);
      setReport(reportText);
    } catch (err) {
      console.error('Failed to generate report', err);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const autoSchedule = async () => {
    if (!confirm('AI가 수익 기반 우선순위($P$ Score) 로직에 따라 업무를 재배치합니다. (잠금된 일정은 유지됩니다)')) return;
    setIsScheduling(true);
    try {
      const suggestions = await geminiService.suggestSchedule(tasks);
      for (const suggestion of suggestions) {
        await fetch(`/api/tasks/${suggestion.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            category: suggestion.category, 
            scheduled_date: suggestion.scheduled_date,
            priority_score: suggestion.priority_score
          }),
        });
      }
      fetchTasks();
    } catch (err) {
      console.error('Failed to auto-schedule', err);
    } finally {
      setIsScheduling(false);
    }
  };

  const importCorePackages = async () => {
    if (!confirm('영민 대표님의 5대 핵심 전략 패키지를 일괄 등록하시겠습니까? (3/16~3/20 일정)')) return;
    setLoading(true);
    try {
      const packages = [
        {
          main: { title: '[영업] 영업 인프라 구축 및 채널 발굴 패키지', category: 'Part 2', scheduled_date: '2026-03-16', impact: 5, urgency: 4, effort: 240, notes: '수익 창출을 위한 영업 기초 인프라 구축' },
          subs: ['(다) 영업 리스트 정리', '(가) 협업 쇼핑몰 발굴', '(카) 견적서 양식 표준화']
        },
        {
          main: { title: '[글로벌 영업] 알리바바 및 수출 대응 패키지', category: 'Part 2', scheduled_date: '2026-03-17', impact: 5, urgency: 5, effort: 240, notes: '글로벌 시장 대응을 위한 세트 업무' },
          subs: ['(마) 알리바바 페이지 정리', '(차) 영문 사용설명서 제작', '(A) 수출 관련 매뉴얼 업데이트']
        },
        {
          main: { title: '[제조] 레시피 고도화 및 품질 안정화 패키지', category: 'Part 1', scheduled_date: '2026-03-18', impact: 4, urgency: 4, effort: 300, notes: '제품 품질 신뢰도 확보를 위한 제조 세트' },
          subs: ['(사) 레시피 고도화', '(자) 안정화 테스트', '(파) 테스트 시트 작성 및 보고']
        },
        {
          main: { title: '[행정/기획] 공장 등록 및 수출 지원 패키지', category: 'Part 1', scheduled_date: '2026-03-19', impact: 4, urgency: 3, effort: 300, notes: '규모 확장을 위한 행정 및 신규 기획 세트' },
          subs: ['(나) 공장 등록 절차 확인', '(하) KITA 수출바우처 자료 준비', '(아) 건식 코팅제 기획']
        },
        {
          main: { title: '[마감] 주간 성과 분석 및 자동 보고서 생성 패키지', category: 'Part 3', scheduled_date: '2026-03-20', impact: 5, urgency: 5, effort: 180, notes: '17시 마감 프로세스' },
          subs: ['(N, O) 성과 분류', '(S) 주간 보고서 자동 생성', '(L) 차주 계획 수립']
        }
      ];

      for (const pkg of packages) {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pkg.main),
        });
        if (res.ok) {
          const { id: parentId } = await res.json();
          for (const subTitle of pkg.subs) {
            await fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                title: subTitle, 
                category: pkg.main.category, 
                scheduled_date: pkg.main.scheduled_date,
                parent_id: parentId,
                impact: 3,
                urgency: 3,
                effort: 30
              }),
            });
          }
        }
      }
      fetchTasks();
      alert('5대 핵심 전략 패키지가 성공적으로 등록되었습니다.');
    } catch (err) {
      console.error('Failed to import packages', err);
    } finally {
      setLoading(false);
    }
  };

  const recommendSubTasks = async (task: Task) => {
    setIsRecommending(task.id);
    try {
      const result = await geminiService.smartIntegrateTask(task.title, tasks);
      
      for (const sub of result.sub_tasks) {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            ...sub,
            parent_id: task.id,
            scheduled_date: task.scheduled_date
          }),
        });
      }
      fetchTasks();
      alert(`'${task.title}' 업무와 연관된 3개의 하위 과업이 자동으로 생성되었습니다.`);
    } catch (err) {
      console.error('Failed to recommend sub-tasks', err);
    } finally {
      setIsRecommending(null);
    }
  };

  const toggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTasks();
    } catch (err) {
      console.error('Failed to update task', err);
    }
  };

  const toggleLock = async (id: number, currentLock: number) => {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_locked: currentLock === 1 ? 0 : 1 }),
      });
      fetchTasks();
    } catch (err) {
      console.error('Failed to toggle lock', err);
    }
  };

  const deleteTask = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      fetchTasks();
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  };

  const mainTasks = tasks.filter(t => !t.parent_id);
  const subTasks = tasks.filter(t => t.parent_id);

  const groupedTasks = mainTasks.reduce((acc, task) => {
    const date = task.scheduled_date || 'Unscheduled';
    if (!acc[date]) acc[date] = { 'Part 1': [], 'Part 2': [], 'Part 3': [] };
    if (acc[date][task.category]) {
      acc[date][task.category].push(task);
    }
    return acc;
  }, {} as Record<string, Record<string, Task[]>>);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTasks = groupedTasks[todayStr] || { 'Part 1': [], 'Part 2': [], 'Part 3': [] };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">나눔랩 OS <span className="text-indigo-600 text-sm font-normal ml-1">v2.0</span></h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Goal: 연 매출 10억 달성</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
              {(['Weekly', 'Monthly', 'Quarterly', 'Yearly'] as const).map(p => (
                <button 
                  key={p}
                  onClick={() => setReportPeriod(p)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${reportPeriod === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button 
              onClick={syncCalendar}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Calendar size={18} />
              캘린더 연동
            </button>
            <button 
              onClick={importCorePackages}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              <Plus size={18} />
              핵심 패키지
            </button>
            <button 
              onClick={autoSchedule}
              disabled={isScheduling}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <Zap size={18} />
              {isScheduling ? 'AI 배치 중...' : 'AI 자동 배치'}
            </button>
            <button 
              onClick={generateReport}
              disabled={isGeneratingReport}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <FileText size={18} />
              {isGeneratingReport ? '분석 중...' : '성과 보고서'}
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
            >
              <Plus size={18} />
              업무 추가
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Smart Add Bar (T: Dynamic Integration) */}
        <div className="mb-10">
          <form onSubmit={handleSmartAdd} className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-indigo-500">
              <Zap size={20} className={isSmartAdding ? 'animate-pulse' : ''} />
            </div>
            <input 
              value={smartInput}
              onChange={e => setSmartInput(e.target.value)}
              disabled={isSmartAdding}
              placeholder="갑자기 생긴 업무를 입력하세요 (예: 알리바바 견적 요청 대응)"
              className="w-full pl-12 pr-32 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
            />
            <div className="absolute inset-y-2 right-2 flex items-center">
              <button 
                type="submit"
                disabled={isSmartAdding || !smartInput.trim()}
                className="h-full px-6 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                {isSmartAdding ? '분석 중...' : (
                  <>
                    <Send size={16} />
                    스마트 통합
                  </>
                )}
              </button>
            </div>
          </form>
          <p className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5 ml-2">
            <AlertCircle size={12} />
            P(우선순위), T(연동), U(기한) 규칙이 자동 적용됩니다
          </p>
        </div>

        {/* Today's Overview */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              오늘의 3분할 실행 <span className="text-slate-400 font-normal text-lg">{todayStr}</span>
              {new Date().getDay() === 0 && (
                <span className="ml-4 px-3 py-1 bg-rose-100 text-rose-600 text-xs font-bold rounded-full animate-pulse">
                  일요일: 주간 계획 수립일 (L)
                </span>
              )}
              {new Date().getDay() === 5 && (
                <span className="ml-4 px-3 py-1 bg-emerald-100 text-emerald-600 text-xs font-bold rounded-full animate-pulse">
                  금요일: 주간 보고 마감일 (M)
                </span>
              )}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(CATEGORIES).map(([key, info]) => (
              <div key={key} className="flex flex-col gap-4">
                <div className={`p-4 rounded-2xl border ${info.color} shadow-sm`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase tracking-widest opacity-70">{key}</span>
                    <Clock size={16} className="opacity-70" />
                  </div>
                  <h3 className="font-bold text-lg">{info.name}</h3>
                  <p className="text-sm font-medium opacity-80">{info.time}</p>
                </div>

                <div className="space-y-3">
                  {todayTasks[key]?.length > 0 ? (
                    todayTasks[key].map((task) => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={task.id} 
                        className={`group p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-300 transition-all ${task.status === 'completed' ? 'opacity-60' : ''} ${task.is_locked ? 'border-l-4 border-l-indigo-500' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <button 
                            onClick={() => toggleStatus(task.id, task.status)}
                            className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${task.status === 'completed' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 hover:border-indigo-400'}`}
                          >
                            {task.status === 'completed' && <CheckCircle2 size={14} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className={`font-semibold text-sm truncate ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                  {task.title}
                                </p>
                                {task.status === 'in_progress' && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 animate-pulse">진행중</span>
                                )}
                                {task.status === 'postponed' && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">연기</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {task.priority_score !== undefined && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 flex items-center gap-1">
                                    <Zap size={10} />
                                    {task.priority_score <= 5 ? `${task.priority_score}순위` : `AI ${Number(task.priority_score).toFixed(0)}`}
                                  </span>
                                )}
                                <button 
                                  onClick={() => openEditModal(task)}
                                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                                  title="업무 수정"
                                >
                                  <Edit size={14} />
                                </button>
                                <button 
                                  onClick={() => toggleLock(task.id, task.is_locked)}
                                  className={`p-1 rounded hover:bg-slate-100 transition-colors ${task.is_locked ? 'text-indigo-600' : 'text-slate-300'}`}
                                  title={task.is_locked ? '일정 고정됨 (Q)' : '일정 고정하기'}
                                >
                                  {task.is_locked ? <Lock size={14} /> : <Unlock size={14} />}
                                </button>
                                <button 
                                  onClick={() => recommendSubTasks(task)}
                                  disabled={isRecommending === task.id}
                                  className={`p-1 rounded hover:bg-indigo-50 transition-colors ${isRecommending === task.id ? 'text-indigo-400 animate-spin' : 'text-indigo-500'}`}
                                  title="연관 업무 자동 생성 (Magic Linker)"
                                >
                                  <Sparkles size={14} />
                                </button>
                              </div>
                            </div>
                            
                            {/* Sub-tasks (Hidden Task Linker) */}
                            {subTasks.filter(st => st.parent_id === task.id).length > 0 && (
                              <div className="mt-2 space-y-1 pl-2 border-l-2 border-indigo-100">
                                <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Hidden Linker</p>
                                {subTasks.filter(st => st.parent_id === task.id).map(st => (
                                  <div key={st.id} className="flex items-center gap-2 text-[11px] text-slate-500 font-medium group/sub">
                                    <button 
                                      onClick={() => toggleStatus(st.id, st.status)}
                                      className={`w-2 h-2 rounded-full transition-all ${st.status === 'completed' ? 'bg-emerald-400' : 'bg-slate-300 hover:bg-indigo-400'}`} 
                                    />
                                    <span className={`${st.status === 'completed' ? 'line-through opacity-50' : ''} flex-1`}>{st.title}</span>
                                    <button 
                                      onClick={() => deleteTask(st.id)}
                                      className="opacity-0 group-hover/sub:opacity-100 text-rose-400 hover:text-rose-600"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-3 mt-1.5">
                              {task.deadline && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500 uppercase">
                                  <AlertCircle size={10} />
                                  U: {task.deadline}
                                </div>
                              )}
                              <div className="text-[10px] font-bold text-slate-400 uppercase">
                                {task.effort}분
                              </div>
                            </div>

                            {/* Notes / Reason (N, O) */}
                            <div className="mt-2">
                              {editingNotesId === task.id ? (
                                <div className="flex gap-2">
                                  <input 
                                    autoFocus
                                    value={tempNotes}
                                    onChange={e => setTempNotes(e.target.value)}
                                    onBlur={async () => {
                                      await fetch(`/api/tasks/${task.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ notes: tempNotes }),
                                      });
                                      setEditingNotesId(null);
                                      fetchTasks();
                                    }}
                                    placeholder="지연 사유 또는 메모 입력..."
                                    className="flex-1 text-[11px] px-2 py-1 bg-slate-50 border border-slate-200 rounded outline-none"
                                  />
                                </div>
                              ) : (
                                <p 
                                  onClick={() => {
                                    setEditingNotesId(task.id);
                                    setTempNotes(task.notes || '');
                                  }}
                                  className="text-[11px] text-slate-500 italic cursor-pointer hover:text-indigo-500"
                                >
                                  {task.notes || '+ 사유/메모 추가 (N, O)'}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => openEditModal(task)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-500 transition-all"
                              title="수정"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => deleteTask(task.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-all"
                              title="삭제"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm font-medium">
                      배정된 업무가 없습니다
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Weekly View */}
        <section>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Calendar size={20} className="text-indigo-600" />
            주간 실행 계획표
          </h2>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
              {['월', '화', '수', '목', '금', '토', '일'].map(day => (
                <div key={day} className="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 h-64">
              {Array.from({ length: 7 }).map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - date.getDay() + i + 1);
                const dateStr = date.toISOString().split('T')[0];
                const dayTasks = groupedTasks[dateStr];
                const count = dayTasks ? Object.values(dayTasks).flat().length : 0;

                return (
                  <div key={i} className={`p-3 border-r border-slate-100 last:border-r-0 ${dateStr === todayStr ? 'bg-indigo-50/30' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold ${dateStr === todayStr ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {date.getDate()}
                      </span>
                      {count > 0 && <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600">{count}</span>}
                    </div>
                    <div className="space-y-1">
                      {dayTasks && Object.entries(dayTasks).map(([cat, tks]) => 
                        (tks as Task[]).slice(0, 2).map(t => (
                          <div key={t.id} className="text-[10px] truncate px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                            {t.title}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Add Task Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-xl">{editingTask ? '업무 수정' : '새 업무 추가'}</h3>
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingTask(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <ChevronRight size={20} className="rotate-90" />
                </button>
              </div>
              <form onSubmit={addTask} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">업무명</label>
                  <input 
                    required
                    value={newTask.title}
                    onChange={e => setNewTask({...newTask, title: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    placeholder="수행할 업무를 입력하세요"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">상태</label>
                    <select 
                      value={newTask.status}
                      onChange={e => setNewTask({...newTask, status: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    >
                      <option value="pending">진행 대기</option>
                      <option value="in_progress">진행중 (Doing)</option>
                      <option value="completed">완료 (Done)</option>
                      <option value="postponed">연기 (Postponed)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">우선순위 (1-5)</label>
                    <select 
                      value={newTask.priority_score || ''}
                      onChange={e => setNewTask({...newTask, priority_score: e.target.value ? parseFloat(e.target.value) : undefined})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    >
                      <option value="">AI 자동 계산</option>
                      {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}순위 {v === 1 ? '(최고)' : v === 5 ? '(최저)' : ''}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">중요도 (Impact 1-5)</label>
                    <select 
                      value={newTask.impact}
                      onChange={e => setNewTask({...newTask, impact: parseInt(e.target.value)})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    >
                      {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}점 {v === 5 ? '(수익 직결)' : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">긴급도 (Urgency 1-5)</label>
                    <select 
                      value={newTask.urgency}
                      onChange={e => setNewTask({...newTask, urgency: parseInt(e.target.value)})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    >
                      {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}점 {v === 5 ? '(마감 임박)' : ''}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">소요 시간 (분)</label>
                    <input 
                      type="number"
                      value={newTask.effort}
                      onChange={e => setNewTask({...newTask, effort: parseInt(e.target.value)})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">실행 날짜</label>
                    <input 
                      type="date"
                      value={newTask.scheduled_date}
                      onChange={e => setNewTask({...newTask, scheduled_date: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">마감 시간</label>
                    <input 
                      type="text"
                      value={newTask.deadline}
                      onChange={e => setNewTask({...newTask, deadline: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                      placeholder="예: 14:00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">업무 구분 (3분할)</label>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(CATEGORIES).map(([key, info]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewTask({...newTask, category: key})}
                        className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${newTask.category === key ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}
                      >
                        <div className="text-left">
                          <p className="text-sm font-bold text-slate-800">{info.name}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{key} • {info.time}</p>
                        </div>
                        {newTask.category === key && <CheckCircle2 size={18} className="text-indigo-600" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    {newTask.status === 'postponed' ? '연기 사유 (왜 미뤄졌나요?)' : 
                     newTask.status === 'in_progress' ? '현재 진행 상황 (어떤 걸 하고 있나요?)' :
                     newTask.status === 'completed' ? '완료 보고 (어떻게 완료했나요?)' :
                     '메모 및 성과 기록'}
                  </label>
                  <textarea 
                    value={newTask.notes}
                    onChange={e => setNewTask({...newTask, notes: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium min-h-[100px]"
                    placeholder={
                      newTask.status === 'postponed' ? '연기된 이유를 기록하세요' : 
                      newTask.status === 'in_progress' ? '현재 작업 중인 내용을 기록하세요' :
                      newTask.status === 'completed' ? '최종 결과와 성과를 기록하세요' :
                      '업무 상세 내용이나 성과를 기록하세요'
                    }
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                  >
                    {editingTask ? '수정 완료' : '저장하기'}
                  </button>
                  {editingTask && (
                    <button 
                      type="button"
                      onClick={() => {
                        deleteTask(editingTask.id);
                        setIsModalOpen(false);
                        setEditingTask(null);
                      }}
                      className="px-4 py-3 bg-rose-50 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-all"
                      title="업무 삭제"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingTask(null);
                    }}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    취소
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Report Modal (Existing) */}
      <AnimatePresence>
        {report && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                <h3 className="font-bold text-lg">{reportPeriod} 성과 보고서 (NanumLab OS)</h3>
                <button onClick={() => setReport(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto prose prose-slate">
                <div className="whitespace-pre-wrap font-medium text-slate-700 leading-relaxed">
                  {report}
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => {
                    const blob = new Blob([report], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${reportPeriod}보고서_${new Date().toISOString().split('T')[0]}.txt`;
                    a.click();
                  }}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700"
                >
                  다운로드
                </button>
                <button onClick={() => setReport(null)} className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg">
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
