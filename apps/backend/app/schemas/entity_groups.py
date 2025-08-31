from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class EntityGroupCreate(BaseModel):
	entity_id: UUID
	group_id: UUID


class EntityGroupRead(BaseModel):
	entity_id: UUID
	group_id: UUID
	joined_at: datetime | None = None

	class Config:
		from_attributes = True
