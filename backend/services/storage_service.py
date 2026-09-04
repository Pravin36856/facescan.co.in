import os
import io
import zipfile
import shutil
from PIL import Image, ImageDraw, ImageFont
from typing import Tuple, List

class StorageService:
    def __init__(self, base_upload_dir: str):
        self.base_upload_dir = base_upload_dir
        os.makedirs(self.base_upload_dir, exist_ok=True)

    def get_event_dir(self, event_id: str) -> str:
        path = os.path.join(self.base_upload_dir, event_id)
        os.makedirs(path, exist_ok=True)
        return path

    def get_thumbnails_dir(self, event_id: str) -> str:
        path = os.path.join(self.base_upload_dir, event_id, "thumbnails")
        os.makedirs(path, exist_ok=True)
        return path

    def save_image(self, event_id: str, file_bytes: bytes, filename: str) -> Tuple[str, str, str, str]:
        """
        Saves original image and generates an optimized compressed thumbnail.
        Returns (original_file_path, thumbnail_file_path, original_url, thumbnail_url)
        """
        event_dir = self.get_event_dir(event_id)
        thumb_dir = self.get_thumbnails_dir(event_id)

        orig_path = os.path.join(event_dir, filename)
        thumb_filename = f"thumb_{filename}"
        thumb_path = os.path.join(thumb_dir, thumb_filename)

        with open(orig_path, "wb") as f:
            f.write(file_bytes)

        # Generate optimized thumbnail (max 800px width/height, quality 85)
        try:
            with Image.open(io.BytesIO(file_bytes)) as img:
                # Handle EXIF orientation if needed
                if hasattr(img, '_getexif') and img._getexif():
                    from PIL import ImageOps
                    img = ImageOps.exif_transpose(img)
                
                img.thumbnail((800, 800), Image.Resampling.LANCZOS)
                # Convert to RGB if PNG/RGBA
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                img.save(thumb_path, "JPEG", quality=85, optimize=True)
        except Exception as e:
            print(f"Thumbnail generation error for {filename}: {e}")
            # Fallback: copy original to thumbnail
            shutil.copyfile(orig_path, thumb_path)

        orig_url = f"/api/events/{event_id}/photos/{filename}"
        thumb_url = f"/api/events/{event_id}/photos/thumbnails/{thumb_filename}"
        return orig_path, thumb_path, orig_url, thumb_url

    def create_zip_archive(self, photo_paths: List[str], zip_filename: str) -> str:
        """
        Packs a list of photo paths into a downloadable zip file.
        Returns the absolute path to the generated zip file.
        """
        temp_dir = os.path.join(self.base_upload_dir, "_temp_zips")
        os.makedirs(temp_dir, exist_ok=True)
        zip_path = os.path.join(temp_dir, zip_filename)

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for p in photo_paths:
                if os.path.exists(p):
                    zip_file.write(p, arcname=os.path.basename(p))

        return zip_path
