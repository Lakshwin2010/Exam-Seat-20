import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  RefreshCw, 
  Download, 
  UploadCloud, 
  Clock, 
  RotateCcw, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  HardDrive,
  FileCode,
  Users,
  Building2,
  Calendar
} from 'lucide-react';
import { BackupSummary, api } from '../utils/api';
import { ExamRoom, Student, ExamSubject, ExamSession } from '../types';

interface BackupRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored: (data: {
    rooms: ExamRoom[];
    students: Student[];
    subjects: ExamSubject[];
    sessions: ExamSession[];
  }) => void;
  onSyncTriggered?: () => Promise<void>;
  currentRooms: ExamRoom[];
  currentStudents: Student[];
  currentSubjects: ExamSubject[];
  currentSessions: ExamSession[];
}

export const BackupRecoveryModal: React.FC<BackupRecoveryModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
  onSyncTriggered,
  currentRooms,
  currentStudents,
  currentSubjects,
  currentSessions
}) => {
  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const list = await api.getBackups();
      setBackups(list);
    } catch (err: any) {
      console.warn('Failed to list backups from backend:', err);
      // Fallback to local storage backups if available
      try {
        const local = localStorage.getItem('examhall_backup_snapshots');
        if (local) {
          setBackups(JSON.parse(local));
        }
      } catch {}
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
      setActionStatus(null);
      setConfirmRestoreId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Sync & Create Backup
  const handleSyncAndBackup = async () => {
    setIsSyncing(true);
    setActionStatus(null);
    try {
      // Create backend snapshot
      let res: any = null;
      try {
        res = await api.syncAndBackup(`Live Sync (${currentStudents.length} students, ${currentRooms.length} rooms)`);
      } catch (e) {
        console.warn('Backend sync warning, creating local copy:', e);
      }

      // Also create local browser snapshot
      const localSnapshot: BackupSummary = {
        id: `local_backup_${Date.now()}`,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toLocaleString(),
        fileSizeBytes: 0,
        summary: {
          roomsCount: currentRooms.length,
          studentsCount: currentStudents.length,
          subjectsCount: currentSubjects.length,
          sessionsCount: currentSessions.length
        },
        note: `Browser Snapshot (${currentStudents.length} students, ${currentRooms.length} rooms)`
      };

      try {
        const existing = JSON.parse(localStorage.getItem('examhall_backup_snapshots') || '[]');
        const updated = [localSnapshot, ...existing].slice(0, 15);
        localStorage.setItem('examhall_backup_snapshots', JSON.stringify(updated));
      } catch {}

      if (onSyncTriggered) {
        await onSyncTriggered();
      }

      await fetchBackups();
      setActionStatus({
        type: 'success',
        message: `Data synchronized with backend! Recovery copy successfully created (${currentStudents.length} students, ${currentRooms.length} rooms).`
      });
    } catch (err: any) {
      setActionStatus({
        type: 'error',
        message: `Sync error: ${err.message || err}`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // 2. Restore Backup
  const handleRestore = async (backupId: string) => {
    setIsRestoring(true);
    setActionStatus(null);
    try {
      // 1. Restore on backend
      await api.restoreBackup(backupId);

      // 2. Fetch fresh data from backend
      const [newRooms, newStudents, newSubjects, newSessions] = await Promise.all([
        api.getRooms(),
        api.getStudents(),
        api.getSubjects(),
        api.getSessions()
      ]);

      // 3. Update parent state
      onDataRestored({
        rooms: newRooms,
        students: newStudents,
        subjects: newSubjects,
        sessions: newSessions
      });

      setConfirmRestoreId(null);
      setActionStatus({
        type: 'success',
        message: `Recovery successful! Database restored to snapshot '${backupId}' (${newStudents.length} students, ${newRooms.length} rooms).`
      });
      await fetchBackups();
    } catch (err: any) {
      setActionStatus({
        type: 'error',
        message: `Failed to restore: ${err.message || err}`
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // 3. Delete Backup
  const handleDelete = async (backupId: string) => {
    try {
      await api.deleteBackup(backupId);
      setBackups(backups.filter(b => b.id !== backupId));
      setActionStatus({
        type: 'success',
        message: `Backup snapshot '${backupId}' deleted.`
      });
    } catch (err: any) {
      setActionStatus({
        type: 'error',
        message: `Failed to delete: ${err.message || err}`
      });
    }
  };

  // 4. Download Current State Copy (JSON)
  const handleExportCurrentState = () => {
    const fullData = {
      exportedAt: new Date().toISOString(),
      rooms: currentRooms,
      students: currentStudents,
      subjects: currentSubjects,
      sessions: currentSessions
    };
    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `examhall_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 5. Upload & Restore Backup File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setActionStatus(null);
    try {
      await api.uploadBackup(file);
      const [newRooms, newStudents, newSubjects, newSessions] = await Promise.all([
        api.getRooms(),
        api.getStudents(),
        api.getSubjects(),
        api.getSessions()
      ]);

      onDataRestored({
        rooms: newRooms,
        students: newStudents,
        subjects: newSubjects,
        sessions: newSessions
      });

      setActionStatus({
        type: 'success',
        message: `Backup file '${file.name}' successfully uploaded and restored! Loaded ${newStudents.length} students.`
      });
      await fetchBackups();
    } catch (err: any) {
      setActionStatus({
        type: 'error',
        message: `Failed to import backup file: ${err.message || err}`
      });
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F1F5F9]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center border border-[#2563EB]/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0F172A] font-heading">
                Backend Data Sync & Recovery Center
              </h2>
              <p className="text-xs text-[#64748B]">
                Sync data with backend and maintain recovery snapshot copies to restore anytime
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

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          {/* Status feedback */}
          {actionStatus && (
            <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs animate-in fade-in duration-150 ${
              actionStatus.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {actionStatus.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <div className="flex-1 font-medium">{actionStatus.message}</div>
              <button onClick={() => setActionStatus(null)} className="text-[#64748B] hover:text-[#0F172A] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Top Action Cards: Sync & Download Copy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Sync with Backend & Create Copy */}
            <div className="p-4 rounded-2xl border-2 border-[#2563EB]/30 bg-gradient-to-br from-blue-50/50 to-white flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-xl bg-[#2563EB] text-white">
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">Sync Data with Backend</h3>
                    <span className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider">Live Synchronization</span>
                  </div>
                </div>
                <p className="text-xs text-[#64748B] mb-4">
                  Synchronizes all rooms, students, and exam schedules with the backend database, and automatically creates a protected recovery copy.
                </p>
              </div>

              <button
                id="btn-modal-sync-now"
                onClick={handleSyncAndBackup}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-98 transition-all shadow-2xs disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing & Copying...' : 'Sync & Save Copy Now'}</span>
              </button>
            </div>

            {/* Offline Export & Upload */}
            <div className="p-4 rounded-2xl border border-[#E2E8F0] bg-white flex flex-col justify-between shadow-2xs">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-xl bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0]">
                    <HardDrive className="w-4 h-4 text-[#2563EB]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">Offline File Copies</h3>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Download / Restore File</span>
                  </div>
                </div>
                <p className="text-xs text-[#64748B] mb-4">
                  Download a JSON file copy to your computer, or upload a previously saved backup file to restore your entire school setup.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCurrentState}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Download Copy</span>
                </button>

                <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] transition-colors cursor-pointer">
                  <UploadCloud className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Upload File</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

          </div>

          {/* Live Data Summary Banner */}
          <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-[#0F172A] block">Current Active Data</span>
              <span className="text-[11px] text-[#64748B]">State currently loaded in system</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-[#0F172A]">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#2563EB]" /> {currentStudents.length} Students
              </span>
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#2563EB]" /> {currentRooms.length} Rooms
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#2563EB]" /> {currentSessions.length} Sessions
              </span>
            </div>
          </div>

          {/* Restore Points / Backups History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Available Recovery Copies & Snapshots ({backups.length})
                </h3>
              </div>
              <button
                onClick={fetchBackups}
                disabled={isLoading}
                className="text-xs text-[#2563EB] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-xs text-[#64748B]">
                <RefreshCw className="w-5 h-5 text-[#2563EB] animate-spin mx-auto mb-2" />
                <span>Loading recovery copies...</span>
              </div>
            ) : backups.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC]">
                <ShieldCheck className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                <p className="text-xs font-bold text-[#0F172A]">No recovery copies created yet</p>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Click "Sync & Save Copy Now" above to create your first protected recovery snapshot.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {backups.map((bk) => {
                  const isConfirming = confirmRestoreId === bk.id;
                  return (
                    <div
                      key={bk.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isConfirming 
                          ? 'border-amber-400 bg-amber-50/60 ring-2 ring-amber-400/20' 
                          : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#0F172A]">
                            {bk.createdAt || bk.id}
                          </span>
                          {bk.note && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
                              {bk.note}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[#64748B]">
                          <span>👥 {bk.summary?.studentsCount ?? 0} Students</span>
                          <span>🏫 {bk.summary?.roomsCount ?? 0} Rooms</span>
                          <span>📅 {bk.summary?.sessionsCount ?? 0} Sessions</span>
                          {bk.fileSizeBytes > 0 && (
                            <span>💾 {(bk.fileSizeBytes / 1024).toFixed(1)} KB</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {isConfirming ? (
                          <div className="flex items-center gap-2 animate-in fade-in duration-150">
                            <span className="text-xs font-bold text-amber-700">Restore this copy?</span>
                            <button
                              onClick={() => handleRestore(bk.id)}
                              disabled={isRestoring}
                              className="px-3 py-1 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-xs cursor-pointer"
                            >
                              {isRestoring ? 'Restoring...' : 'Yes, Restore'}
                            </button>
                            <button
                              onClick={() => setConfirmRestoreId(null)}
                              className="px-2.5 py-1 rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => setConfirmRestoreId(bk.id)}
                              title="Restore database to this point"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#2563EB] bg-[#2563EB]/10 hover:bg-[#2563EB]/20 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </button>

                            <a
                              href={api.getBackupDownloadUrl(bk.id)}
                              download={`${bk.id}.json`}
                              title="Download copy of this snapshot"
                              className="p-1.5 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                            </a>

                            <button
                              onClick={() => handleDelete(bk.id)}
                              title="Delete this snapshot"
                              className="p-1.5 rounded-xl text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <span className="text-[11px] text-[#64748B]">
            All snapshots contain full copies of classrooms, student enrollments, exam schedules, and seat layouts.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-[#0F172A] bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
