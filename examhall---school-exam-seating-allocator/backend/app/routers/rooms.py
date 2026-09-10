from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/rooms", tags=["rooms"])

@router.get("", response_model=List[schemas.ExamRoom])
def list_rooms(db: Session = Depends(get_db)):
    rooms = db.query(models.ExamRoom).all()
    results = []
    for r in rooms:
        results.append(schemas.ExamRoom(
            id=r.id,
            name=r.name,
            building=r.building or "Main Academic Block",
            floor=r.floor or "1st Floor",
            capacity=r.capacity,
            rows=r.rows,
            cols=r.cols,
            benchType=r.bench_type,
            isActive=r.is_active,
            notes=r.notes or ""
        ))
    return results

@router.post("", response_model=schemas.ExamRoom)
def create_room(data: schemas.ExamRoomCreate, db: Session = Depends(get_db)):
    room_id = data.id or f"room-{data.name.lower().replace(' ', '-')}"
    existing = db.query(models.ExamRoom).filter(models.ExamRoom.id == room_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Room '{data.name}' already exists.")

    new_room = models.ExamRoom(
        id=room_id,
        name=data.name,
        building=data.building or "Main Academic Block",
        floor=data.floor or "1st Floor",
        capacity=data.capacity,
        rows=data.rows,
        cols=data.cols,
        bench_type=data.benchType,
        is_active=data.isActive,
        notes=data.notes or ""
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)

    return schemas.ExamRoom(
        id=new_room.id,
        name=new_room.name,
        building=new_room.building,
        floor=new_room.floor,
        capacity=new_room.capacity,
        rows=new_room.rows,
        cols=new_room.cols,
        benchType=new_room.bench_type,
        isActive=new_room.is_active,
        notes=new_room.notes or ""
    )

@router.put("/{room_id}", response_model=schemas.ExamRoom)
def update_room(room_id: str, data: schemas.ExamRoomCreate, db: Session = Depends(get_db)):
    room = db.query(models.ExamRoom).filter(models.ExamRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    room.name = data.name
    room.building = data.building or room.building
    room.floor = data.floor or room.floor
    room.capacity = data.capacity
    room.rows = data.rows
    room.cols = data.cols
    room.bench_type = data.benchType
    room.is_active = data.isActive
    room.notes = data.notes or ""

    db.commit()
    db.refresh(room)

    return schemas.ExamRoom(
        id=room.id,
        name=room.name,
        building=room.building,
        floor=room.floor,
        capacity=room.capacity,
        rows=room.rows,
        cols=room.cols,
        benchType=room.bench_type,
        isActive=room.is_active,
        notes=room.notes or ""
    )

@router.delete("/{room_id}")
def delete_room(room_id: str, db: Session = Depends(get_db)):
    room = db.query(models.ExamRoom).filter(models.ExamRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    db.delete(room)
    db.commit()
    return {"status": "success", "message": f"Room {room_id} deleted."}
