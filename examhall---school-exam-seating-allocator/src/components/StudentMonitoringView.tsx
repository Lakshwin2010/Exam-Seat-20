import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  UserX, 
  AlertTriangle, 
  Search, 
  RefreshCw, 
  Building2, 
  UserCheck, 
  Eye, 
  Plus, 
  X,
  FileSpreadsheet,
  Users
} from 'lucide-react';
import { api, StudentMonitoringRecord, MonitoringDashboardStats } from '../utils/api';
import { ExamSession, ExamRoom } from '../types';

interface StudentMonitoringViewProps {
  activeSession: ExamSession | null;
  rooms: ExamRoom[];
}

export const StudentMonitoringView: React.FC<StudentMonitoringViewProps> = ({ activeSession, rooms }) => {
  const [stats, setStats] = useState<MonitoringDashboardStats | null>(null);
  const [records, setRecords] = useState<StudentMonitoringRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Incident Modal
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentMonitoringRecord | null>(null);
  const [incidentType, setIncidentType] = useState('malpractice_suspicion');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');

  const loadData = async () => {
    if (!activeSession) return;
    setLoading(true);
    try {
      const dashStats = await api.getMonitoringDashboard(activeSession.id);
      setStats(dashStats);

      const filterRoom = selectedRoomId === 'all' ? undefined : selectedRoomId;
      const filterStatus = statusFilter === 'all' ? undefined : statusFilter;
      const recs = await api.getMonitoringRecords(activeSession.id, filterRoom, filterStatus, searchQuery);
      setRecords(recs);
    } catch (err) {
      console.error('Failed to load monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // 5s auto-refresh
    return () => clearInterval(interval);
  }, [activeSession?.id, selectedRoomId, statusFilter, searchQuery]);

  const handleUpdateStatus = async (studentId: string, newStatus: string) => {
    if (!activeSession) return;
    try {
      await api.updateStudentStatus(studentId, activeSession.id, newStatus);
      await loadData();
    } catch (err) {
      alert(`Failed to update status: ${err}`);
    }
  };

  const handleLogIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !selectedStudent) return;
    try {
      await api.logIncident(
        activeSession.id,
        incidentType,
        severity,
        description,
        selectedStudent.studentId,
        selectedStudent.roomId
      );
      setIncidentModalOpen(false);
      setDescription('');
      setSelectedStudent(null);
      await loadData();
    } catch (err) {
      alert(`Failed to log incident: ${err}`);
    }
  };

  if (!activeSession) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-[#E2E8F0]">
        <Users className="w-12 h-12 text-[#64748B] mx-auto mb-3" />
        <h3 className="text-lg font-bold text-[#0F172A]">No Active Exam Session</h3>
        <p className="text-sm text-[#64748B]">Select an exam session above to start student monitoring.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Live Database Monitoring
            </span>
            <span className="text-xs text-[#64748B]">• SQLite Active</span>
          </div>
          <h2 className="text-2xl font-black text-[#0F172A]">
            {activeSession.name} — Student Monitor
          </h2>
          <p className="text-sm text-[#2563EB]">
            {activeSession.date} | {activeSession.timeSlot}
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] text-sm font-semibold transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-2xs">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Total Enrolled</p>
          <p className="text-2xl font-black text-[#0F172A] mt-1">{stats?.totalStudents || 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Checked In</p>
            <UserCheck className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-900 mt-1">{stats?.totalCheckedIn || 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">In Hall</p>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-900 mt-1">{stats?.totalInHall || 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Submitted</p>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-indigo-900 mt-1">{stats?.totalCompleted || 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Absent</p>
            <UserX className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-900 mt-1">{stats?.totalAbsent || 0}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Flagged / Alert</p>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-900 mt-1">{stats?.totalFlagged || 0}</p>
        </div>
      </div>

      {/* Room Breakdown Grid */}
      {stats && stats.roomBreakdown.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-2xs">
          <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#2563EB]" />
            Hall-wise Attendance & Occupancy
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.roomBreakdown.map(rb => (
              <div key={rb.roomId} className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-[#0F172A]">{rb.roomName}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white font-medium border border-[#E2E8F0]">
                    {rb.occupancyPercent}% cap
                  </span>
                </div>
                <div className="flex justify-between text-xs text-[#2563EB]">
                  <span>Present: <strong>{rb.presentCount}</strong> / {rb.totalAssigned}</span>
                  <span>Absent: <strong>{rb.absentCount}</strong></span>
                </div>
                {rb.flaggedCount > 0 && (
                  <div className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {rb.flaggedCount} student(s) flagged
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search by Roll No, Student Name, or Grade..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <select
            value={selectedRoomId}
            onChange={e => setSelectedRoomId(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-sm font-medium text-[#0F172A]"
          >
            <option value="all">All Rooms</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-sm font-medium text-[#0F172A]"
          >
            <option value="all">All Statuses</option>
            <option value="not_checked_in">Not Checked In</option>
            <option value="checked_in">Checked In</option>
            <option value="in_hall">In Hall</option>
            <option value="completed">Completed</option>
            <option value="absent">Absent</option>
            <option value="flagged">Flagged</option>
          </select>
        </div>

        {/* Student Records Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F1F5F9] text-[#2563EB] text-xs uppercase font-bold">
              <tr>
                <th className="p-3.5 rounded-l-xl">Roll No</th>
                <th className="p-3.5">Student Name</th>
                <th className="p-3.5">Grade</th>
                <th className="p-3.5">Room & Seat</th>
                <th className="p-3.5">Current Status</th>
                <th className="p-3.5">Timestamps</th>
                <th className="p-3.5 text-right rounded-r-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[#64748B]">
                    No students match current filters.
                  </td>
                </tr>
              ) : (
                records.map(rec => {
                  const statusColors: Record<string, string> = {
                    not_checked_in: 'bg-gray-100 text-gray-700',
                    checked_in: 'bg-blue-100 text-blue-800',
                    in_hall: 'bg-emerald-100 text-emerald-800',
                    completed: 'bg-indigo-100 text-indigo-800',
                    absent: 'bg-amber-100 text-amber-800',
                    flagged: 'bg-rose-100 text-rose-800'
                  };

                  return (
                    <tr key={rec.id} className="hover:bg-[#F8FAFC] transition">
                      <td className="p-3.5 font-mono font-bold text-[#0F172A]">{rec.studentRollNo}</td>
                      <td className="p-3.5 font-semibold text-[#0F172A]">{rec.studentName}</td>
                      <td className="p-3.5 text-[#2563EB]">{rec.studentGrade}</td>
                      <td className="p-3.5">
                        <span className="font-semibold text-[#0F172A]">{rec.roomName || 'Unassigned'}</span>
                        {rec.seatLabel && (
                          <span className="ml-2 px-2 py-0.5 rounded bg-[#E2E8F0] text-xs font-bold">
                            Seat {rec.seatLabel}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusColors[rec.status] || 'bg-gray-100'}`}>
                          {rec.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3.5 text-xs text-[#64748B]">
                        {rec.checkInTime ? `In: ${new Date(rec.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                        {rec.submissionTime && ` | Out: ${new Date(rec.submissionTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </td>
                      <td className="p-3.5 text-right space-x-1">
                        {rec.status === 'not_checked_in' && (
                          <button
                            onClick={() => handleUpdateStatus(rec.studentId, 'checked_in')}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                          >
                            Check In
                          </button>
                        )}
                        {rec.status === 'checked_in' && (
                          <button
                            onClick={() => handleUpdateStatus(rec.studentId, 'in_hall')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                          >
                            In Hall
                          </button>
                        )}
                        {rec.status === 'in_hall' && (
                          <button
                            onClick={() => handleUpdateStatus(rec.studentId, 'completed')}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                          >
                            Submit
                          </button>
                        )}
                        {rec.status !== 'absent' && rec.status !== 'completed' && (
                          <button
                            onClick={() => handleUpdateStatus(rec.studentId, 'absent')}
                            className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] text-amber-700 text-xs font-semibold hover:bg-amber-100"
                          >
                            Absent
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedStudent(rec);
                            setIncidentModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100"
                        >
                          Report
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Incident Log Modal */}
      {incidentModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-[#E2E8F0] shadow-xl">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="text-lg font-bold text-[#0F172A]">Log Incident / Flag Student</h3>
              </div>
              <button onClick={() => setIncidentModalOpen(false)} className="text-[#64748B] hover:text-[#0F172A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-[#F8FAFC] rounded-xl text-xs space-y-1">
              <p><strong>Candidate:</strong> {selectedStudent.studentName} ({selectedStudent.studentRollNo})</p>
              <p><strong>Hall:</strong> {selectedStudent.roomName} | <strong>Seat:</strong> {selectedStudent.seatLabel}</p>
            </div>

            <form onSubmit={handleLogIncident} className="space-y-4 text-sm">
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Incident Type</label>
                <select
                  value={incidentType}
                  onChange={e => setIncidentType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]"
                >
                  <option value="malpractice_suspicion">Suspicion of Cheating / Copying</option>
                  <option value="unauthorized_material">Unauthorized Material / Notes / Devices</option>
                  <option value="seat_violation">Seat Violation / Unauthorized Swap</option>
                  <option value="temporary_exit">Temporary Bathroom / Medical Exit</option>
                  <option value="medical_emergency">Medical Emergency / Unwell</option>
                  <option value="other">Other Violation</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Severity</label>
                <select
                  value={severity}
                  onChange={e => setSeverity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]"
                >
                  <option value="low">Low (Note / Notice only)</option>
                  <option value="medium">Medium (Warning issued)</option>
                  <option value="high">High (Paper confiscated / Candidate Flagged)</option>
                  <option value="critical">Critical (Immediate Disqualification)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">Observation / Description</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe what occurred, invigilator observations, or action taken..."
                  className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIncidentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[#2563EB] hover:bg-[#F1F5F9] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700"
                >
                  Submit Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
