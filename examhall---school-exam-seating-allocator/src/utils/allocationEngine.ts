import { 
  ExamRoom, 
  ExamSubject, 
  Student, 
  ExamSession, 
  AllocationOptions, 
  SeatingPlan, 
  RoomAllocation, 
  SeatAssignment, 
  ConflictWarning 
} from '../types';

interface StudentToSeat {
  student: Student;
  subject: ExamSubject;
}

export function runSeatingAllocation(
  session: ExamSession,
  allRooms: ExamRoom[],
  allStudents: Student[],
  allSubjects: ExamSubject[],
  options: AllocationOptions
): SeatingPlan {
  // Ensure active rooms
  let activeRooms = allRooms.filter(r => r.isActive && r.capacity > 0);
  if (activeRooms.length === 0 && allRooms.length > 0) {
    activeRooms = allRooms.filter(r => r.capacity > 0);
  }

  // Build lookup maps for subjects by ID and by code
  const subjectById = new Map<string, ExamSubject>(allSubjects.map(s => [s.id.toLowerCase(), s]));
  const subjectByCode = new Map<string, ExamSubject>(allSubjects.map(s => [s.code.toUpperCase(), s]));

  // Find session subject IDs and codes
  const sessionSubIds = new Set((session?.subjectIds || []).map(id => id.toLowerCase()));
  const sessionSubCodes = new Set<string>();
  for (const sId of sessionSubIds) {
    if (subjectById.has(sId)) {
      sessionSubCodes.add(subjectById.get(sId)!.code.toUpperCase());
    } else if (subjectByCode.has(sId.toUpperCase())) {
      sessionSubCodes.add(sId.toUpperCase());
    }
  }

  const g11SubIds = new Set((session?.grade11SubjectIds || []).map(id => id.toLowerCase()));
  const g12SubIds = new Set((session?.grade12SubjectIds || []).map(id => id.toLowerCase()));
  const g11SubCodes = new Set<string>();
  const g12SubCodes = new Set<string>();
  for (const sId of g11SubIds) {
    if (subjectById.has(sId)) g11SubCodes.add(subjectById.get(sId)!.code.toUpperCase());
    else if (subjectByCode.has(sId.toUpperCase())) g11SubCodes.add(sId.toUpperCase());
  }
  for (const sId of g12SubIds) {
    if (subjectById.has(sId)) g12SubCodes.add(subjectById.get(sId)!.code.toUpperCase());
    else if (subjectByCode.has(sId.toUpperCase())) g12SubCodes.add(sId.toUpperCase());
  }

  const isXI = (g: string) => {
    const u = (g || '').toUpperCase();
    return u.includes('XI') && !u.includes('XII');
  };
  const isXII = (g: string) => (g || '').toUpperCase().includes('XII');

  // 1. Identify all eligible students taking exams in this session
  const candidates: StudentToSeat[] = [];

  for (const student of allStudents) {
    const studentSubs: ExamSubject[] = student.enrolledSubjectIds
      .map(id => subjectById.get(id.toLowerCase()) || subjectByCode.get(id.toUpperCase()))
      .filter((s): s is ExamSubject => Boolean(s));

    let chosenSub: ExamSubject | null = null;
    const studXI = isXI(student.grade);
    const studXII = isXII(student.grade);

    if (studXI && (g11SubIds.size > 0 || g11SubCodes.size > 0)) {
      // Grade 11 student strictly matches Grade 11 exam subjects
      chosenSub = studentSubs.find(sub => 
        g11SubIds.has(sub.id.toLowerCase()) ||
        g11SubIds.has(sub.code.toLowerCase()) ||
        g11SubCodes.has(sub.code.toUpperCase())
      ) || null;
    } else if (studXII && (g12SubIds.size > 0 || g12SubCodes.size > 0)) {
      // Grade 12 student strictly matches Grade 12 exam subjects
      chosenSub = studentSubs.find(sub => 
        g12SubIds.has(sub.id.toLowerCase()) ||
        g12SubIds.has(sub.code.toLowerCase()) ||
        g12SubCodes.has(sub.code.toUpperCase())
      ) || null;
    } else if (sessionSubIds.size === 0) {
      // General session: student takes first enrolled subject or default
      chosenSub = studentSubs[0] || allSubjects[0] || {
        id: 'sub-gen',
        name: 'General Examination',
        code: 'GEN',
        gradeLevel: student.grade || 'General',
        color: '#2563EB'
      };
    } else {
      // Match by general session subject ID or subject code
      for (const sub of studentSubs) {
        if (
          sessionSubIds.has(sub.id.toLowerCase()) ||
          sessionSubIds.has(sub.code.toLowerCase()) ||
          sessionSubCodes.has(sub.code.toUpperCase())
        ) {
          chosenSub = sub;
          break;
        }
      }
    }

    if (chosenSub) {
      candidates.push({
        student,
        subject: chosenSub
      });
    }
  }

  // Fallback: if session specified subjects but none matched, seat all students
  if (candidates.length === 0 && allStudents.length > 0) {
    for (const student of allStudents) {
      const studentSubs = student.enrolledSubjectIds
        .map(id => subjectById.get(id.toLowerCase()) || subjectByCode.get(id.toUpperCase()))
        .filter((s): s is ExamSubject => Boolean(s));
      const fallbackSub = studentSubs[0] || allSubjects[0] || {
        id: 'sub-gen',
        name: 'General Examination',
        code: 'GEN',
        gradeLevel: student.grade || 'General',
        color: '#2563EB'
      };
      candidates.push({
        student,
        subject: fallbackSub
      });
    }
  }

  // 2. Group candidates by Subject / Grade Level
  const groupMap = new Map<string, StudentToSeat[]>();
  for (const c of candidates) {
    const groupKey = `${c.subject.code}_${c.student.grade}`;
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, []);
    }
    groupMap.get(groupKey)!.push(c);
  }

  // Sort candidates inside groups (e.g., special needs first, then roll number order)
  for (const group of groupMap.values()) {
    group.sort((a, b) => {
      if (options.prioritizeSpecialNeedsFront) {
        if (a.student.specialNeeds && !b.student.specialNeeds) return -1;
        if (!a.student.specialNeeds && b.student.specialNeeds) return 1;
      }
      return a.student.rollNo.localeCompare(b.student.rollNo, undefined, { numeric: true });
    });
  }

  // Convert map to array of pools for round-robin / 50-50 splitting
  const pools = Array.from(groupMap.entries()).map(([key, list]) => ({
    key,
    list: [...list],
    subject: list[0]?.subject,
    grade: list[0]?.student.grade,
    originalCount: list.length
  }));

  // Sort pools with largest counts first
  pools.sort((a, b) => b.list.length - a.list.length);

  const roomAllocations: RoomAllocation[] = [];
  const unassignedStudents: { student: Student; subject: ExamSubject; reason: string }[] = [];
  const conflicts: ConflictWarning[] = [];

  // 3. Allocate Room by Room
  for (const room of activeRooms) {
    // If all students are already seated, break early or initialize empty room
    const totalRemainingStudents = pools.reduce((acc, p) => acc + p.list.length, 0);
    if (totalRemainingStudents === 0) {
      break;
    }

    const rows = room.rows || Math.ceil(room.capacity / (room.cols || 6));
    const cols = room.cols || Math.ceil(room.capacity / rows);
    const capacity = room.capacity;

    // Create empty seat grid
    const assignedSeats: SeatAssignment[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seatIdx = r * cols + c;
        if (seatIdx < capacity) {
          const rowLetter = String.fromCharCode(65 + r); // A, B, C, D...
          const colNum = c + 1; // 1, 2, 3...
          assignedSeats.push({
            seatIndex: seatIdx,
            row: r,
            col: c,
            seatLabel: `${rowLetter}${colNum}`
          });
        }
      }
    }

    // Determine how many students from each group to place in this room
    // User request: "if a class can accommodate 30 people... it should split like 15 students from that class and 15 from another class... if incase there is a difference... it can put 2 or 3 students of a single subject"
    const activePools = pools.filter(p => p.list.length > 0);

    if (activePools.length === 0) break;

    let roomCandidates: (StudentToSeat | null)[] = [];

    if (activePools.length === 1) {
      // Only 1 group remaining, fill as many as room allows
      const p = activePools[0];
      const takeCount = Math.min(capacity, p.list.length);
      const taken = p.list.splice(0, takeCount);
      roomCandidates = taken;
    } else {
    // Helpers to identify Grade 11 vs Grade 12
    const isXI = (grade?: string) => Boolean(grade && grade.toUpperCase().includes('XI') && !grade.toUpperCase().includes('XII'));
    const isXII = (grade?: string) => Boolean(grade && grade.toUpperCase().includes('XII'));

    const hasXI = activePools.some(p => isXI(p.grade));
    const hasXII = activePools.some(p => isXII(p.grade));

    let takenA: StudentToSeat[] = [];
    let takenB: StudentToSeat[] = [];
    const additionalLeftovers: StudentToSeat[] = [];

    if (hasXI && hasXII) {
      // Row-alternating arrangement: 11th in one row (Row 0, 2, 4...), 12th in next (Row 1, 3, 5...), 11th again
      let evenRowSeats = 0;
      let oddRowSeats = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (r * cols + c < capacity) {
            if (r % 2 === 0) evenRowSeats++;
            else oddRowSeats++;
          }
        }
      }

      const targetA = (options.strategy === 'row_alternate' || !options.strategy) ? evenRowSeats : Math.floor(capacity / 2);
      const targetB = capacity - targetA;

      // Round-robin / interleave sections across XI pools
      const xiPools = pools.filter(p => isXI(p.grade) && p.list.length > 0);
      while (takenA.length < targetA && xiPools.length > 0) {
        let addedAny = false;
        for (const p of xiPools) {
          if (takenA.length < targetA && p.list.length > 0) {
            takenA.push(p.list.shift()!);
            addedAny = true;
          }
        }
        if (!addedAny) break;
      }

      // Round-robin / interleave sections across XII pools
      const xiiPools = pools.filter(p => isXII(p.grade) && p.list.length > 0);
      while (takenB.length < targetB && xiiPools.length > 0) {
        let addedAny = false;
        for (const p of xiiPools) {
          if (takenB.length < targetB && p.list.length > 0) {
            takenB.push(p.list.shift()!);
            addedAny = true;
          }
        }
        if (!addedAny) break;
      }

      // Leftovers if either grade ran out
      let currentRoomCount = takenA.length + takenB.length;
      if (currentRoomCount < capacity) {
        for (const p of pools) {
          if (p.list.length > 0 && currentRoomCount < capacity) {
            const need = capacity - currentRoomCount;
            const take = Math.min(need, p.list.length);
            const taken = p.list.splice(0, take);
            if (isXI(p.grade)) {
              takenA.push(...taken);
            } else {
              takenB.push(...taken);
            }
            currentRoomCount += taken.length;
          }
        }
      }
    } else {
      // Fallback for single grade or multi-subject single-year groups
      const poolA = activePools[0];
      const poolB = activePools[1] || null;

      const halfCapacity = Math.floor(capacity / 2);
      const takeA = Math.min(halfCapacity, poolA.list.length);
      takenA = poolA.list.splice(0, takeA);

      if (poolB) {
        const takeB = Math.min(capacity - takeA, poolB.list.length);
        takenB = poolB.list.splice(0, takeB);
      }

      let currentRoomCount = takenA.length + takenB.length;
      if (currentRoomCount < capacity) {
        for (const p of pools) {
          if (p.list.length > 0 && currentRoomCount + additionalLeftovers.length < capacity) {
            const availableSpace = capacity - (currentRoomCount + additionalLeftovers.length);
            const takeLeftover = Math.min(availableSpace, p.list.length);
            additionalLeftovers.push(...p.list.splice(0, takeLeftover));
          }
        }
      }
    }

      // Merge and interleave candidates according to strategy
      if (options.strategy === 'checkerboard_mix' || options.strategy === 'split_50_50') {
        // Interleave takenA and takenB in alternating order (A, B, A, B...)
        const interleaved: StudentToSeat[] = [];
        const maxLen = Math.max(takenA.length, takenB.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < takenA.length) interleaved.push(takenA[i]);
          if (i < takenB.length) interleaved.push(takenB[i]);
        }
        // Append any extra leftover students
        interleaved.push(...additionalLeftovers);
        roomCandidates = interleaved;
      } else if (options.strategy === 'column_alternate') {
        const interleaved: StudentToSeat[] = [];
        let aIdx = 0;
        let bIdx = 0;
        let lIdx = 0;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            if (c % 2 === 0) {
              if (aIdx < takenA.length) interleaved.push(takenA[aIdx++]);
              else if (bIdx < takenB.length) interleaved.push(takenB[bIdx++]);
              else if (lIdx < additionalLeftovers.length) interleaved.push(additionalLeftovers[lIdx++]);
            } else {
              if (bIdx < takenB.length) interleaved.push(takenB[bIdx++]);
              else if (aIdx < takenA.length) interleaved.push(takenA[aIdx++]);
              else if (lIdx < additionalLeftovers.length) interleaved.push(additionalLeftovers[lIdx++]);
            }
          }
        }
        roomCandidates = interleaved;
      } else {
        // Multi-subject round robin
        const allGroups = [takenA, takenB, additionalLeftovers].filter(g => g.length > 0);
        const interleaved: StudentToSeat[] = [];
        let added = true;
        let index = 0;
        while (added) {
          added = false;
          for (const g of allGroups) {
            if (index < g.length) {
              interleaved.push(g[index]);
              added = true;
            }
          }
          index++;
        }
        roomCandidates = interleaved;
      }
    }

    // Assign candidates to seat slots
    // Handle special needs students first (place in row 0)
    const specialNeedsCandidates: StudentToSeat[] = [];
    const regularCandidates: StudentToSeat[] = [];

    for (const c of roomCandidates) {
      if (c && c.student.specialNeeds && options.prioritizeSpecialNeedsFront) {
        specialNeedsCandidates.push(c);
      } else if (c) {
        regularCandidates.push(c);
      }
    }

    // Place special needs in front row
    let frontSeatIdx = 0;
    for (const sn of specialNeedsCandidates) {
      while (frontSeatIdx < assignedSeats.length && assignedSeats[frontSeatIdx].studentId) {
        frontSeatIdx++;
      }
      if (frontSeatIdx < assignedSeats.length) {
        const seat = assignedSeats[frontSeatIdx];
        seat.studentId = sn.student.id;
        seat.studentRollNo = sn.student.rollNo;
        seat.studentName = sn.student.name;
        seat.studentGrade = sn.student.grade;
        seat.subjectCode = sn.subject.code;
        seat.subjectName = sn.subject.name;
        seat.subjectColor = sn.subject.color;
        seat.isSpecialNeeds = true;
      }
    }

    // Helpers to identify Grade 11 vs Grade 12
    const isXI = (grade?: string) => Boolean(grade && grade.toUpperCase().includes('XI') && !grade.toUpperCase().includes('XII'));
    const isXII = (grade?: string) => Boolean(grade && grade.toUpperCase().includes('XII'));

    // Now assign regular candidates based on pattern
    if (options.strategy === 'column_alternate') {
      // Column by column assignment (Col 0: Group A, Col 1: Group B, Col 2: Group A...)
      let candIdx = 0;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const seat = assignedSeats.find(s => s.row === r && s.col === c);
          if (seat && !seat.studentId && candIdx < regularCandidates.length) {
            const cand = regularCandidates[candIdx++];
            seat.studentId = cand.student.id;
            seat.studentRollNo = cand.student.rollNo;
            seat.studentName = cand.student.name;
            seat.studentGrade = cand.student.grade;
            seat.subjectCode = cand.subject.code;
            seat.subjectName = cand.subject.name;
            seat.subjectColor = cand.subject.color;
            seat.isSpecialNeeds = cand.student.specialNeeds;
          }
        }
      }
    } else if (options.strategy === 'row_alternate' || !options.strategy) {
      // Row by row assignment: 11th in one row (Row 0, 2, 4...), 12th in next (Row 1, 3, 5...), 11th again
      const regA = regularCandidates.filter(c => isXI(c.student.grade));
      const regB = regularCandidates.filter(c => isXII(c.student.grade));
      const otherCands = regularCandidates.filter(c => !isXI(c.student.grade) && !isXII(c.student.grade));

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seat = assignedSeats.find(s => s.row === r && s.col === c);
          if (seat && !seat.studentId) {
            let cand: StudentToSeat | undefined;
            if (r % 2 === 0) {
              cand = regA.shift() || regB.shift() || otherCands.shift();
            } else {
              cand = regB.shift() || regA.shift() || otherCands.shift();
            }
            if (cand) {
              seat.studentId = cand.student.id;
              seat.studentRollNo = cand.student.rollNo;
              seat.studentName = cand.student.name;
              seat.studentGrade = cand.student.grade;
              seat.subjectCode = cand.subject.code;
              seat.subjectName = cand.subject.name;
              seat.subjectColor = cand.subject.color;
              seat.isSpecialNeeds = cand.student.specialNeeds;
            }
          }
        }
      }
    } else {
      // Sequential or fallback alternate
      let candIdx = 0;
      for (const seat of assignedSeats) {
        if (!seat.studentId && candIdx < regularCandidates.length) {
          const cand = regularCandidates[candIdx++];
          seat.studentId = cand.student.id;
          seat.studentRollNo = cand.student.rollNo;
          seat.studentName = cand.student.name;
          seat.studentGrade = cand.student.grade;
          seat.subjectCode = cand.subject.code;
          seat.subjectName = cand.subject.name;
          seat.subjectColor = cand.subject.color;
          seat.isSpecialNeeds = cand.student.specialNeeds;
        }
      }
    }

    // Build distributions
    const gradeDist: Record<string, number> = {};
    const subDist: Record<string, number> = {};
    let assignedCount = 0;

    for (const seat of assignedSeats) {
      if (seat.studentId) {
        assignedCount++;
        if (seat.studentGrade) {
          gradeDist[seat.studentGrade] = (gradeDist[seat.studentGrade] || 0) + 1;
        }
        if (seat.subjectCode) {
          subDist[seat.subjectCode] = (subDist[seat.subjectCode] || 0) + 1;
        }
      }
    }

    // Evaluate anti-cheating neighbor conflicts in this room
    if (options.avoidAdjacentSameSubject) {
      const seatMatrix: (SeatAssignment | undefined)[][] = Array(rows).fill(null).map(() => Array(cols).fill(undefined));
      for (const seat of assignedSeats) {
        seatMatrix[seat.row][seat.col] = seat;
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seat = seatMatrix[r][c];
          if (seat && seat.subjectCode) {
            // Check adjacent seats: Left, Right, Front, Back
            const neighbors = [
              seatMatrix[r]?.[c - 1], // Left
              seatMatrix[r]?.[c + 1], // Right
              seatMatrix[r - 1]?.[c], // Front
              seatMatrix[r + 1]?.[c]  // Back
            ];

            const sameSubjectNeighbor = neighbors.find(n => {
              if (!n || !n.studentId || n.subjectCode !== seat.subjectCode) return false;
              const isNXI = Boolean(n.studentGrade?.toUpperCase().includes('XI') && !n.studentGrade?.toUpperCase().includes('XII'));
              const isSeatXI = Boolean(seat.studentGrade?.toUpperCase().includes('XI') && !seat.studentGrade?.toUpperCase().includes('XII'));
              return isNXI === isSeatXI;
            });
            if (sameSubjectNeighbor) {
              seat.hasNeighborConflict = true;
            }
          }
        }
      }
    }

    roomAllocations.push({
      roomId: room.id,
      roomName: room.name,
      building: room.building,
      floor: room.floor,
      capacity: room.capacity,
      rows,
      cols,
      benchType: room.benchType,
      assignedSeats,
      totalAssigned: assignedCount,
      gradeDistribution: gradeDist,
      subjectDistribution: subDist
    });
  }

  // 4. Check for any remaining unassigned students (overflow)
  for (const pool of pools) {
    for (const leftover of pool.list) {
      unassignedStudents.push({
        student: leftover.student,
        subject: leftover.subject,
        reason: 'Classroom capacity exhausted. Add more rooms or activate larger halls.'
      });
      conflicts.push({
        type: 'unassigned',
        severity: 'error',
        message: `Student ${leftover.student.name} (${leftover.student.rollNo}) unallocated for ${leftover.subject.name}`,
        studentId: leftover.student.id
      });
    }
  }

  // 5. Compute global statistics
  const totalAssigned = roomAllocations.reduce((acc, r) => acc + r.totalAssigned, 0);
  const totalCapacityAvailable = activeRooms.reduce((acc, r) => acc + r.capacity, 0);
  const overallUtilizationPercent = totalCapacityAvailable > 0 
    ? Math.round((totalAssigned / totalCapacityAvailable) * 100) 
    : 0;

  const mixedRoomCount = roomAllocations.filter(r => Object.keys(r.gradeDistribution).length > 1).length;
  const singleGroupRoomCount = roomAllocations.filter(r => Object.keys(r.gradeDistribution).length === 1).length;

  let totalNeighborConflicts = 0;
  for (const r of roomAllocations) {
    for (const s of r.assignedSeats) {
      if (s.studentId && s.hasNeighborConflict) {
        totalNeighborConflicts++;
      }
    }
  }

  const cheatPreventionIndex = totalAssigned > 0
    ? Math.max(0, Math.round(((totalAssigned - totalNeighborConflicts) / totalAssigned) * 100))
    : 100;

  return {
    id: `plan-${Date.now()}`,
    sessionId: session.id,
    sessionName: session.name,
    sessionDate: session.date,
    sessionTime: session.timeSlot,
    createdAt: new Date().toISOString(),
    options,
    roomAllocations,
    unassignedStudents,
    conflicts,
    stats: {
      totalStudents: candidates.length,
      totalAssigned,
      totalRoomsUsed: roomAllocations.filter(r => r.totalAssigned > 0).length,
      totalCapacityAvailable,
      overallUtilizationPercent,
      mixedRoomCount,
      singleGroupRoomCount,
      conflictCount: conflicts.length + totalNeighborConflicts,
      cheatPreventionIndex
    }
  };
}

