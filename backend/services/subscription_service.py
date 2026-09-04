import os
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

class SubscriptionService:
    def __init__(self, data_file: str):
        self.data_file = data_file
        os.makedirs(os.path.dirname(data_file), exist_ok=True)
        self.state: Dict[str, Any] = {
            "is_active": False,
            "plan_name": "1-Year Photographer Studio Pass",
            "price_inr": 4999,
            "price_display": "₹4,999 / Year",
            "activated_at": None,
            "expires_at": None,
            "upi_id": "8669173204@upi",
            "seller_contact": "+91 8669173204",
            "valid_keys": [
                "SNAP-YEAR-4999-DEMO",
                "SNAP-YEAR-4999-PRO1",
                "SNAP-YEAR-4999-PRO2"
            ],
            "used_keys": []
        }
        self._load()

    def _load(self):
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, "r", encoding="utf-8") as f:
                    self.state.update(json.load(f))
            except Exception as e:
                print(f"Error loading subscription data: {e}")
        else:
            self._save()

    def _save(self):
        try:
            with open(self.data_file, "w", encoding="utf-8") as f:
                json.dump(self.state, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving subscription data: {e}")

    def get_status(self) -> Dict[str, Any]:
        self._load()
        is_active = self.state.get("is_active", False)
        expires_at_str = self.state.get("expires_at")
        days_left = 0

        if is_active and expires_at_str:
            try:
                expires_at = datetime.fromisoformat(expires_at_str)
                now = datetime.now()
                if now < expires_at:
                    days_left = (expires_at - now).days + 1
                    is_active = True
                else:
                    is_active = False
                    self.state["is_active"] = False
                    self._save()
            except Exception:
                is_active = False

        return {
            "is_active": is_active,
            "plan_name": self.state.get("plan_name", "1-Year Photographer Studio Pass"),
            "price_display": self.state.get("price_display", "₹4,999 / Year"),
            "price_inr": self.state.get("price_inr", 4999),
            "days_left": days_left,
            "expires_at": expires_at_str,
            "upi_id": self.state.get("upi_id", "8669173204@upi"),
            "seller_contact": self.state.get("seller_contact", "+91 8669173204"),
            "valid_keys_count": len(self.state.get("valid_keys", []))
        }

    def activate_with_key(self, key: str) -> Dict[str, Any]:
        key = key.strip().upper()
        valid_keys = self.state.get("valid_keys", [])

        if key not in valid_keys:
            return {"success": False, "message": "Amaniya ya Invalid License Key. Kripya sahi key dalein."}

        # Consume key
        valid_keys.remove(key)
        self.state["valid_keys"] = valid_keys
        if "used_keys" not in self.state:
            self.state["used_keys"] = []
        self.state["used_keys"].append({"key": key, "used_at": datetime.now().isoformat()})

        # Set 365 days (1 Year) validity
        now = datetime.now()
        expires_at = now + timedelta(days=365)

        self.state["is_active"] = True
        self.state["activated_at"] = now.isoformat()
        self.state["expires_at"] = expires_at.isoformat()
        self._save()

        return {
            "success": True,
            "message": "Badhaai ho! Aapka 1-Year Photographer Plan (₹4,999) activate ho gaya hai!",
            "expires_at": expires_at.strftime("%d %b %Y"),
            "days_left": 365
        }

    def generate_new_license_key(self) -> str:
        """Admin helper for the USER to generate keys to sell for ₹4,999"""
        new_key = f"SNAP-{uuid.uuid4().hex[:4].upper()}-{uuid.uuid4().hex[:4].upper()}-4999"
        if "valid_keys" not in self.state:
            self.state["valid_keys"] = []
        self.state["valid_keys"].append(new_key)
        self._save()
        return new_key

    def update_seller_upi(self, upi_id: str, contact: str):
        self.state["upi_id"] = upi_id
        self.state["seller_contact"] = contact
        self._save()
