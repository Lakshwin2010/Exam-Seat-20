import { 
  ExamRoom, 
  Student, 
  ExamSubject, 
  ExamSession, 
  AllocationOptions, 
  SeatingPlan 
} from '../types';

const API_BASE = typeof window !== 'undefined'
  ? '/api' 
  : 'http://localhost:8001/api';

export interface SourceFileSummary {
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  modifiedTime: string;
  sheets: string[];
  detectedTypes: string[];
  recordsCount: Record<string, number>;
  status: string;
  message?: string;
}

export interface StudentMonitoringRecord {
  id: string;
  studentId: string;
  studentRollNo: string;
  studentName: string;
  studentGrade: string;
  sessionId: string;
  roomId?: string;
  roomName?: string;
  seatLabel?: string;
  status: 'not_checked_in' | 'checked_in' | 'in_hall' | 'completed' | 'absent' | 'flagged';
  checkInTime?: string;
  submissionTime?: string;
  remarks?: string;
  updatedAt?: string;
}

export interface MonitoringDashboardStats {
  totalStudents: number;
  totalCheckedIn: number;
  totalInHall: number;
  totalCompleted: number;
  totalAbsent: number;
  totalFlagged: number;
  attendanceRate: number;
  roomBreakdown: Array<{
    roomId: string;
    roomName: string;
    capacity: number;
    totalAssigned: number;
    presentCount: number;
    absentCount: number;
    flaggedCount: number;
    incidentCount: number;
    occupancyPercent: number;
  }>;
  recentIncidents: Array<{
    id: string;
    sessionId: string;
    studentId?: string;
    studentName?: string;
    studentRollNo?: string;
    roomId?: string;
    roomName?: string;
    incidentType: string;
    severity: string;
    description: string;
    reportedBy: string;
    actionTaken?: string;
    timestamp: string;
  }>;
}

export interface BackupSummary {
  id: string;
  timestamp: string;
  createdAt: string;
  fileSizeBytes: number;
  summary: {
    roomsCount: number;
    studentsCount: number;
    subjectsCount: number;
    sessionsCount: number;
    allocationsCount?: number;
    monitoringCount?: number;
  };
  note?: string;
}