export function resolveConflicts(plan: SeatingPlan): SeatingPlan {
  const newPlan: SeatingPlan = JSON.parse(JSON.stringify(plan));
  
  for (const room of newPlan.roomAllocations) {
    const { rows, cols, assignedSeats } = room;
    
    let madeChanges = true;
    let iterations = 0;
    while (madeChanges && iterations < 50) {
      madeChanges = false;
      iterations++;
      
      const seatMatrix: (SeatAssignment | undefined)[][] = Array(rows).fill(null).map(() => Array(cols).fill(undefined));
      for (const seat of assignedSeats) {
        seatMatrix[seat.row][seat.col] = seat;
        seat.hasNeighborConflict = false;
      }

      const conflictSeats: SeatAssignment[] = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seat = seatMatrix[r][c];
          if (seat && seat.subjectCode) {
            const neighbors = [
              seatMatrix[r]?.[c - 1], // Left
              seatMatrix[r]?.[c + 1], // Right
              seatMatrix[r - 1]?.[c], // Front
              seatMatrix[r + 1]?.[c]  // Back
            ];

            const sameSubjectNeighbor = neighbors.find(n => n && n.studentId && n.subjectCode === seat.subjectCode);
            if (sameSubjectNeighbor) {
              seat.hasNeighborConflict = true;
              if (!conflictSeats.find(s => s.seatIndex === seat.seatIndex)) {
                conflictSeats.push(seat);
              }
            }
          }
        }
      }

      if (conflictSeats.length === 0) break;

      // Swap to resolve: find a seat that is in conflict and swap with another seat of the same subject but different grade
      for (const conflictSeat of conflictSeats) {
        // We want to break the adjacency. If we swap conflictSeat with swapCandidate (same subject, different grade),
        // we might fix it if the classes are interleaved.
        const swapCandidate = assignedSeats.find(s => 
          s.studentId && 
          s.subjectCode === conflictSeat.subjectCode && 
          s.studentGrade !== conflictSeat.studentGrade &&
          s.seatIndex !== conflictSeat.seatIndex
        );

        if (swapCandidate) {
          const temp = {
            studentId: conflictSeat.studentId,
            studentRollNo: conflictSeat.studentRollNo,
            studentName: conflictSeat.studentName,
            studentGrade: conflictSeat.studentGrade,
            subjectCode: conflictSeat.subjectCode,
            subjectName: conflictSeat.subjectName,
            subjectColor: conflictSeat.subjectColor,
            isSpecialNeeds: conflictSeat.isSpecialNeeds
          };

          conflictSeat.studentId = swapCandidate.studentId;
          conflictSeat.studentRollNo = swapCandidate.studentRollNo;
          conflictSeat.studentName = swapCandidate.studentName;
          conflictSeat.studentGrade = swapCandidate.studentGrade;
          conflictSeat.subjectCode = swapCandidate.subjectCode;
          conflictSeat.subjectName = swapCandidate.subjectName;
          conflictSeat.subjectColor = swapCandidate.subjectColor;
          conflictSeat.isSpecialNeeds = swapCandidate.isSpecialNeeds;

          swapCandidate.studentId = temp.studentId;
          swapCandidate.studentRollNo = temp.studentRollNo;
          swapCandidate.studentName = temp.studentName;
          swapCandidate.studentGrade = temp.studentGrade;
          swapCandidate.subjectCode = temp.subjectCode;
          swapCandidate.subjectName = temp.subjectName;
          swapCandidate.subjectColor = temp.subjectColor;
          swapCandidate.isSpecialNeeds = temp.isSpecialNeeds;

          madeChanges = true;
          break;
        }
      }
    }
  }

  // Re-evaluate conflicts for the final plan
  newPlan.conflicts = [];
  let totalNeighborConflicts = 0;
  for (const room of newPlan.roomAllocations) {
    const { rows, cols, assignedSeats } = room;
    const seatMatrix: (SeatAssignment | undefined)[][] = Array(rows).fill(null).map(() => Array(cols).fill(undefined));
    for (const seat of assignedSeats) {
      seatMatrix[seat.row][seat.col] = seat;
      seat.hasNeighborConflict = false;
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seat = seatMatrix[r][c];
        if (seat && seat.subjectCode) {
          const neighbors = [
            seatMatrix[r]?.[c - 1],
            seatMatrix[r]?.[c + 1],
            seatMatrix[r - 1]?.[c],
            seatMatrix[r + 1]?.[c]
          ];
          const sameSubjectNeighbor = neighbors.find(n => n && n.studentId && n.subjectCode === seat.subjectCode);
          if (sameSubjectNeighbor) {
            seat.hasNeighborConflict = true;
            totalNeighborConflicts++;
          }
        }
      }
    }
  }
  
  if (totalNeighborConflicts > 0) {
    // each pair counts as 2 neighbor conflicts
    for(let i=0; i<Math.ceil(totalNeighborConflicts / 2); i++) {
        newPlan.conflicts.push({
            type: 'neighbor_conflict',
            severity: 'warning',
            message: 'Neighbor proximity detected (same subject)',
            studentId: ''
        });
    }
  }

  // Preserve unassigned students conflicts
  for (const un of newPlan.unassignedStudents) {
    newPlan.conflicts.push({
      type: 'unassigned',
      severity: 'error',
      message: `Student unallocated`,
      studentId: un.student.id
    });
  }

  return newPlan;
}
