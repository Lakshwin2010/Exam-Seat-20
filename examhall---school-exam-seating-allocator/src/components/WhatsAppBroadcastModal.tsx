import React, { useState, useEffect } from 'react';
import {
  X,
  MessageCircle,
  Download,
  Copy,
  Check,
  ExternalLink,
  Eye,
  Calendar,
  Layers,
  Users,
  Search,
  RefreshCw,
  FileText,
  Send,
  AlertCircle,
  Share2
} from 'lucide-react';
import { ExamSession } from '../types';

interface RoomSplit {
  room: string;
  count: number;
  rollRange: string;
}

interface SectionNotice {
  section: string;
  gradeLevel: string;
  studentCount: number;
  allocatedCount: number;
  subject: string;
  roomSplits: RoomSplit[];
  pdfUrl: string;
  whatsappText: string;
  whatsappUrl: string;
}

interface WhatsAppBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions?: ExamSession[];
  selectedSessionId?: string;
}

export const WhatsAppBroadcastModal: React.FC<WhatsAppBroadcastModalProps> = ({
  isOpen,
  onClose,
  sessions = [],
  selectedSessionId = ''
}) => {
  const [currentSessionId, setCurrentSessionId] = useState<string>(selectedSessionId || (sessions[0]?.id || ''));
  const [activeGradeTab, setActiveGradeTab] = useState<'ALL' | 'XI' | 'XII'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notices, setNotices] = useState<SectionNotice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<{ section: string; msg: string } | null>(null);
  const [sessionMeta, setSessionMeta] = useState<{ name: string; date: string; time: string } | null>(null);
  const [expandedPreviews, setExpandedPreviews] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (selectedSessionId) {
      setCurrentSessionId(selectedSessionId);
    } else if (sessions.length > 0 && !currentSessionId) {
      setCurrentSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessions]);

  const fetchNotices = async (sessId?: string) => {
    setLoading(true);
    try {
      const targetSession = sessId !== undefined ? sessId : currentSessionId;
      const url = targetSession
        ? `/api/email/whatsapp/notices?session_id=${encodeURIComponent(targetSession)}`
        : '/api/email/whatsapp/notices';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setNotices(data.sections || []);
        setSessionMeta({
          name: data.sessionName || 'Exam Session',
          date: data.sessionDate || '',
          time: data.sessionTime || ''
        });
      }
    } catch (err) {
      console.error('Failed to load WhatsApp notices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotices(currentSessionId);
    }
  }, [isOpen, currentSessionId]);

  if (!isOpen) return null;

  // Filter sections by Grade and Search
  const filteredNotices = notices.filter(n => {
    if (activeGradeTab === 'XI' && (!n.section.includes('XI') || n.section.includes('XII'))) return false;
    if (activeGradeTab === 'XII' && !n.section.includes('XII')) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSec = n.section.toLowerCase().includes(q);
      const matchSub = n.subject.toLowerCase().includes(q);
      const matchRoom = n.roomSplits.some(r => r.room.toLowerCase().includes(q));
      if (!matchSec && !matchSub && !matchRoom) return false;
    }
    return true;
  });

  const togglePreview = (sec: string) => {
    setExpandedPreviews(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const handleCopyText = (secNotice: SectionNotice) => {
    navigator.clipboard.writeText(secNotice.whatsappText);
    setCopiedSection(secNotice.section);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const handleCopyAll = () => {
    const allText = filteredNotices.map(n => n.whatsappText).join('\n\n========================================\n\n');
    navigator.clipboard.writeText(allText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handleDownloadPdf = (secNotice: SectionNotice) => {
    const url = `/api/email/dispatch-pdf/${encodeURIComponent(secNotice.section)}?download=true${currentSessionId ? `&session_id=${encodeURIComponent(currentSessionId)}` : ''}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `Exam_Dispatch_${secNotice.section.replace(/\s+/g, '')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewPdf = (secNotice: SectionNotice) => {
    const url = `/api/email/dispatch-pdf/${encodeURIComponent(secNotice.section)}?download=false${currentSessionId ? `&session_id=${encodeURIComponent(currentSessionId)}` : ''}`;
    window.open(url, '_blank');
  };

  const handleShareToWhatsApp = (secNotice: SectionNotice) => {
    // 1. Trigger instant download of the PDF so the user has the file in their downloads to drag & drop
    handleDownloadPdf(secNotice);

    // 2. Open WhatsApp Web / App with pre-filled message
    window.open(secNotice.whatsappUrl, '_blank');

    // 3. Show confirmation feedback
    setActionNotice({
      section: secNotice.section,
      msg: 'Opened WhatsApp Web & downloaded Dispatch PDF!'
    });
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleDownloadAllPdfs = async () => {
    setActionNotice({ section: 'all', msg: `Downloading ${filteredNotices.length} PDFs...` });
    for (const sec of filteredNotices) {
      handleDownloadPdf(sec);
      await new Promise(r => setTimeout(r, 400));
    }
    setTimeout(() => setActionNotice(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0F172A]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 bg-[#F0FDF4]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[#0F172A] font-heading">
                  WhatsApp Group Broadcast & Dispatch PDFs
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#166534]">
                  Ready to Send
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                One-click WhatsApp notices and official Class Outward Exam Dispatch PDFs for each section
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Session Picker + Grade Tabs + Search */}
        <div className="px-6 py-3 border-b border-[#E2E8F0] bg-white flex flex-wrap items-center justify-between gap-3">
          
          {/* Session Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#64748B] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#16A34A]" />
              Session:
            </span>
            <select
              value={currentSessionId}
              onChange={(e) => {
                setCurrentSessionId(e.target.value);
                fetchNotices(e.target.value);
              }}
              className="text-xs font-bold text-[#0F172A] bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
            >
              {sessions.length > 0 ? (
                sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.date} • {s.time_slot})
                  </option>
                ))
              ) : (
                <option value="">Active Exam Session</option>
              )}
            </select>
          </div>

          {/* Grade Level Selector */}
          <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-xl border border-[#E2E8F0] text-xs font-semibold">
            <button
              onClick={() => setActiveGradeTab('ALL')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeGradeTab === 'ALL'
                  ? 'bg-white text-[#0F172A] shadow-2xs font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              All ({notices.length})
            </button>
            <button
              onClick={() => setActiveGradeTab('XI')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeGradeTab === 'XI'
                  ? 'bg-[#16A34A] text-white shadow-2xs font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Grade XI (8)
            </button>
            <button
              onClick={() => setActiveGradeTab('XII')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeGradeTab === 'XII'
                  ? 'bg-[#16A34A] text-white shadow-2xs font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Grade XII (7)
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search section or room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16A34A] w-48"
            />
          </div>

          {/* Batch Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] transition-colors cursor-pointer"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5 text-[#64748B]" />}
              <span>{copiedAll ? 'Copied All!' : 'Copy All Notices'}</span>
            </button>
            <button
              onClick={handleDownloadAllPdfs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download All PDFs</span>
            </button>
          </div>
        </div>

        {/* Action toast */}
        {actionNotice && (
          <div className="bg-[#DCFCE7] text-[#166534] px-6 py-2 text-xs font-bold flex items-center gap-2 border-b border-[#BBF7D0]">
            <Check className="w-4 h-4 text-[#16A34A]" />
            <span>{actionNotice.msg}</span>
          </div>
        )}

        {/* Main Section List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-[#F8FAFC]">
          {loading ? (
            <div className="py-16 text-center text-[#64748B]">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-[#16A34A] mb-3" />
              <p className="text-sm font-semibold">Generating section room splits & WhatsApp notices...</p>
            </div>
          ) : filteredNotices.length === 0 ? (
            <div className="py-16 text-center text-[#64748B]">
              <AlertCircle className="w-8 h-8 mx-auto text-[#94A3B8] mb-2" />
              <p className="text-sm font-semibold">No sections match your search or filter.</p>
            </div>
          ) : (
            filteredNotices.map((sec) => {
              const isExpanded = Boolean(expandedPreviews[sec.section]);
              const isCopied = copiedSection === sec.section;

              return (
                <div
                  key={sec.section}
                  className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs p-4 sm:p-5 transition-all hover:border-[#16A34A]/50 hover:shadow-xs"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    
                    {/* Left: Section Details & Room Split Chips */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold font-heading text-[#0F172A]">
                          Class {sec.section}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                          {sec.studentCount} Students
                        </span>
                        <span className="text-[11px] font-medium text-[#64748B]">
                          • {sec.subject}
                        </span>
                      </div>

                      {/* Room Split Badges */}
                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        <span className="text-[11px] font-bold text-[#64748B]">
                          Allotted Halls:
                        </span>
                        {sec.roomSplits.map((split, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] border border-[#DBEAFE]"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]"></span>
                            <span><b>Room {split.room}</b>: {split.count} students ({split.rollRange})</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Right: Quick Actions */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
                      
                      {/* 1. Share via WhatsApp (Green Primary Button) */}
                      <button
                        onClick={() => handleShareToWhatsApp(sec)}
                        title="Open WhatsApp Web & Download Official Dispatch PDF"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] active:scale-98 transition-all cursor-pointer shadow-2xs"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Send to WhatsApp</span>
                      </button>

                      {/* 2. Download Dispatch PDF */}
                      <button
                        onClick={() => handleDownloadPdf(sec)}
                        title="Download official Class Outward Exam Dispatch PDF"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] transition-colors cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-[#2563EB]" />
                        <span className="hidden sm:inline">Dispatch PDF</span>
                      </button>

                      {/* 3. View PDF in new tab */}
                      <button
                        onClick={() => handleViewPdf(sec)}
                        title="View Dispatch PDF in new tab"
                        className="p-2 rounded-xl text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* 4. Copy Notice Text */}
                      <button
                        onClick={() => handleCopyText(sec)}
                        title="Copy formatted notice to clipboard"
                        className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors cursor-pointer"
                      >
                        {isCopied ? <Check className="w-4 h-4 text-[#16A34A]" /> : <Copy className="w-4 h-4" />}
                        <span className="text-[11px]">{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>

                      {/* 5. Toggle Preview Accordion */}
                      <button
                        onClick={() => togglePreview(sec.section)}
                        className="text-[11px] font-bold text-[#16A34A] hover:underline px-1 py-1 cursor-pointer"
                      >
                        {isExpanded ? 'Hide Notice' : 'Preview'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Notice Preview */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#F1F5F9]">
                      <div className="bg-[#0F172A]/95 text-[#F8FAFC] rounded-xl p-3.5 text-xs font-mono whitespace-pre-wrap leading-relaxed border border-[#334155] shadow-inner max-h-56 overflow-y-auto">
                        {sec.whatsappText}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#16A34A]"></span>
            <span>Clicking <b>"Send to WhatsApp"</b> automatically downloads the Dispatch PDF and opens WhatsApp Web with the notice ready.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl font-bold text-[#0F172A] bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
