import React from 'react';
import { X, Sliders, CheckCircle2, Shield, Grid, Columns, Shuffle, Sparkles, UserPlus } from 'lucide-react';
import { AllocationOptions, SplitStrategy, LeftoverHandling } from '../types';

interface AllocationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: AllocationOptions;
  onChangeOptions: (newOptions: AllocationOptions) => void;
  onApplyAndRegenerate: () => void;
}

export const AllocationSettingsModal: React.FC<AllocationSettingsModalProps> = ({
  isOpen,
  onClose,
  options,
  onChangeOptions,
  onApplyAndRegenerate
}) => {
  if (!isOpen) return null;

  const strategies: { id: SplitStrategy; title: string; desc: string; icon: React.ReactNode; badge: string }[] = [
    {
      id: 'column_alternate',
      title: 'Column-wise Alternating',
      desc: 'Assigns entire columns to alternating classes (e.g. Column 1: Grade 10, Column 2: Grade 12, Column 3: Grade 10...).',
      icon: <Columns className="w-5 h-5 text-[#2563EB]" />,
      badge: 'Easy Invigilation'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F1F5F9]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] text-[#2563EB] flex items-center justify-center border border-[#E2E8F0]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0F172A] font-heading">
                Seating & Split Rules
              </h2>
              <p className="text-xs text-[#64748B]">
                Configure classroom mixing, 50/50 distribution, and leftover student handling
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
          
          {/* Strategy Section */}
          <div>
            <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">
              1. Room Mixing & Split Strategy
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {strategies.map((strat) => {
                const isSelected = options.strategy === strat.id;
                return (
                  <div
                    key={strat.id}
                    onClick={() => onChangeOptions({ ...options, strategy: strat.id })}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#2563EB] bg-[#F1F5F9] ring-2 ring-[#2563EB]/20 shadow-xs'
                        : 'border-[#E2E8F0] hover:border-[#2563EB]/50 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-white shadow-2xs border border-[#E2E8F0]">
                            {strat.icon}
                          </div>
                          <span className="text-sm font-bold text-[#0F172A]">{strat.title}</span>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-[#2563EB] shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[#3B82F6] line-clamp-3">
                        {strat.desc}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[#E2E8F0]">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#BFDBFE]/40 text-[#2563EB] border border-[#BFDBFE]">
                        {strat.badge}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leftover Student Handling */}
          <div className="bg-[#F1F5F9] p-4 rounded-2xl border border-[#E2E8F0] space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#2563EB]" />
              <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                2. Leftover Students Handling (2-3 Remaining per Subject)
              </label>
            </div>
            <p className="text-xs text-[#3B82F6]">
              When class enrollments are uneven (e.g. 33 students vs 30 students), how should the remaining 2-3 students be placed?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer ${
                options.leftoverHandling === 'distribute_evenly' ? 'bg-white border-[#2563EB] font-semibold text-[#0F172A]' : 'border-[#E2E8F0] text-[#3B82F6] bg-white/60'
              }`}>
                <input
                  type="radio"
                  name="leftoverHandling"
                  checked={options.leftoverHandling === 'distribute_evenly'}
                  onChange={() => onChangeOptions({ ...options, leftoverHandling: 'distribute_evenly' })}
                  className="mt-0.5 accent-[#2563EB] cursor-pointer"
                />
                <div>
                  <span className="block font-bold">Distribute in Available Rooms</span>
                  <span className="text-[11px] text-[#64748B] font-normal">Places 2 or 3 students in classes with spare desks.</span>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer ${
                options.leftoverHandling === 'fill_back' ? 'bg-white border-[#2563EB] font-semibold text-[#0F172A]' : 'border-[#E2E8F0] text-[#3B82F6] bg-white/60'
              }`}>
                <input
                  type="radio"
                  name="leftoverHandling"
                  checked={options.leftoverHandling === 'fill_back'}
                  onChange={() => onChangeOptions({ ...options, leftoverHandling: 'fill_back' })}
                  className="mt-0.5 accent-[#2563EB] cursor-pointer"
                />
                <div>
                  <span className="block font-bold">Fill Contiguous Desks</span>
                  <span className="text-[11px] text-[#64748B] font-normal">Packs remaining students sequentially in the last room.</span>
                </div>
              </label>
            </div>
          </div>

          {/* Anti-Cheating & Accessibility Toggles */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider">
              3. Constraints & Accessibility Rules
            </label>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 rounded-xl border border-[#E2E8F0] hover:bg-[#F1F5F9] cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-[#2563EB]" />
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-[#0F172A]">Avoid Adjacent Same-Subject Desks</span>
                    <p className="text-[11px] text-[#64748B]">Ensure horizontal and vertical neighbors do not have the same exam question paper.</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={options.avoidAdjacentSameSubject}
                  onChange={(e) => onChangeOptions({ ...options, avoidAdjacentSameSubject: e.target.checked })}
                  className="w-4 h-4 rounded accent-[#2563EB] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-[#E2E8F0] hover:bg-[#F1F5F9] cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-base">♿</span>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-[#0F172A]">Prioritize Front-Row for Special Needs</span>
                    <p className="text-[11px] text-[#64748B]">Automatically seat accessibility / special accommodation students in Row 1.</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={options.prioritizeSpecialNeedsFront}
                  onChange={(e) => onChangeOptions({ ...options, prioritizeSpecialNeedsFront: e.target.checked })}
                  className="w-4 h-4 rounded accent-[#2563EB] cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-[#F1F5F9] border-t border-[#E2E8F0] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#0F172A] bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              onApplyAndRegenerate();
              onClose();
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#F8FAFC] bg-[#2563EB] hover:bg-[#1D4ED8] shadow-sm transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Apply & Regenerate Plan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
