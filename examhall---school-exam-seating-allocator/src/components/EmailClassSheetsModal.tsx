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
  Sparkles
} from 'lucide-react';
import { GoogleUser, sendClassSpreadsheetEmail, signInWithGoogle } from '../utils/googleAuth';

interface SectionRecipient {
  section: string;
  studentCount: number;
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
}

export const EmailClassSheetsModal: React.FC<EmailClassSheetsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSignInSuccess
}) => {
  const [sections, setSections] = useState<SectionRecipient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMap, setStatusMap] = useState<Record<string, SendStatus>>({});
  const [isBulkSending, setIsBulkSending] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Fetch recipients from backend
  const fetchRecipients = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/email/recipients');
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
      fetchRecipients();
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      [sec.section]: { state: 'generating', message: 'Generating Excel...' }
    }));

    try {
      // 1. Fetch generated class excel base64 from backend
      const encodedSec = encodeURIComponent(sec.section);
      const res = await fetch(`/api/email/class-sheet/${encodedSec}`);
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
        studentCount: sheetData.studentCount,
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

  // Send all ready configured classes (e.g. XI-A and XI-B)
  const handleSendAllConfigured = async () => {
    if (!currentUser) {
      setAuthError("Please sign in with Google before sending.");
      return;
    }

    const readySections = sections.filter(s => s.email.trim().length > 0);
    if (readySections.length === 0) {
      setAuthError("No sections have recipient emails configured.");
      return;
    }

    setIsBulkSending(true);
    // Save any pending edits first
    await handleSaveRecipients();

    for (const sec of readySections) {
      await handleSendSingle(sec);
      // Brief delay between sends to respect rate limits
      await new Promise(r => setTimeout(r, 600));
    }
    setIsBulkSending(false);
  };

  // Download class sheet directly
  const handleDownloadSheet = (section: string) => {
    window.open(`/api/email/class-sheet/${encodeURIComponent(section)}?download=true`, '_blank');
  };

  const configuredCount = sections.filter(s => s.email.trim().length > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0F172A]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <span>Email Class Spreadsheets</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#E2E8F0] text-[#2563EB] font-semibold">
                  Grade XI (8 Sections)
                </span>
              </h2>
              <p className="text-xs text-[#64748b]">
                Send formatted class spreadsheets with student details directly to class teachers via Gmail.
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-[#64748b] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sender Identity Banner */}
        <div className="px-6 py-3 bg-[#F1F5F9] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              {currentUser.picture ? (
                <img 
                  src={currentUser.picture} 
                  alt={currentUser.name} 
                  className="w-8 h-8 rounded-full border border-[#2563EB]"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white font-bold flex items-center justify-center text-xs">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-xs text-[#64748b] flex items-center gap-1.5">
                  <span>Sending from:</span>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-emerald-700 font-semibold">Gmail API Connected</span>
                </div>
                <div className="text-sm font-bold text-[#0F172A]">
                  {currentUser.name} <span className="font-normal text-[#64748b]">({currentUser.email})</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs text-amber-800">
                <span className="font-bold">Not signed in:</span> Sign in with Google to send emails directly from your Gmail account.
              </div>
              <button
                onClick={() => signInWithGoogle(onSignInSuccess, (err) => setAuthError(err))}
                className="px-3 py-1.5 bg-white border border-[#CBD5E1] rounded-lg text-xs font-bold text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-3.5 h-3.5" />
                Sign in with Google
              </button>
            </div>
          )}

          {/* Bulk Action Button */}
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
              <span>Send All Configured ({configuredCount}/8)</span>
            </button>
          </div>
        </div>

        {/* Notifications / Error message */}
        {authError && (
          <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
            <button onClick={() => setAuthError(null)} className="text-red-500 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {savedSuccessMsg && (
          <div className="mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedSuccessMsg}</span>
          </div>
        )}

        {/* Sections Table Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-[#64748b] gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#2563EB]" />
              <span className="text-xs font-medium">Loading section details & email mapping...</span>
            </div>
          ) : (
            <div className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475569] font-bold">
                  <tr>
                    <th className="py-3 px-4">Class Section</th>
                    <th className="py-3 px-4">Students</th>
                    <th className="py-3 px-4">Recipient Teacher Email</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {sections.map(sec => {
                    const st = statusMap[sec.section] || { state: 'idle' };
                    const isXI_A_or_B = sec.section === 'XI - A' || sec.section === 'XI - B';

                    return (
                      <tr key={sec.section} className={`hover:bg-[#F8FAFC] transition-colors ${isXI_A_or_B ? 'bg-blue-50/30' : ''}`}>
                        
                        {/* Section Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#0F172A] text-sm">{sec.section}</span>
                            {isXI_A_or_B && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2563EB]/10 text-[#2563EB] font-bold">
                                Priority Target
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Student Count */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#475569] bg-[#F1F5F9] px-2.5 py-1 rounded-lg">
                            <Users className="w-3.5 h-3.5 text-[#2563EB]" />
                            {sec.studentCount} Students
                          </span>
                        </td>

                        {/* Recipient Email Input */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 max-w-sm">
                            <input
                              type="email"
                              value={sec.email}
                              onChange={(e) => handleEmailChange(sec.section, e.target.value)}
                              placeholder={`Enter email for ${sec.section}`}
                              className={`w-full px-3 py-1.5 rounded-lg border text-xs font-mono transition-all focus:outline-none focus:ring-2 focus:ring-[#2563EB] ${
                                sec.email.trim()
                                  ? 'border-[#CBD5E1] bg-white text-[#0F172A]'
                                  : 'border-dashed border-[#94A3B8] bg-[#F8FAFC] text-[#64748B]'
                              }`}
                            />
                          </div>
                        </td>

                        {/* Delivery Status */}
                        <td className="py-3 px-4">
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
                              Generating Excel...
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
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 max-w-[150px] truncate"
                            >
                              <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                              {st.message}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Download Preview Button */}
                            <button
                              onClick={() => handleDownloadSheet(sec.section)}
                              title={`Download ${sec.section} Excel spreadsheet`}
                              className="p-1.5 rounded-lg border border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
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

          {/* Informational Card */}
          <div className="mt-5 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3 text-xs text-[#64748B]">
            <FileSpreadsheet className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#0F172A]">Automated Excel Attachment: </span>
              Each email sent will attach a cleanly formatted <code className="text-[#2563EB] font-mono">Class_XI-X_Details.xlsx</code> spreadsheet containing students' S.No, Exam/Roll No, Name, Gender, Registered Subjects, and assigned Room & Desk seating.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div className="text-xs text-[#64748B]">
            Recipient emails are saved securely in your local backend data store.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#CBD5E1] rounded-xl text-xs font-bold text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
