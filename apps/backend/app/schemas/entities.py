from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID


class EntityBase(BaseModel):
    name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    main_group_id: Optional[UUID] = None
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None


class EntityCreate(EntityBase):
    is_current_user: bool = False
    groups_in: List[UUID] = []
    connected_people: List[UUID] = []


class EntityUpdate(BaseModel):
    name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    main_group_id: Optional[UUID] = None
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None
    is_current_user: Optional[bool] = None
    groups_in: Optional[List[UUID]] = None
    connected_people: Optional[List[UUID]] = None


class EntityRead(EntityBase):
    id: UUID
    is_current_user: bool

    class Config:
        from_attributes = True
