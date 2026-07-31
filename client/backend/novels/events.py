import json
import time
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from models.event import Event


def log_event(db: Session, user_id: str, event_type: str, payload: dict | None = None):
    entry = Event(
        id=f"{int(time.time() * 1000)}_{user_id}",
        user_id=user_id,
        event_type=event_type,
        payload=json.dumps(payload or {}, ensure_ascii=False),
        created_at=datetime.now(UTC).isoformat(),
    )
    db.add(entry)
    db.commit()
