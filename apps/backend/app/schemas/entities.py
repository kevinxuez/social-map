from pydantic import BaseModel
from typing import Dict

class EntityCreate(BaseModel):
    type: str
    name: str
    attributes: Dict = {}

class EntityOut(BaseModel):
    id: int
    type: str
    name: str
    attributes: Dict
    class Config:
        from_attributes = True
