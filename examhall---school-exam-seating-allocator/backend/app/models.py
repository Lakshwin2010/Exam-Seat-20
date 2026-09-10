import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    Table,
    Text
)
from sqlalchemy.orm import relationship
from app.database import Base

# Association table: Student <-> Subject
student_subject_assoc = Table(
    "student_subjects",
    Base.metadata,
    Column("student_id", String, ForeignKey("students.id", ondelete="CASCADE"), primary_key=True),
    Column("subject_id", String, ForeignKey("subjects.id", ondelete="CASCADE"), primary_key=True)
)

# Association table: ExamSession <-> Subject
session_subject_assoc = Table(
    "session_subjects",
    Base.metadata,
    Column("session_id", String, ForeignKey("exam_sessions.id", ondelete="CASCADE"), primary_key=True),
    Column("subject_id", String, ForeignKey("subjects.id", ondelete="CASCADE"), primary_key=True)
)

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(String, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    grade_level = Column(String, default="General")
    color = Column(String, default="#6B705C")

    students = relationship("Student", secondary=student_subject_assoc, back_populates="enrolled_subjects")
    sessions = relationship("ExamSession", secondary=session_subject_assoc, back_populates="subjects")

class Student(Base):
    __tablename__ = "students"

    id = Column(String, primary_key=True, index=True)
    roll_no = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False, index=True)
    grade = Column(String, nullable=False, index=True)
    gender = Column(String, default="M")
    special_needs = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    enrolled_subjects = relationship("Subject", secondary=student_subject_assoc, back_populates="students")
    monitoring_records = relationship("StudentMonitoring", back_populates="student", cascade="all, delete-orphan")
    allocations = relationship("SeatAllocation", back_populates="student")

class ExamRoom(Base):
    __tablename__ = "exam_rooms"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    building = Column(String, default="Main Academic Block")
    floor = Column(String, default="1st Floor")
    capacity = Column(Integer, default=30)
    rows = Column(Integer, default=5)
    cols = Column(Integer, default=6)
    bench_type = Column(String, default="single")  # "single" | "paired"
    is_active = Column(Boolean, default=True)
    notes = Column(Text, default="")

    allocations = relationship("SeatAllocation", back_populates="room", cascade="all, delete-orphan")

class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    date = Column(String, nullable=False)  # YYYY-MM-DD
    time_slot = Column(String, nullable=False)  # e.g. "09:00 AM - 12:00 PM"
    is_locked = Column(Boolean, default=False)

    subjects = relationship("Subject", secondary=session_subject_assoc, back_populates="sessions")
    allocations = relationship("SeatAllocation", back_populates="session", cascade="all, delete-orphan")
    monitoring_records = relationship("StudentMonitoring", back_populates="session", cascade="all, delete-orphan")

class SeatAllocation(Base):
    __tablename__ = "seat_allocations"

    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("exam_sessions.id", ondelete="CASCADE"), index=True, nullable=False)
    room_id = Column(String, ForeignKey("exam_rooms.id", ondelete="CASCADE"), index=True, nullable=False)
    seat_index = Column(Integer, nullable=False)
    row = Column(Integer, nullable=False)
    col = Column(Integer, nullable=False)
    seat_label = Column(String, nullable=False)  # e.g. "A1"
    student_id = Column(String, ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True)
    subject_id = Column(String, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    neighbor_conflict = Column(Boolean, default=False)
    is_special_needs = Column(Boolean, default=False)

    session = relationship("ExamSession", back_populates="allocations")
    room = relationship("ExamRoom", back_populates="allocations")
    student = relationship("Student", back_populates="allocations")
    subject = relationship("Subject")

class StudentMonitoring(Base):
    __tablename__ = "student_monitoring"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False)
    session_id = Column(String, ForeignKey("exam_sessions.id", ondelete="CASCADE"), index=True, nullable=False)
    room_id = Column(String, ForeignKey("exam_rooms.id", ondelete="SET NULL"), nullable=True)
    seat_label = Column(String, nullable=True)
    
    # Status: not_checked_in, checked_in, in_hall, completed, absent, flagged
    status = Column(String, default="not_checked_in", index=True)
    check_in_time = Column(DateTime, nullable=True)
    submission_time = Column(DateTime, nullable=True)
    remarks = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    student = relationship("Student", back_populates="monitoring_records")
    session = relationship("ExamSession", back_populates="monitoring_records")
    room = relationship("ExamRoom")

class MonitoringIncident(Base):
    __tablename__ = "monitoring_incidents"

    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("exam_sessions.id", ondelete="CASCADE"), index=True, nullable=False)
    student_id = Column(String, ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True)
    room_id = Column(String, ForeignKey("exam_rooms.id", ondelete="SET NULL"), nullable=True)
    incident_type = Column(String, nullable=False)  # malpractice, unapproved_material, seat_violation, medical, etc.
    severity = Column(String, default="medium")     # info, low, medium, high, critical
    description = Column(Text, nullable=False)
    reported_by = Column(String, default="Invigilator")
    action_taken = Column(String, default="")
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
