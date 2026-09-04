import os

app_js_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "app.js")

with open(app_js_path, "r", encoding="utf-8") as f:
    content = f.read()

# Prepend API_BASE definition if not present
if "const API_BASE =" not in content:
    content = "// FaceSnap AI - Core Application Logic\nconst API_BASE = (window.location.protocol === 'file:') ? 'http://127.0.0.1:8000' : '';\n" + content[len("// FaceSnap AI - Core Application Logic\n"):]

# Replace fetch calls
content = content.replace("fetch('/api/", "fetch(`${API_BASE}/api/")
content = content.replace("fetch(`/api/", "fetch(`${API_BASE}/api/")

# Fix cover image url in renderEventsGrid
content = content.replace(
    "const cover = ev.cover_url ||",
    "const cover = (ev.cover_url && !ev.cover_url.startsWith('http')) ? (API_BASE + ev.cover_url) : (ev.cover_url ||"
)

# Fix photo urls in renderPhotosGrid
content = content.replace(
    'src="${p.thumbnail_url || p.original_url}"',
    'src="${(p.thumbnail_url || p.original_url).startsWith(\'http\') ? (p.thumbnail_url || p.original_url) : (API_BASE + (p.thumbnail_url || p.original_url))}"'
)
content = content.replace(
    'href="${p.original_url}"',
    'href="${p.original_url.startsWith(\'http\') ? p.original_url : (API_BASE + p.original_url)}"'
)

with open(app_js_path, "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: app.js patched with API_BASE for local file and web server compatibility!")
