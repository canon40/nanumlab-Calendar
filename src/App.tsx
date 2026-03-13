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
  Sparkles,
  Moon,
  Sun,
  Search,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { geminiService, Task } from './services/geminiService';

const CATEGORIES = {
  'Part 1': { name: '제조 (약품 안정)', time: '10:00 - 12:00', color: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300', card: 'bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300' },
  'Part 2': { name: '영업 (국내/해외)', time: '13:00 - 16:00', color: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300', card: 'bg-emerald-100 dark:bg-emerald-900/50 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300' },
  'Part 3': { name: '마케팅 및 정리', time: '16:00 - 18:00', color: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300', card: 'bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-800/50 text-amber-700 dark:text-amber-300' },
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
    priority_score: undefined as number | undefined,
    doc_url: ''
  });
  const [report, setReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isRecommending, setIsRecommending] = useState<number | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('nanumlab-dark');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [isRelatedOpen, setIsRelatedOpen] = useState(false);
  const [relatedKeyword, setRelatedKeyword] = useState('');
  const [relatedSelectedTask, setRelatedSelectedTask] = useState<Task | null>(null);
  const [relatedSuggestions, setRelatedSuggestions] = useState<{ title: string; category: string; effort?: number; scheduled_date?: string }[]>([]);
  const [isRelatedLoading, setIsRelatedLoading] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('nanumlab-dark', String(darkMode));
  }, [darkMode]);

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

  const syncCalendar = async () => {
    try {
      const res = await fetch('/api/google/auth-url');
      const data = await res.json();
      if (!data.url) {
        alert(data.error || 'Google OAuth 설정을 확인하세요.');
        return;
      }
      const authWindow = window.open(data.url, '_blank', 'width=500,height=700');
      if (!authWindow) {
        alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.');
        return;
      }
      const poll = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(poll);
          fetch('/api/google/sync', { method: 'POST' })
            .then(r => r.json())
            .then(result => {
              if (result.error) {
                alert(result.error);
              } else {
                alert(`Google Calendar에 ${result.count ?? 0}건의 일정을 동기화했습니다.`);
              }
            })
            .catch(() => alert('Google Calendar 동기화 중 오류가 발생했습니다.'));
        }
      }, 1000);
    } catch (e) {
      alert('Google Calendar 연동 중 오류가 발생했습니다.');
    }
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
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTask),
        });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error || '저장 실패');
          return;
        }
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
        priority_score: undefined,
        doc_url: ''
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
    if (!acc[date][task.category]) acc[date][task.category] = [];
    if (acc[date][task.category].length < 1) acc[date][task.category].push(task);
    return acc;
  }, {} as Record<string, Record<string, Task[]>>);

  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date();
  const isFriday = today.getDay() === 5;
  const isSunday = today.getDay() === 0;
  const todayTasks = groupedTasks[todayStr] || { 'Part 1': [], 'Part 2': [], 'Part 3': [] };

  const getMonthMatrix = (monthDate: Date) => {
    const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const startDay = (start.getDay() + 6) % 7; // 월(0) 기준
    const firstMonday = new Date(start);
    firstMonday.setDate(start.getDate() - startDay);

    const weeks: Date[][] = [];
    let cursor = new Date(firstMonday);

    for (let w = 0; w < 6; w++) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  };

  const monthMatrix = getMonthMatrix(currentMonth);
  const monthLabel = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;

  const filteredMainTasks = mainTasks.filter(
    t => !relatedKeyword.trim() || t.title.toLowerCase().includes(relatedKeyword.trim().toLowerCase())
  );

  const fetchRelatedSuggestions = async (task: Task) => {
    setRelatedSelectedTask(task);
    setIsRelatedLoading(true);
    setRelatedSuggestions([]);
    try {
      const result = await geminiService.smartIntegrateTask(task.title, tasks);
      setRelatedSuggestions(result.sub_tasks || []);
    } catch (err) {
      console.error('Failed to fetch related tasks', err);
      alert('연관 업무 추천을 불러오지 못했습니다. GEMINI_API_KEY 설정을 확인하세요.');
    } finally {
      setIsRelatedLoading(false);
    }
  };

  const addRelatedToSchedule = async () => {
    if (!relatedSelectedTask || relatedSuggestions.length === 0) return;
    try {
      for (const sub of relatedSuggestions) {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: sub.title,
            category: sub.category,
            impact: 3,
            urgency: 3,
            effort: sub.effort ?? 30,
            parent_id: relatedSelectedTask.id,
            scheduled_date: relatedSelectedTask.scheduled_date || todayStr,
          }),
        });
      }
      fetchTasks();
      setRelatedSuggestions([]);
      alert(`${relatedSuggestions.length}건의 연관 업무가 일정에 추가되었습니다.`);
    } catch (err) {
      console.error('Failed to add related tasks', err);
      alert('일정 추가 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4 overflow-hidden">
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => setDarkMode(prev => !prev)}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title={darkMode ? '라이트 모드' : '다크 모드'}
              aria-label={darkMode ? '라이트 모드' : '다크 모드'}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">나눔랩 OS <span className="text-indigo-600 dark:text-indigo-400 text-sm font-normal ml-1">v2.0</span></h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Goal: 연 매출 10억 달성</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto">
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                {(['Weekly', 'Monthly', 'Quarterly', 'Yearly'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setReportPeriod(p)}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${reportPeriod === p ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                  >
                    {p === 'Weekly' ? '주간' : p === 'Monthly' ? '월간' : p === 'Quarterly' ? '분기' : '연간'}
                  </button>
                ))}
              </div>
              <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">
                {reportPeriod === 'Weekly' && '보기·보고 기준: 주간'}
                {reportPeriod === 'Monthly' && '보기·보고 기준: 월간'}
                {reportPeriod === 'Quarterly' && '보기·보고 기준: 분기'}
                {reportPeriod === 'Yearly' && '보기·보고 기준: 연간'}
              </span>
            </div>
            <button 
              onClick={syncCalendar}
              title="현재 일정들을 Google Calendar와 동기화합니다."
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Calendar size={18} />
              캘린더 연동
            </button>
            <button 
              onClick={importCorePackages}
              title="영민 대표님의 핵심 전략 패키지를 미리 정의된 일정으로 한 번에 불러옵니다."
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
            >
              <Plus size={18} />
              핵심 패키지
            </button>
            <button 
              onClick={autoSchedule}
              disabled={isScheduling}
              title="P 점수(Impact·Urgency)를 기준으로 하루 3분할 시간표에 자동 재배치합니다."
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors disabled:opacity-50"
            >
              <Zap size={18} />
              {isScheduling ? 'AI 배치 중...' : 'AI 자동 배치'}
            </button>
            <button 
              onClick={generateReport}
              disabled={isGeneratingReport}
              title="선택된 기준(주간·월간·분기·연간)에 맞춰 성과 보고서를 생성합니다."
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <FileText size={18} />
              {isGeneratingReport ? '분석 중...' : '성과 보고서'}
            </button>
            <button 
              onClick={() => { setIsRelatedOpen(true); setRelatedKeyword(''); setRelatedSelectedTask(null); setRelatedSuggestions([]); }}
              title="등록된 업무들 중에서 비슷한 업무를 찾고, AI로 연관 업무까지 추천받습니다."
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-colors"
            >
              <Search size={18} />
              관련 업무 찾기
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg font-semibold shadow-md shadow-indigo-100 dark:shadow-indigo-900/30 hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all active:scale-95"
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
              className="w-full pl-12 pr-32 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            <div className="absolute inset-y-2 right-2 flex items-center">
              <button 
                type="submit"
                disabled={isSmartAdding || !smartInput.trim()}
                title="한 줄로 업무를 쓰면, AI가 메인 업무와 필요한 연관 업무 3가지를 만들어 일정에 배치합니다."
                className="h-full px-6 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-all"
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
          <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5 ml-2">
            <AlertCircle size={12} />
            P(우선순위), T(연동), U(기한) 규칙이 자동 적용됩니다
          </p>
        </div>

        {/* 일요일: 다음 주 계획 배너, 금요일: 주간 보고 배너 */}
        {(isSunday || isFriday) && (
          <section className="mb-8">
            <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white rounded-2xl px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-md">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
                  WEEKLY RITUAL
                </p>
                {isSunday && (
                  <p className="text-sm md:text-base font-bold">
                    오늘은 <span className="underline decoration-amber-300">주간 계획서 작성일</span>입니다. 다음 주에 꼭 하고 싶은 일을 미리 적어두세요.
                  </p>
                )}
                {isFriday && (
                  <p className="text-sm md:text-base font-bold">
                    오늘은 <span className="underline decoration-emerald-300">주간 보고서 작성일</span>입니다. 이번 주에 한 일을 정리해 보고서를 남겨두세요.
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {isSunday && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextMonday = new Date();
                      const day = nextMonday.getDay();
                      const diff = (8 - day) % 7 || 7;
                      nextMonday.setDate(nextMonday.getDate() + diff);
                      const mondayStr = nextMonday.toISOString().split('T')[0];
                      setIsModalOpen(true);
                      setEditingTask(null);
                      setNewTask(prev => ({
                        ...prev,
                        title: `주간 계획 (${mondayStr} 시작)`,
                        scheduled_date: mondayStr,
                        category: 'Part 3',
                        status: 'pending'
                      }));
                    }}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1.5"
                  >
                    <Calendar size={14} />
                    주간 계획 쓰기
                  </button>
                )}
                {isFriday && (
                  <button
                    type="button"
                    onClick={generateReport}
                    disabled={isGeneratingReport}
                    className="px-3 py-2 bg-white text-indigo-700 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1.5 hover:bg-amber-50 disabled:opacity-60"
                  >
                    <FileText size={14} />
                    {isGeneratingReport ? '보고서 생성 중...' : '주간 보고서 만들기'}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 분기 보기 (Quarterly 선택 시) */}
        {reportPeriod === 'Quarterly' && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 dark:text-slate-100">
              <Calendar size={20} className="text-indigo-600 dark:text-indigo-400" />
              분기 보기 (이번 분기 3개월)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(() => {
                const now = new Date();
                const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
                return [0, 1, 2].map(offset => {
                  const m = new Date(now.getFullYear(), quarterStartMonth + offset, 1);
                  const monthKey = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
                  const prefix = monthKey + '-';
                  const monthTasks = tasks.filter(t => t.scheduled_date && t.scheduled_date.startsWith(prefix));
                  const completed = monthTasks.filter(t => t.status === 'completed').length;
                  return (
                    <div key={monthKey} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
                      <div className="font-bold text-slate-700 dark:text-slate-200 mb-2">
                        {m.getFullYear()}년 {m.getMonth() + 1}월
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        일정 {monthTasks.length}건 · 완료 {completed}건
                      </div>
                      <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                        {monthTasks.slice(0, 5).map(t => (
                          <li key={t.id} className="text-xs truncate flex items-center gap-1">
                            {t.status === 'completed' && <CheckCircle2 size={10} className="text-emerald-500 flex-shrink-0" />}
                            <span className={t.status === 'completed' ? 'line-through text-slate-400' : ''}>{t.title}</span>
                          </li>
                        ))}
                        {monthTasks.length > 5 && <li className="text-xs text-slate-400">외 {monthTasks.length - 5}건</li>}
                      </ul>
                    </div>
                  );
                });
              })()}
            </div>
            <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">성과 보고서 버튼을 누르면 분기 기준 보고서가 생성됩니다.</p>
          </section>
        )}

        {/* 연간 보기 (Yearly 선택 시) */}
        {reportPeriod === 'Yearly' && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 dark:text-slate-100">
              <Calendar size={20} className="text-indigo-600 dark:text-indigo-400" />
              연간 보기 (올해 12개월)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Array.from({ length: 12 }, (_, i) => {
                const m = new Date(new Date().getFullYear(), i, 1);
                const monthKey = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
                const prefix = monthKey + '-';
                const monthTasks = tasks.filter(t => t.scheduled_date && t.scheduled_date.startsWith(prefix));
                const completed = monthTasks.filter(t => t.status === 'completed').length;
                return (
                  <div key={monthKey} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-sm">
                    <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{m.getMonth() + 1}월</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {monthTasks.length}건 · 완료 {completed}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">성과 보고서 버튼을 누르면 연간 기준 보고서가 생성됩니다.</p>
          </section>
        )}

        {/* Today's Overview */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 dark:text-slate-100">
              오늘의 3분할 실행 <span className="text-slate-400 dark:text-slate-500 font-normal text-lg">{todayStr}</span>
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
                        className={`group p-4 rounded-xl shadow-sm transition-all ${task.status === 'completed' ? 'opacity-60' : ''} ${task.is_locked ? 'border-l-4 border-l-indigo-500' : ''} ${CATEGORIES[task.category as keyof typeof CATEGORIES]?.color || 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'}`}
                      >
                        <div className="flex items-start gap-3">
                          <button 
                            onClick={() => toggleStatus(task.id, task.status)}
                            className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${task.status === 'completed' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500'}`}
                          >
                            {task.status === 'completed' && <CheckCircle2 size={14} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className={`font-semibold text-sm truncate ${task.status === 'completed' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
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
                                  className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/50 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                  title="업무 수정 (내용·연기·메모)"
                                >
                                  <Edit size={14} />
                                </button>
                                <button 
                                  onClick={() => toggleLock(task.id, task.is_locked)}
                                  className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${task.is_locked ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-500'}`}
                                  title={task.is_locked ? '일정 고정됨 (Q)' : '일정 고정하기'}
                                >
                                  {task.is_locked ? <Lock size={14} /> : <Unlock size={14} />}
                                </button>
                                <button 
                                  onClick={() => recommendSubTasks(task)}
                                  disabled={isRecommending === task.id}
                                  className={`p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors ${isRecommending === task.id ? 'text-indigo-400 animate-spin' : 'text-indigo-500 dark:text-indigo-400'}`}
                                  title="연관 업무 자동 생성 (Magic Linker)"
                                >
                                  <Sparkles size={14} />
                                </button>
                              </div>
                            </div>
                            
                            {/* Sub-tasks (Hidden Task Linker) */}
                            {subTasks.filter(st => st.parent_id === task.id).length > 0 && (
                              <div className="mt-2 space-y-1 pl-2 border-l-2 border-indigo-100 dark:border-indigo-800">
                                <p className="text-[9px] font-bold text-indigo-400 dark:text-indigo-500 uppercase tracking-widest mb-1">Hidden Linker</p>
                                {subTasks.filter(st => st.parent_id === task.id).map(st => (
                                  <div key={st.id} className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium group/sub">
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
                                <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase">
                                  <AlertCircle size={10} />
                                  U: {task.deadline}
                                </div>
                              )}
                              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                                {task.effort}분
                              </div>
                              {task.doc_url && (
                                <button
                                  type="button"
                                  onClick={() => window.open(task.doc_url!, '_blank')}
                                  title="관련 문서(구글 문서/시트/드라이브)를 새 창에서 엽니다."
                                  className="flex items-center gap-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                                >
                                  <LinkIcon size={12} />
                                  문서
                                </button>
                              )}
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
                                    className="flex-1 text-[11px] px-2 py-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded outline-none text-slate-900 dark:text-slate-100"
                                  />
                                </div>
                              ) : (
                                <p 
                                  onClick={() => {
                                    setEditingNotesId(task.id);
                                    setTempNotes(task.notes || '');
                                  }}
                                  className="text-[11px] text-slate-500 dark:text-slate-400 italic cursor-pointer hover:text-indigo-500 dark:hover:text-indigo-400"
                                >
                                  {task.notes || '+ 사유/메모 추가 (N, O)'}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => openEditModal(task)}
                              className="p-1 text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded transition-all"
                              title="수정"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => deleteTask(task.id)}
                              className="p-1 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition-all"
                              title="삭제"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="py-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl text-slate-400 dark:text-slate-500 text-sm font-medium">
                      배정된 업무가 없습니다
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Weekly View - 2주 */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 dark:text-slate-100">
            <Calendar size={20} className="text-indigo-600 dark:text-indigo-400" />
            주간 실행 계획표 (2주)
          </h2>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            {[0, 1].map(weekOffset => {
              const weekStart = new Date();
              const daysSinceMonday = (weekStart.getDay() + 6) % 7;
              weekStart.setDate(weekStart.getDate() - daysSinceMonday + weekOffset * 7);
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekStart.getDate() + 6);
              const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()} ~ ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
              return (
                <div key={weekOffset} className={weekOffset > 0 ? 'border-t-2 border-slate-200 dark:border-slate-600' : ''}>
                  <div className="px-4 py-1.5 bg-slate-100/80 dark:bg-slate-700/80 text-xs font-bold text-slate-600 dark:text-slate-300">{weekLabel}</div>
                  <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/30">
                    {['월', '화', '수', '목', '금', '토', '일'].map((day, di) => (
                      <div key={day} className={`py-2 text-center text-xs font-bold uppercase tracking-widest ${di === 5 ? 'text-blue-600 dark:text-blue-400' : di === 6 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>{day}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 h-56">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const date = new Date(weekStart);
                      date.setDate(weekStart.getDate() + i);
                      const dateStr = date.toISOString().split('T')[0];
                      const dayTasks = groupedTasks[dateStr];
                      const count = dayTasks ? Object.values(dayTasks).flat().length : 0;

                      return (
                        <div key={`${weekOffset}-${i}`} className={`p-3 border-r border-slate-100 dark:border-slate-600 last:border-r-0 ${dateStr === todayStr ? 'bg-indigo-50/30 dark:bg-indigo-900/20' : i === 5 ? 'bg-blue-50/50 dark:bg-blue-900/20' : i === 6 ? 'bg-rose-50/50 dark:bg-rose-900/20' : ''}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-bold ${dateStr === todayStr ? 'text-indigo-600 dark:text-indigo-400' : i === 5 ? 'text-blue-600 dark:text-blue-400' : i === 6 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>
                              {date.getMonth() + 1}/{date.getDate()}
                            </span>
                            {count > 0 && <span className="w-5 h-5 bg-slate-100 dark:bg-slate-600 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">{count}</span>}
                          </div>
                          <div className="space-y-1">
                            {dayTasks && Object.entries(dayTasks).map(([cat, tks]) => 
                              (tks as Task[]).slice(0, 4).map(t => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => openEditModal(t)}
                                  className={`w-full text-left text-[10px] truncate px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer group/card flex items-center gap-1 ${CATEGORIES[t.category as keyof typeof CATEGORIES]?.card || 'bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 text-slate-600 dark:text-slate-300'}`}
                                  title="클릭하여 수정·연기·메모"
                                >
                                  {t.status === 'completed' && <CheckCircle2 size={10} className="flex-shrink-0 text-emerald-500" />}
                                  {t.status === 'postponed' && <Clock size={10} className="flex-shrink-0 text-amber-500" />}
                                  <span className="truncate flex-1">{t.title}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Monthly View */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2 dark:text-slate-100">
              <Calendar size={20} className="text-indigo-600 dark:text-indigo-400" />
              월간 실행 캘린더
            </h2>
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  const d = new Date(currentMonth);
                  d.setMonth(d.getMonth() - 1);
                  setCurrentMonth(d);
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="font-semibold text-slate-700 dark:text-slate-200 min-w-[120px] text-center">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={() => {
                  const d = new Date(currentMonth);
                  d.setMonth(d.getMonth() + 1);
                  setCurrentMonth(d);
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-700/40">
              {['월', '화', '수', '목', '금', '토', '일'].map((day, di) => (
                <div
                  key={day}
                  className={`py-2 text-center text-xs font-bold uppercase tracking-widest ${
                    di === 5
                      ? 'text-blue-600 dark:text-blue-400'
                      : di === 6
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500 dark:text-slate-300'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-rows-6">
              {monthMatrix.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b last:border-b-0 border-slate-100 dark:border-slate-700">
                  {week.map((date, di) => {
                    const dateStr = date.toISOString().split('T')[0];
                    const isToday = dateStr === todayStr;
                    const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                    const dayTasks = groupedTasks[dateStr];
                    const flatTasks: Task[] = dayTasks ? (Object.values(dayTasks).flat() as Task[]) : [];
                    const completedTasks = flatTasks.filter(t => t.status === 'completed');

                    return (
                      <div
                        key={dateStr}
                        className={`min-h-[96px] p-2 border-r last:border-r-0 border-slate-100 dark:border-slate-700 ${
                          isToday
                            ? 'bg-indigo-50/40 dark:bg-indigo-900/20'
                            : di === 5
                            ? 'bg-blue-50/30 dark:bg-blue-950/10'
                            : di === 6
                            ? 'bg-rose-50/30 dark:bg-rose-950/10'
                            : ''
                        } ${!isCurrentMonth ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs font-bold ${
                              isToday
                                ? 'text-indigo-600 dark:text-indigo-300'
                                : di === 5
                                ? 'text-blue-600 dark:text-blue-300'
                                : di === 6
                                ? 'text-rose-600 dark:text-rose-300'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {date.getDate()}
                          </span>
                          {flatTasks.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-200">
                              {flatTasks.length}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {flatTasks.slice(0, 3).map(t => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => openEditModal(t)}
                              className={`w-full text-left text-[10px] truncate px-1.5 py-0.5 rounded font-medium flex items-center gap-1 transition-colors ${
                                CATEGORIES[t.category as keyof typeof CATEGORIES]?.card ||
                                'bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200'
                              }`}
                              title={t.title}
                            >
                              {t.status === 'completed' && (
                                <CheckCircle2 size={10} className="text-emerald-500 flex-shrink-0" />
                              )}
                              {t.status === 'postponed' && (
                                <Clock size={10} className="text-amber-500 flex-shrink-0" />
                              )}
                              <span className={`truncate flex-1 ${t.status === 'completed' ? 'line-through opacity-70' : ''}`}>
                                {t.title}
                              </span>
                              {t.doc_url && (
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); window.open(t.doc_url!, '_blank'); }}
                                  title="관련 문서 열기"
                                  className="p-0.5 rounded text-sky-600 dark:text-sky-300 hover:bg-sky-100/60 dark:hover:bg-sky-900/40 flex-shrink-0"
                                >
                                  <LinkIcon size={10} />
                                </button>
                              )}
                            </button>
                          ))}
                          {completedTasks.length > 0 && (
                            <p className="mt-0.5 text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              완료 {completedTasks.length}건
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Add Task Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-xl dark:text-slate-100">{editingTask ? '업무 수정' : '새 업무 추가'}</h3>
                  {editingTask && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsRelatedOpen(true);
                        setRelatedSelectedTask(editingTask);
                        setRelatedKeyword(editingTask.title);
                        fetchRelatedSuggestions(editingTask);
                      }}
                      title="이 업무와 연관된 하위 업무를 AI에게 추천받습니다."
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-violet-600 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/30 hover:bg-violet-100 dark:hover:bg-violet-900/50"
                    >
                      <Sparkles size={14} />
                      관련 업무
                    </button>
                  )}
                </div>
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingTask(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <ChevronRight size={20} className="rotate-90" />
                </button>
              </div>
              <form onSubmit={addTask} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">업무명</label>
                  <input 
                    required
                    value={newTask.title}
                    onChange={e => setNewTask({...newTask, title: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="수행할 업무를 입력하세요"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">상태</label>
                    <select 
                      value={newTask.status}
                      onChange={e => setNewTask({...newTask, status: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-900 dark:text-slate-100"
                    >
                      <option value="pending">진행 대기</option>
                      <option value="in_progress">진행중 (Doing)</option>
                      <option value="completed">완료 (Done)</option>
                      <option value="postponed">연기 (Postponed)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">우선순위 (1-5)</label>
                    <select 
                      value={newTask.priority_score || ''}
                      onChange={e => setNewTask({...newTask, priority_score: e.target.value ? parseFloat(e.target.value) : undefined})}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-900 dark:text-slate-100"
                    >
                      <option value="">AI 자동 계산</option>
                      {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}순위 {v === 1 ? '(최고)' : v === 5 ? '(최저)' : ''}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">중요도 (Impact 1-5)</label>
                    <select 
                      value={newTask.impact}
                      onChange={e => setNewTask({...newTask, impact: parseInt(e.target.value)})}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-900 dark:text-slate-100"
                    >
                      {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}점 {v === 5 ? '(수익 직결)' : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">긴급도 (Urgency 1-5)</label>
                    <select 
                      value={newTask.urgency}
                      onChange={e => setNewTask({...newTask, urgency: parseInt(e.target.value)})}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-900 dark:text-slate-100"
                    >
                      {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}점 {v === 5 ? '(마감 임박)' : ''}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">소요 시간 (분)</label>
                    <input 
                      type="number"
                      value={newTask.effort}
                      onChange={e => setNewTask({...newTask, effort: parseInt(e.target.value)})}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">실행 날짜</label>
                    <input 
                      type="date"
                      value={newTask.scheduled_date}
                      onChange={e => setNewTask({...newTask, scheduled_date: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">마감 시간</label>
                    <input 
                      type="text"
                      value={newTask.deadline}
                      onChange={e => setNewTask({...newTask, deadline: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-900 dark:text-slate-100"
                      placeholder="예: 14:00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    관련 문서 링크 (Google Docs/Sheets/Drive)
                  </label>
                  <input
                    type="url"
                    value={newTask.doc_url}
                    onChange={e => setNewTask({ ...newTask, doc_url: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    placeholder="구글 문서/스프레드시트/드라이브 공유 링크를 붙여넣기 하세요"
                  />
                  <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                    휴대폰과 PC에서 같은 구글 계정으로 열리므로, 관련 서류를 어디서든 바로 확인할 수 있습니다.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">업무 구분 (3분할)</label>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(CATEGORIES).map(([key, info]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewTask({...newTask, category: key})}
                        className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${newTask.category === key ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-100 dark:border-slate-600 hover:border-slate-200 dark:hover:border-slate-500'}`}
                      >
                        <div className="text-left">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{info.name}</p>
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{key} • {info.time}</p>
                        </div>
                        {newTask.category === key && <CheckCircle2 size={18} className="text-indigo-600 dark:text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    {newTask.status === 'postponed' ? '연기 사유 (왜 미뤄졌나요?)' : 
                     newTask.status === 'in_progress' ? '현재 진행 상황 (어떤 걸 하고 있나요?)' :
                     newTask.status === 'completed' ? '완료 보고 (어떻게 완료했나요?)' :
                     '메모 및 성과 기록'}
                  </label>
                  <textarea 
                    value={newTask.notes}
                    onChange={e => setNewTask({...newTask, notes: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium min-h-[100px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                    className="flex-1 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30 hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all active:scale-95"
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
                      className="px-4 py-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl font-bold hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all"
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
                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
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
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-indigo-600 dark:bg-indigo-700 text-white">
                <h3 className="font-bold text-lg">{reportPeriod} 성과 보고서 (NanumLab OS)</h3>
                <button onClick={() => setReport(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto prose prose-slate dark:prose-invert">
                <div className="whitespace-pre-wrap font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                  {report}
                </div>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-600 flex justify-end gap-3">
                <button 
                  onClick={() => {
                    const blob = new Blob([report], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${reportPeriod}보고서_${new Date().toISOString().split('T')[0]}.txt`;
                    a.click();
                  }}
                  className="px-6 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30 hover:bg-indigo-700 dark:hover:bg-indigo-600"
                >
                  다운로드
                </button>
                <button onClick={() => setReport(null)} className="px-6 py-2 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg">
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 관련 업무 찾기 모달 */}
      <AnimatePresence>
        {isRelatedOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-bold text-lg flex items-center gap-2 dark:text-slate-100">
                  <Search size={20} className="text-violet-500" />
                  관련 업무 찾기
                </h3>
                <button
                  onClick={() => { setIsRelatedOpen(false); setRelatedSuggestions([]); setRelatedSelectedTask(null); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <ChevronRight size={20} className="rotate-90" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">업무 검색 (키워드)</label>
                  <input
                    value={relatedKeyword}
                    onChange={e => setRelatedKeyword(e.target.value)}
                    placeholder="제목으로 검색..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">업무 목록 · 연관 추천</p>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-slate-200 dark:border-slate-600 p-2">
                    {filteredMainTasks.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">검색 결과가 없습니다.</p>
                    ) : (
                      filteredMainTasks.map(t => (
                        <div
                          key={t.id}
                          className={`flex items-center justify-between gap-2 p-2 rounded-lg border transition-colors ${relatedSelectedTask?.id === t.id ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                        >
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate flex-1">{t.title}</span>
                          <button
                            type="button"
                            onClick={() => fetchRelatedSuggestions(t)}
                            disabled={isRelatedLoading}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 rounded-lg disabled:opacity-50"
                          >
                            <Sparkles size={12} />
                            {isRelatedLoading && relatedSelectedTask?.id === t.id ? '추천 중...' : 'AI 연관 추천'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {relatedSuggestions.length > 0 && relatedSelectedTask && (
                  <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/20 p-3 space-y-2">
                    <p className="text-xs font-bold text-violet-700 dark:text-violet-300">
                      「{relatedSelectedTask.title}」 연관 업무 {relatedSuggestions.length}건
                    </p>
                    <ul className="space-y-1">
                      {relatedSuggestions.map((s, i) => (
                        <li key={i} className="text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-violet-500 flex-shrink-0" />
                          <span>{s.title}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{s.category}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={addRelatedToSchedule}
                      className="w-full py-2 bg-violet-600 dark:bg-violet-500 text-white rounded-lg text-sm font-bold hover:bg-violet-700 dark:hover:bg-violet-600 transition-colors"
                    >
                      선택한 연관 업무 일정에 추가
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
