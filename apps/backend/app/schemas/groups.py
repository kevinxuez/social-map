from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class GroupBase(BaseModel):
	name: str
	description: Optional[str] = None
	color_hex: Optional[str] = None
	parent_group_id: Optional[UUID] = None


class GroupCreate(GroupBase):
	pass


class GroupUpdate(BaseModel):
	name: Optional[str] = None
	description: Optional[str] = None
	color_hex: Optional[str] = None
	parent_group_id: Optional[UUID] = None


class GroupRead(GroupBase):
	id: UUID

	class Config:
		from_attributes = True
