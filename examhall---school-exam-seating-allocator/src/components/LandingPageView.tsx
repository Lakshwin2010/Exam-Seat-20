import React from 'react';
import { 
  Building2, 
  Users, 
  Calendar, 
  Layers, 
  Printer, 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  BookOpen, 
  ArrowRight, 
  FileSpreadsheet, 
  CheckCircle2,
  CalendarDays,
  Plus
} from 'lucide-react';
import { ExamSession, ExamRoom, Student, ExamSubject } from '../types';

interface LandingPageViewProps {
  sessions: ExamSession[];
  rooms: ExamRoom[];
  students: Student[];
  subjects: ExamSubject[];
  totalStudentsSeated: number;
  onSelectSession: (id: string) => void;
  setActiveTab: (tab: 'home' | 'plan' | 'rooms' | 'data' | 'print' | 'calendar' | 'monitoring') => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  sessions,
  rooms,
  students,
  subjects,
  totalStudentsSeated,
  onSelectSession,
  setActiveTab
}) => {
  const sortedSessions = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const totalCapacity = rooms.reduce((acc, r) => acc + (r.capacity || 0), 0);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1E3A8A] via-[#2563EB] to-[#3B82F6] rounded-3xl text-white p-6 sm:p-10 shadow-lg">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-48 h-48 bg-blue-400/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-semibold tracking-wide backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>School Exam Seating & Allocator System</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-heading leading-tight">
            Smart Exam Scheduling & Anti-Cheating Seating Allocation
          </h1>

          <p className="text-sm sm:text-base text-blue-100 leading-relaxed max-w-2xl">
            Automate 50/50 alternate classroom seating, view interactive exam calendars, manage student rosters, and generate printable hall door sheets with one click.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => setActiveTab('plan')}
              className="px-5 py-3 rounded-2xl bg-white text-[#1E3A8A] hover:bg-blue-50 font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-[#2563EB]" />
              <span>View Seating Plan</span>
              <ArrowRight className="w-4 h-4 text-[#2563EB]" />
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className="px-5 py-3 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs sm:text-sm border border-white/30 transition-all flex items-center gap-2 cursor-pointer backdrop-blur-xs"
            >
              <Calendar className="w-4 h-4" />
              <span>Open Exam Calendar</span>
            </button>

            <button
              onClick={() => setActiveTab('data')}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Students & Classrooms</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[#64748B]">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Students</span>
            <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-[#0F172A] font-heading">{students.length}</p>
          <p className="text-[11px] text-[#64748B]">Enrolled in exam database</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[#64748B]">
            <span className="text-xs font-semibold uppercase tracking-wider">Classrooms</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-[#0F172A] font-heading">{rooms.length}</p>
          <p className="text-[11px] text-[#64748B]">{totalCapacity} total seats available</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[#64748B]">
            <span className="text-xs font-semibold uppercase tracking-wider">Exam Sessions</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-[#0F172A] font-heading">{sessions.length}</p>
          <p className="text-[11px] text-[#64748B]">Scheduled on calendar</p>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[#64748B]">
            <span className="text-xs font-semibold uppercase tracking-wider">Anti-Cheat Strategy</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-[#0F172A] font-heading">50 / 50</p>
          <p className="text-[11px] text-[#64748B]">Checkerboard & alternate split</p>
        </div>
      </div>

      {/* Upcoming Exam Dates Section */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#E2E8F0] shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-50 text-[#2563EB]">
                <Calendar className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#0F172A] font-heading">
                  Scheduled Exam Dates & Timetable
                </h2>
                <p className="text-xs text-[#64748B]">
                  Browse scheduled exam dates, check which subjects are running, and jump straight to seat allocations.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('calendar')}
            className="px-4 py-2 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-xs font-bold text-[#2563EB] flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule New Exam Date</span>
          </button>
        </div>

        {sortedSessions.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] space-y-3">
            <CalendarDays className="w-10 h-10 text-[#94A3B8] mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-[#0F172A]">No Exam Sessions Scheduled Yet</p>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                Open the Exam Calendar to pick dates and schedule your school or college exam sessions.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('calendar')}
              className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1D4ED8] transition-all cursor-pointer"
            >
              Open Exam Calendar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {sortedSessions.map((sess) => {
              const sessSubjects = subjects.filter(s => sess.subjectIds.includes(s.id));

              return (
                <div
                  key={sess.id}
                  className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white hover:border-[#2563EB] hover:shadow-md transition-all p-4 flex flex-col justify-between space-y-3 group"
                >
                  <div className="space-y-2.5">
                    {/* Date Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-xl bg-blue-100/80 text-[#1E3A8A] text-xs font-bold border border-blue-200 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                          <span>{formatDate(sess.date)}</span>
                        </span>
                      </div>
                      <span className="text-[11px] text-[#64748B] font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {sess.timeSlot}
                      </span>
                    </div>

                    {/* Session Title */}
                    <div>
                      <h3 className="text-sm font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                        {sess.name}
                      </h3>
                    </div>

                    {/* Subjects / Exams Running */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">
                        Exams Happening on this Date:
                      </span>
                      {sessSubjects.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {sessSubjects.map(sub => (
                            <span
                              key={sub.id}
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-lg"
                              style={{
                                backgroundColor: sub.color + '18',
                                color: sub.color,
                                border: `1px solid ${sub.color}40`
                              }}
                            >
                              {sub.code} - {sub.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-[#94A3B8]">All enrolled subjects</span>
                      )}
                    </div>
                  </div>

                  {/* Jump to Seating Button */}
                  <div className="pt-2 border-t border-[#E2E8F0]">
                    <button
                      onClick={() => {
                        onSelectSession(sess.id);
                        setActiveTab('plan');
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>View Seating Plan</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feature Capabilities Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => setActiveTab('plan')}
          className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-2xs hover:border-[#2563EB] transition-all cursor-pointer space-y-2 group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center group-hover:scale-105 transition-transform">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#0F172A]">Seating Allocation Matrix</h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Interactive visual classroom layouts with anti-cheating neighbor auditing and manual drag-and-swap seats.
          </p>
        </div>

        <div 
          onClick={() => setActiveTab('calendar')}
          className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-2xs hover:border-[#2563EB] transition-all cursor-pointer space-y-2 group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Calendar className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#0F172A]">Exam Calendar & Dates</h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Month-at-a-glance scheduling, date selection, and immediate creation of multi-subject exam time slots.
          </p>
        </div>

        <div 
          onClick={() => setActiveTab('data')}
          className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-2xs hover:border-[#2563EB] transition-all cursor-pointer space-y-2 group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#0F172A]">Excel Ingestion & Data</h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Directly drop school Excel sheets into the source folder and auto-sync student and room records.
          </p>
        </div>

        <div 
          onClick={() => setActiveTab('print')}
          className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-2xs hover:border-[#2563EB] transition-all cursor-pointer space-y-2 group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Printer className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#0F172A]">Door Sheets & Reports</h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            One-click printable hall door notices, student roll-number rosters, and invigilator desk charts.
          </p>
        </div>
      </div>
    </div>
  );
};
