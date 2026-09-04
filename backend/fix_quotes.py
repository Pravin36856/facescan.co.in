import os

app_js_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "app.js")

with open(app_js_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix unmatched quotes
content = content.replace("fetch(`${API_BASE}/api/events');", "fetch(`${API_BASE}/api/events`);")
content = content.replace("fetch(`${API_BASE}/api/events',", "fetch(`${API_BASE}/api/events`,")
content = content.replace("fetch(`${API_BASE}/api/pricing');", "fetch(`${API_BASE}/api/pricing`);")

with open(app_js_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Quotes fixed successfully!")
