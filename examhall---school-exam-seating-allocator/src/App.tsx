import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { 
  INITIAL_ROOMS, 
  INITIAL_STUDENTS, 
  INITIAL_SUBJECTS, 
  INITIAL_SESSIONS, 
  SAMPLE_ROOMS,
  SAMPLE_STUDENTS,
  SAMPLE_SUBJECTS,
  SAMPLE_SESSIONS,
  DEFAULT_ALLOCATION_OPTIONS 
} from './utils/sampleData';
import { 
  ExamRoom, 
  Student, 
  ExamSubject, 
  ExamSession, 
  AllocationOptions, 
  SeatingPlan 
} from './types';
import { runSeatingAllocation } from './utils/allocationEngine';
import { Header } from './components/Header';
import { AllocationSummaryStats } from './components/AllocationSummaryStats';
import { RoomAllocationView } from './components/RoomAllocationView';
import { DataManagement } from './components/DataManagement';
import { PrintReportsView } from './components/PrintReportsView';
import { StudentFinderModal } from './components/StudentFinderModal';
import { AllocationSettingsModal } from './components/AllocationSettingsModal';
import { StudentMonitoringView } from './components/StudentMonitoringView';
import { ExamCalendarView } from './components/ExamCalendarView';
import { LandingPageView } from './components/LandingPageView';
import { EmailClassSheetsModal } from './components/EmailClassSheetsModal';
import { GoogleUser, getStoredUser, signInWithGoogle, signOutGoogle } from './utils/googleAuth';
import { api } from './utils/api';
import { Sparkles, Layers, Building2, Users, BookOpen, Plus, UploadCloud, RefreshCw, FileSpreadsheet, Database, Calendar, Clock, Home } from 'lucide-react';

const STORAGE_KEYS = {
  ROOMS: 'examhall_clean_rooms_v6',
  STUDENTS: 'examhall_clean_students_v6',
  SUBJECTS: 'examhall_clean_subjects_v6',
  SESSIONS: 'examhall_clean_sessions_v6',
  OPTIONS: 'examhall_clean_options_v6'
};

