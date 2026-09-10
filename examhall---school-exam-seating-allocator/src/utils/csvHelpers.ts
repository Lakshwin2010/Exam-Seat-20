import { ExamRoom, Student, ExamSubject, SeatingPlan } from '../types';

export function exportSeatingPlanToCSV(plan: SeatingPlan): string {
  const headers = ['Room Name', 'Building', 'Floor', 'Seat Number', 'Roll Number', 'Student Name', 'Class/Grade', 'Subject Code', 'Subject Name', 'Session Date', 'Time Slot'];
  const rows: string[][] = [headers];

  for (const room of plan.roomAllocations) {
    for (const seat of room.assignedSeats) {
      if (seat.studentId) {
        rows.push([
          `"${room.roomName}"`,
          `"${room.building || ''}"`,
          `"${room.floor || ''}"`,
          `"${seat.seatLabel}"`,
          `"${seat.studentRollNo || ''}"`,
          `"${seat.studentName || ''}"`,
          `"${seat.studentGrade || ''}"`,
          `"${seat.subjectCode || ''}"`,
          `"${seat.subjectName || ''}"`,
          `"${plan.sessionDate}"`,
          `"${plan.sessionTime}"`
        ]);
      }
    }
  }

  return rows.map(r => r.join(',')).join('\n');
}

export function exportStudentsTemplate(): string {
  return [
    'Roll Number,Student Name,Grade/Class,Enrolled Subject Codes (comma separated),Special Needs (Yes/No)',
    '10A-01,Aarav Sharma,Grade 10-A,MATH-10;ENG-10,Yes',
    '10A-02,Aditi Rao,Grade 10-A,MATH-10;ENG-10,No',
    '12S-01,Alexander Wright,Grade 12-Science,PHYS-12;CHEM-12,No'
  ].join('\n');
}

export function exportRoomsTemplate(): string {
  return [
    'Room Name,Building,Floor,Capacity,Rows,Columns,Bench Type (single/paired),Active (Yes/No)',
    'Room 101,Main Block,1st Floor,30,5,6,single,Yes',
    'Room 102,Main Block,1st Floor,30,5,6,single,Yes',
    'Senior Hall A,Science Wing,Ground Floor,40,5,8,paired,Yes'
  ].join('\n');
}

export function parseStudentsCSV(csvText: string, availableSubjects: ExamSubject[]): Student[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  const subjectCodeToId = new Map<string, string>();
  for (const s of availableSubjects) {
    subjectCodeToId.set(s.code.toUpperCase(), s.id);
  }

  const parsedStudents: Student[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Split on comma ignoring quotes
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 3) {
      const rollNo = cols[0];
      const name = cols[1];
      const grade = cols[2];
      const rawSubjects = cols[3] ? cols[3].split(/[;,|]/).map(s => s.trim().toUpperCase()) : [];
      const specialNeeds = cols[4] ? ['yes', 'true', '1', 'y'].includes(cols[4].toLowerCase()) : false;

      const enrolledSubjectIds = rawSubjects
        .map(code => subjectCodeToId.get(code))
        .filter((id): id is string => Boolean(id));

      if (rollNo && name) {
        parsedStudents.push({
          id: `stud-${Date.now()}-${i}`,
          rollNo,
          name,
          grade: grade || 'General',
          specialNeeds,
          enrolledSubjectIds: enrolledSubjectIds.length > 0 
            ? enrolledSubjectIds 
            : (availableSubjects[0] ? [availableSubjects[0].id] : [])
        });
      }
    }
  }

  return parsedStudents;
}

export function parseRoomsCSV(csvText: string): ExamRoom[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  const parsedRooms: ExamRoom[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 4) {
      const name = cols[0];
      const building = cols[1] || 'Main Academic Block';
      const floor = cols[2] || '1st Floor';
      const capacity = parseInt(cols[3], 10) || 30;
      const rows = parseInt(cols[4], 10) || Math.ceil(capacity / 6);
      const colsCount = parseInt(cols[5], 10) || Math.ceil(capacity / rows);
      const benchType = cols[6]?.toLowerCase() === 'paired' ? 'paired' : 'single';
      const isActive = cols[7] ? !['no', 'false', '0', 'n'].includes(cols[7].toLowerCase()) : true;

      if (name) {
        parsedRooms.push({
          id: `room-${Date.now()}-${i}`,
          name,
          building,
          floor,
          capacity,
          rows,
          cols: colsCount,
          benchType,
          isActive
        });
      }
    }
  }

  return parsedRooms;
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
