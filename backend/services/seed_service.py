import os
import requests
from typing import List, Dict

# High quality sample portrait / event photos with clear faces for instant testing
SAMPLE_PHOTOS = [
    {
        "url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
        "day_id": "day_1",
        "filename": "haldi_guest_1.jpg"
    },
    {
        "url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
        "day_id": "day_1",
        "filename": "haldi_groom_friend.jpg"
    },
    {
        "url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
        "day_id": "day_2",
        "filename": "sangeet_guest_1_dance.jpg"
    },
    {
        "url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80",
        "day_id": "day_2",
        "filename": "sangeet_celebration.jpg"
    },
    {
        "url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
        "day_id": "day_3",
        "filename": "wedding_guest_1_stage.jpg"
    },
    {
        "url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80",
        "day_id": "day_3",
        "filename": "wedding_bride_sister.jpg"
    }
]

def seed_sample_event_if_empty(event_service, storage_service, face_engine):
    """
    If no events exist yet, automatically creates 'Aman & Sneha Grand Wedding'
    with 3 days and indexes sample photos so the user can test immediately.
    """
    events = event_service.list_events()
    if len(events) > 0:
        return

    print("Seeding initial sample wedding event...")
    try:
        event = event_service.create_event(
            title="Aman & Sneha's Grand Wedding",
            photographer_name="PixelCraft Studios",
            date="04-06 September 2026",
            location="The Grand Palace, Udaipur",
            days=[
                {"id": "day_1", "title": "Day 1 - Haldi & Mehendi"},
                {"id": "day_2", "title": "Day 2 - Sangeet & Cocktail"},
                {"id": "day_3", "title": "Day 3 - Royal Wedding & Reception"}
            ],
            watermark_text="PixelCraft Studios"
        )
        event_id = event["id"]

        for item in SAMPLE_PHOTOS:
            try:
                resp = requests.get(item["url"], timeout=15)
                if resp.status_code == 200:
                    orig_path, thumb_path, orig_url, thumb_url = storage_service.save_image(
                        event_id=event_id,
                        file_bytes=resp.content,
                        filename=item["filename"]
                    )
                    # Detect and extract faces
                    faces = face_engine.detect_and_extract(orig_path)
                    event_service.add_photo(
                        event_id=event_id,
                        filename=item["filename"],
                        original_path=orig_path,
                        thumbnail_path=thumb_path,
                        original_url=orig_url,
                        thumbnail_url=thumb_url,
                        day_id=item["day_id"],
                        faces=faces
                    )
                    print(f"Seeded {item['filename']} with {len(faces)} faces detected.")
            except Exception as e:
                print(f"Failed to seed image {item['filename']}: {e}")

        print(f"Sample wedding seeded with ID: {event_id}")
    except Exception as e:
        print(f"Seeding skipped or failed: {e}")
