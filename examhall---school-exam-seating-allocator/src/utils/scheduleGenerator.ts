import { Student, ExamSubject, ExamSession } from '../types';

export function generateAutoSchedule(
  students: Student[],
  subjects: ExamSubject[]
): ExamSession[] {
  const sessions: ExamSession[] = [];
  let dayOffset = 1;

  const today = new Date();
  const getNextDate = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };

  // 1. Identify English
  const englishSub = subjects.find(s => s.code.includes('ENG') || s.name.toUpperCase().includes('ENGLISH'));
  if (englishSub) {
    sessions.push({
      id: `session-eng-${Date.now()}`,
      name: 'Periodic Assessment English',
      date: getNextDate(dayOffset++),
      timeSlot: '09:00 AM - 12:00 PM',
      subjectIds: [englishSub.id]
    });
  }

  // 2. Identify Skill Subjects to exclude
  const SKILL_CODES = ['BA', 'DS', 'FN', 'FND'];
  const excludedSubjectIds = new Set<string>();
  if (englishSub) excludedSubjectIds.add(englishSub.id);
  subjects.forEach(s => {
    if (SKILL_CODES.includes(s.code.toUpperCase())) {
      excludedSubjectIds.add(s.id);
    }
  });

  // 3. Build Conflict Graph for remaining subjects
  const coreSubjectIds = subjects.filter(s => !excludedSubjectIds.has(s.id)).map(s => s.id);
  
  // Adjacency list: subjectId -> Set of conflicting subjectIds
  const graph = new Map<string, Set<string>>();
  coreSubjectIds.forEach(id => graph.set(id, new Set()));

  students.forEach(student => {
    const studentCoreSubs = student.enrolledSubjectIds.filter(id => coreSubjectIds.includes(id));
    for (let i = 0; i < studentCoreSubs.length; i++) {
      for (let j = i + 1; j < studentCoreSubs.length; j++) {
        graph.get(studentCoreSubs[i])!.add(studentCoreSubs[j]);
        graph.get(studentCoreSubs[j])!.add(studentCoreSubs[i]);
      }
    }
  });

  // 4. Greedy Graph Coloring (Try to fit into 4 colors)
  // Sort nodes by degree (most conflicts first)
  const sortedNodes = [...coreSubjectIds].sort((a, b) => graph.get(b)!.size - graph.get(a)!.size);
  
  const colors = new Map<string, number>();
  let maxColor = -1;

  for (const node of sortedNodes) {
    const neighborColors = new Set<number>();
    graph.get(node)!.forEach(neighbor => {
      if (colors.has(neighbor)) {
        neighborColors.add(colors.get(neighbor)!);
      }
    });

    let color = 0;
    while (neighborColors.has(color)) {
      color++;
    }
    colors.set(node, color);
    maxColor = Math.max(maxColor, color);
  }

  // Group subjects by color
  const groupedSubjects = new Map<number, string[]>();
  for (const [node, color] of colors.entries()) {
    if (!groupedSubjects.has(color)) {
      groupedSubjects.set(color, []);
    }
    groupedSubjects.get(color)!.push(node);
  }

  // Create sessions for each color group
  for (let c = 0; c <= maxColor; c++) {
    const subs = groupedSubjects.get(c) || [];
    if (subs.length > 0) {
      const subjectNames = subs.map(id => subjects.find(s => s.id === id)?.code || '').join(', ');
      sessions.push({
        id: `session-core-${c}-${Date.now()}`,
        name: `Core Exams - Day ${c + 1} (${subjectNames})`,
        date: getNextDate(dayOffset++),
        timeSlot: '09:00 AM - 12:00 PM',
        subjectIds: subs
      });
    }
  }

  return sessions;
}
