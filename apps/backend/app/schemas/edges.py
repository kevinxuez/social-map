from pydantic import BaseModel
from uuid import UUID
from typing import Optional
from datetime import datetime


class EdgeCreate(BaseModel):
	a_entity_id: UUID
	b_entity_id: UUID
	label: Optional[str] = None


class EdgeRead(BaseModel):
	id: UUID
	a_entity_id: UUID
	b_entity_id: UUID
	label: Optional[str] = None
	created_at: datetime

	class Config:
		from_attributes = True