export const api = {
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getSourceFiles(): Promise<SourceFileSummary[]> {
    const res = await fetch(`${API_BASE}/source/files`);
    if (!res.ok) throw new Error('Failed to fetch source files');
    return res.json();
  },

  async syncSourceFolder(): Promise<{ status: string; message: string; imported: any }> {
    const res = await fetch(`${API_BASE}/source/sync`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to synchronize source folder');
    return res.json();
  },

  getTemplateDownloadUrl(): string {
    return `${API_BASE}/source/template`;
  },

  async getStudents(search?: string, grade?: string): Promise<Student[]> {
    const params = new URLSearchParams();
    params.set('limit', '2000');
    if (search) params.set('search', search);
    if (grade) params.set('grade', grade);
    const res = await fetch(`${API_BASE}/students?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch students');
    return res.json();
  },

  async getRooms(): Promise<ExamRoom[]> {
    const res = await fetch(`${API_BASE}/rooms`);
    if (!res.ok) throw new Error('Failed to fetch rooms');
    return res.json();
  },

  async getSubjects(): Promise<ExamSubject[]> {
    const res = await fetch(`${API_BASE}/subjects`);
    if (!res.ok) throw new Error('Failed to fetch subjects');
    return res.json();
  },

  async getSessions(): Promise<ExamSession[]> {
    const res = await fetch(`${API_BASE}/sessions`);
    if (!res.ok) throw new Error('Failed to fetch sessions');
    return res.json();
  },

  async createSession(session: Partial<ExamSession>): Promise<ExamSession> {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create session' }));
      throw new Error(err.detail || 'Failed to create session');
    }
    return res.json();
  },

  async updateSession(sessionId: string, session: Partial<ExamSession>): Promise<ExamSession> {
    const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update session' }));
      throw new Error(err.detail || 'Failed to update session');
    }
    return res.json();
  },

  async deleteSession(sessionId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete session');
  },

  async deleteAllSessions(): Promise<void> {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete all sessions');
  },

  // Room CRUD
  async createRoom(room: Partial<ExamRoom>): Promise<ExamRoom> {
    const res = await fetch(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room)
    });
    if (!res.ok) throw new Error('Failed to create room');
    return res.json();
  },

  async updateRoom(roomId: string, room: Partial<ExamRoom>): Promise<ExamRoom> {
    const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(roomId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room)
    });
    if (!res.ok) throw new Error('Failed to update room');
    return res.json();
  },

  async deleteRoom(roomId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(roomId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete room');
  },

  // Student CRUD
  async createStudent(student: Partial<Student>): Promise<Student> {
    const res = await fetch(`${API_BASE}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student)
    });
    if (!res.ok) throw new Error('Failed to create student');
    return res.json();
  },

  async updateStudent(studentId: string, student: Partial<Student>): Promise<Student> {
    const res = await fetch(`${API_BASE}/students/${encodeURIComponent(studentId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student)
    });
    if (!res.ok) throw new Error('Failed to update student');
    return res.json();
  },

  async deleteStudent(studentId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/students/${encodeURIComponent(studentId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete student');
  },

  // Subject CRUD
  async createSubject(subject: Partial<ExamSubject>): Promise<ExamSubject> {
    const res = await fetch(`${API_BASE}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subject)
    });
    if (!res.ok) throw new Error('Failed to create subject');
    return res.json();
  },

  async updateSubject(subjectId: string, subject: Partial<ExamSubject>): Promise<ExamSubject> {
    const res = await fetch(`${API_BASE}/subjects/${encodeURIComponent(subjectId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subject)
    });
    if (!res.ok) throw new Error('Failed to update subject');
    return res.json();
  },

  async deleteSubject(subjectId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/subjects/${encodeURIComponent(subjectId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete subject');
  },

  async generatePlan(sessionId: string, options: AllocationOptions): Promise<SeatingPlan> {
    const res = await fetch(`${API_BASE}/allocations/generate?session_id=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    if (!res.ok) throw new Error('Failed to generate seating plan from backend');
    return res.json();
  },

  async swapSeats(
    sessionId: string,
    sourceRoomId: string,
    sourceSeatIdx: number,
    targetRoomId: string,
    targetSeatIdx: number
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/allocations/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        sourceRoomId,
        sourceSeatIdx,
        targetRoomId,
        targetSeatIdx
      })
    });
    if (!res.ok) throw new Error('Failed to swap seats');
    return res.json();
  },

  getExportExcelUrl(sessionId: string): string {
    return `${API_BASE}/allocations/${encodeURIComponent(sessionId)}/export/excel`;
  },

  // Student Monitoring Endpoints
  async getMonitoringRecords(sessionId: string, roomId?: string, status?: string, search?: string): Promise<StudentMonitoringRecord[]> {
    const params = new URLSearchParams({ session_id: sessionId });
    if (roomId) params.set('room_id', roomId);
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    const res = await fetch(`${API_BASE}/monitoring/records?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch monitoring records');
    return res.json();
  },

  async updateStudentStatus(
    studentId: string,
    sessionId: string,
    status: string,
    remarks?: string
  ): Promise<StudentMonitoringRecord> {
    const res = await fetch(
      `${API_BASE}/students/${encodeURIComponent(studentId)}/status?session_id=${encodeURIComponent(sessionId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, remarks })
      }
    );
    if (!res.ok) throw new Error('Failed to update student monitoring status');
    return res.json();
  },

  async getMonitoringDashboard(sessionId?: string): Promise<MonitoringDashboardStats> {
    const url = sessionId ? `${API_BASE}/monitoring/dashboard?session_id=${encodeURIComponent(sessionId)}` : `${API_BASE}/monitoring/dashboard`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch monitoring dashboard stats');
    return res.json();
  },

  async logIncident(
    sessionId: string,
    incidentType: string,
    severity: string,
    description: string,
    studentId?: string,
    roomId?: string,
    reportedBy = 'Invigilator'
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/monitoring/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        studentId,
        roomId,
        incidentType,
        severity,
        description,
        reportedBy
      })
    });
    if (!res.ok) throw new Error('Failed to log incident');
    return res.json();
  },

  // Backup & Recovery Endpoints
  async createBackup(note = 'Manual backup'): Promise<any> {
    const res = await fetch(`${API_BASE}/backup/create?note=${encodeURIComponent(note)}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to create backup snapshot');
    return res.json();
  },

  async syncAndBackup(note = 'Sync & Snapshot'): Promise<any> {
    const res = await fetch(`${API_BASE}/backup/sync_and_backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    if (!res.ok) throw new Error('Failed to sync and backup with backend');
    return res.json();
  },

  async getBackups(): Promise<BackupSummary[]> {
    const res = await fetch(`${API_BASE}/backup/list`);
    if (!res.ok) throw new Error('Failed to list backups');
    return res.json();
  },

  async restoreBackup(backupId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/backup/restore/${encodeURIComponent(backupId)}`, {
      method: 'POST'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to restore backup' }));
      throw new Error(err.detail || 'Failed to restore backup');
    }
    return res.json();
  },

  async deleteBackup(backupId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/backup/${encodeURIComponent(backupId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete backup');
    return res.json();
  },

  getBackupDownloadUrl(backupId: string): string {
    return `${API_BASE}/backup/download/${encodeURIComponent(backupId)}`;
  },

  async uploadBackup(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/backup/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to upload backup' }));
      throw new Error(err.detail || 'Failed to upload backup');
    }
    return res.json();
  }
};
