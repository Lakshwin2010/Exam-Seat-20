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

  // Helpers to identify Grade 11 vs Grade 12 and extract section keys
  const extractSectionKey = (g: string) => {
    const parts = (g || '').replace(/-/g, ' ').split(/\s+/).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const pClean = parts[i].trim().toUpperCase();
      if (pClean && !['XI', 'XII', 'GRADE', 'CLASS', 'SECTION'].includes(pClean)) {
        return pClean;
      }
    }
    return (g || '').trim().toUpperCase();
  };

  // 2. Group candidates strictly by Section (e.g. XI - A, XI - B, XII - A, XII - B...)
  const sectionMap = new Map<string, StudentToSeat[]>();
  for (const c of candidates) {
    const secName = c.student.grade || 'General';
    if (!sectionMap.has(secName)) {
      sectionMap.set(secName, []);
    }
    sectionMap.get(secName)!.push(c);
  }

  // Sort candidates inside each section (special needs first, then roll number)
  for (const group of sectionMap.values()) {
    group.sort((a, b) => {
      if (options.prioritizeSpecialNeedsFront) {
        if (a.student.specialNeeds && !b.student.specialNeeds) return -1;
        if (!a.student.specialNeeds && b.student.specialNeeds) return 1;
      }
      return a.student.rollNo.localeCompare(b.student.rollNo, undefined, { numeric: true });
    });
  }

  interface SectionPool {
    section: string;
    sectionKey: string;
    list: StudentToSeat[];
    originalCount: number;
    subject: ExamSubject;
    grade: string;
  }

  const xiPools: SectionPool[] = [];
  const xiiPools: SectionPool[] = [];
  const otherPools: SectionPool[] = [];

  for (const [secName, members] of sectionMap.entries()) {
    const poolItem: SectionPool = {
      section: secName,
      sectionKey: extractSectionKey(secName),
      list: [...members],
      originalCount: members.length,
      subject: members[0].subject,
      grade: secName
    };
    if (isXI(secName)) {
      xiPools.push(poolItem);
    } else if (isXII(secName)) {
      xiiPools.push(poolItem);
    } else {
      otherPools.push(poolItem);
    }
  }

  // Sort section pools alphabetically by section key (A, B, C...)
  xiPools.sort((a, b) => a.sectionKey.localeCompare(b.sectionKey) || a.section.localeCompare(b.section));
  xiiPools.sort((a, b) => a.sectionKey.localeCompare(b.sectionKey) || a.section.localeCompare(b.section));

  // Build matched section pairs (XI-A with XII-A, XI-B with XII-B, etc.)
  // Special coordination for Senior Secondary Commerce wing (XI-G, XI-H, XII-G):
  // XI-H is paired across Room XII-G (with XII-G) and Room XI-H (with XI-G) to ensure XI-H students are 100% mixed!
  const pXIH = xiPools.find(p => p.sectionKey === 'H');
  const pXIG = xiPools.find(p => p.sectionKey === 'G');
  const pXIIG = xiiPools.find(p => p.sectionKey === 'G');

  const pairedList: Array<{ xiPool: SectionPool | null; xiiPool: SectionPool | null }> = [];
  const unmatchedXII = [...xiiPools];

  for (const pXI of xiPools) {
    if (pXI.sectionKey === 'H') {
      continue; // Handled in coordinated G/H cluster below
    }

    if (pXI.sectionKey === 'G' && pXIH && pXIIG) {
      const gIdx = unmatchedXII.findIndex(p => p.sectionKey === 'G');
      if (gIdx !== -1) unmatchedXII.splice(gIdx, 1);

      const halfGXI = Math.ceil(pXIG.list.length / 2);
      const halfGXII = Math.ceil(pXIIG.list.length / 2);
      const halfHXI = halfGXII > 0 ? Math.min(halfGXII, pXIH.list.length) : Math.ceil(pXIH.list.length / 2);

      const xiGHalf1: SectionPool = { ...pXIG, list: pXIG.list.slice(0, halfGXI), originalCount: halfGXI };
      const xiGHalf2: SectionPool = { ...pXIG, list: pXIG.list.slice(halfGXI), originalCount: pXIG.list.length - halfGXI };

      const xiiGHalf1: SectionPool = { ...pXIIG, list: pXIIG.list.slice(0, halfGXII), originalCount: halfGXII };
      const xiiGHalf2: SectionPool = { ...pXIIG, list: pXIIG.list.slice(halfGXII), originalCount: pXIIG.list.length - halfGXII };

      const xiHHalf1: SectionPool = { ...pXIH, list: pXIH.list.slice(0, halfHXI), originalCount: halfHXI };
      const xiHHalf2: SectionPool = { ...pXIH, list: pXIH.list.slice(halfHXI), originalCount: pXIH.list.length - halfHXI };

      // 1. Room XI-G gets (XI-G half 1, XII-G half 1) -> 16 XI-G & 16 XII-G
      pairedList.push({ xiPool: xiGHalf1, xiiPool: xiiGHalf1 });
      // 2. Room XII-G gets (XI-H half 1, XII-G half 2) -> 16 XI-H & 16 XII-G
      pairedList.push({ xiPool: xiHHalf1, xiiPool: xiiGHalf2 });
      // 3. Room XI-H gets (XI-H half 2, XI-G half 2) -> 17 XI-H & 16 XI-G
      pairedList.push({ xiPool: xiHHalf2, xiiPool: xiGHalf2 });
      continue;
    }

    const matchIdx = unmatchedXII.findIndex(p => p.sectionKey === pXI.sectionKey);
    if (matchIdx !== -1) {
      const matchXII = unmatchedXII.splice(matchIdx, 1)[0];
      pairedList.push({ xiPool: pXI, xiiPool: matchXII });
    } else {
      if (unmatchedXII.length > 0) {
        pairedList.push({ xiPool: pXI, xiiPool: unmatchedXII.shift()! });
      } else {
        pairedList.push({ xiPool: pXI, xiiPool: null });
      }
    }
  }

  for (const pXII of unmatchedXII) {
    pairedList.push({ xiPool: null, xiiPool: pXII });
  }

  for (const pOth of otherPools) {
    pairedList.push({ xiPool: pOth, xiiPool: null });
  }

  const allSectionPools = [...xiPools, ...xiiPools, ...otherPools];
  const pools = allSectionPools;

  const roomAllocations: RoomAllocation[] = [];
  const unassignedStudents: { student: Student; subject: ExamSubject; reason: string }[] = [];
  const conflicts: ConflictWarning[] = [];

  // Order active rooms so matching section rooms are paired together (XI - A, XII - A, XI - B, XII - B...)
  const roomsBySec = new Map<string, ExamRoom[]>();
  const genericRooms: ExamRoom[] = [];

  for (const r of activeRooms) {
    const rSec = extractSectionKey(r.name);
    if (isXI(r.name) || isXII(r.name)) {
      if (!roomsBySec.has(rSec)) {
        roomsBySec.set(rSec, []);
      }
      roomsBySec.get(rSec)!.push(r);
    } else {
      genericRooms.push(r);
    }
  }

  const orderedRooms: ExamRoom[] = [];
  const sortedSecKeys = Array.from(roomsBySec.keys()).sort();
  for (const sk of sortedSecKeys) {
    const secRooms = roomsBySec.get(sk)!;
    secRooms.sort((a, b) => {
      const aIsXI = isXI(a.name) ? 0 : 1;
      const bIsXI = isXI(b.name) ? 0 : 1;
      return aIsXI - bIsXI || a.name.localeCompare(b.name);
    });
    orderedRooms.push(...secRooms);
  }
  orderedRooms.push(...genericRooms);

  const finalRooms = orderedRooms.length > 0 ? orderedRooms : activeRooms;

  // 3. Allocate Room by Room: strictly 1 section of Class 11 and 1 section of Class 12 per room
  let currentPairIdx = 0;

  for (const room of finalRooms) {
    while (currentPairIdx < pairedList.length) {
      const pair = pairedList[currentPairIdx];
      const remA = pair.xiPool ? pair.xiPool.list.length : 0;
      const remB = pair.xiiPool ? pair.xiiPool.list.length : 0;
      if (remA > 0 || remB > 0) break;
      currentPairIdx++;
    }

    if (currentPairIdx >= pairedList.length) break;

    const curPair = pairedList[currentPairIdx];
    const curXIPool = curPair.xiPool;
    const curXIIPool = curPair.xiiPool;

    const rows = room.rows || Math.ceil(room.capacity / (room.cols || 6));
    const cols = room.cols || Math.ceil(room.capacity / rows);
    const capacity = room.capacity;

    // Create empty seat grid
    const assignedSeats: SeatAssignment[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seatIdx = r * cols + c;
        if (seatIdx < capacity) {
          const rowLetter = String.fromCharCode(65 + r);
          const colNum = c + 1;
          assignedSeats.push({
            seatIndex: seatIdx,
            row: r,
            col: c,
            seatLabel: `${rowLetter}${colNum}`
          });
        }
      }
    }

    let takenA: StudentToSeat[] = [];
    let takenB: StudentToSeat[] = [];

    const hasXIInPair = Boolean(curXIPool && curXIPool.list.length > 0);
    const hasXIIInPair = Boolean(curXIIPool && curXIIPool.list.length > 0);

    if (hasXIInPair && hasXIIInPair) {
      // 50/50 seat split: 15 Class 11 and 15 Class 12 for a 30-capacity room
      const targetA = Math.ceil(capacity / 2);
      const targetB = capacity - targetA;

      const takeA = Math.min(targetA, curXIPool!.list.length);
      takenA = curXIPool!.list.splice(0, takeA);

      const takeB = Math.min(targetB, curXIIPool!.list.length);
      takenB = curXIIPool!.list.splice(0, takeB);

      let remCapacity = capacity - (takenA.length + takenB.length);
      if (remCapacity > 0 && curXIPool!.list.length > 0) {
        const extraA = Math.min(remCapacity, curXIPool!.list.length);
        takenA.push(...curXIPool!.list.splice(0, extraA));
        remCapacity = capacity - (takenA.length + takenB.length);
      }
      if (remCapacity > 0 && curXIIPool!.list.length > 0) {
        const extraB = Math.min(remCapacity, curXIIPool!.list.length);
        takenB.push(...curXIIPool!.list.splice(0, extraB));
      }
    } else if (hasXIInPair) {
      const takeA = Math.min(capacity, curXIPool!.list.length);
      takenA = curXIPool!.list.splice(0, takeA);
    } else if (hasXIIInPair) {
      const takeB = Math.min(capacity, curXIIPool!.list.length);
      takenB = curXIIPool!.list.splice(0, takeB);
    }

    // In case there are a few extra tables, put a few students of another class also
    let remTables = capacity - (takenA.length + takenB.length);
    if (remTables > 0) {
      for (let nextPairIdx = currentPairIdx + 1; nextPairIdx < pairedList.length; nextPairIdx++) {
        if (remTables <= 0) break;
        const nxtPair = pairedList[nextPairIdx];
        const nxtXI = nxtPair.xiPool;
        const nxtXII = nxtPair.xiiPool;

        if (remTables > 0 && nxtXI && nxtXI.list.length > 0) {
          const halfRem = (nxtXII && nxtXII.list.length > 0) ? Math.ceil(remTables / 2) : remTables;
          const takeNxtA = Math.min(halfRem, nxtXI.list.length);
          takenA.push(...nxtXI.list.splice(0, takeNxtA));
          remTables = capacity - (takenA.length + takenB.length);
        }

        if (remTables > 0 && nxtXII && nxtXII.list.length > 0) {
          const takeNxtB = Math.min(remTables, nxtXII.list.length);
          takenB.push(...nxtXII.list.splice(0, takeNxtB));
          remTables = capacity - (takenA.length + takenB.length);
        }
      }
    }

    const roomStudentsToSeat = [...takenA, ...takenB];
    const frontStudents = roomStudentsToSeat.filter(s => s.student.specialNeeds && options.prioritizeSpecialNeedsFront);
    const regularA = takenA.filter(s => !(s.student.specialNeeds && options.prioritizeSpecialNeedsFront));
    const regularB = takenB.filter(s => !(s.student.specialNeeds && options.prioritizeSpecialNeedsFront));

    // Place special needs in front row
    let frontIdx = 0;
    for (let c = 0; c < cols; c++) {
      if (frontIdx < frontStudents.length && c < capacity) {
        const seat = assignedSeats.find(s => s.row === 0 && s.col === c);
        if (seat) {
          const sn = frontStudents[frontIdx++];
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
    }

    // Fill remaining regular seats
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seat = assignedSeats.find(s => s.row === r && s.col === c);
        if (!seat || seat.studentId) continue;

        let isSlotA: boolean;
        if (options.strategy === 'column_alternate') {
          isSlotA = (c % 2 === 0);
        } else if (options.strategy === 'row_alternate') {
          isSlotA = (r % 2 === 0);
        } else {
          // Default / checkerboard / split_50_50
          isSlotA = ((r + c) % 2 === 0);
        }

        const chosen = isSlotA
          ? (regularA.shift() || regularB.shift())
          : (regularB.shift() || regularA.shift());

        if (chosen) {
          seat.studentId = chosen.student.id;
          seat.studentRollNo = chosen.student.rollNo;
          seat.studentName = chosen.student.name;
          seat.studentGrade = chosen.student.grade;
          seat.subjectCode = chosen.subject.code;
          seat.subjectName = chosen.subject.name;
          seat.subjectColor = chosen.subject.color;
          seat.isSpecialNeeds = chosen.student.specialNeeds;
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
