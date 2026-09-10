import React from 'react';
import { 
  Users, 
  Building2, 
  ShieldCheck, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Shuffle, 
  Maximize2 
} from 'lucide-react';
import { SeatingPlan, SplitStrategy } from '../types';

interface AllocationSummaryStatsProps {
  plan: SeatingPlan | null;
  onOpenSettings: () => void;
  onSelectRoomFilter?: (roomId: string) => void;
  onSortOutConflicts?: () => void;
}

export const AllocationSummaryStats: React.FC<AllocationSummaryStatsProps> = ({
  plan,
  onOpenSettings,
  onSelectRoomFilter,
  onSortOutConflicts
}) => {
  if (!plan) return null;

  const hasConflicts = plan.conflicts.length > 0 || plan.unassignedStudents.length > 0;
  if (!hasConflicts) return null;

  return (
    <div className="space-y-3">
      {/* Unassigned or Conflict Warning Banner */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3 sm:p-4 text-[#1E3A8A] text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-start sm:items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-[#60A5FA] shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <span className="font-bold">Seating Notice: </span>
            {plan.unassignedStudents.length > 0 ? (
              <span>
                {plan.unassignedStudents.length} student(s) could not be seated due to capacity limits. Please add rooms or increase capacity.
              </span>
            ) : (
              <span>
                {plan.conflicts.length} conflict(s) or neighbor subject proximities detected.
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {plan.unassignedStudents.length > 0 && (
            <button
              onClick={onOpenSettings}
              className="text-xs font-semibold bg-[#60A5FA] hover:bg-[#1E3A8A] text-white px-3 py-1.5 rounded-lg transition-colors self-start sm:self-auto cursor-pointer"
            >
              Adjust Capacity Rules
            </button>
          )}
          {plan.unassignedStudents.length === 0 && plan.conflicts.length > 0 && onSortOutConflicts && (
            <button
              onClick={onSortOutConflicts}
              className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors self-start sm:self-auto cursor-pointer"
            >
              Sort it out
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
