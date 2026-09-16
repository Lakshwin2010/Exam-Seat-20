import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  Calendar, 
  Search, 
  Sliders, 
  Sparkles, 
  Layers, 
  Menu, 
  X,
  RefreshCw,
  Home,
  Mail,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { GoogleUser } from '../utils/googleAuth';

type ActiveTab = 'home' | 'plan' | 'rooms' | 'data' | 'print' | 'calendar' | 'monitoring';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onGeneratePlan: () => void;
  isAllocating: boolean;
  totalStudentsSeated: number;
  // Google Auth & Email
  currentUser: GoogleUser | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenEmailModal: () => void;
  onOpenSyncBackup: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenSearch,
  onOpenSettings,
  onGeneratePlan,
  isAllocating,
  totalStudentsSeated,
  currentUser,
  onSignIn,
  onSignOut,
  onOpenEmailModal,
  onOpenSyncBackup
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-[#F8FAFC]/90 backdrop-blur-md border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-3">
          
          {/* Left: Brand Identity */}
          <button 
            onClick={() => setActiveTab('plan')}
            className="flex items-center gap-2 shrink-0 text-left cursor-pointer group"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-[#2563EB] text-[#F8FAFC] flex items-center justify-center shadow-xs group-hover:bg-[#1D4ED8] transition-colors">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="hidden md:block">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-[#0F172A] font-heading group-hover:text-[#2563EB] transition-colors">
                  ExamHall
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#E2E8F0] text-[#2563EB]">
                  Allocation
                </span>
              </div>
            </div>
          </button>

          {/* Strategy rules */}
          <div className="hidden lg:flex items-center gap-2">
             <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] transition-colors cursor-pointer"
             >
               <Sliders className="w-4 h-4 text-[#2563EB]" />
               <span>Strategy Settings</span>
             </button>
          </div>

          {/* Center: Main Navigation Tabs (Desktop & Tablet) */}
          <nav className="hidden md:flex items-center p-1 bg-[#F1F5F9] rounded-xl border border-[#E2E8F0]">

            <button
              id="tab-btn-plan"
              onClick={() => setActiveTab('plan')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'plan'
                  ? 'bg-white text-[#0F172A] shadow-2xs border border-[#E2E8F0]'
                  : 'text-[#3B82F6] hover:text-[#0F172A]'
              }`}
            >
              <Layers className="w-4 h-4 text-[#2563EB]" />
              <span>Seating Plan</span>
            </button>

            <button
              id="tab-btn-calendar"
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'calendar'
                  ? 'bg-white text-[#0F172A] shadow-2xs border border-[#E2E8F0]'
                  : 'text-[#3B82F6] hover:text-[#0F172A]'
              }`}
            >
              <Calendar className="w-4 h-4 text-[#2563EB]" />
              <span>Exam Calendar</span>
            </button>

            <button
              id="tab-btn-data"
              onClick={() => setActiveTab('data')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'data'
                  ? 'bg-white text-[#0F172A] shadow-2xs border border-[#E2E8F0]'
                  : 'text-[#3B82F6] hover:text-[#0F172A]'
              }`}
            >
              <Users className="w-4 h-4 text-[#2563EB]" />
              <span>Students</span>
            </button>
          </nav>

          {/* Right: Quick Tools & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              id="btn-search-student"
              onClick={onOpenSearch}
              title="Search student room & desk"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4 text-[#3B82F6]" />
            </button>

            {/* Auto Allocate Button */}
            <button
              id="btn-run-allocate"
              onClick={onGeneratePlan}
              disabled={isAllocating}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold text-[#F8FAFC] bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-98 shadow-2xs transition-all disabled:opacity-75 cursor-pointer whitespace-nowrap"
            >
              {isAllocating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>Auto Allocate</span>
            </button>

            {/* Sync & Backup Trigger */}
            <button
              id="btn-sync-backup"
              onClick={onOpenSyncBackup}
              title="Sync data with backend and create/restore recovery copies"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-[#2563EB]" />
              <span className="hidden sm:inline">Sync & Backup</span>
            </button>

            {/* Email Class Sheets Quick Trigger */}
            <button
              id="btn-email-class-sheets"
              onClick={onOpenEmailModal}
              title="Email Class Excel Spreadsheets to Teachers"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2E8F0] transition-colors cursor-pointer"
            >
              <Mail className="w-4 h-4 text-[#2563EB]" />
              <span className="hidden lg:inline">Email Sheets</span>
            </button>

            {/* Google Sign In / User Profile in the Corner */}
            <div className="relative">
              {currentUser ? (
                <div>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] transition-colors cursor-pointer shadow-2xs"
                  >
                    {currentUser.picture ? (
                      <img src={currentUser.picture} alt={currentUser.name} className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-[10px] font-bold">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-bold text-[#0F172A] max-w-[100px] truncate hidden sm:inline">
                      {currentUser.name}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-4 py-2 border-b border-[#F1F5F9]">
                        <div className="text-xs font-bold text-[#0F172A] truncate">{currentUser.name}</div>
                        <div className="text-[11px] text-[#64748B] truncate">{currentUser.email}</div>
                      </div>

                      <div className="py-1">
                        <button
                          onClick={() => { onOpenEmailModal(); setUserMenuOpen(false); }}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] flex items-center gap-2 cursor-pointer"
                        >
                          <Mail className="w-4 h-4 text-[#2563EB]" />
                          <span>Email Class Spreadsheets</span>
                        </button>
                      </div>

                      <div className="pt-1 border-t border-[#F1F5F9]">
                        <button
                          onClick={() => { onSignOut(); setUserMenuOpen(false); }}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 text-red-500" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={onSignIn}
                  title="Sign in with Google"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#0F172A] bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] shadow-2xs transition-all cursor-pointer"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign in</span>
                </button>
              )}
            </div>

            {/* Mobile Hamburger Toggle */}
            <button
              id="btn-mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-[#0F172A] hover:bg-[#F1F5F9] md:hidden cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-[#E2E8F0] space-y-2 bg-[#F8FAFC]">
            <button
              onClick={() => { setActiveTab('plan'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${activeTab === 'plan' ? 'bg-white text-[#2563EB] border border-[#E2E8F0]' : 'text-[#0F172A] hover:bg-[#F1F5F9]'}`}
            >
              <Layers className="w-4 h-4 text-[#2563EB]" /> Seating Plan
            </button>
            <button
              onClick={() => { setActiveTab('calendar'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${activeTab === 'calendar' ? 'bg-white text-[#2563EB] border border-[#E2E8F0]' : 'text-[#0F172A] hover:bg-[#F1F5F9]'}`}
            >
              <Calendar className="w-4 h-4 text-[#2563EB]" /> Exam Calendar
            </button>
            <button
              onClick={() => { setActiveTab('data'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${activeTab === 'data' ? 'bg-white text-[#2563EB] border border-[#E2E8F0]' : 'text-[#0F172A] hover:bg-[#F1F5F9]'}`}
            >
              <Users className="w-4 h-4 text-[#2563EB]" /> Students
            </button>
            <div className="px-1 pt-1 space-y-1">
              <button
                onClick={() => { onOpenSyncBackup(); setMobileMenuOpen(false); }}
                className="w-full px-3 py-2 bg-[#F1F5F9] rounded-xl border border-[#E2E8F0] flex items-center gap-2 text-xs font-semibold text-[#0F172A]"
              >
                <RefreshCw className="w-4 h-4 text-[#2563EB]" /> Sync & Backup Data
              </button>
              <button
                onClick={() => { onOpenSettings(); setMobileMenuOpen(false); }}
                className="w-full px-3 py-2 bg-[#F1F5F9] rounded-xl border border-[#E2E8F0] flex items-center gap-2 text-xs font-semibold text-[#0F172A]"
              >
                <Sliders className="w-4 h-4 text-[#2563EB]" /> Strategy Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
