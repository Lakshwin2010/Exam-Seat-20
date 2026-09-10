import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Clock,
  BookOpen,
  CalendarDays,
  Layers,
  X,
  CheckCircle2,
} from 'lucide-react';
import { ExamSession, ExamSubject } from '../types';

interface ExamCalendarViewProps {
  sessions: ExamSession[];
  setSessions: React.Dispatch<React.SetStateAction<ExamSession[]>>;
  subjects: ExamSubject[];
  selectedSessionId: string;
  onSelectSession: (id: string) => void;
  setActiveTab: (tab: 'plan' | 'rooms' | 'data' | 'print' | 'calendar' | 'monitoring') => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SESSION_COLORS = [
  '#2563EB', '#7C3AED', '#059669', '#DC2626', '#D97706',
  '#0891B2', '#BE185D', '#15803D', '#B45309', '#4F46E5'
];

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const ExamCalendarView: React.FC<ExamCalendarViewProps> = ({
  sessions,
  setSessions,
  subjects,
  selectedSessionId,
  onSelectSession,
  setActiveTab,
}) => {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createTimeSlot, setCreateTimeSlot] = useState('09:00 AM - 12:00 PM');
  const [createSubjectIds, setCreateSubjectIds] = useState<string[]>(subjects.map(s => s.id));
  const [createSuccess, setCreateSuccess] = useState(false);

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDate(null);
    setShowCreateForm(false);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDate(null);
    setShowCreateForm(false);
  };

  const handleDateClick = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setShowCreateForm(false);
    setCreateSuccess(false);
    setCreateName('');
    setCreateTimeSlot('09:00 AM - 12:00 PM');
    setCreateSubjectIds(subjects.map(s => s.id));
  };

  const sessionsOnDate = selectedDate
    ? sessions.filter(s => s.date === selectedDate)
    : [];

  const handleDeleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const handleSelectAndGo = (id: string) => {
    onSelectSession(id);
    setActiveTab('plan');
  };

  const handleCreateExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !createName.trim()) return;

    const newSession: ExamSession = {
      id: `session-${Date.now()}`,
      name: createName.trim(),
      date: selectedDate,
      timeSlot: createTimeSlot,
      subjectIds: createSubjectIds.length > 0 ? createSubjectIds : subjects.map(s => s.id),
    };

    setSessions(prev => [...prev, newSession]);
    onSelectSession(newSession.id);
    setCreateSuccess(true);
    setShowCreateForm(false);
    setCreateName('');
  };

  const toggleCreateSubject = (subId: string) => {
    setCreateSubjectIds(prev =>
      prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]
    );
  };

  // Map of date -> sessions for dot indicators
  const sessionsByDate: Record<string, ExamSession[]> = {};
  for (const sess of sessions) {
    if (!sessionsByDate[sess.date]) sessionsByDate[sess.date] = [];
    sessionsByDate[sess.date].push(sess);
  }

  const todayStr = toLocalDateString(today);

  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to complete last row
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* ── Calendar Panel ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs p-4 sm:p-6 flex-1 min-w-0">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl hover:bg-[#F1F5F9] text-[#3B82F6] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] font-heading">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h2>
            <p className="text-xs text-[#64748B] font-medium mt-0.5">
              {sessions.length} exam session{sessions.length !== 1 ? 's' : ''} scheduled in system
            </p>
          </div>

          <button
            onClick={nextMonth}
            className="p-2.5 rounded-xl hover:bg-[#F1F5F9] text-[#3B82F6] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2 text-center">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} className="text-xs sm:text-sm font-bold text-[#64748B] uppercase tracking-wider py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid with enlarged dates & rich exam badges */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {calendarCells.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="min-h-[85px] sm:min-h-[110px] rounded-2xl bg-slate-50/40 border border-transparent" />;
            }

            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const daySessions = sessionsByDate[dateStr] || [];
            const hasExams = daySessions.length > 0;

            return (
              <button
                key={day}
                onClick={() => handleDateClick(day)}
                className={`
                  min-h-[85px] sm:min-h-[110px] p-2 sm:p-2.5 rounded-2xl flex flex-col justify-between items-start text-left relative
                  transition-all cursor-pointer border
                  ${isSelected
                    ? 'bg-[#2563EB] text-white border-[#1D4ED8] shadow-md ring-2 ring-blue-400/40'
                    : isToday
                      ? 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB] shadow-xs'
                      : hasExams
                        ? 'bg-white hover:bg-blue-50/40 text-[#0F172A] border-blue-200/70 shadow-2xs'
                        : 'bg-white hover:bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0]'
                  }
                `}
              >
                {/* Top: Large Date Number */}
                <div className="w-full flex items-center justify-between">
                  <span className={`text-base sm:text-2xl font-black tracking-tight ${
                    isSelected ? 'text-white' : isToday ? 'text-[#2563EB]' : 'text-[#0F172A]'
                  }`}>
                    {day}
                  </span>
                  {isToday && (
                    <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#2563EB] text-white'
                    }`}>
                      Today
                    </span>
                  )}
                </div>

                {/* Bottom: Exam indicators & Badges */}
                <div className="w-full mt-1.5 space-y-1">
                  {hasExams ? (
                    <>
                      <div className={`text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded-lg truncate w-full flex items-center gap-1 ${
                        isSelected 
                          ? 'bg-white/20 text-white' 
                          : 'bg-blue-100/80 text-[#1E3A8A] border border-blue-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-white' : 'bg-[#2563EB]'}`} />
                        <span className="truncate">
                          {daySessions.length === 1 ? daySessions[0].name : `${daySessions.length} Exams`}
                        </span>
                      </div>
                      {/* Show mini subject codes if 1 session */}
                      {daySessions.length === 1 && daySessions[0].subjectIds.length > 0 && (
                        <div className="hidden sm:flex flex-wrap gap-0.5 max-h-4 overflow-hidden">
                          {subjects
                            .filter(s => daySessions[0].subjectIds.includes(s.id))
                            .slice(0, 2)
                            .map(sub => (
                              <span 
                                key={sub.id} 
                                className={`text-[9px] font-bold px-1 rounded ${
                                  isSelected ? 'text-white/80 bg-black/20' : 'text-[#64748B] bg-slate-100'
                                }`}
                              >
                                {sub.code}
                              </span>
                            ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="h-3" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex items-center gap-4 text-xs text-[#64748B]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#2563EB]" />
            <span>Has exam(s)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xl border-2 border-[#2563EB] bg-[#EFF6FF]" />
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xl bg-[#2563EB]" />
            <span>Selected</span>
          </div>
        </div>
      </div>

      {/* ── Side Panel ── */}
      <div className="lg:w-80 xl:w-96 flex-shrink-0 space-y-3">
        {!selectedDate ? (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F1F5F9] text-[#2563EB] flex items-center justify-center mx-auto">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">Select a Date</h3>
              <p className="text-xs text-[#64748B] mt-1">
                Click any date on the calendar to view or schedule exams.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Date Header */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    {sessionsOnDate.length === 0
                      ? 'No exams scheduled'
                      : `${sessionsOnDate.length} exam session${sessionsOnDate.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sessions on this date */}
            {sessionsOnDate.length > 0 && (
              <div className="space-y-2">
                {sessionsOnDate.map((sess, i) => {
                  const color = SESSION_COLORS[i % SESSION_COLORS.length];
                  const sessSubjects = subjects.filter(s => sess.subjectIds.includes(s.id));
                  const isActive = sess.id === selectedSessionId;

                  return (
                    <div
                      key={sess.id}
                      className={`bg-white rounded-2xl border shadow-2xs p-4 space-y-3 ${
                        isActive ? 'border-[#2563EB]' : 'border-[#E2E8F0]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full mt-0.5 shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#0F172A] truncate">{sess.name}</p>
                            <p className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 shrink-0" />
                              {sess.timeSlot}
                            </p>
                          </div>
                        </div>
                        {isActive && (
                          <span className="shrink-0 text-[10px] font-bold bg-[#EFF6FF] text-[#2563EB] px-2 py-0.5 rounded-full border border-[#BFDBFE]">
                            Active
                          </span>
                        )}
                      </div>

                      {/* Subjects */}
                      {sessSubjects.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {sessSubjects.map(sub => (
                            <span
                              key={sub.id}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: sub.color + '22',
                                color: sub.color,
                                border: `1px solid ${sub.color}44`,
                              }}
                            >
                              {sub.code}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1 border-t border-[#E2E8F0]">
                        <button
                          onClick={() => handleSelectAndGo(sess.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold text-[#F8FAFC] bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors cursor-pointer"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>View Seating Plan</span>
                        </button>
                        <button
                          onClick={() => handleDeleteSession(sess.id)}
                          className="p-1.5 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                          title="Delete session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Create Exam Section */}
            {createSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Exam created! Session is now active.</span>
              </div>
            )}

            {!showCreateForm ? (
              <button
                onClick={() => {
                  setShowCreateForm(true);
                  setCreateSuccess(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 border-dashed border-[#CBD5E1] hover:border-[#2563EB] hover:bg-[#EFF6FF] text-xs font-semibold text-[#64748B] hover:text-[#2563EB] transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {sessionsOnDate.length === 0 ? 'Schedule an Exam on this Date' : 'Add Another Exam Session'}
                </span>
              </button>
            ) : (
              /* Create Exam Form */
              <div className="bg-white rounded-2xl border border-[#2563EB] shadow-2xs p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-[#2563EB]" />
                    Create Exam Session
                  </h4>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="p-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <form onSubmit={handleCreateExam} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-[#0F172A] mb-1">Session Name *</label>
                    <input
                      type="text"
                      required
                      value={createName}
                      onChange={e => setCreateName(e.target.value)}
                      placeholder="e.g. Morning Midterm"
                      className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#2563EB] outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#0F172A] mb-1">Time Slot</label>
                    <input
                      type="text"
                      value={createTimeSlot}
                      onChange={e => setCreateTimeSlot(e.target.value)}
                      placeholder="09:00 AM - 12:00 PM"
                      className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#2563EB] outline-none text-xs"
                    />
                  </div>

                  {subjects.length > 0 && (
                    <div>
                      <label className="block font-semibold text-[#0F172A] mb-1.5 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-[#2563EB]" />
                        Subjects in this Session
                      </label>
                      <div className="space-y-1.5 bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0] max-h-32 overflow-y-auto">
                        {subjects.map(s => (
                          <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={createSubjectIds.includes(s.id)}
                              onChange={() => toggleCreateSubject(s.id)}
                              className="rounded text-[#2563EB]"
                            />
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="text-[11px] font-semibold text-[#0F172A]">{s.code} – {s.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1 py-2 rounded-xl border border-[#E2E8F0] text-[#3B82F6] font-semibold hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold transition-colors cursor-pointer"
                    >
                      Create Exam
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
