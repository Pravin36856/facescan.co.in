import os
import io
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from pydantic import BaseModel
from typing import List, Optional
import json

from services.face_service import FaceRecognitionEngine
from services.storage_service import StorageService
from services.event_service import EventService
from services.subscription_service import SubscriptionService
from services.seed_service import seed_sample_event_if_empty

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)
MODELS_DIR = os.path.join(BASE_DIR, "models")
DATA_DIR = os.path.join(BASE_DIR, "data")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
FRONTEND_DIR = os.path.join(PROJECT_DIR, "frontend")

# Initialize services
face_engine = FaceRecognitionEngine(MODELS_DIR)
storage_service = StorageService(UPLOADS_DIR)
event_service = EventService(os.path.join(DATA_DIR, "events.json"))
subscription_service = SubscriptionService(os.path.join(DATA_DIR, "subscription.json"))

# Automatically seed sample event if empty
seed_sample_event_if_empty(event_service, storage_service, face_engine)

app = FastAPI(
    title="AI Event Photo Sharing SaaS",
    description="Facial Recognition Event Photo Delivery Platform for Photographers",
    version="1.0.0"
)

# Enable CORS for frontend flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Pydantic models
class DayCreate(BaseModel):
    id: str
    title: str

class EventCreateRequest(BaseModel):
    title: str
    photographer_name: str = "Studio Pro"
    date: str = ""
    location: str = ""
    days: List[DayCreate] = []
    watermark_text: str = ""

class DownloadZipRequest(BaseModel):
    photo_ids: List[str]

class ActivateKeyRequest(BaseModel):
    key: str

class UpdateSellerRequest(BaseModel):
    upi_id: str
    seller_contact: str

# ----------------- API ROUTES -----------------

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": "AI Face Recognition Photo Delivery Platform",
        "total_events": len(event_service.list_events())
    }

# Subscription / Paywall Endpoints
@app.get("/api/subscription/status")
def get_subscription_status():
    return subscription_service.get_status()

@app.post("/api/subscription/activate")
def activate_subscription(req: ActivateKeyRequest):
    result = subscription_service.activate_with_key(req.key)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result

@app.post("/api/subscription/generate-key")
def generate_license_key():
    key = subscription_service.generate_new_license_key()
    return {
        "success": True,
        "key": key,
        "message": f"Nayi 1-Year License Key ban gayi: {key}. Photographer ko ₹4,999 lene ke baad share karein."
    }

@app.post("/api/subscription/update-seller")
def update_seller_details(req: UpdateSellerRequest):
    subscription_service.update_seller_upi(req.upi_id, req.seller_contact)
    return {"success": True, "message": "Seller UPI details updated successfully!"}

@app.get("/api/events")
def list_events():
    return event_service.list_events()

@app.post("/api/events")
def create_event(req: EventCreateRequest):
    sub = subscription_service.get_status()
    if not sub["is_active"]:
        raise HTTPException(
            status_code=403,
            detail="Pehle 1-Year Plan (₹4,999) buy karke activate karein tabhi naya event order create ho sakta hai."
        )

    days_dict = [{"id": d.id, "title": d.title} for d in req.days]
    event = event_service.create_event(
        title=req.title,
        photographer_name=req.photographer_name,
        date=req.date,
        location=req.location,
        days=days_dict,
        watermark_text=req.watermark_text
    )
    return event

@app.get("/api/events/{event_id}")
def get_event(event_id: str):
    event = event_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

import socket

def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

@app.get("/api/events/{event_id}/qr")
def get_event_qr(event_id: str, request: Request):
    event = event_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    host = request.headers.get("host", "127.0.0.1:8000")
    scheme = request.url.scheme or "http"
    
    # If accessed locally, use LAN IP so mobile phones scanning the QR code can open it
    if "localhost" in host or "127.0.0.1" in host:
        lan_ip = get_lan_ip()
        port = host.split(":")[1] if ":" in host else "8000"
        mobile_host = f"{lan_ip}:{port}"
        client_url = f"{scheme}://{mobile_host}/event/{event_id}"
    else:
        client_url = f"{scheme}://{host}/event/{event_id}"

    qr_data = event_service.generate_qr_base64(client_url)

    return {
        "event_id": event_id,
        "title": event["title"],
        "client_url": client_url,
        "qr_code_base64": qr_data
    }

@app.post("/api/events/{event_id}/photos")
async def upload_photos(
    event_id: str,
    day_id: str = Form("day_1"),
    files: List[UploadFile] = File(...)
):
    sub = subscription_service.get_status()
    if not sub["is_active"]:
        raise HTTPException(
            status_code=403,
            detail="Photos upload karne ke liye 1-Year Plan (₹4,999) active hona zaroori hai. Pehale subscription activate karein."
        )

    event = event_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    uploaded_results = []
    for file in files:
        contents = await file.read()
        filename = file.filename or f"photo_{len(event.get('photos', [])) + 1}.jpg"

        orig_path, thumb_path, orig_url, thumb_url = storage_service.save_image(
            event_id=event_id,
            file_bytes=contents,
            filename=filename
        )

        # AI Face Detection & Embedding extraction
        faces = face_engine.detect_and_extract(orig_path)

        photo_record = event_service.add_photo(
            event_id=event_id,
            filename=filename,
            original_path=orig_path,
            thumbnail_path=thumb_path,
            original_url=orig_url,
            thumbnail_url=thumb_url,
            day_id=day_id,
            faces=faces
        )
        uploaded_results.append({
            "id": photo_record["id"],
            "filename": filename,
            "faces_detected": len(faces)
        })

    return {
        "success": True,
        "uploaded_count": len(uploaded_results),
        "results": uploaded_results
    }

