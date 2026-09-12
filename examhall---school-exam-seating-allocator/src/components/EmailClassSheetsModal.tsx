import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  RefreshCw, 
  Users, 
  FileSpreadsheet, 
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Calendar,
  Layers,
  MapPin
} from 'lucide-react';
import { GoogleUser, sendClassSpreadsheetEmail, signInWithGoogle } from '../utils/googleAuth';
import { ExamSession } from '../types';

interface SectionRecipient {
  section: string;
  gradeLevel?: string;
  studentCount: number;
  roomSeatsCount?: number;
  xiSeatsCount?: number;
  xiiSeatsCount?: number;
  despatchCount?: number;
  email: string;
  teacherName: string;
  isConfigured: boolean;
}

interface SendStatus {
  state: 'idle' | 'generating' | 'sending' | 'success' | 'error';
  message?: string;
  timestamp?: string;
}

interface EmailClassSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: GoogleUser | null;
  onSignInSuccess: (user: GoogleUser) => void;
  sessions?: ExamSession[];
  selectedSessionId?: string;
}

export const EmailClassSheetsModal: React.FC<EmailClassSheetsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSignInSuccess,
  sessions = [],
  selectedSessionId = ''
}) => {
  const [currentSessionId, setCurrentSessionId] = useState<string>(selectedSessionId || (sessions[0]?.id || ''));
  const [activeGradeTab, setActiveGradeTab] = useState<'XI' | 'XII' | 'ALL'>('XI');
  const [sections, setSections] = useState<SectionRecipient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMap, setStatusMap] = useState<Record<string, SendStatus>>({});
  const [isBulkSending, setIsBulkSending] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Keep currentSessionId updated if prop changes
  useEffect(() => {
    if (selectedSessionId) {
      setCurrentSessionId(selectedSessionId);
    } else if (sessions.length > 0 && !currentSessionId) {
      setCurrentSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessions]);

  // Fetch recipients from backend with session_id
  const fetchRecipients = async (sessId?: string) => {
    setLoading(true);
    try {
      const targetSession = sessId !== undefined ? sessId : currentSessionId;
      const url = targetSession 
        ? `/api/email/recipients?session_id=${encodeURIComponent(targetSession)}`
        : '/api/email/recipients';
      const res = await fetch(url);
      const data = await res.json();
      if (data.sections) {
        setSections(data.sections);
      }
    } catch (err) {
      console.error('Error loading email recipients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRecipients(currentSessionId);
    }
  }, [isOpen, currentSessionId]);

  if (!isOpen) return null;

  const currentSessionObj = sessions.find(s => s.id === currentSessionId);

  // Handle email change in input
  const handleEmailChange = (section: string, newEmail: string) => {
    setSections(prev => prev.map(s => s.section === section ? { ...s, email: newEmail, isConfigured: Boolean(newEmail.trim()) } : s));
  };

  // Save recipient email changes to backend
  const handleSaveRecipients = async () => {
    try {
      const payload: Record<string, string> = {};
      sections.forEach(s => {
        payload[s.section] = s.email;
      });
      const res = await fetch('/api/email/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: payload })
      });
      if (res.ok) {
        setSavedSuccessMsg("Recipient emails saved successfully!");
        setTimeout(() => setSavedSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error("Failed to save recipients:", err);
    }
  };

  // Send single class sheet
  const handleSendSingle = async (sec: SectionRecipient) => {
    if (!currentUser) {
      setAuthError("Please sign in with Google in the top-right corner or below before sending emails.");
      return;
    }
    if (!sec.email.trim()) {
      setStatusMap(prev => ({
        ...prev,
        [sec.section]: { state: 'error', message: 'No recipient email specified' }
      }));
      return;
    }

    setStatusMap(prev => ({
      ...prev,
      [sec.section]: { state: 'generating', message: 'Generating 2-tab Excel...' }
    }));

    try {
      // 1. Fetch generated class excel base64 from backend with session_id
      const encodedSec = encodeURIComponent(sec.section);
      const url = currentSessionId 
        ? `/api/email/class-sheet/${encodedSec}?session_id=${encodeURIComponent(currentSessionId)}`
        : `/api/email/class-sheet/${encodedSec}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Backend failed to generate sheet (${res.status})`);
      const sheetData = await res.json();

      setStatusMap(prev => ({
        ...prev,
        [sec.section]: { state: 'sending', message: 'Sending via Gmail...' }
      }));

      // 2. Dispatch via Gmail API
      await sendClassSpreadsheetEmail({
        accessToken: currentUser.accessToken,
        fromEmail: currentUser.email,
        toEmail: sec.email.trim(),
        teacherName: sec.teacherName,
        className: sec.section,
        sessionName: currentSessionObj?.name || undefined,
        studentCount: sheetData.despatchCount || sheetData.studentCount || sec.studentCount,
        roomSeatsCount: sheetData.roomSeatsCount || sec.roomSeatsCount || 0,
        xiSeatsCount: sheetData.xiSeatsCount || sec.xiSeatsCount || 0,
        xiiSeatsCount: sheetData.xiiSeatsCount || sec.xiiSeatsCount || 0,
        attachmentFilename: sheetData.filename,
        attachmentBase64: sheetData.base64
      });

      setStatusMap(prev => ({
        ...prev,
        [sec.section]: {
          state: 'success',
          message: 'Sent successfully',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      }));
    } catch (err: any) {
      setStatusMap(prev => ({
        ...prev,
        [sec.section]: {
          state: 'error',
          message: err.message || 'Failed to send'
        }
      }));
    }
  };

  // Filter sections by selected Grade tab
  const displayedSections = sections.filter(s => {
    if (activeGradeTab === 'XI') return s.section.includes('XI') && !s.section.includes('XII');
    if (activeGradeTab === 'XII') return s.section.includes('XII');
    return true;
  });

  // Send all ready configured classes in the active view
  const handleSendAllConfigured = async () => {
    if (!currentUser) {
      setAuthError("Please sign in with Google before sending.");
      return;
    }

    const readySections = displayedSections.filter(s => s.email.trim().length > 0);
    if (readySections.length === 0) {
      setAuthError("No sections in the current tab have recipient emails configured.");
      return;
    }

    setIsBulkSending(true);
    await handleSaveRecipients();

    for (const sec of readySections) {
      await handleSendSingle(sec);
      await new Promise(r => setTimeout(r, 600));
    }
    setIsBulkSending(false);
  };

  // Download class sheet directly
  const handleDownloadSheet = (section: string) => {
    const url = currentSessionId 
      ? `/api/email/class-sheet/${encodeURIComponent(section)}?download=true&session_id=${encodeURIComponent(currentSessionId)}`
      : `/api/email/class-sheet/${encodeURIComponent(section)}?download=true`;
    window.open(url, '_blank');
  };

  const configuredCount = displayedSections.filter(s => s.email.trim().length > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0F172A]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-3.5 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <span>Email Class Seating & Despatch Spreadsheets</span>
              </h2>
              <p className="text-xs text-[#64748b]">
                Dispatches dual-report workbooks (In-Room Seating + Outward Despatch) directly to class teachers via Gmail.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Session Selector */}
            {sessions.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-[#CBD5E1] rounded-xl px-2.5 py-1 shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                <span className="text-[11px] font-bold text-[#475569] hidden sm:inline">Exam:</span>
                <select
                  value={currentSessionId}
                  onChange={(e) => setCurrentSessionId(e.target.value)}
                  className="text-xs font-bold text-[#0F172A] bg-transparent outline-none cursor-pointer max-w-[180px] sm:max-w-[220px] truncate"
                >
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.date})
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-[#64748b] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sender Identity Banner */}
        <div className="px-6 py-2.5 bg-[#F1F5F9] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              {currentUser.picture ? (
                <img 
                  src={currentUser.picture} 
                  alt={currentUser.name} 
                  className="w-7 h-7 rounded-full border border-[#2563EB]"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white font-bold flex items-center justify-center text-xs">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-[11px] text-[#64748b] flex items-center gap-1.5">
                  <span>From:</span>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-emerald-700 font-semibold">Gmail API Connected</span>
                </div>
                <div className="text-xs font-bold text-[#0F172A]">
                  {currentUser.name} <span className="font-normal text-[#64748b]">({currentUser.email})</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="text-xs text-amber-800">
                <span className="font-bold">Not signed in:</span> Sign in to dispatch emails via Gmail.
              </div>
              <button
                onClick={() => signInWithGoogle(onSignInSuccess, (err) => setAuthError(err))}
                className="px-2.5 py-1 bg-white border border-[#CBD5E1] rounded-lg text-xs font-bold text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-3 h-3" />
                Sign in with Google
              </button>
            </div>
          )}

          {/* Bulk Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveRecipients}
              className="px-3 py-1.5 text-xs font-semibold text-[#475569] hover:text-[#0F172A] bg-white border border-[#CBD5E1] rounded-xl hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            >
              Save Email Edits
            </button>
            
            <button
              onClick={handleSendAllConfigured}
              disabled={isBulkSending || !currentUser || configuredCount === 0}
              className="px-4 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs disabled:opacity-50 transition-all cursor-pointer"
            >
              {isBulkSending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Send Ready ({configuredCount}/{displayedSections.length})</span>
            </button>
          </div>
        </div>

        {/* Grade Filter Tabs */}
        <div className="px-6 py-2 bg-white border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveGradeTab('XI')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeGradeTab === 'XI'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Grade XI (8 Sections)
            </button>
            <button
              onClick={() => setActiveGradeTab('XII')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeGradeTab === 'XII'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Grade XII (7 Sections)
            </button>
            <button
              onClick={() => setActiveGradeTab('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeGradeTab === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Sections (15)
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            Active Exam Session: <span className="font-bold text-slate-800">{currentSessionObj?.name || 'Standard Exam'}</span>
          </div>
        </div>

        {/* Notifications / Error message */}
        {authError && (
          <div className="mx-6 mt-2.5 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
            <button onClick={() => setAuthError(null)} className="text-red-500 hover:text-red-800 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {savedSuccessMsg && (
          <div className="mx-6 mt-2.5 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedSuccessMsg}</span>
          </div>
        )}

        {/* Sections Table Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-[#64748b] gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#2563EB]" />
              <span className="text-xs font-medium">Loading section details & allocation counts...</span>
            </div>
          ) : (
            <div className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475569] font-bold">
                  <tr>
                    <th className="py-2.5 px-4">Class Section</th>
                    <th className="py-2.5 px-4">In-Room Seating (Who sits in room)</th>
                    <th className="py-2.5 px-4">Class Despatch (Where class goes)</th>
                    <th className="py-2.5 px-4">Recipient Teacher Email</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {displayedSections.map(sec => {
                    const st = statusMap[sec.section] || { state: 'idle' };
                    const isXI_A_or_B = sec.section === 'XI - A' || sec.section === 'XI - B';

                    return (
                      <tr key={sec.section} className={`hover:bg-[#F8FAFC] transition-colors ${isXI_A_or_B ? 'bg-blue-50/25' : ''}`}>
                        
                        {/* Section Name */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#0F172A] text-sm">{sec.section}</span>
                            {isXI_A_or_B && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2563EB]/10 text-[#2563EB] font-bold">
                                Priority Target
                              </span>
                            )}
                          </div>
                        </td>

                        {/* In-Room Seating (Who sits here) */}
                        <td className="py-2.5 px-4">
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 text-[11px]">
                              <Layers className="w-3 h-3 text-blue-600" />
                              {sec.roomSeatsCount || 0} Seated in Room
                            </span>
                            {(sec.roomSeatsCount || 0) > 0 && (
                              <div className="text-[10px] text-slate-500 font-semibold">
                                {sec.xiSeatsCount || 0} XI + {sec.xiiSeatsCount || 0} XII (50/50 Mix)
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Class Despatch (Where class students go) */}
                        <td className="py-2.5 px-4">
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                              <MapPin className="w-3 h-3 text-emerald-600" />
                              {sec.despatchCount || sec.studentCount} Dispatched Out
                            </span>
                            <div className="text-[10px] text-slate-500 font-semibold">
                              Total Enrolled: {sec.studentCount}
                            </div>
                          </div>
                        </td>

                        {/* Recipient Email Input */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2 max-w-xs">
                            <input
                              type="email"
                              value={sec.email}
                              onChange={(e) => handleEmailChange(sec.section, e.target.value)}
                              placeholder={`Enter email for ${sec.section}`}
                              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all focus:outline-none focus:ring-2 focus:ring-[#2563EB] ${
                                sec.email.trim()
                                  ? 'border-[#CBD5E1] bg-white text-[#0F172A]'
                                  : 'border-dashed border-[#94A3B8] bg-[#F8FAFC] text-[#64748B]'
                              }`}
                            />
                          </div>
                        </td>

                        {/* Delivery Status */}
                        <td className="py-2.5 px-4">
                          {st.state === 'idle' && (
                            sec.email.trim() ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                Ready to send
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#94a3b8] italic">No email set</span>
                            )
                          )}
                          {st.state === 'generating' && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Generating 2-tab Excel...
                            </span>
                          )}
                          {st.state === 'sending' && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Sending via Gmail...
                            </span>
                          )}
                          {st.state === 'success' && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Sent {st.timestamp}
                            </span>
                          )}
                          {st.state === 'error' && (
                            <span 
                              title={st.message}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 max-w-[130px] truncate"
                            >
                              <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                              {st.message}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Download 2-Tab Workbook Button */}
                            <button
                              onClick={() => handleDownloadSheet(sec.section)}
                              title={`Download ${sec.section} 2-Tab Excel (Seating + Despatch)`}
                              className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9] transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold hidden md:inline">2-Tab XLSX</span>
                            </button>

                            {/* Send Single Class Button */}
                            <button
                              onClick={() => handleSendSingle(sec)}
                              disabled={st.state === 'sending' || st.state === 'generating' || !currentUser || !sec.email.trim()}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                isXI_A_or_B
                                  ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
                                  : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A]'
                              }`}
                            >
                              <Send className="w-3 h-3" />
                              <span>Send</span>
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Informational Dual-Report Explanation Card */}
          <div className="mt-4 p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#64748B]">
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</div>
              <div>
                <span className="font-bold text-[#0F172A]">Tab 1: Room Seating Door Chart</span>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Shows who will physically sit inside that classroom (desk by desk, with both 11th & 12th graders in 50/50 alternating checkerboard).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</div>
              <div>
                <span className="font-bold text-[#0F172A]">Tab 2: Class Outward Despatch</span>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Shows where all students of that home class need to report (assigned exam room, building, and specific desk label).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div className="text-xs text-[#64748B]">
            All recipient emails and preferences are saved locally and synced with the school portal.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-[#CBD5E1] rounded-xl text-xs font-bold text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
