import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  BookOpen, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit3, 
  UploadCloud, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  X,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  Sparkles,
  Search,
  GraduationCap,
  Mail
} from 'lucide-react';
import { ExamRoom, Student, ExamSubject, ExamSession } from '../types';
import { 
  exportStudentsTemplate, 
  exportRoomsTemplate, 
  parseStudentsCSV, 
  parseRoomsCSV, 
  downloadFile 
} from '../utils/csvHelpers';
import { api } from '../utils/api';
import { generateAutoSchedule } from '../utils/scheduleGenerator';

interface DataManagementProps {
  rooms: ExamRoom[];
  setRooms: React.Dispatch<React.SetStateAction<ExamRoom[]>>;
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  subjects: ExamSubject[];
  setSubjects: React.Dispatch<React.SetStateAction<ExamSubject[]>>;
  sessions: ExamSession[];
  setSessions: React.Dispatch<React.SetStateAction<ExamSession[]>>;
  initialSubTab?: 'rooms' | 'students' | 'subjects' | 'import_export';
  onSyncFolder?: () => Promise<void>;
  isSyncingFolder?: boolean;
  onOpenEmailModal?: () => void;
}

export const DataManagement: React.FC<DataManagementProps> = ({
  rooms,
  setRooms,
  students,
  setStudents,
  subjects,
  setSubjects,
  sessions,
  setSessions,
  initialSubTab = 'students',
  onSyncFolder,
  isSyncingFolder,
  onOpenEmailModal
}) => {
  const [subTab, setSubTab] = useState<'rooms' | 'students' | 'subjects' | 'import_export'>(initialSubTab || 'rooms');

  React.useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);
  
  // Room modal state
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ExamRoom | null>(null);

  // Student modal state
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Subject modal state
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<ExamSubject | null>(null);

  // Session modal state
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ExamSession | null>(null);

  // CSV status feedback
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Student filtering states (Separate 11th and 12th students)
  const [studentGradeFilter, setStudentGradeFilter] = useState<'all' | 'XI' | 'XII'>('all');
  const [studentSectionFilter, setStudentSectionFilter] = useState<string>('all');
  const [studentSearch, setStudentSearch] = useState<string>('');

  // --- ROOM HANDLERS ---
  const handleSaveRoom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const capacity = parseInt(formData.get('capacity') as string, 10) || 30;
    const rows = parseInt(formData.get('rows') as string, 10) || 5;
    const cols = parseInt(formData.get('cols') as string, 10) || 6;

    const roomData: ExamRoom = {
      id: editingRoom?.id || `room-${Date.now()}`,
      name: formData.get('name') as string || 'Room 101',
      building: formData.get('building') as string || 'Main Block',
      floor: formData.get('floor') as string || '1st Floor',
      capacity,
      rows,
      cols,
      benchType: (formData.get('benchType') as any) || 'single',
      isActive: formData.get('isActive') === 'on',
      notes: formData.get('notes') as string || ''
    };

    if (editingRoom) {
      setRooms(rooms.map(r => r.id === editingRoom.id ? roomData : r));
    } else {
      setRooms([...rooms, roomData]);
    }
    setRoomModalOpen(false);
    setEditingRoom(null);
  };

  const handleDeleteRoom = (id: string) => {
    setRooms(rooms.filter(r => r.id !== id));
  };

  // --- STUDENT HANDLERS ---
  const handleSaveStudent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const selectedSubIds = subjects
      .filter(s => formData.get(`sub-${s.id}`) === 'on')
      .map(s => s.id);

    const studentData: Student = {
      id: editingStudent?.id || `stud-${Date.now()}`,
      rollNo: formData.get('rollNo') as string || '',
      name: formData.get('name') as string || '',
      grade: formData.get('grade') as string || 'Grade 10-A',
      gender: (formData.get('gender') as any) || 'M',
      specialNeeds: formData.get('specialNeeds') === 'on',
      enrolledSubjectIds: selectedSubIds.length > 0 ? selectedSubIds : (subjects[0] ? [subjects[0].id] : [])
    };

    if (editingStudent) {
      setStudents(students.map(s => s.id === editingStudent.id ? studentData : s));
    } else {
      setStudents([...students, studentData]);
    }
    setStudentModalOpen(false);
    setEditingStudent(null);
  };

  const handleDeleteStudent = (id: string) => {
    setStudents(students.filter(s => s.id !== id));
  };

  // --- SUBJECT HANDLERS ---
  const handleSaveSubject = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const subjectData: ExamSubject = {
      id: editingSubject?.id || `sub-${Date.now()}`,
      code: (formData.get('code') as string || 'SUB-01').toUpperCase(),
      name: formData.get('name') as string || 'Subject Name',
      gradeLevel: formData.get('gradeLevel') as string || 'Grade 10',
      color: formData.get('color') as string || '#2563EB'
    };

    if (editingSubject) {
      setSubjects(subjects.map(s => s.id === editingSubject.id ? subjectData : s));
    } else {
      setSubjects([...subjects, subjectData]);
    }
    setSubjectModalOpen(false);
    setEditingSubject(null);
  };

  const handleDeleteSubject = (id: string) => {
    setSubjects(subjects.filter(s => s.id !== id));
  };

  // --- SESSION HANDLERS ---
  const handleSaveSession = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const selectedSubIds = subjects
      .filter(s => formData.get(`sess-sub-${s.id}`) === 'on')
      .map(s => s.id);

    const sessionData: ExamSession = {
      id: editingSession?.id || `session-${Date.now()}`,
      name: formData.get('name') as string || 'Exam Session',
      date: formData.get('date') as string || new Date().toISOString().split('T')[0],
      timeSlot: formData.get('timeSlot') as string || '09:00 AM - 12:00 PM',
      subjectIds: selectedSubIds.length > 0 ? selectedSubIds : subjects.map(s => s.id)
    };

    if (editingSession) {
      setSessions(sessions.map(s => s.id === editingSession.id ? sessionData : s));
    } else {
      setSessions([...sessions, sessionData]);
    }
    setSessionModalOpen(false);
    setEditingSession(null);
  };

  const handleDeleteSession = (id: string) => {
    setSessions(sessions.filter(s => s.id !== id));
  };

  // --- CLEAR ALL DATA ---
  const handleClearAllData = () => {
    if (window.confirm('Are you sure you want to clear all data? This will remove all classrooms, students, subjects, and sessions.')) {
      setRooms([]);
      setStudents([]);
      setSubjects([]);
      setSessions([]);
      setImportStatus({ type: 'success', message: 'All current data has been cleared.' });
    }
  };

  const handleGenerateSchedule = () => {
    if (students.length === 0 || subjects.length === 0) {
      setImportStatus({ type: 'error', message: 'Need students and subjects to generate schedule.' });
      return;
    }
    const newSessions = generateAutoSchedule(students, subjects);
    setSessions(newSessions);
    setImportStatus({ type: 'success', message: `Successfully generated ${newSessions.length} sessions!` });
  };

  // --- CSV UPLOAD HANDLERS ---
  const handleRoomsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseRoomsCSV(text);
        if (parsed.length > 0) {
          setRooms(parsed);
          setImportStatus({ type: 'success', message: `Successfully imported ${parsed.length} classrooms!` });
        } else {
          setImportStatus({ type: 'error', message: 'No valid room records found in CSV file.' });
        }
      } catch {
        setImportStatus({ type: 'error', message: 'Failed to parse CSV file. Please check format.' });
      }
    };
    reader.readAsText(file);
  };

  const handleStudentsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseStudentsCSV(text, subjects);
        if (parsed.length > 0) {
          setStudents(parsed);
          setImportStatus({ type: 'success', message: `Successfully imported ${parsed.length} students!` });
        } else {
          setImportStatus({ type: 'error', message: 'No valid student records found in CSV.' });
        }
      } catch {
        setImportStatus({ type: 'error', message: 'Failed to parse student CSV file.' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      {/* Sub Tabs Bar */}
      <div className="bg-white rounded-2xl p-2 sm:p-3 border border-[#E2E8F0] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSubTab('rooms')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              subTab === 'rooms' ? 'bg-[#2563EB] text-[#F8FAFC] shadow-2xs' : 'bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Classrooms ({rooms.length})</span>
          </button>

          <button
            onClick={() => setSubTab('students')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              subTab === 'students' ? 'bg-[#2563EB] text-[#F8FAFC] shadow-2xs' : 'bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Students ({students.length})</span>
          </button>

          <button
            onClick={() => setSubTab('subjects')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              subTab === 'subjects' ? 'bg-[#2563EB] text-[#F8FAFC] shadow-2xs' : 'bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Subjects & Sessions ({subjects.length}/{sessions.length})</span>
          </button>

          <button
            onClick={() => setSubTab('import_export')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              subTab === 'import_export' ? 'bg-[#2563EB] text-[#F8FAFC] shadow-2xs' : 'bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>CSV Import / Export</span>
          </button>
        </div>

        {/* Action Controls: Clear All & Demo Data */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearAllData}
            title="Wipe out all records to start fresh"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#1E3A8A] hover:text-red-700 bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] transition-colors shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>

          {onSyncFolder && (
            <button
              onClick={onSyncFolder}
              disabled={isSyncingFolder}
              title="Synchronize real data from source Excel files"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] transition-colors shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#2563EB] ${isSyncingFolder ? 'animate-spin' : ''}`} />
              <span>{isSyncingFolder ? 'Syncing...' : 'Sync Source Folder'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Import Status Alert */}
      {importStatus && (
        <div className={`p-3.5 rounded-xl text-xs sm:text-sm flex items-center justify-between border ${
          importStatus.type === 'success' ? 'bg-[#F1F5F9] text-[#0F172A] border-[#2563EB]' : 'bg-red-50 text-red-900 border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {importStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-[#2563EB]" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{importStatus.message}</span>
          </div>
          <button onClick={() => setImportStatus(null)} className="font-bold text-xs cursor-pointer">✕</button>
        </div>
      )}

      {/* TAB 1: CLASSROOMS & ROOMS */}
      {subTab === 'rooms' && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#0F172A] font-heading">
                Classrooms & Exam Halls
              </h3>
              <p className="text-xs text-[#64748B]">
                Total Capacity: <strong className="text-[#0F172A]">{rooms.filter(r => r.isActive).reduce((a, b) => a + b.capacity, 0)}</strong> desks available
              </p>
            </div>
            <button
              onClick={() => {
                setEditingRoom(null);
                setRoomModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#F8FAFC] bg-[#2563EB] hover:bg-[#1D4ED8] transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Classroom</span>
            </button>
          </div>

          {rooms.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Building2 className="w-10 h-10 text-[#64748B] mx-auto" />
              <h4 className="text-sm font-bold text-[#0F172A]">No Classrooms Configured</h4>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                Add your exam rooms or halls manually or import them via CSV to start allocating seats.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => {
                    setEditingRoom(null);
                    setRoomModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#2563EB] text-[#F8FAFC] hover:bg-[#1D4ED8] cursor-pointer"
                >
                  + Add First Classroom
                </button>
                <button
                  onClick={() => setSubTab('import_export')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0] border border-[#E2E8F0] cursor-pointer"
                >
                  Upload Rooms CSV
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F1F5F9] text-[#3B82F6] font-bold border-b border-[#E2E8F0]">
                    <th className="p-3.5">Room Name</th>
                    <th className="p-3.5">Building & Floor</th>
                    <th className="p-3.5">Capacity</th>
                    <th className="p-3.5">Grid (Rows × Cols)</th>
                    <th className="p-3.5">Bench Type</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {rooms.map((room) => (
                    <tr key={room.id} className="hover:bg-[#F8FAFC]">
                      <td className="p-3.5 font-bold text-[#0F172A]">{room.name}</td>
                      <td className="p-3.5 text-[#3B82F6]">{room.building} • {room.floor}</td>
                      <td className="p-3.5 font-bold text-[#2563EB] font-mono">{room.capacity} seats</td>
                      <td className="p-3.5 text-[#3B82F6]">{room.rows} × {room.cols}</td>
                      <td className="p-3.5">
                        <span className="capitalize px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#0F172A] text-xs font-medium border border-[#E2E8F0]">
                          {room.benchType}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          room.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-[#F1F5F9] text-[#64748B]'
                        }`}>
                          {room.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingRoom(room);
                            setRoomModalOpen(true);
                          }}
                          className="p-1.5 text-[#3B82F6] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room.id)}
                          className="p-1.5 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STUDENTS ROSTER (SEPARATED 11th AND 12th) */}
      {subTab === 'students' && (() => {
        const isXI = (g?: string) => Boolean(g && g.toUpperCase().includes('XI') && !g.toUpperCase().includes('XII'));
        const isXII = (g?: string) => Boolean(g && g.toUpperCase().includes('XII'));

        const xiStudents = students.filter(s => isXI(s.grade));
        const xiiStudents = students.filter(s => isXII(s.grade));

        const xiSections = Array.from(new Set(xiStudents.map(s => s.grade))).sort();
        const xiiSections = Array.from(new Set(xiiStudents.map(s => s.grade))).sort();

        const currentGradeStudents = studentGradeFilter === 'XI' 
          ? xiStudents 
          : studentGradeFilter === 'XII' 
          ? xiiStudents 
          : students;

        const availableSections = studentGradeFilter === 'XI'
          ? xiSections
          : studentGradeFilter === 'XII'
          ? xiiSections
          : Array.from(new Set(students.map(s => s.grade))).sort();

        const filteredStudents = currentGradeStudents.filter(s => {
          if (studentSectionFilter !== 'all' && s.grade !== studentSectionFilter) {
            return false;
          }
          if (studentSearch.trim()) {
            const q = studentSearch.toLowerCase();
            return s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q) || s.grade?.toLowerCase().includes(q);
          }
          return true;
        });

        return (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs overflow-hidden space-y-4">
            {/* Header with Title & Add Student */}
            <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#0F172A] font-heading">
                  Student Roster & Enrollments
                </h3>
                <p className="text-xs text-[#64748B]">
                  Total Students: <strong className="text-[#0F172A]">{students.length}</strong> • Class 11: <strong className="text-[#2563EB]">{xiStudents.length}</strong> • Class 12: <strong className="text-indigo-600">{xiiStudents.length}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {onOpenEmailModal && (
                  <button
                    onClick={onOpenEmailModal}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#2563EB] bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all shadow-2xs cursor-pointer"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Email Class Sheets</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingStudent(null);
                    setStudentModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#F8FAFC] bg-[#2563EB] hover:bg-[#1D4ED8] transition-all shadow-2xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Student</span>
                </button>
              </div>
            </div>

            {/* SEPARATE 11th AND 12th STUDENTS - Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-4 sm:px-5">
              {/* Class 11 Card */}
              <div 
                onClick={() => {
                  setStudentGradeFilter(studentGradeFilter === 'XI' ? 'all' : 'XI');
                  setStudentSectionFilter('all');
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  studentGradeFilter === 'XI'
                    ? 'bg-blue-50/80 border-[#2563EB] shadow-xs'
                    : 'bg-[#F8FAFC] hover:bg-blue-50/40 border-[#E2E8F0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
                      XI
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#0F172A]">Class 11 (Grade XI)</h4>
                      <p className="text-xs text-[#64748B]">{xiSections.length} Sections ({xiSections.join(', ')})</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-extrabold text-[#2563EB]">{xiStudents.length}</span>
                    <span className="text-[11px] text-[#64748B] block font-semibold">Students</span>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-blue-100 flex items-center justify-between text-xs">
                  <span className="text-[#64748B] font-medium">{studentGradeFilter === 'XI' ? '✓ Currently Showing Class 11' : 'Click to view Class 11 only'}</span>
                  <span className="text-xs font-bold text-[#2563EB]">View Class 11 →</span>
                </div>
              </div>

              {/* Class 12 Card */}
              <div 
                onClick={() => {
                  setStudentGradeFilter(studentGradeFilter === 'XII' ? 'all' : 'XII');
                  setStudentSectionFilter('all');
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  studentGradeFilter === 'XII'
                    ? 'bg-indigo-50/80 border-indigo-600 shadow-xs'
                    : 'bg-[#F8FAFC] hover:bg-indigo-50/40 border-[#E2E8F0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
                      XII
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#0F172A]">Class 12 (Grade XII)</h4>
                      <p className="text-xs text-[#64748B]">{xiiSections.length} Sections ({xiiSections.join(', ')})</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-extrabold text-indigo-600">{xiiStudents.length}</span>
                    <span className="text-[11px] text-[#64748B] block font-semibold">Students</span>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-indigo-100 flex items-center justify-between text-xs">
                  <span className="text-[#64748B] font-medium">{studentGradeFilter === 'XII' ? '✓ Currently Showing Class 12' : 'Click to view Class 12 only'}</span>
                  <span className="text-xs font-bold text-indigo-600">View Class 12 →</span>
                </div>
              </div>
            </div>

            {/* Filter Bar: Tabs, Sections, and Search */}
            <div className="px-4 sm:px-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                {/* Grade Filter Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-[#F1F5F9] rounded-xl border border-[#E2E8F0] self-start">
                  <button
                    onClick={() => { setStudentGradeFilter('all'); setStudentSectionFilter('all'); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      studentGradeFilter === 'all'
                        ? 'bg-white text-[#0F172A] shadow-2xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    All Students ({students.length})
                  </button>
                  <button
                    onClick={() => { setStudentGradeFilter('XI'); setStudentSectionFilter('all'); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      studentGradeFilter === 'XI'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    Class 11 ({xiStudents.length})
                  </button>
                  <button
                    onClick={() => { setStudentGradeFilter('XII'); setStudentSectionFilter('all'); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      studentGradeFilter === 'XII'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    Class 12 ({xiiStudents.length})
                  </button>
                </div>

                {/* Search Box */}
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by name, roll no, section..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-medium text-[#0F172A] outline-none focus:border-[#2563EB] transition"
                  />
                  {studentSearch && (
                    <button onClick={() => setStudentSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748B] hover:text-[#0F172A]">✕</button>
                  )}
                </div>
              </div>

              {/* Section Chips */}
              {availableSections.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <span className="text-[#64748B] font-semibold shrink-0">Sections:</span>
                  <button
                    onClick={() => setStudentSectionFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                      studentSectionFilter === 'all'
                        ? 'bg-[#0F172A] text-white shadow-2xs'
                        : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
                    }`}
                  >
                    All Sections
                  </button>
                  {availableSections.map(sec => {
                    const secCount = students.filter(s => s.grade === sec).length;
                    return (
                      <button
                        key={sec}
                        onClick={() => setStudentSectionFilter(sec)}
                        className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                          studentSectionFilter === sec
                            ? 'bg-[#2563EB] text-white shadow-2xs'
                            : 'bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0]'
                        }`}
                      >
                        {sec} ({secCount})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {filteredStudents.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Users className="w-10 h-10 text-[#64748B] mx-auto" />
                <h4 className="text-sm font-bold text-[#0F172A]">No Students Match Criteria</h4>
                <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                  No students found for the selected grade or search query.
                </p>
                <button
                  onClick={() => { setStudentGradeFilter('all'); setStudentSectionFilter('all'); setStudentSearch(''); }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#2563EB] text-[#F8FAFC] hover:bg-[#1D4ED8] cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="sticky top-0 bg-[#F1F5F9] z-10">
                    <tr className="text-[#3B82F6] font-bold border-b border-[#E2E8F0]">
                      <th className="p-3.5">Roll No</th>
                      <th className="p-3.5">Full Name</th>
                      <th className="p-3.5">Grade / Section</th>
                      <th className="p-3.5">Registered Subjects</th>
                      <th className="p-3.5">Special Needs</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredStudents.map((student) => {
                      const isStudentXI = isXI(student.grade);
                      return (
                        <tr key={student.id} className="hover:bg-[#F8FAFC]">
                          <td className="p-3.5 font-mono font-bold text-[#0F172A]">{student.rollNo}</td>
                          <td className="p-3.5 font-semibold text-[#0F172A]">
                            <span>{student.name}</span>
                          </td>
                          <td className="p-3.5 text-[#0F172A]">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                              isStudentXI
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            }`}>
                              {student.grade}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="flex gap-1 flex-wrap">
                              {student.enrolledSubjectIds.map(subId => {
                                const sub = subjects.find(s => s.id === subId);
                                return sub ? (
                                  <span 
                                    key={subId}
                                    className="text-[10px] font-bold text-[#F8FAFC] px-2 py-0.5 rounded shadow-2xs"
                                    style={{ backgroundColor: sub.color }}
                                  >
                                    {sub.code}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          </td>
                          <td className="p-3.5">
                            {student.specialNeeds ? (
                              <span className="text-xs font-bold text-[#2563EB] bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#E2E8F0]">
                                ♿ Front Row
                              </span>
                            ) : (
                              <span className="text-[#64748B] text-xs">Standard</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right space-x-2">
                            <button
                              onClick={() => {
                                setEditingStudent(student);
                                setStudentModalOpen(true);
                              }}
                              className="p-1.5 text-[#3B82F6] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student.id)}
                              className="p-1.5 text-[#64748B] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 3: SUBJECTS & SESSIONS */}
      {subTab === 'subjects' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Subjects Card */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0F172A] font-heading">
                  Exam Subjects & Codes
                </h3>
                <p className="text-xs text-[#64748B]">
                  Configured Subjects: {subjects.length}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingSubject(null);
                  setSubjectModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#F8FAFC] bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Subject</span>
              </button>
            </div>

            {subjects.length === 0 ? (
              <div className="p-8 text-center bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-2">
                <BookOpen className="w-8 h-8 text-[#64748B] mx-auto" />
                <p className="text-xs text-[#64748B]">No exam subjects created yet.</p>
                <button
                  onClick={() => {
                    setEditingSubject(null);
                    setSubjectModalOpen(true);
                  }}
                  className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
                >
                  + Add Subject
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {subjects.map(sub => (
                  <div key={sub.id} className="flex items-center justify-between p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                    <div className="flex items-center gap-3">
                      <span 
                        className="w-4 h-4 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: sub.color }}
                      />
                      <div>
                        <span className="text-xs font-bold text-[#0F172A]">{sub.name}</span>
                        <span className="block text-[11px] font-mono text-[#3B82F6] font-semibold">{sub.code} • {sub.gradeLevel}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingSubject(sub);
                          setSubjectModalOpen(true);
                        }}
                        className="p-1.5 text-[#3B82F6] hover:text-[#0F172A] rounded-lg hover:bg-[#E2E8F0] transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(sub.id)}
                        className="p-1.5 text-[#64748B] hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sessions Card */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0F172A] font-heading">
                  Exam Schedule Sessions
                </h3>
                <p className="text-xs text-[#64748B]">
                  Configured Sessions: {sessions.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateSchedule}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors cursor-pointer border border-[#E2E8F0]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>Auto Generate</span>
                </button>
                <button
                  onClick={() => {
                    setEditingSession(null);
                    setSessionModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#F8FAFC] bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Session</span>
                </button>
              </div>
            </div>

            {sessions.length === 0 ? (
              <div className="p-8 text-center bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-2">
                <Calendar className="w-8 h-8 text-[#64748B] mx-auto" />
                <p className="text-xs text-[#64748B]">No exam sessions created yet.</p>
                <button
                  onClick={() => {
                    setEditingSession(null);
                    setSessionModalOpen(true);
                  }}
                  className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
                >
                  + Add Session
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {sessions.map(sess => (
                  <div key={sess.id} className="p-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0F172A]">{sess.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingSession(sess);
                            setSessionModalOpen(true);
                          }}
                          className="p-1 text-[#3B82F6] hover:text-[#0F172A] rounded hover:bg-[#E2E8F0] cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSession(sess.id)}
                          className="p-1 text-[#64748B] hover:text-red-600 rounded hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#3B82F6]">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {sess.date}</span>
                      <span className="flex items-center gap-1 font-semibold"><Clock className="w-3.5 h-3.5" /> {sess.timeSlot}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: CSV & EXCEL IMPORT / EXPORT */}
      {subTab === 'import_export' && (
        <div className="space-y-4">
          {/* Source Folder Card */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F172A]">Excel Source Folder Auto-Ingestion</h4>
                  <p className="text-xs text-[#64748B]">
                    Drop any <code className="font-mono text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded">.xlsx</code> or <code className="font-mono text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded">.xls</code> sheets into <code className="font-mono text-[#2563EB] bg-[#F1F5F9] px-1 py-0.5 rounded">e:/Ye not me/Antigravity/source</code>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={api.getTemplateDownloadUrl()}
                  download
                  className="px-3 py-2 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Get Master Excel Template</span>
                </a>
              </div>
            </div>

            <p className="text-xs text-[#2563EB] bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] leading-relaxed">
              💡 <strong>School Multi-Section Support:</strong> Automatically reads section sheets like <code className="font-bold">XI - A</code>, <code className="font-bold">XI - B</code>, <code className="font-bold">A</code>, <code className="font-bold">B</code>, with <code className="font-bold">EXAM NO</code>, <code className="font-bold">Name</code>, <code className="font-bold">Group</code>, and individual subject columns (<code className="font-bold">SUB 1</code> to <code className="font-bold">SUB 6</code>: Eng, Phy, Che, Math, Bio, CS, BS, Acc, Eco, etc.). Summaries and footer counts are auto-filtered.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Import Students CSV */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#F1F5F9] text-[#2563EB] border border-[#E2E8F0]">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0F172A]">Upload Students CSV</h4>
                <p className="text-xs text-[#64748B]">Import student roll numbers, classes, and subjects</p>
              </div>
            </div>

            <div className="border-2 border-dashed border-[#D8D4CA] hover:border-[#2563EB] rounded-2xl p-6 text-center bg-[#F8FAFC] hover:bg-white transition-colors">
              <input
                type="file"
                accept=".csv"
                id="file-students-csv"
                onChange={handleStudentsFileUpload}
                className="hidden"
              />
              <label htmlFor="file-students-csv" className="cursor-pointer block">
                <FileSpreadsheet className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
                <span className="text-xs font-bold text-[#2563EB] hover:underline">Click to upload Students CSV</span>
                <span className="block text-[11px] text-[#64748B] mt-1">Supports standard CSV with Roll No, Name, Grade</span>
              </label>
            </div>

            <button
              onClick={() => downloadFile(exportStudentsTemplate(), 'students_template.csv')}
              className="w-full py-2 px-3 rounded-xl border border-[#E2E8F0] hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Download Students CSV Template</span>
            </button>
          </div>

          {/* Import Rooms CSV */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#F1F5F9] text-[#2563EB] border border-[#E2E8F0]">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#0F172A]">Upload Classrooms CSV</h4>
                <p className="text-xs text-[#64748B]">Import room names, capacity, and dimensions</p>
              </div>
            </div>

            <div className="border-2 border-dashed border-[#D8D4CA] hover:border-[#2563EB] rounded-2xl p-6 text-center bg-[#F8FAFC] hover:bg-white transition-colors">
              <input
                type="file"
                accept=".csv"
                id="file-rooms-csv"
                onChange={handleRoomsFileUpload}
                className="hidden"
              />
              <label htmlFor="file-rooms-csv" className="cursor-pointer block">
                <FileSpreadsheet className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
                <span className="text-xs font-bold text-[#2563EB] hover:underline">Click to upload Rooms CSV</span>
                <span className="block text-[11px] text-[#64748B] mt-1">Supports Room Name, Capacity, Rows, Cols</span>
              </label>
            </div>

            <button
              onClick={() => downloadFile(exportRoomsTemplate(), 'rooms_template.csv')}
              className="w-full py-2 px-3 rounded-xl border border-[#E2E8F0] hover:bg-[#F1F5F9] text-xs font-semibold text-[#0F172A] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Download Rooms CSV Template</span>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* MODAL: ADD / EDIT CLASSROOM */}
      {roomModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
              <h3 className="text-base font-bold text-[#0F172A] font-heading">
                {editingRoom ? 'Edit Classroom' : 'Add New Classroom'}
              </h3>
              <button onClick={() => setRoomModalOpen(false)} className="p-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveRoom} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Room Name / Number *</label>
                <input
                  name="name"
                  required
                  placeholder="e.g. Room 101"
                  defaultValue={editingRoom?.name || ''}
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#2563EB] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Building Block</label>
                  <input
                    name="building"
                    placeholder="e.g. Main Block"
                    defaultValue={editingRoom?.building || ''}
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#2563EB] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Floor</label>
                  <input
                    name="floor"
                    placeholder="e.g. 1st Floor"
                    defaultValue={editingRoom?.floor || ''}
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#2563EB] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Capacity *</label>
                  <input
                    name="capacity"
                    type="number"
                    required
                    defaultValue={editingRoom?.capacity || 30}
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#2563EB] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Rows</label>
                  <input
                    name="rows"
                    type="number"
                    defaultValue={editingRoom?.rows || 5}
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#2563EB] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Columns</label>
                  <input
                    name="cols"
                    type="number"
                    defaultValue={editingRoom?.cols || 6}
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#2563EB] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#0F172A]">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={editingRoom ? editingRoom.isActive : true}
                    className="w-4 h-4 text-[#2563EB] rounded"
                  />
                  <span>Active for Allocation</span>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setRoomModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[#3B82F6] hover:bg-[#F1F5F9] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] font-semibold shadow-sm cursor-pointer"
                >
                  Save Classroom
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT STUDENT */}
      {studentModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
              <h3 className="text-base font-bold text-[#0F172A] font-heading">
                {editingStudent ? 'Edit Student' : 'Add New Student'}
              </h3>
              <button onClick={() => setStudentModalOpen(false)} className="p-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveStudent} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Roll Number *</label>
                  <input
                    name="rollNo"
                    required
                    placeholder="e.g. 10A-01"
                    defaultValue={editingStudent?.rollNo || ''}
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] font-mono focus:ring-2 focus:ring-[#2563EB] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Grade / Class *</label>
                  <input
                    name="grade"
                    required
                    placeholder="e.g. Grade 10-A"
                    defaultValue={editingStudent?.grade || ''}
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#2563EB] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Student Full Name *</label>
                <input
                  name="name"
                  required
                  defaultValue={editingStudent?.name || ''}
                  placeholder="e.g. John Doe"
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#2563EB] outline-none"
                />
              </div>

              {subjects.length > 0 && (
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1.5">Enrolled Exam Subjects</label>
                  <div className="grid grid-cols-2 gap-2 bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] max-h-36 overflow-y-auto">
                    {subjects.map(s => (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          name={`sub-${s.id}`}
                          defaultChecked={editingStudent?.enrolledSubjectIds.includes(s.id) || !editingStudent}
                          className="rounded text-[#2563EB]"
                        />
                        <span className="font-semibold text-[#0F172A]">{s.code} - {s.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#0F172A]">
                  <input
                    type="checkbox"
                    name="specialNeeds"
                    defaultChecked={editingStudent?.specialNeeds}
                    className="w-4 h-4 text-[#2563EB] rounded"
                  />
                  <span>♿ Accessibility / Special Accommodation (Front Row)</span>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setStudentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[#3B82F6] hover:bg-[#F1F5F9] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] font-semibold shadow-sm cursor-pointer"
                >
                  Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT SUBJECT */}
      {subjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
              <h3 className="text-base font-bold text-[#0F172A] font-heading">
                {editingSubject ? 'Edit Subject' : 'Add New Subject'}
              </h3>
              <button onClick={() => setSubjectModalOpen(false)} className="p-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveSubject} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Subject Code *</label>
                <input
                  name="code"
                  required
                  placeholder="e.g. MATH-10"
                  defaultValue={editingSubject?.code || ''}
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] font-mono focus:ring-2 focus:ring-[#2563EB] outline-none uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Subject Full Name *</label>
                <input
                  name="name"
                  required
                  placeholder="e.g. Mathematics"
                  defaultValue={editingSubject?.name || ''}
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#2563EB] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Grade Level</label>
                <input
                  name="gradeLevel"
                  placeholder="e.g. Grade 10"
                  defaultValue={editingSubject?.gradeLevel || 'Grade 10'}
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#2563EB] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Theme Tag Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    name="color"
                    defaultValue={editingSubject?.color || '#2563EB'}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-[#E2E8F0]"
                  />
                  <span className="text-xs text-[#64748B]">Color used on desk labels and seating map</span>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setSubjectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[#3B82F6] hover:bg-[#F1F5F9] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] font-semibold shadow-sm cursor-pointer"
                >
                  Save Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT SESSION */}
      {sessionModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
              <h3 className="text-base font-bold text-[#0F172A] font-heading">
                {editingSession ? 'Edit Exam Session' : 'Add Exam Session'}
              </h3>
              <button onClick={() => setSessionModalOpen(false)} className="p-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveSession} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Session Title *</label>
                <input
                  name="name"
                  required
                  placeholder="e.g. Midterm Morning Session"
                  defaultValue={editingSession?.name || ''}
                  className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#2563EB] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Date *</label>
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={editingSession?.date || new Date().toISOString().split('T')[0]}
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#2563EB] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">Time Slot</label>
                  <input
                    name="timeSlot"
                    placeholder="09:00 AM - 12:00 PM"
                    defaultValue={editingSession?.timeSlot || '09:00 AM - 12:00 PM'}
                    className="w-full p-2.5 rounded-xl border border-[#E2E8F0] focus:ring-2 focus:ring-[#2563EB] outline-none"
                  />
                </div>
              </div>

              {subjects.length > 0 && (
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1.5">Exam Subjects in this Session</label>
                  <div className="space-y-1.5 bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] max-h-36 overflow-y-auto">
                    {subjects.map(s => (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          name={`sess-sub-${s.id}`}
                          defaultChecked={editingSession ? editingSession.subjectIds.includes(s.id) : true}
                          className="rounded text-[#2563EB]"
                        />
                        <span className="font-semibold text-[#0F172A]">{s.code} - {s.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setSessionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[#3B82F6] hover:bg-[#F1F5F9] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] font-semibold shadow-sm cursor-pointer"
                >
                  Save Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
