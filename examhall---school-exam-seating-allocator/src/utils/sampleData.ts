import { ExamRoom, ExamSubject, Student, ExamSession, AllocationOptions } from '../types';

// Clean initial empty state: all data is synchronized dynamically from the backend and Excel files
export const INITIAL_ROOMS: ExamRoom[] = [];
export const INITIAL_STUDENTS: Student[] = [];
export const INITIAL_SUBJECTS: ExamSubject[] = [];
export const INITIAL_SESSIONS: ExamSession[] = [];

export const SAMPLE_ROOMS: ExamRoom[] = [];
export const SAMPLE_STUDENTS: Student[] = [];
export const SAMPLE_SUBJECTS: ExamSubject[] = [];
export const SAMPLE_SESSIONS: ExamSession[] = [];

export const DEFAULT_ALLOCATION_OPTIONS: AllocationOptions = {
  strategy: 'checkerboard_mix',
  leftoverHandling: 'distribute_evenly',
  avoidAdjacentSameSubject: true,
  benchPartnerDifferentGroup: true,
  prioritizeSpecialNeedsFront: true,
  targetMaxPerGroupInRoom: 15
};
