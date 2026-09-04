import os
import json
import uuid
import qrcode
import io
import base64
from datetime import datetime
from typing import List, Dict, Any, Optional

class EventService:
    def __init__(self, data_file_path: str):
        self.data_file_path = data_file_path
        os.makedirs(os.path.dirname(data_file_path), exist_ok=True)
        self.events: Dict[str, Dict[str, Any]] = {}
        self._load()

    def _load(self):
        if os.path.exists(self.data_file_path):
            try:
                with open(self.data_file_path, "r", encoding="utf-8") as f:
                    self.events = json.load(f)
            except Exception as e:
                print(f"Error loading events data: {e}")
                self.events = {}
        else:
            self.events = {}

    def _save(self):
        try:
            with open(self.data_file_path, "w", encoding="utf-8") as f:
                json.dump(self.events, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving events data: {e}")

    def list_events(self) -> List[Dict[str, Any]]:
        # Return summary of all events
        return [
            {
                "id": ev["id"],
                "title": ev["title"],
                "photographer_name": ev.get("photographer_name", "Studio Pro"),
                "date": ev.get("date", ""),
                "location": ev.get("location", ""),
                "days": ev.get("days", []),
                "cover_url": ev.get("cover_url", ""),
                "total_photos": len(ev.get("photos", [])),
                "total_faces": sum(len(p.get("faces", [])) for p in ev.get("photos", [])),
                "client_scans": ev.get("client_scans", 0),
                "created_at": ev.get("created_at")
            }
            for ev in self.events.values()
        ]

    def get_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        return self.events.get(event_id)

    def create_event(
        self,
        title: str,
        photographer_name: str = "Studio Pro",
        date: str = "",
        location: str = "",
        days: Optional[List[Dict[str, str]]] = None,
        watermark_text: str = ""
    ) -> Dict[str, Any]:
        event_id = f"evt_{uuid.uuid4().hex[:8]}"

        if not days or len(days) == 0:
            days = [
                {"id": "day_1", "title": "Day 1 - Haldi / Mehendi"},
                {"id": "day_2", "title": "Day 2 - Sangeet / Cocktail"},
                {"id": "day_3", "title": "Day 3 - Wedding & Reception"}
            ]

        event = {
            "id": event_id,
            "title": title,
            "photographer_name": photographer_name,
            "date": date or datetime.now().strftime("%d %b %Y"),
            "location": location,
            "days": days,
            "cover_url": "",
            "watermark_enabled": bool(watermark_text),
            "watermark_text": watermark_text or photographer_name,
            "client_scans": 0,
            "created_at": datetime.now().isoformat(),
            "photos": []
        }

        self.events[event_id] = event
        self._save()
        return event

    def add_photo(
        self,
        event_id: str,
        filename: str,
        original_path: str,
        thumbnail_path: str,
        original_url: str,
        thumbnail_url: str,
        day_id: str,
        faces: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        event = self.get_event(event_id)
        if not event:
            raise ValueError(f"Event {event_id} not found")

        # Find day title
        day_title = "Day 1"
        for d in event.get("days", []):
            if d["id"] == day_id:
                day_title = d["title"]
                break

        photo_id = f"img_{uuid.uuid4().hex[:10]}"
        photo_record = {
            "id": photo_id,
            "filename": filename,
            "original_path": original_path,
            "thumbnail_path": thumbnail_path,
            "original_url": original_url,
            "thumbnail_url": thumbnail_url,
            "day_id": day_id,
            "day_title": day_title,
            "faces": faces,
            "face_count": len(faces),
            "uploaded_at": datetime.now().isoformat()
        }

        # If no cover image yet, set this as cover
        if not event.get("cover_url"):
            event["cover_url"] = thumbnail_url

        event["photos"].append(photo_record)
        self._save()
        return photo_record

    def increment_scans(self, event_id: str):
        event = self.get_event(event_id)
        if event:
            event["client_scans"] = event.get("client_scans", 0) + 1
            self._save()

    def generate_qr_base64(self, client_url: str) -> str:
        """Generates a high-quality QR code image encoded in base64 string"""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=3,
        )
        qr.add_data(client_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")