@app.post("/api/events/{event_id}/search")
async def search_client_photos(
    event_id: str,
    selfie: UploadFile = File(...),
    threshold: Optional[float] = Form(0.36)
):
    """
    Client face scan endpoint:
    Accepts client selfie from camera or file,
    extracts facial embedding, and finds all matching photos
    from Day 1 to the last day in this event order.
    """
    event = event_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    selfie_bytes = await selfie.read()
    selfie_embedding = face_engine.extract_single_face_from_bytes(selfie_bytes)

    if not selfie_embedding:
        return {
            "success": False,
            "message": "Chehra spasht roop se detect nahi hua (No face clearly detected in selfie). Kripya seedha dekh kar achhi roshni (lighting) me selfie lein.",
            "total_matches": 0,
            "photos": []
        }

    # Increment client scan counter
    event_service.increment_scans(event_id)

    # Search across all photos in event
    event_photos = event.get("photos", [])
    matches = face_engine.search_face_in_event(
        selfie_embedding=selfie_embedding,
        event_photos=event_photos,
        threshold=threshold
    )

    return {
        "success": True,
        "total_event_photos": len(event_photos),
        "total_matches": len(matches),
        "event_title": event["title"],
        "photographer_name": event.get("photographer_name", ""),
        "days": event.get("days", []),
        "photos": matches
    }

@app.post("/api/events/{event_id}/download-zip")
def download_all_matched_photos(event_id: str, req: DownloadZipRequest):
    event = event_service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    photo_map = {p["id"]: p["original_path"] for p in event.get("photos", [])}
    paths_to_zip = [photo_map[pid] for pid in req.photo_ids if pid in photo_map]

    if not paths_to_zip:
        raise HTTPException(status_code=400, detail="No valid photos selected for zip download")

    zip_name = f"{event.get('title', 'photos').replace(' ', '_')}_my_photos.zip"
    zip_path = storage_service.create_zip_archive(paths_to_zip, zip_name)

    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=zip_name
    )

@app.get("/api/events/{event_id}/photos/{filename}")
def serve_original_photo(event_id: str, filename: str):
    path = os.path.join(UPLOADS_DIR, event_id, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Photo file not found")
    return FileResponse(path)

@app.get("/api/events/{event_id}/photos/thumbnails/{filename}")
def serve_thumbnail_photo(event_id: str, filename: str):
    path = os.path.join(UPLOADS_DIR, event_id, "thumbnails", filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return FileResponse(path)

@app.get("/api/pricing")
def get_saas_pricing_plans():
    """B2B SaaS pricing plans for selling to photographers"""
    return [
        {
            "id": "yearly_pass",
            "name": "1-Year Unlimited Studio Pass",
            "price_inr": "₹4,999 / Year",
            "price_usd": "$59 / Year",
            "events_limit": "Unlimited Weddings & Events (365 Days)",
            "storage": "Unlimited Client Face Searches & Downloads",
            "features": [
                "Full 1-Year Unlimited Access (365 Days)",
                "AI Face Recognition (Instant 1-Second Match)",
                "Multi-Day Event Support (Haldi, Sangeet, Wedding)",
                "Printable Wedding Standee & QR Generator",
                "Client ZIP Photo Downloads",
                "Direct WhatsApp Sharing Links",
                "Photographer Logo Watermark Protection"
            ],
            "recommended": True
        },
        {
            "id": "starter_event",
            "name": "Single Event Pass",
            "price_inr": "₹299 / Event",
            "price_usd": "$4 / Event",
            "events_limit": "1 Event (Validity 60 Days)",
            "storage": "Full Face Recognition for 1 Wedding",
            "features": [
                "1 Wedding Order",
                "AI Face Search & QR Code",
                "Up to 3 Days per Event",
                "Standard Web Gallery",
                "Client ZIP Downloads"
            ],
            "recommended": False
        },
        {
            "id": "agency_unlimited",
            "name": "Studio Enterprise Lifetime",
            "price_inr": "₹2,999 / 3 Years",
            "price_usd": "$39 / 3 Years",
            "events_limit": "Unlimited Events for 3 Years",
            "storage": "Cloudflare R2 Zero-Egress Storage",
            "features": [
                "3 Years Unlimited Weddings",
                "Complete White-label (Your Brand Only)",
                "Multi-photographer Sub-accounts",
                "High Volume Bulk Uploader",
                "Priority Support"
            ],
            "recommended": False
        }
    ]

# ----------------- STATIC FRONTEND & CLIENT ROUTE -----------------

os.makedirs(FRONTEND_DIR, exist_ok=True)

@app.get("/event/{event_id:path}")
def serve_client_portal(event_id: str):
    """Direct link shared with wedding clients and guests"""
    # If a static asset like app.js is requested under /event/...
    if event_id.endswith(".js"):
        js_file = os.path.join(FRONTEND_DIR, os.path.basename(event_id))
        if os.path.exists(js_file):
            return FileResponse(js_file, media_type="application/javascript")
    if event_id.endswith(".css"):
        css_file = os.path.join(FRONTEND_DIR, os.path.basename(event_id))
        if os.path.exists(css_file):
            return FileResponse(css_file, media_type="text/css")

    index_file = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content)
    return HTMLResponse("<h1>Client Portal Loading...</h1>")

app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
