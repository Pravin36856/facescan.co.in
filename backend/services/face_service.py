import os
import cv2
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from PIL import Image

class FaceRecognitionEngine:
    def __init__(self, models_dir: str):
        self.models_dir = models_dir
        self.detector_path = os.path.join(models_dir, "face_detection_yunet_2023mar.onnx")
        self.recognizer_path = os.path.join(models_dir, "face_recognition_sface_2021dec.onnx")

        if not os.path.exists(self.detector_path) or not os.path.exists(self.recognizer_path):
            raise FileNotFoundError("YuNet or SFace model files are missing in models directory.")

        # Default detector input size (will dynamically adapt per image)
        self.detector = cv2.FaceDetectorYN.create(
            self.detector_path,
            "",
            (320, 320),
            score_threshold=0.6,
            nms_threshold=0.3,
            top_k=5000
        )
        self.recognizer = cv2.FaceRecognizerSF.create(self.recognizer_path, "")

        # Default Cosine similarity match threshold for SFace
        # Standard SFace match threshold is >= 0.363 for same identity
        self.cosine_threshold = 0.363

    def detect_and_extract(self, image_path: str) -> List[Dict[str, Any]]:
        """
        Reads an image from image_path, detects all faces, and extracts 128-d feature embeddings.
        Returns a list of dicts: [ { 'bbox': [x, y, w, h], 'embedding': list[float], 'score': float } ]
        """
        img = cv2.imread(image_path)
        if img is None:
            return []

        h, w = img.shape[:2]
        # Resize detector input size to match image dimensions
        self.detector.setInputSize((w, h))

        # Detect faces
        _, faces = self.detector.detect(img)
        if faces is None or len(faces) == 0:
            return []

        results = []
        for face in faces:
            bbox = [int(face[0]), int(face[1]), int(face[2]), int(face[3])]
            score = float(face[14])

            # Align and crop face
            try:
                aligned_face = self.recognizer.alignCrop(img, face)
                # Extract 128-dimensional embedding
                feature = self.recognizer.feature(aligned_face)
                # Feature is a 1x128 numpy array
                embedding = feature.flatten().tolist()

                results.append({
                    "bbox": bbox,
                    "score": round(score, 4),
                    "embedding": embedding
                })
            except Exception as e:
                print(f"Error processing face crop in {image_path}: {e}")
                continue

        return results

    def extract_single_face_from_bytes(self, image_bytes: bytes) -> Optional[List[float]]:
        """
        Used for client selfie scan. Decodes image bytes, finds the most prominent face,
        and returns its 128-d feature embedding.
        """
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None

        h, w = img.shape[:2]
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(img)

        if faces is None or len(faces) == 0:
            return None

        # Pick the largest face by area (since selfie is usually the subject)
        best_face = None
        max_area = 0
        for face in faces:
            area = face[2] * face[3]
            if area > max_area:
                max_area = area
                best_face = face

        if best_face is None:
            return None

        aligned_face = self.recognizer.alignCrop(img, best_face)
        feature = self.recognizer.feature(aligned_face)
        return feature.flatten().tolist()

    def compare_embeddings(self, emb1: List[float], emb2: List[float]) -> float:
        """
        Calculates cosine similarity between two 128-d embeddings.
        Returns a float score between -1.0 and 1.0.
        """
        arr1 = np.array(emb1, dtype=np.float32).reshape(1, 128)
        arr2 = np.array(emb2, dtype=np.float32).reshape(1, 128)
        sim = self.recognizer.match(arr1, arr2, cv2.FaceRecognizerSF_FR_COSINE)
        return float(sim)

    def search_face_in_event(
        self,
        selfie_embedding: List[float],
        event_photos: List[Dict[str, Any]],
        threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Searches for photos where any detected face matches the selfie_embedding.
        Returns matching photos sorted by highest similarity score.
        """
        thresh = threshold if threshold is not None else self.cosine_threshold
        target_feat = np.array(selfie_embedding, dtype=np.float32).reshape(1, 128)

        matched_photos = []

        for photo in event_photos:
            faces = photo.get("faces", [])
            best_photo_score = -1.0
            best_face_bbox = None

            for face in faces:
                emb = face.get("embedding")
                if not emb or len(emb) != 128:
                    continue

                feat = np.array(emb, dtype=np.float32).reshape(1, 128)
                score = float(self.recognizer.match(target_feat, feat, cv2.FaceRecognizerSF_FR_COSINE))

                if score > best_photo_score:
                    best_photo_score = score
                    best_face_bbox = face.get("bbox")

            if best_photo_score >= thresh:
                # Convert score to percentage: SFace 0.363 -> ~70%, 0.6 -> ~90%, 0.8+ -> 98%
                pct = min(100, max(50, int(((best_photo_score - 0.2) / 0.7) * 100)))
                matched_photos.append({
                    "id": photo["id"],
                    "filename": photo["filename"],
                    "original_url": photo["original_url"],
                    "thumbnail_url": photo.get("thumbnail_url", photo["original_url"]),
                    "day_id": photo.get("day_id", "day_1"),
                    "day_title": photo.get("day_title", "Day 1"),
                    "similarity_score": round(best_photo_score, 4),
                    "match_percentage": pct,
                    "matched_bbox": best_face_bbox,
                    "created_at": photo.get("created_at")
                })

        # Sort photos by similarity score descending
        matched_photos.sort(key=lambda x: x["similarity_score"], reverse=True)
        return matched_photos
