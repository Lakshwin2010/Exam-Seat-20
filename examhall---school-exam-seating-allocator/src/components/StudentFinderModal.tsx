import React, { useState, useMemo } from 'react';
import { Search, X, Building2, User, Clock, Calendar, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { SeatingPlan, Student, ExamSubject } from '../types';

interface StudentFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: SeatingPlan | null;
  allStudents: Student[];
  allSubjects: ExamSubject[];
}

interface FoundResult {
  student: Student;
  roomName: string;
  building?: string;
  floor?: string;
  seatLabel: string;
  row: number;
  col: number;
  subjectCode: string;
  subjectName: string;
  subjectColor?: string;
  isAssigned: boolean;
}

export const StudentFinderModal: React.FC<StudentFinderModalProps> = ({
  isOpen,
  onClose,
  plan,
  allStudents,
  allSubjects
}) => {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim() || !plan) return [];
    const q = query.toLowerCase().trim();

    const matches: FoundResult[] = [];

    // Search across all assigned seats in all rooms
    for (const room of plan.roomAllocations) {
      for (const seat of room.assignedSeats) {
        if (seat.studentId) {
          const matchName = seat.studentName?.toLowerCase().includes(q);
          const matchRoll = seat.studentRollNo?.toLowerCase().includes(q);
          const matchGrade = seat.studentGrade?.toLowerCase().includes(q);

          if (matchName || matchRoll || matchGrade) {
            const studentObj = allStudents.find(s => s.id === seat.studentId);
            if (studentObj) {
              matches.push({
                student: studentObj,
                roomName: room.roomName,
                building: room.building,
                floor: room.floor,
                seatLabel: seat.seatLabel,
                row: seat.row,
                col: seat.col,
                subjectCode: seat.subjectCode || '',
                subjectName: seat.subjectName || '',
                subjectColor: seat.subjectColor,
                isAssigned: true
              });
            }
          }
        }
      }
    }

    return matches;
  }, [query, plan, allStudents]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F1F5F9]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] text-[#2563EB] flex items-center justify-center border border-[#E2E8F0]">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0F172A] font-heading">
                Find Student Exam Seat
              </h2>
              <p className="text-xs text-[#64748B]">
                Instant lookup by Roll Number, Name, or Grade
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-4 sm:p-6 border-b border-[#E2E8F0]">
          <div className="relative">
            <Search className="w-5 h-5 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Roll Number, Name, or Grade..."
              className="w-full bg-[#F8FAFC] hover:bg-white focus:bg-white text-[#0F172A] text-sm font-medium rounded-2xl pl-11 pr-4 py-3.5 border border-[#E2E8F0] focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 transition-all outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Dynamic Filter chips if students exist */}
          {allStudents.length > 0 && (
            <div className="flex items-center gap-1.5 mt-3 flex-wrap text-xs text-[#64748B]">
              <span className="font-semibold text-[#64748B]">Quick search:</span>
              {allStudents.slice(0, 4).map(student => (
                <button
                  key={student.id}
                  onClick={() => setQuery(student.rollNo)}
                  className="px-2 py-0.5 rounded-lg bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] text-xs font-medium cursor-pointer"
                >
                  {student.rollNo} ({student.name.split(' ')[0]})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search Results Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3 bg-[#F8FAFC]/50">
          {!query.trim() ? (
            <div className="text-center py-10 text-[#64748B]">
              <User className="w-12 h-12 mx-auto mb-2 text-[#D8D4CA] stroke-[1.5]" />
              <p className="text-sm font-medium text-[#0F172A]">Enter a roll number or name to search</p>
              <p className="text-xs text-[#64748B] mt-1">Works across all classes and exam rooms</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-10 text-[#64748B]">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 text-[#60A5FA] stroke-[1.5]" />
              <p className="text-sm font-medium text-[#0F172A]">No student matching "{query}"</p>
              <p className="text-xs text-[#64748B] mt-1">Verify roll number or check if plan has been generated.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Found {results.length} result(s)
              </div>

              {results.map((res, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#2563EB] p-4 shadow-2xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div 
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0"
                      style={{ backgroundColor: res.subjectColor || '#2563EB' }}
                    >
                      {res.student.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[#0F172A]">{res.student.name}</h4>
                        <span className="text-[11px] font-mono font-bold bg-[#F1F5F9] text-[#3B82F6] px-2 py-0.5 rounded border border-[#E2E8F0]">
                          {res.student.rollNo}
                        </span>
                      </div>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        {res.student.grade} • Exam: <strong className="text-[#0F172A]">{res.subjectName} ({res.subjectCode})</strong>
                      </p>
                    </div>
                  </div>

                  {/* Room & Seat Highlight Card */}
                  <div className="bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl p-3 flex sm:flex-col items-center justify-between sm:justify-center sm:text-right shrink-0">
                    <span className="text-xs font-semibold text-[#3B82F6]">
                      {res.roomName} {res.floor ? `(${res.floor})` : ''}
                    </span>
                    <span className="text-sm sm:text-base font-extrabold text-[#0F172A] font-mono">
                      Desk: {res.seatLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F1F5F9] border-t border-[#E2E8F0] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#0F172A] bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
