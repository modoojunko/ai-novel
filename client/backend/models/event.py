from sqlalchemy import Column, String, Text

from db import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    event_type = Column(String, nullable=False)
    payload = Column(Text, default="{}")
    created_at = Column(String, nullable=False)
