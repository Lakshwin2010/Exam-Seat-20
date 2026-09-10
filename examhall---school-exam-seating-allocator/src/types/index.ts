export type BenchType = 'single' | 'paired';

export interface ExamRoom {
  id: string;
  name: string;
  building?: string;
  floor?: string;
  capacity: number;
  rows: number;
  cols: number;
  benchType: BenchType;
  isActive: boolean;
  notes?: string;
}

export interface ExamSubject {
  id: string;
  code: string;
  name: string;
  color: string; // Tailwind-friendly hex or color identifier
  gradeLevel: string;
}

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  grade: string; // e.g. "Grade 10-A", "Grade 12-Science"
  gender?: 'M' | 'F' | 'Other';
  specialNeeds?: boolean; // front row / accessibility
  enrolledSubjectIds: string[]; // Subject IDs student is registered for
}

export interface ExamSession {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "09:00 AM - 12:00 PM"
  subjectIds: string[]; // Subjects running in this session
  isLocked?: boolean;
}

export type SplitStrategy = 
  | 'checkerboard_mix'   // alternate every seat: Grade A, Grade B, Grade A...
  | 'split_50_50'         // exactly split 15 students from Class A and 15 from Class B in a 30-seater room
  | 'column_alternate'    // columns of Grade A, Grade B...
  | 'subject_interleave'; // mix different subjects as far apart as possible

export type LeftoverHandling = 
  | 'distribute_evenly'   // distribute 2-3 leftover students into remaining rooms with capacity
  | 'fill_back'           // place leftovers at the back of rooms
  | 'isolate_room';       // create dedicated overflow room

export interface AllocationOptions {
  strategy: SplitStrategy;
  leftoverHandling: LeftoverHandling;
  avoidAdjacentSameSubject: boolean;
  benchPartnerDifferentGroup: boolean; // if paired bench, seat 2 different grades/subjects side-by-side
  prioritizeSpecialNeedsFront: boolean;
  targetMaxPerGroupInRoom?: number; // e.g. max 15 per grade in a 30 seater room
  customGradePairs?: Array<[string, string]>; // Pair e.g. Grade 10 with Grade 12
}

export interface SeatAssignment {
  seatIndex: number;
  row: number; // 0-indexed
  col: number; // 0-indexed
  seatLabel: string; // e.g. "A1", "B3"
  studentId?: string;
  studentRollNo?: string;
  studentName?: string;
  studentGrade?: string;
  subjectCode?: string;
  subjectName?: string;
  subjectColor?: string;
  isSpecialNeeds?: boolean;
  hasNeighborConflict?: boolean; // same subject sitting right next to or in front/back
}

export interface RoomAllocation {
  roomId: string;
  roomName: string;
  building?: string;
  floor?: string;
  capacity: number;
  rows: number;
  cols: number;
  benchType: BenchType;
  assignedSeats: SeatAssignment[];
  totalAssigned: number;
  gradeDistribution: Record<string, number>; // e.g. { "Grade 10-A": 15, "Grade 12-B": 15 }
  subjectDistribution: Record<string, number>; // e.g. { "MATH-101": 15, "PHYS-201": 15 }
  invigilator?: string;
}

export interface ConflictWarning {
  type: 'neighbor_same_subject' | 'double_booking' | 'unassigned' | 'capacity_overload' | 'special_needs_not_front';
  severity: 'warning' | 'error' | 'info';
  message: string;
  roomId?: string;
  studentId?: string;
  seatLabel?: string;
}

export interface SeatingPlan {
  id: string;
  sessionId: string;
  sessionName: string;
  sessionDate: string;
  sessionTime: string;
  createdAt: string;
  options: AllocationOptions;
  roomAllocations: RoomAllocation[];
  unassignedStudents: {
    student: Student;
    subject: ExamSubject;
    reason: string;
  }[];
  conflicts: ConflictWarning[];
  stats: {
    totalStudents: number;
    totalAssigned: number;
    totalRoomsUsed: number;
    totalCapacityAvailable: number;
    overallUtilizationPercent: number;
    mixedRoomCount: number;
    singleGroupRoomCount: number;
    conflictCount: number;
    cheatPreventionIndex: number; // percentage of students with 0 adjacent same-subject neighbors
  };
}
