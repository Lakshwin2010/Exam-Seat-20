import React, { useState } from 'react';
import { 
  RoomAllocation, 
  SeatAssignment, 
  SeatingPlan, 
  ExamSubject 
} from '../types';
import { 
  Building2, 
  UserCheck, 
  ArrowLeftRight, 
  AlertCircle, 
  Sparkles, 
  Layers, 
  ChevronRight, 
  ChevronLeft,
  Eye,
  Info,
  CheckCircle,
  HelpCircle,
  ShieldAlert,
  Search,
  Filter
} from 'lucide-react';

interface RoomAllocationViewProps {
  plan: SeatingPlan;
  subjects: ExamSubject[];
  onSwapSeats: (
    sourceRoomId: string, 
    sourceSeatIdx: number, 
    targetRoomId: string, 
    targetSeatIdx: number
  ) => void;
  onOpenSearch: () => void;
}

export const RoomAllocationView: React.FC<RoomAllocationViewProps> = ({
  plan,
  subjects,
  onSwapSeats,
  onOpenSearch
}) => {
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(0);
  const [selectedSeat, setSelectedSeat] = useState<{ roomId: string; seat: SeatAssignment } | null>(null);
  const [swapSourceSeat, setSwapSourceSeat] = useState<{ roomId: string; seat: SeatAssignment } | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [showAntiCheatHeatmap, setShowAntiCheatHeatmap] = useState(false);

  const rooms = plan.roomAllocations;
  const currentRoom = rooms[selectedRoomIndex] || rooms[0];

  if (!currentRoom) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">No Classrooms Allocated</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
          Click "Auto Allocate" above to automatically generate optimal room seating.
        </p>
      </div>
    );
  }

  // Handle seat click
  const handleSeatClick = (seat: SeatAssignment) => {
    if (swapSourceSeat) {
      if (swapSourceSeat.roomId === currentRoom.roomId && swapSourceSeat.seat.seatIndex === seat.seatIndex) {
        // Deselect
        setSwapSourceSeat(null);
      } else {
        // Execute swap
        onSwapSeats(
          swapSourceSeat.roomId,
          swapSourceSeat.seat.seatIndex,
          currentRoom.roomId,
          seat.seatIndex
        );
        setSwapSourceSeat(null);
        setSelectedSeat(null);
      }
    } else {
      setSelectedSeat({ roomId: currentRoom.roomId, seat });
    }
  };

  const startSwapFromModal = () => {
    if (selectedSeat) {
      setSwapSourceSeat(selectedSeat);
      setSelectedSeat(null);
    }
  };

  // Color lookup for subjects, with slight shade variation based on class (grade)
  const getSubjectColorForGrade = (code?: string, grade?: string) => {
    if (!code) return '#64748B';
    const sub = subjects.find(s => s.code === code);
    let baseColor = sub ? sub.color : '#2563EB';

    if (grade && baseColor.startsWith('#')) {
      let hash = 0;
      for (let i = 0; i < grade.length; i++) hash += grade.charCodeAt(i);
      
      // slightly lighten or darken based on grade hash
      const adjust = (hash % 3 === 0) ? 40 : (hash % 3 === 1 ? -40 : 0);
      
      if (adjust !== 0 && baseColor.length >= 7) {
        let r = parseInt(baseColor.substring(1,3), 16);
        let g = parseInt(baseColor.substring(3,5), 16);
        let b = parseInt(baseColor.substring(5,7), 16);
        
        r = Math.max(0, Math.min(255, r + adjust));
        g = Math.max(0, Math.min(255, g + adjust));
        b = Math.max(0, Math.min(255, b + adjust));
        
        baseColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      }
    }
    return baseColor;
  };

  return (
    <div className="space-y-4">
      {/* Room Selector Tab Bar */}
      <div className="bg-white rounded-2xl p-2 sm:p-3 border border-[#E2E8F0] shadow-2xs">
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
          <div className="flex items-center gap-1.5 min-w-max">
            {rooms.map((room, idx) => {
              const isSelected = idx === selectedRoomIndex;
              const gradeCount = Object.keys(room.gradeDistribution).length;
              const isMixed = gradeCount > 1;

              return (
                <button
                  key={room.roomId}
                  id={`room-tab-${room.roomId}`}
                  onClick={() => {
                    setSelectedRoomIndex(idx);
                    setSelectedSeat(null);
                  }}
                  className={`flex flex-col items-start px-3.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#2563EB] text-[#F8FAFC] shadow-sm ring-2 ring-[#2563EB]/30'
                      : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] border border-[#E2E8F0]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs sm:text-sm">{room.roomName}</span>
                    {isMixed && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                        isSelected ? 'bg-[#1D4ED8] text-[#F8FAFC]' : 'bg-[#BFDBFE]/40 text-[#2563EB] border border-[#BFDBFE]'
                      }`}>
                        Mixed ({gradeCount})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[11px] font-medium ${isSelected ? 'text-[#D8D4CA]' : 'text-[#64748B]'}`}>
                      {room.totalAssigned}/{room.capacity} seats
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Swap Mode Alert Bar */}
      {swapSourceSeat && (
        <div className="bg-[#EFF6FF] border-2 border-[#60A5FA] rounded-xl p-3 sm:p-4 flex items-center justify-between gap-2 animate-pulse">
          <div className="flex items-center gap-2.5">
            <ArrowLeftRight className="w-5 h-5 text-[#1E3A8A] shrink-0" />
            <div className="text-xs sm:text-sm text-[#1E3A8A]">
              <span className="font-bold">Swap Mode Active: </span>
              Selected <span className="font-semibold">{swapSourceSeat.seat.studentName || 'Empty Seat'}</span> ({swapSourceSeat.seat.seatLabel}). 
              Click any other desk to swap seats.
            </div>
          </div>
          <button
            onClick={() => setSwapSourceSeat(null)}
            className="text-xs font-semibold bg-white text-[#0F172A] hover:bg-[#F1F5F9] px-3 py-1.5 rounded-lg border border-[#E2E8F0] shrink-0 shadow-2xs cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Classroom Layout Card */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
        
        {/* Room Header & Toolbar */}
        <div className="p-4 sm:p-5 border-b border-[#E2E8F0] bg-[#F1F5F9]/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-[#0F172A] font-heading">
                {currentRoom.roomName}
              </h2>
              <span className="text-xs font-semibold text-[#3B82F6] bg-white border border-[#E2E8F0] px-2.5 py-0.5 rounded-full">
                {currentRoom.building || 'Academic Block'} • {currentRoom.floor || '1st Floor'}
              </span>
              <span className="text-xs font-semibold bg-[#BFDBFE]/30 text-[#2563EB] border border-[#BFDBFE] px-2.5 py-0.5 rounded-full">
                Capacity: {currentRoom.totalAssigned} / {currentRoom.capacity} Seated
              </span>
            </div>

            {/* Distribution Badges (e.g. 15 from Grade 10, 15 from Grade 12) */}
            <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
              <span className="text-[#64748B] font-medium">Split Breakdown:</span>
              {Object.entries(currentRoom.gradeDistribution).map(([grade, count]) => (
                <span 
                  key={grade}
                  className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold bg-white border border-[#E2E8F0] text-[#0F172A] shadow-2xs"
                >
                  <span className="w-2 h-2 rounded-full mr-1.5 bg-[#2563EB]" />
                  {grade}: <strong className="ml-1 text-[#0F172A]">{count}</strong>
                </span>
              ))}
              {Object.entries(currentRoom.subjectDistribution).map(([subCode, count]) => {
                const sub = subjects.find(s => s.code === subCode);
                return (
                  <span 
                    key={subCode}
                    className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-white shadow-2xs"
                    style={{ backgroundColor: sub?.color || '#2563EB' }}
                  >
                    {subCode}: {count}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Quick Filter & View Controls */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => setShowAntiCheatHeatmap(!showAntiCheatHeatmap)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                showAntiCheatHeatmap
                  ? 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE] ring-2 ring-[#60A5FA]/30'
                  : 'bg-white text-[#0F172A] border-[#E2E8F0] hover:bg-[#F1F5F9]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span>Anti-Cheat Audit</span>
            </button>

            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              aria-label="Filter seats by subject"
              className="bg-white text-xs font-semibold text-[#0F172A] rounded-xl px-3 py-1.5 border border-[#E2E8F0] shadow-2xs focus:ring-2 focus:ring-[#2563EB] cursor-pointer"
            >
              <option value="all">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.code}>{s.code} - {s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Visual Classroom Blackboard & Desk Area */}
        <div className="p-4 sm:p-8 bg-[#F8FAFC] overflow-x-auto">
          <div className="min-w-[640px] max-w-4xl mx-auto space-y-6">
            
            {/* Front Stage / Blackboard Indicator */}
            <div className="w-full bg-[#0F172A] text-[#F8FAFC] text-center py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 border-b-4 border-[#252622]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#64748B] animate-pulse" />
              <span className="text-xs sm:text-sm font-bold tracking-widest uppercase font-heading">
                [ Blackboard / Teacher Invigilator Desk - FRONT ]
              </span>
            </div>

            {/* Visual Desks Grid */}
            <div 
              className="grid gap-3 sm:gap-4 p-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs"
              style={{
                gridTemplateColumns: `repeat(${currentRoom.cols}, minmax(0, 1fr))`
              }}
            >
              {currentRoom.assignedSeats.map((seat) => {
                const isOccupied = Boolean(seat.studentId);
                const isSelectedForSwap = swapSourceSeat?.roomId === currentRoom.roomId && swapSourceSeat.seat.seatIndex === seat.seatIndex;
                const isSelected = selectedSeat?.roomId === currentRoom.roomId && selectedSeat.seat.seatIndex === seat.seatIndex;
                const matchesFilter = subjectFilter === 'all' || seat.subjectCode === subjectFilter;
                const subjectColor = getSubjectColorForGrade(seat.subjectCode, seat.studentGrade);

                return (
                  <div
                    key={seat.seatIndex}
                    id={`desk-${currentRoom.roomId}-${seat.seatLabel}`}
                    onClick={() => handleSeatClick(seat)}
                    className={`relative group rounded-xl p-2 sm:p-2.5 border-2 transition-all cursor-pointer flex flex-col justify-between min-h-[96px] sm:min-h-[110px] ${
                      isSelectedForSwap
                        ? 'border-[#2563EB] bg-[#F1F5F9] ring-4 ring-[#2563EB]/30 shadow-md scale-102'
                        : isSelected
                        ? 'border-[#2563EB] bg-[#F1F5F9]/80 shadow-sm'
                        : isOccupied
                        ? 'border-[#E2E8F0] hover:border-[#2563EB]/70 bg-white hover:shadow-md hover:-translate-y-0.5'
                        : 'border-dashed border-[#D8D4CA] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#64748B]'
                    } ${!matchesFilter ? 'opacity-30' : 'opacity-100'}`}
                  >
                    {/* Top Seat Label & Subject Pill */}
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-mono font-bold text-[#3B82F6] bg-[#F1F5F9] px-1.5 py-0.5 rounded">
                        {seat.seatLabel}
                      </span>
                      {seat.subjectCode && (
                        <span 
                          className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded shadow-2xs truncate max-w-[80px]"
                          style={{ backgroundColor: subjectColor }}
                        >
                          {seat.subjectCode}
                        </span>
                      )}
                    </div>

                    {/* Middle: Student Name & Roll Number */}
                    {isOccupied ? (
                      <div className="my-1">
                        <div className="text-xs sm:text-sm font-bold text-[#0F172A] line-clamp-1 group-hover:text-[#2563EB] transition-colors">
                          {seat.studentName}
                        </div>
                        <div className="text-[11px] font-semibold text-[#64748B] font-mono mt-0.5">
                          {seat.studentRollNo}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center my-auto py-2">
                        <span className="text-[11px] font-medium text-[#64748B] italic">Empty Desk</span>
                      </div>
                    )}

                    {/* Bottom: Grade badge & indicators */}
                    <div className="flex items-center justify-between gap-1 text-[10px] mt-1 pt-1 border-t border-[#F1F5F9]">
                      {seat.studentGrade ? (
                        <span className="font-semibold text-[#3B82F6] truncate max-w-[85px]">
                          {seat.studentGrade}
                        </span>
                      ) : (
                        <span className="text-[#D8D4CA]">—</span>
                      )}

                      <div className="flex items-center gap-1">
                        {seat.isSpecialNeeds && (
                          <span title="Special Needs - Front Row Assigned" className="p-0.5 rounded bg-[#F1F5F9] text-[#2563EB] font-bold border border-[#E2E8F0]">
                            ♿
                          </span>
                        )}
                        {showAntiCheatHeatmap && seat.hasNeighborConflict && (
                          <span title="Adjacent desk has same subject!" className="p-0.5 rounded bg-[#EFF6FF] text-[#1E3A8A] font-bold border border-[#BFDBFE]">
                            ⚠️
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Room Footer & Instructions */}
            <div className="flex items-center justify-between text-xs text-[#64748B] px-2 flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-white border border-[#E2E8F0]" />
                  <span>Single Desk</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="p-0.5 rounded bg-[#F1F5F9] text-[#2563EB] text-[10px] border border-[#E2E8F0]">♿</span>
                  <span>Front Row Priority</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="p-0.5 rounded bg-[#EFF6FF] text-[#1E3A8A] text-[10px] border border-[#BFDBFE]">⚠️</span>
                  <span>Same-Subject Neighbor</span>
                </div>
              </div>
              <p className="text-[#64748B] italic">
                * Click any seat to view student or swap desks
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Seat Inspector Drawer / Modal */}
      {selectedSeat && selectedSeat.seat.studentId && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FDFDFB] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E2E8F0] animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md"
                  style={{ backgroundColor: getSubjectColorForGrade(selectedSeat.seat.subjectCode, selectedSeat.seat.studentGrade) }}
                >
                  {selectedSeat.seat.studentName?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">
                    {selectedSeat.seat.studentName}
                  </h3>
                  <p className="text-xs font-mono font-semibold text-[#64748B]">
                    Roll No: {selectedSeat.seat.studentRollNo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSeat(null)}
                className="p-1.5 rounded-full hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-3 bg-[#F1F5F9] p-4 rounded-2xl border border-[#E2E8F0] text-xs">
              <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                <span className="text-[#3B82F6] font-medium">Assigned Classroom:</span>
                <span className="font-bold text-[#0F172A]">{currentRoom.roomName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                <span className="text-[#3B82F6] font-medium">Seat Label:</span>
                <span className="font-bold text-[#2563EB] bg-white px-2 py-0.5 rounded font-mono border border-[#E2E8F0]">
                  {selectedSeat.seat.seatLabel} (Row {selectedSeat.seat.row + 1}, Col {selectedSeat.seat.col + 1})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                <span className="text-[#3B82F6] font-medium">Grade & Class:</span>
                <span className="font-bold text-[#0F172A]">{selectedSeat.seat.studentGrade}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E2E8F0]">
                <span className="text-[#3B82F6] font-medium">Exam Paper:</span>
                <span className="font-bold text-[#0F172A]">
                  {selectedSeat.seat.subjectCode} - {selectedSeat.seat.subjectName}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#3B82F6] font-medium">Special Accommodations:</span>
                <span className="font-bold text-[#0F172A]">
                  {selectedSeat.seat.isSpecialNeeds ? '♿ Front Row Accessible' : 'Standard'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={startSwapFromModal}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm text-[#F8FAFC] bg-[#2563EB] hover:bg-[#1D4ED8] shadow-sm transition-all cursor-pointer"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Swap this Seat</span>
              </button>
              <button
                onClick={() => setSelectedSeat(null)}
                className="py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
