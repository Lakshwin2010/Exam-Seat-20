from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# --- SUBJECT SCHEMAS ---
class ExamSubjectBase(BaseModel):
    code: str
    name: str
    gradeLevel: str = "General"
    color: str = "#6B705C"

class ExamSubjectCreate(ExamSubjectBase):
    id: Optional[str] = None

class ExamSubject(ExamSubjectBase):
    id: str

    class Config:
        from_attributes = True

# --- STUDENT SCHEMAS ---
class StudentBase(BaseModel):
    rollNo: str
    name: str
    grade: str
    gender: Optional[str] = "M"
    specialNeeds: Optional[bool] = False
    enrolledSubjectIds: List[str] = []

class StudentCreate(StudentBase):
    id: Optional[str] = None

class Student(StudentBase):
    id: str

    class Config:
        from_attributes = True

# --- ROOM SCHEMAS ---
class ExamRoomBase(BaseModel):
    name: str
    building: Optional[str] = "Main Academic Block"
    floor: Optional[str] = "1st Floor"
    capacity: int = 30
    rows: int = 5
    cols: int = 6
    benchType: str = "single"  # single | paired
    isActive: bool = True
    notes: Optional[str] = ""

class ExamRoomCreate(ExamRoomBase):
    id: Optional[str] = None

class ExamRoom(ExamRoomBase):
    id: str

    class Config:
        from_attributes = True

# --- SESSION SCHEMAS ---
class ExamSessionBase(BaseModel):
    name: str
    date: str  # YYYY-MM-DD
    timeSlot: str  # e.g. "09:00 AM - 12:00 PM"
    subjectIds: List[str] = []
    isLocked: Optional[bool] = False

class ExamSessionCreate(ExamSessionBase):
    id: Optional[str] = None

class ExamSession(ExamSessionBase):
    id: str

    class Config:
        from_attributes = True

# --- STUDENT MONITORING SCHEMAS ---
class StudentMonitoringRecord(BaseModel):
    id: str
    studentId: str
    studentRollNo: str
    studentName: str
    studentGrade: str
    sessionId: str
    roomId: Optional[str] = None
    roomName: Optional[str] = None
    seatLabel: Optional[str] = None
    status: str  # not_checked_in, checked_in, in_hall, completed, absent, flagged
    checkInTime: Optional[str] = None
    submissionTime: Optional[str] = None
    remarks: Optional[str] = ""
    updatedAt: Optional[str] = None

class StudentMonitoringStatusUpdate(BaseModel):
    status: str  # checked_in, in_hall, completed, absent, flagged, not_checked_in
    remarks: Optional[str] = None
    roomId: Optional[str] = None
    seatLabel: Optional[str] = None

class MonitoringIncidentCreate(BaseModel):
    sessionId: str
    studentId: Optional[str] = None
    roomId: Optional[str] = None
    incidentType: str
    severity: str = "medium"
    description: str
    reportedBy: str = "Invigilator"
    actionTaken: Optional[str] = ""

class MonitoringIncidentOut(BaseModel):
    id: str
    sessionId: str
    studentId: Optional[str] = None
    studentName: Optional[str] = None
    studentRollNo: Optional[str] = None
    roomId: Optional[str] = None
    roomName: Optional[str] = None
    incidentType: str
    severity: str
    description: str
    reportedBy: str
    actionTaken: Optional[str]
    timestamp: str

class MonitoringDashboardStats(BaseModel):
    totalStudents: int
    totalCheckedIn: int
    totalInHall: int
    totalCompleted: int
    totalAbsent: int
    totalFlagged: int
    attendanceRate: float
    roomBreakdown: List[Dict[str, Any]]
    recentIncidents: List[MonitoringIncidentOut]

# --- ALLOCATION SCHEMAS ---
class AllocationOptions(BaseModel):
    strategy: str = "column_alternate"  # column_alternate
    leftoverHandling: str = "distribute_evenly"
    avoidAdjacentSameSubject: bool = True
    benchPartnerDifferentGroup: bool = True
    prioritizeSpecialNeedsFront: bool = True
    targetMaxPerGroupInRoom: Optional[int] = None
    customGradePairs: Optional[List[List[str]]] = None

class SeatAssignment(BaseModel):
    seatIndex: int
    row: int
    col: int
    seatLabel: str
    studentId: Optional[str] = None
    studentRollNo: Optional[str] = None
    studentName: Optional[str] = None
    studentGrade: Optional[str] = None
    subjectCode: Optional[str] = None
    subjectName: Optional[str] = None
    subjectColor: Optional[str] = None
    isSpecialNeeds: Optional[bool] = False
    hasNeighborConflict: Optional[bool] = False

class RoomAllocation(BaseModel):
    roomId: str
    roomName: str
    building: Optional[str] = ""
    floor: Optional[str] = ""
    capacity: int
    rows: int
    cols: int
    benchType: str
    assignedSeats: List[SeatAssignment]
    totalAssigned: int
    gradeDistribution: Dict[str, int]
    subjectDistribution: Dict[str, int]
    invigilator: Optional[str] = ""

class ConflictWarning(BaseModel):
    type: str
    severity: str
    message: str
    roomId: Optional[str] = None
    studentId: Optional[str] = None
    seatLabel: Optional[str] = None

class SeatingPlanStats(BaseModel):
    totalStudents: int
    totalAssigned: int
    totalRoomsUsed: int
    totalCapacityAvailable: int
    overallUtilizationPercent: float
    mixedRoomCount: int
    singleGroupRoomCount: int
    conflictCount: int
    cheatPreventionIndex: float

class UnassignedStudent(BaseModel):
    student: Student
    subject: ExamSubject
    reason: str

class SeatingPlan(BaseModel):
    id: str
    sessionId: str
    sessionName: str
    sessionDate: str
    sessionTime: str
    createdAt: str
    options: AllocationOptions
    roomAllocations: List[RoomAllocation]
    unassignedStudents: List[UnassignedStudent]
    conflicts: List[ConflictWarning]
    stats: SeatingPlanStats

class SeatSwapRequest(BaseModel):
    sessionId: str
    sourceRoomId: str
    sourceSeatIdx: int
    targetRoomId: str
    targetSeatIdx: int

# --- SOURCE FILE SCHEMAS ---
class SourceFileSummary(BaseModel):
    fileName: str
    filePath: str
    fileSizeBytes: int
    modifiedTime: str
    sheets: List[str]
    detectedTypes: List[str]
    recordsCount: Dict[str, int]
    status: str
    message: Optional[str] = None