export default function App() {
  // Purge any legacy demo storage items
  useEffect(() => {
    try {
      const keysToPurge = [
        'examhall_rooms_v2', 'examhall_students_v2', 'examhall_subjects_v2', 'examhall_sessions_v2', 'examhall_options_v2',
        'examhall_rooms_v3', 'examhall_students_v3', 'examhall_subjects_v3', 'examhall_sessions_v3', 'examhall_options_v3',
        'examhall_rooms_v4', 'examhall_students_v4', 'examhall_subjects_v4', 'examhall_sessions_v4', 'examhall_options_v4',
        'examhall_rooms_v5', 'examhall_students_v5', 'examhall_subjects_v5', 'examhall_sessions_v5', 'examhall_options_v5'
      ];
      for (const k of keysToPurge) {
        localStorage.removeItem(k);
      }
    } catch {}
  }, []);

  // Database States with clean empty defaults (populated from backend sync)
  const [rooms, setRooms] = useState<ExamRoom[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ROOMS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });


  const [subjects, setSubjects] = useState<ExamSubject[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [sessions, setSessions] = useState<ExamSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [allocationOptions, setAllocationOptions] = useState<AllocationOptions>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.OPTIONS);
      return saved ? JSON.parse(saved) : DEFAULT_ALLOCATION_OPTIONS;
    } catch {
      return DEFAULT_ALLOCATION_OPTIONS;
    }
  });

  const [selectedSessionId, setSelectedSessionId] = useState<string>(() => {
    return sessions[0]?.id || '';
  });

  // Keep selectedSessionId in sync if sessions change
  useEffect(() => {
    if (sessions.length > 0 && (!selectedSessionId || !sessions.some(s => s.id === selectedSessionId))) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  const [activeTab, setActiveTab] = useState<'home' | 'plan' | 'rooms' | 'data' | 'print' | 'calendar' | 'monitoring'>('plan');
  const [currentPlan, setCurrentPlan] = useState<SeatingPlan | null>(null);
  const [isAllocating, setIsAllocating] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<GoogleUser | null>(() => getStoredUser());
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);

  // Backend & Source Folder Sync State
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [isSyncingSource, setIsSyncingSource] = useState<boolean>(false);
  const [syncStatusBanner, setSyncStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check backend health & auto-populate on mount
  useEffect(() => {
    api.checkHealth().then(async isUp => {
      setBackendConnected(isUp);
      if (isUp) {
        try {
          const [bRooms, bStudents, bSubjects, bSessions] = await Promise.all([
            api.getRooms(),
            api.getStudents(),
            api.getSubjects(),
            api.getSessions()
          ]);
          if (bRooms) setRooms(bRooms);
          if (bStudents) setStudents(bStudents);
          if (bSubjects) setSubjects(bSubjects);
          if (bSessions) {
            setSessions(bSessions);
            if (bSessions.length > 0 && (!selectedSessionId || !bSessions.some(s => s.id === selectedSessionId))) {
              setSelectedSessionId(bSessions[0].id);
            }
          }
        } catch (e) {
          console.error("Failed to fetch initial backend data:", e);
        }
      }
    });
  }, []);

  const handleSyncFromSourceFolder = async () => {
    setIsSyncingSource(true);
    setSyncStatusBanner(null);
    try {
      const res = await api.syncSourceFolder();
      const [bRooms, bStudents, bSubjects, bSessions] = await Promise.all([
        api.getRooms(),
        api.getStudents(),
        api.getSubjects(),
        api.getSessions()
      ]);
      if (bRooms) setRooms(bRooms);
      if (bStudents) setStudents(bStudents);
      if (bSubjects) setSubjects(bSubjects);
      if (bSessions) {
        setSessions(bSessions);
        if (bSessions.length > 0) setSelectedSessionId(bSessions[0].id);
      }
      setSyncStatusBanner({
        type: 'success',
        text: `Source folder synchronized! Loaded ${bStudents.length} students across ${bRooms.length} classrooms.`
      });
      setTimeout(() => setSyncStatusBanner(null), 6000);
    } catch (err: any) {
      setSyncStatusBanner({
        type: 'error',
        text: `Sync error: ${err.message || err}`
      });
    } finally {
      setIsSyncingSource(false);
    }
  };

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
  }, [rooms]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
  }, [subjects]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.OPTIONS, JSON.stringify(allocationOptions));
  }, [allocationOptions]);

  // Main Allocation Handler
  const handleGeneratePlan = useCallback(async (silent = false) => {
    let session = sessions.find(s => s.id === selectedSessionId);
    if (!session && sessions.length > 0) {
      session = sessions[0];
    }

    let effectiveRooms = rooms.length > 0 ? rooms : INITIAL_ROOMS;

    if (!session || effectiveRooms.length === 0 || students.length === 0) {
      setCurrentPlan(null);
      return;
    }

    if (!silent) setIsAllocating(true);

    try {
      // 1. Try backend allocation engine first if connected
      if (backendConnected && session.id) {
        try {
          const backendPlan = await api.generatePlan(session.id, allocationOptions);
          if (backendPlan && backendPlan.roomAllocations && backendPlan.roomAllocations.length > 0) {
            setCurrentPlan(backendPlan);
            if (!silent) {
              try {
                confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
              } catch {}
            }
            return;
          }
        } catch (backendErr) {
          console.warn("Backend allocation fallback to client engine:", backendErr);
        }
      }

      // 2. High-speed client allocation fallback
      const plan = runSeatingAllocation(
        session,
        effectiveRooms,
        students,
        subjects,
        allocationOptions
      );
      setCurrentPlan(plan);
      if (!silent) {
        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.8 }
          });
        } catch {}
      }
    } catch (err) {
      console.error("Seating allocation error:", err);
    } finally {
      setIsAllocating(false);
    }
  }, [selectedSessionId, sessions, rooms, students, subjects, allocationOptions, backendConnected]);

  // Run allocation automatically when dependencies change
  useEffect(() => {
    handleGeneratePlan(true);
  }, [selectedSessionId, rooms, students, subjects, allocationOptions, handleGeneratePlan]);

  // Reset to default sample school
  const handleResetToSampleData = () => {
    setRooms(SAMPLE_ROOMS);
    setStudents(SAMPLE_STUDENTS);
    setSubjects(SAMPLE_SUBJECTS);
    setSessions(SAMPLE_SESSIONS);
    setAllocationOptions(DEFAULT_ALLOCATION_OPTIONS);
    setSelectedSessionId(SAMPLE_SESSIONS[0].id);
  };

  // Manual Seat Swap Handler
  const handleSwapSeats = (
    sourceRoomId: string,
    sourceSeatIdx: number,
    targetRoomId: string,
    targetSeatIdx: number
  ) => {
    if (!currentPlan) return;

    const newPlan: SeatingPlan = JSON.parse(JSON.stringify(currentPlan));
    const sourceRoom = newPlan.roomAllocations.find(r => r.roomId === sourceRoomId);
    const targetRoom = newPlan.roomAllocations.find(r => r.roomId === targetRoomId);

    if (!sourceRoom || !targetRoom) return;

    const sourceSeat = sourceRoom.assignedSeats.find(s => s.seatIndex === sourceSeatIdx);
    const targetSeat = targetRoom.assignedSeats.find(s => s.seatIndex === targetSeatIdx);

    if (!sourceSeat || !targetSeat) return;

    // Swap student attributes
    const tempStudent = {
      studentId: sourceSeat.studentId,
      studentRollNo: sourceSeat.studentRollNo,
      studentName: sourceSeat.studentName,
      studentGrade: sourceSeat.studentGrade,
      subjectCode: sourceSeat.subjectCode,
      subjectName: sourceSeat.subjectName,
      subjectColor: sourceSeat.subjectColor,
      isSpecialNeeds: sourceSeat.isSpecialNeeds
    };

    sourceSeat.studentId = targetSeat.studentId;
    sourceSeat.studentRollNo = targetSeat.studentRollNo;
    sourceSeat.studentName = targetSeat.studentName;
    sourceSeat.studentGrade = targetSeat.studentGrade;
    sourceSeat.subjectCode = targetSeat.subjectCode;
    sourceSeat.subjectName = targetSeat.subjectName;
    sourceSeat.subjectColor = targetSeat.subjectColor;
    sourceSeat.isSpecialNeeds = targetSeat.isSpecialNeeds;

    targetSeat.studentId = tempStudent.studentId;
    targetSeat.studentRollNo = tempStudent.studentRollNo;
    targetSeat.studentName = tempStudent.studentName;
    targetSeat.studentGrade = tempStudent.studentGrade;
    targetSeat.subjectCode = tempStudent.subjectCode;
    targetSeat.subjectName = tempStudent.subjectName;
    targetSeat.subjectColor = tempStudent.subjectColor;
    targetSeat.isSpecialNeeds = tempStudent.isSpecialNeeds;

    // Recompute distributions
    for (const r of [sourceRoom, targetRoom]) {
      const gDist: Record<string, number> = {};
      const sDist: Record<string, number> = {};
      let total = 0;
      for (const s of r.assignedSeats) {
        if (s.studentId) {
          total++;
          if (s.studentGrade) gDist[s.studentGrade] = (gDist[s.studentGrade] || 0) + 1;
          if (s.subjectCode) sDist[s.subjectCode] = (sDist[s.subjectCode] || 0) + 1;
        }
      }
      r.gradeDistribution = gDist;
      r.subjectDistribution = sDist;
      r.totalAssigned = total;
    }

    setCurrentPlan(newPlan);
  };

  const handleSortOutConflicts = () => {
    if (!currentPlan) return;
    import('./utils/allocationEngine').then(({ resolveConflicts }) => {
      const updatedPlan = resolveConflicts(currentPlan);
      setCurrentPlan(updatedPlan);
    });
  };

  const hasData = rooms.length > 0 && students.length > 0 && sessions.length > 0;
  const currentSession = sessions.find(s => s.id === selectedSessionId) || sessions[0];

  const formatSessionDate = (dateStr?: string) => {
    if (!dateStr) return 'No Date Set';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col antialiased">
      {/* Top Header & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onGeneratePlan={() => handleGeneratePlan(false)}
        isAllocating={isAllocating}
        totalStudentsSeated={currentPlan?.stats.totalAssigned || 0}
        currentUser={currentUser}
        onSignIn={() => signInWithGoogle(
          (user) => setCurrentUser(user),
          (err) => alert(err)
        )}
        onSignOut={() => {
          signOutGoogle();
          setCurrentUser(null);
        }}
        onOpenEmailModal={() => setIsEmailModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
        
        {/* TAB 1: SEATING PLAN VIEW */}
        {activeTab === 'plan' && (
          <div className="space-y-4">
            {/* Clean Session Selector Bar */}
            {sessions.length > 1 && (
              <div className="flex items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-xl border border-[#E2E8F0] shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#64748B] font-semibold">Exam Session:</span>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="bg-[#F1F5F9] px-3 py-1.5 rounded-lg text-xs font-bold text-[#0F172A] border border-[#E2E8F0] outline-none cursor-pointer"
                    aria-label="Select exam session"
                  >
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} • {s.timeSlot}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setActiveTab('calendar')}
                  className="px-3 py-1.5 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#2563EB] text-xs font-bold border border-[#E2E8F0] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Calendar</span>
                </button>
              </div>
            )}

            {!hasData ? (
              <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#E2E8F0] shadow-2xs text-center max-w-2xl mx-auto my-6 space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] text-[#2563EB] flex items-center justify-center mx-auto border border-[#E2E8F0]">
                  <Layers className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-xl font-bold text-[#0F172A] font-heading">
                    Ready to Build Your Seating Plan
                  </h2>
                  <p className="text-sm text-[#64748B] max-w-md mx-auto">
                    All pre-built details have been cleared. Add your classrooms, students, and exam sessions to begin 50/50 anti-cheating seat allocation.
                  </p>
                </div>

                {/* Setup Status Progress Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                  <div className={`p-4 rounded-2xl border ${rooms.length > 0 ? 'bg-[#F1F5F9] border-[#2563EB]' : 'bg-[#F8FAFC] border-[#E2E8F0]'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-[#2563EB]" />
                      <span className="text-xs font-bold text-[#0F172A]">1. Classrooms</span>
                    </div>
                    <p className="text-xs text-[#64748B]">{rooms.length} room(s) added</p>
                  </div>

                  <div className={`p-4 rounded-2xl border ${students.length > 0 ? 'bg-[#F1F5F9] border-[#2563EB]' : 'bg-[#F8FAFC] border-[#E2E8F0]'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-[#2563EB]" />
                      <span className="text-xs font-bold text-[#0F172A]">2. Students</span>
                    </div>
                    <p className="text-xs text-[#64748B]">{students.length} student(s) added</p>
                  </div>

                  <div className={`p-4 rounded-2xl border ${sessions.length > 0 ? 'bg-[#F1F5F9] border-[#2563EB]' : 'bg-[#F8FAFC] border-[#E2E8F0]'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="w-4 h-4 text-[#2563EB]" />
                      <span className="text-xs font-bold text-[#0F172A]">3. Sessions</span>
                    </div>
                    <p className="text-xs text-[#64748B]">{sessions.length} session(s) active</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('data')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] font-semibold text-xs sm:text-sm transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Go to Data Management</span>
                  </button>

                  <button
                    onClick={handleResetToSampleData}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] font-semibold text-xs sm:text-sm border border-[#E2E8F0] transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4 text-[#3B82F6]" />
                    <span>Load Demo Data (Optional)</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* KPI Summary Bar */}
                <AllocationSummaryStats
                  plan={currentPlan}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onSortOutConflicts={handleSortOutConflicts}
                />

                {/* Room Allocation Matrix View */}
                {currentPlan && (
                  <RoomAllocationView
                    plan={currentPlan}
                    subjects={subjects}
                    onSwapSeats={handleSwapSeats}
                    onOpenSearch={() => setIsSearchOpen(true)}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 2: DATA & CLASSES ROSTER (STUDENTS TAB) */}
        {activeTab === 'data' && (
          <div className="space-y-4">
            {/* Backend & Excel Source Integration Bar */}
            <div className="bg-white rounded-2xl px-4 py-3 border border-[#E2E8F0] shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${backendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                <span className="font-bold text-[#0F172A]">
                  {backendConnected ? 'Backend Online (SQLite & Student Monitoring Active)' : 'Local Storage Mode (Backend Offline)'}
                </span>
                <span className="text-[#64748B] hidden sm:inline">• Source Folder: /source</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {backendConnected && (
                  <>
                    <button
                      onClick={handleSyncFromSourceFolder}
                      disabled={isSyncingSource}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] font-semibold transition cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSource ? 'animate-spin text-[#2563EB]' : 'text-[#2563EB]'}`} />
                      <span>{isSyncingSource ? 'Scanning Source...' : 'Sync Source Excel'}</span>
                    </button>

                    <a
                      href={api.getTemplateDownloadUrl()}
                      download
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] font-semibold transition"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden md:inline">Download Master Excel Template</span>
                    </a>

                    {selectedSessionId && (
                      <a
                        href={api.getExportExcelUrl(selectedSessionId)}
                        download
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200 transition"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Export Seating Excel</span>
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>

            {syncStatusBanner && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
                syncStatusBanner.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                <span>{syncStatusBanner.text}</span>
                <button onClick={() => setSyncStatusBanner(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
              </div>
            )}

            <DataManagement
              rooms={rooms}
              setRooms={setRooms}
              students={students}
              setStudents={setStudents}
              subjects={subjects}
              setSubjects={setSubjects}
              sessions={sessions}
              setSessions={setSessions}
              onResetToSampleData={handleResetToSampleData}
              onOpenEmailModal={() => setIsEmailModalOpen(true)}
            />
          </div>
        )}

        {/* TAB 3: PRINT DOOR SHEETS & ATTENDANCE */}
        {activeTab === 'print' && (
          <PrintReportsView
            plan={currentPlan}
            subjects={subjects}
          />
        )}

        {/* TAB 4: REAL-TIME STUDENT MONITORING */}
        {activeTab === 'monitoring' && (
          <StudentMonitoringView
            activeSession={sessions.find(s => s.id === selectedSessionId) || sessions[0] || null}
            rooms={rooms}
          />
        )}

        {/* TAB 5: EXAM CALENDAR */}
        {activeTab === 'calendar' && (
          <ExamCalendarView
            sessions={sessions}
            setSessions={setSessions}
            subjects={subjects}
            selectedSessionId={selectedSessionId}
            onSelectSession={setSelectedSessionId}
            setActiveTab={setActiveTab}
          />
        )}
      </main>

      {/* Student Finder Quick Lookup Modal */}
      <StudentFinderModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        plan={currentPlan}
        allStudents={students}
        allSubjects={subjects}
      />

      {/* Allocation Split & Anti-Cheat Rules Modal */}
      <AllocationSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        options={allocationOptions}
        onChangeOptions={setAllocationOptions}
        onApplyAndRegenerate={() => handleGeneratePlan(false)}
      />

      {/* Class Excel Spreadsheets Email Distribution Modal */}
      <EmailClassSheetsModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        currentUser={currentUser}
        onSignInSuccess={(user) => setCurrentUser(user)}
      />

      <div className="md:hidden sticky bottom-0 z-20 bg-white/95 backdrop-blur border-t border-[#E2E8F0] p-2.5 flex items-center justify-around gap-2 no-print">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'home' ? 'bg-[#F1F5F9] text-[#2563EB] font-bold' : 'text-[#3B82F6]'
          }`}
        >
          <span className="text-sm">🏠</span>
          <span>Home</span>
        </button>

        <button
          onClick={() => setActiveTab('plan')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'plan' ? 'bg-[#F1F5F9] text-[#2563EB] font-bold' : 'text-[#3B82F6]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Plan</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'calendar' ? 'bg-[#F1F5F9] text-[#2563EB] font-bold' : 'text-[#3B82F6]'
          }`}
        >
          <span className="text-sm">📅</span>
          <span>Calendar</span>
        </button>

        <button
          onClick={() => setIsSearchOpen(true)}
          className="flex-1 py-2 rounded-xl text-xs font-semibold text-[#3B82F6] flex flex-col items-center gap-0.5 hover:bg-[#F1F5F9] transition-colors"
        >
          <span className="text-sm">🔍</span>
          <span>Find Seat</span>
        </button>

        <button
          onClick={() => setActiveTab('data')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'data' ? 'bg-[#F1F5F9] text-[#2563EB] font-bold' : 'text-[#3B82F6]'
          }`}
        >
          <span className="text-sm">👥</span>
          <span>Students</span>
        </button>

        <button
          onClick={() => setActiveTab('print')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'print' ? 'bg-[#F1F5F9] text-[#2563EB] font-bold' : 'text-[#3B82F6]'
          }`}
        >
          <span className="text-sm">🖨️</span>
          <span>Print</span>
        </button>
      </div>
    </div>
  );
}
