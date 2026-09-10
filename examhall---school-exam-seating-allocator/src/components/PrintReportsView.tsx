import React, { useState } from 'react';
import { Printer, Download, Eye, Layers, FileText, CheckCircle2 } from 'lucide-react';
import { SeatingPlan, ExamSubject } from '../types';
import { downloadFile, exportSeatingPlanToCSV } from '../utils/csvHelpers';

interface PrintReportsViewProps {
  plan: SeatingPlan | null;
  subjects: ExamSubject[];
}

export const PrintReportsView: React.FC<PrintReportsViewProps> = ({ plan, subjects }) => {
  const [printMode, setPrintMode] = useState<'door_sheets' | 'desk_labels' | 'master_matrix'>('door_sheets');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');

  if (!plan) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-[#E2E8F0]">
        <Printer className="w-12 h-12 text-[#64748B] mx-auto mb-3" />
        <h3 className="text-lg font-bold text-[#0F172A]">No Seating Plan to Print</h3>
        <p className="text-sm text-[#64748B] mt-1">Please generate a seating allocation plan first.</p>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const csvContent = exportSeatingPlanToCSV(plan);
    downloadFile(csvContent, `exam-seating-plan-${plan.sessionDate}.csv`);
  };

  const roomsToDisplay = selectedRoomId === 'all'
    ? plan.roomAllocations
    : plan.roomAllocations.filter(r => r.roomId === selectedRoomId);

  return (
    <div className="space-y-4">
      {/* Top Print Toolbar (Hidden during actual print) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-2xs no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] font-heading">
            Print & Export Exam Notices
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Print official classroom door sheets, desk slips, and attendance sign-off lists
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Print Mode Selector */}
          <div className="flex items-center bg-[#F1F5F9] p-1 rounded-xl text-xs font-semibold border border-[#E2E8F0]">
            <button
              onClick={() => setPrintMode('door_sheets')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                printMode === 'door_sheets' ? 'bg-[#2563EB] text-[#F8FAFC] shadow-2xs' : 'text-[#3B82F6] hover:text-[#0F172A]'
              }`}
            >
              Door Signs
            </button>
            <button
              onClick={() => setPrintMode('desk_labels')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                printMode === 'desk_labels' ? 'bg-[#2563EB] text-[#F8FAFC] shadow-2xs' : 'text-[#3B82F6] hover:text-[#0F172A]'
              }`}
            >
              Desk Stickers
            </button>
            <button
              onClick={() => setPrintMode('master_matrix')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                printMode === 'master_matrix' ? 'bg-[#2563EB] text-[#F8FAFC] shadow-2xs' : 'text-[#3B82F6] hover:text-[#0F172A]'
              }`}
            >
              Master Matrix
            </button>
          </div>

          {/* Filter Room */}
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            aria-label="Filter room for printing"
            className="bg-white text-xs font-semibold text-[#0F172A] rounded-xl px-3 py-2 border border-[#E2E8F0] shadow-2xs cursor-pointer"
          >
            <option value="all">All Rooms ({plan.roomAllocations.length})</option>
            {plan.roomAllocations.map(r => (
              <option key={r.roomId} value={r.roomId}>{r.roomName}</option>
            ))}
          </select>

          {/* CSV Download Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0F172A] bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>CSV Export</span>
          </button>

          {/* Print Trigger */}
          <button
            id="btn-print-action"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#F8FAFC] bg-[#2563EB] hover:bg-[#1D4ED8] shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Now</span>
          </button>
        </div>
      </div>

      {/* Printable Content Area */}
      <div className="space-y-8 bg-white p-4 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-2xs">
        
        {/* MODE 1: CLASSROOM DOOR SHEETS & ATTENDANCE ROSTER */}
        {printMode === 'door_sheets' && (
          <div className="space-y-12">
            {roomsToDisplay.map((room) => {
              const seatedList = room.assignedSeats.filter(s => s.studentId);

              return (
                <div 
                  key={room.roomId} 
                  className="page-break-after border border-slate-300 rounded-xl p-6 sm:p-8 bg-white shadow-2xs space-y-6"
                >
                  {/* School Header */}
                  <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight font-heading">
                        EXAMINATION SEATING ARRANGEMENT & ATTENDANCE
                      </h1>
                      <p className="text-xs sm:text-sm font-medium text-slate-600 mt-0.5">
                        Session: <strong>{plan.sessionName}</strong> | Date: <strong>{plan.sessionDate}</strong> | Time: <strong>{plan.sessionTime}</strong>
                      </p>
                    </div>
                    <div className="text-right bg-[#F1F5F9] p-3 rounded-xl border border-[#E2E8F0] shrink-0">
                      <span className="block text-xs font-semibold text-[#3B82F6]">EXAM HALL / ROOM</span>
                      <span className="text-xl font-extrabold text-[#0F172A] font-heading">{room.roomName}</span>
                      <span className="block text-[11px] text-[#64748B]">{room.building} • {room.floor}</span>
                    </div>
                  </div>

                  {/* Summary Breakdown Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                    <div>
                      <span className="text-[#3B82F6] font-medium">Total Seated:</span>
                      <strong className="block text-sm text-[#0F172A] font-bold">{room.totalAssigned} / {room.capacity}</strong>
                    </div>
                    <div>
                      <span className="text-[#3B82F6] font-medium">Class Breakdown:</span>
                      <div className="font-bold text-[#0F172A]">
                        {Object.entries(room.gradeDistribution).map(([grade, count]) => `${grade}: ${count}`).join(' | ') || 'None'}
                      </div>
                    </div>
                    <div>
                      <span className="text-[#3B82F6] font-medium">Subject Papers:</span>
                      <div className="font-bold text-[#0F172A]">
                        {Object.entries(room.subjectDistribution).map(([code, count]) => `${code} (${count})`).join(', ') || 'None'}
                      </div>
                    </div>
                    <div>
                      <span className="text-[#3B82F6] font-medium">Layout:</span>
                      <strong className="block text-[#0F172A]">{room.rows} Rows × {room.cols} Columns</strong>
                    </div>
                  </div>

                  {/* Student Seating Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-[#F1F5F9] text-[#0F172A] uppercase font-bold border-b border-slate-300">
                          <th className="p-2 border border-slate-300 w-12 text-center">S.No</th>
                          <th className="p-2 border border-slate-300 w-20 text-center">Seat No.</th>
                          <th className="p-2 border border-slate-300 w-28">Roll Number</th>
                          <th className="p-2 border border-slate-300">Student Name</th>
                          <th className="p-2 border border-slate-300">Grade / Class</th>
                          <th className="p-2 border border-slate-300">Subject / Paper</th>
                          <th className="p-2 border border-slate-300 w-32 text-center">Student Signature</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seatedList.map((seat, index) => (
                          <tr key={seat.seatIndex} className={index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}>
                            <td className="p-2 border border-slate-300 text-center font-mono">{index + 1}</td>
                            <td className="p-2 border border-slate-300 text-center font-mono font-bold text-[#2563EB]">
                              {seat.seatLabel}
                            </td>
                            <td className="p-2 border border-slate-300 font-mono font-semibold text-slate-800">
                              {seat.studentRollNo}
                            </td>
                            <td className="p-2 border border-slate-300 font-bold text-slate-900">
                              {seat.studentName} {seat.isSpecialNeeds && '(♿ Front Row)'}
                            </td>
                            <td className="p-2 border border-slate-300 text-slate-700">
                              {seat.studentGrade}
                            </td>
                            <td className="p-2 border border-slate-300 font-semibold text-slate-900">
                              {seat.subjectCode} - {seat.subjectName}
                            </td>
                            <td className="p-2 border border-slate-300 h-8"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Invigilator Sign-Off Section */}
                  <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-3 gap-6 text-xs text-slate-700">
                    <div>
                      <p className="font-semibold text-slate-500">Invigilator Name:</p>
                      <div className="mt-4 border-b border-slate-400 w-full"></div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-500">Total Present / Absent:</p>
                      <div className="mt-4 border-b border-slate-400 w-full"></div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-500">Invigilator Signature & Date:</p>
                      <div className="mt-4 border-b border-slate-400 w-full"></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODE 2: DESK STICKER LABELS */}
        {printMode === 'desk_labels' && (
          <div className="space-y-6">
            <p className="text-xs text-[#64748B] no-print">
              * Ready to print and cut out. Affix these labels to the top corner of each exam desk.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {roomsToDisplay.flatMap(room => 
                room.assignedSeats
                  .filter(s => s.studentId)
                  .map(seat => (
                    <div 
                      key={`${room.roomId}-${seat.seatIndex}`}
                      className="border-2 border-dashed border-[#D8D4CA] p-3 rounded-xl bg-white space-y-1 page-break-inside-avoid shadow-2xs"
                    >
                      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1">
                        <span className="text-[10px] font-bold text-[#3B82F6] uppercase">{room.roomName}</span>
                        <span className="text-xs font-mono font-black bg-[#0F172A] text-[#F8FAFC] px-2 py-0.5 rounded">
                          SEAT: {seat.seatLabel}
                        </span>
                      </div>
                      <div className="pt-1">
                        <div className="text-xs font-bold text-[#0F172A] truncate">{seat.studentName}</div>
                        <div className="text-[11px] font-mono font-semibold text-[#3B82F6]">Roll: {seat.studentRollNo}</div>
                      </div>
                      <div className="text-[10px] text-[#64748B] pt-1 flex justify-between">
                        <span>{seat.studentGrade}</span>
                        <span className="font-bold text-[#2563EB]">{seat.subjectCode}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* MODE 3: MASTER EXAM MATRIX */}
        {printMode === 'master_matrix' && (
          <div className="space-y-4">
            <div className="border-b border-[#E2E8F0] pb-3">
              <h2 className="text-lg font-bold text-[#0F172A] font-heading">
                Master Seating Allocation Register
              </h2>
              <p className="text-xs text-[#3B82F6]">
                Complete school-wide overview for session: {plan.sessionName} ({plan.sessionDate})
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-300">
                <thead>
                  <tr className="bg-[#F1F5F9] text-[#0F172A] font-bold border-b border-slate-300">
                    <th className="p-2.5 border border-slate-300">Room</th>
                    <th className="p-2.5 border border-slate-300">Capacity</th>
                    <th className="p-2.5 border border-slate-300">Allocated</th>
                    <th className="p-2.5 border border-slate-300">Grade / Class Breakdown</th>
                    <th className="p-2.5 border border-slate-300">Subjects Scheduled</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.roomAllocations.map((room) => (
                    <tr key={room.roomId} className="hover:bg-[#F8FAFC] border-b border-slate-200">
                      <td className="p-2.5 border border-slate-300 font-bold text-[#0F172A]">
                        {room.roomName} ({room.building})
                      </td>
                      <td className="p-2.5 border border-slate-300 font-mono">{room.capacity}</td>
                      <td className="p-2.5 border border-slate-300 font-mono font-bold text-[#2563EB]">
                        {room.totalAssigned}
                      </td>
                      <td className="p-2.5 border border-slate-300 text-[#0F172A]">
                        {Object.entries(room.gradeDistribution).map(([grade, count]) => (
                          <span key={grade} className="mr-2 inline-block bg-[#F1F5F9] px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                            {grade}: <strong>{count}</strong>
                          </span>
                        ))}
                      </td>
                      <td className="p-2.5 border border-slate-300 font-semibold text-[#0F172A]">
                        {Object.entries(room.subjectDistribution).map(([code, count]) => `${code} (${count})`).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
