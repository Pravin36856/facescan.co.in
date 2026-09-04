// FaceSnap AI - Core Application Logic
const API_BASE = (window.location.protocol === 'file:') ? 'http://127.0.0.1:8000' : '';

let currentView = 'dashboard';
let eventsList = [];
let activeEventId = null;
let activeEventData = null;
let currentMatchedPhotos = [];
let activeDayFilter = 'all';
let cameraStream = null;
let selectedBulkFiles = [];
let currentLightboxPhoto = null;
let albumFavorites = new Set(JSON.parse(localStorage.getItem('facesnap_favorites') || '[]'));

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();

  // Check URL path: if `/event/evt_xxx`, switch directly to client view
  const eventMatch = window.location.pathname.match(/\/event\/([a-zA-Z0-9_\-]+)/);
  if (eventMatch && eventMatch[1] && eventMatch[1] !== 'app.js') {
    const eventId = eventMatch[1];
    loadClientViewForEvent(eventId);
  } else {
    fetchSubscriptionStatus();
    fetchEvents();
    fetchPricing();
  }
});

// ----------------- NAVIGATION & VIEWS -----------------

function switchView(viewName) {
  currentView = viewName;
  document.getElementById('view-dashboard').classList.add('hidden');
  document.getElementById('view-client').classList.add('hidden');
  document.getElementById('view-pricing').classList.add('hidden');

  // Update Nav buttons styling
  ['dashboard', 'client', 'pricing'].forEach(v => {
    const btn = document.getElementById(`nav-${v}`);
    if (btn) {
      if (v === viewName) {
        btn.className = "px-4 py-2 text-sm font-medium rounded-lg transition-all bg-white text-slate-900 shadow-sm";
      } else {
        btn.className = "px-4 py-2 text-sm font-medium rounded-lg text-slate-600 hover:text-slate-900 transition-all";
      }
    }
  });

  const activeSection = document.getElementById(`view-${viewName}`);
  if (activeSection) {
    activeSection.classList.remove('hidden');
  }

  if (viewName === 'dashboard') {
    stopCamera();
    fetchEvents();
  } else if (viewName === 'client') {
    if (!activeEventId && eventsList.length > 0) {
      loadClientViewForEvent(eventsList[0].id);
    }
  } else if (viewName === 'pricing') {
    stopCamera();
    fetchPricing();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.lucide) lucide.createIcons();
}

// ----------------- TOAST NOTIFICATIONS -----------------

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  const icon = document.getElementById('toast-icon');

  msgEl.innerText = message;
  if (isError) {
    icon.setAttribute('data-lucide', 'alert-circle');
    icon.className = 'w-5 h-5 text-rose-400';
  } else {
    icon.setAttribute('data-lucide', 'check-circle');
    icon.className = 'w-5 h-5 text-emerald-400';
  }

  if (window.lucide) lucide.createIcons();

  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3500);
}

// ----------------- EVENTS MANAGEMENT -----------------

async function fetchEvents() {
  try {
    const res = await fetch(`${API_BASE}/api/events`);
    const data = await res.json();
    eventsList = data;
    renderEventsGrid(data);
    updateDashboardStats(data);
  } catch (err) {
    console.error('Failed to fetch events:', err);
    showToast('Failed to load events', true);
  }
}

function updateDashboardStats(events) {
  const totalEvents = events.length;
  const totalPhotos = events.reduce((acc, ev) => acc + (ev.total_photos || 0), 0);
  const totalFaces = events.reduce((acc, ev) => acc + (ev.total_faces || 0), 0);
  const totalScans = events.reduce((acc, ev) => acc + (ev.client_scans || 0), 0);

  document.getElementById('stat-total-events').innerText = totalEvents;
  document.getElementById('stat-total-photos').innerText = totalPhotos;
  document.getElementById('stat-total-faces').innerText = totalFaces;
  document.getElementById('stat-total-scans').innerText = totalScans;
}

function renderEventsGrid(events) {
  const container = document.getElementById('events-grid');
  if (!events || events.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200">
        <i data-lucide="folder-plus" class="w-12 h-12 text-slate-300 mx-auto mb-3"></i>
        <h4 class="font-bold text-slate-800 text-lg">No Event Orders Yet</h4>
        <p class="text-sm text-slate-500 mb-4">Create your first client event order to upload photos and share QR codes.</p>
        <button onclick="openCreateEventModal()" class="px-5 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-sm shadow-md">
          Create New Event
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = events.map(ev => {
    const cover = (ev.cover_url && !ev.cover_url.startsWith('http')) ? (API_BASE + ev.cover_url) : (ev.cover_url || 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80');
    return `
      <div class="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col">
        <!-- Event Cover & Badge -->
        <div class="relative h-48 w-full bg-slate-100 overflow-hidden group">
          <img src="${cover}" alt="${ev.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
          
          <div class="absolute top-4 left-4">
            <span class="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-xs font-bold text-slate-800 shadow">
              ${(ev.days || []).length} Days Order
            </span>
          </div>

          <div class="absolute bottom-4 left-4 right-4 text-white">
            <p class="text-xs font-semibold text-brand-300 uppercase tracking-wider">${ev.photographer_name || 'Studio Pro'}</p>
            <h3 class="text-lg font-bold leading-snug drop-shadow">${ev.title}</h3>
            <p class="text-xs text-slate-300 mt-0.5">${ev.date || 'Active Event'} • ${ev.location || 'India'}</p>
          </div>
        </div>

        <!-- Event Metrics -->
        <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
          <div class="grid grid-cols-3 gap-2 text-center py-2 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <span class="text-xs text-slate-400 font-medium">Photos</span>
              <p class="font-bold text-slate-800 text-sm">${ev.total_photos || 0}</p>
            </div>
            <div>
              <span class="text-xs text-slate-400 font-medium">Faces</span>
              <p class="font-bold text-brand-600 text-sm">${ev.total_faces || 0}</p>
            </div>
            <div>
              <span class="text-xs text-slate-400 font-medium">Guest Scans</span>
              <p class="font-bold text-emerald-600 text-sm">${ev.client_scans || 0}</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="space-y-2 pt-2 border-t border-slate-100">
            <div class="grid grid-cols-2 gap-2">
              <button onclick="openUploadModal('${ev.id}')" class="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all flex items-center justify-center">
                <i data-lucide="upload" class="w-3.5 h-3.5 mr-1.5"></i> Bulk Upload
              </button>
              <button onclick="openQrModal('${ev.id}')" class="px-3 py-2.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold text-xs transition-all flex items-center justify-center">
                <i data-lucide="qr-code" class="w-3.5 h-3.5 mr-1.5"></i> QR & Link
              </button>
            </div>

            <button onclick="loadClientViewForEvent('${ev.id}')" class="w-full px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-700 font-medium text-xs transition-all flex items-center justify-center">
              <i data-lucide="external-link" class="w-3.5 h-3.5 mr-1.5"></i> Open Client Face Scan Portal
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ----------------- CREATE NEW EVENT -----------------

function openCreateEventModal() {
  document.getElementById('modal-create-event').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeCreateEventModal() {
  document.getElementById('modal-create-event').classList.add('hidden');
}

async function handleCreateEvent(e) {
  e.preventDefault();
  const title = document.getElementById('new-event-title').value.trim();
  const studio = document.getElementById('new-event-studio').value.trim();
  const date = document.getElementById('new-event-date').value.trim();
  const location = document.getElementById('new-event-location').value.trim();
  const watermark = document.getElementById('new-event-watermark').value.trim();

  // Extract day titles
  const dayInputs = document.querySelectorAll('.day-input');
  const days = Array.from(dayInputs).map((inp, idx) => ({
    id: `day_${idx + 1}`,
    title: inp.value.trim() || `Day ${idx + 1}`
  }));

  try {
    const res = await fetch(`${API_BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        photographer_name: studio || 'Studio Pro',
        date,
        location,
        days,
        watermark_text: watermark
      })
    });

    if (!res.ok) throw new Error('Failed to create event');
    const newEvent = await res.json();
    closeCreateEventModal();
    showToast(`Order created: ${newEvent.title}!`);
    fetchEvents();
  } catch (err) {
    console.error(err);
    showToast('Error creating event', true);
  }
}

// ----------------- BULK PHOTO UPLOAD -----------------

function checkAndOpenCreateEventModal() {
  if (!subscriptionData || !subscriptionData.is_active) {
    showToast('Naya order banane ke liye 1-Year Plan (₹4,999) zaroori hai!', true);
    openSubscriptionModal();
    return;
  }
  openCreateEventModal();
}

let targetUploadEventId = null;

async function openUploadModal(eventId) {
  if (!subscriptionData || !subscriptionData.is_active) {
    showToast('Photos upload karne ke liye 1-Year Plan (₹4,999) activate karein!', true);
    openSubscriptionModal();
    return;
  }

  targetUploadEventId = eventId;
  const res = await fetch(`${API_BASE}/api/events/${eventId}`);
  const event = await res.json();

  document.getElementById('upload-modal-event-title').innerText = `Upload Photos: ${event.title}`;
  const daySelect = document.getElementById('upload-day-select');
  daySelect.innerHTML = (event.days || []).map(d => `<option value="${d.id}">${d.title}</option>`).join('');

  clearSelectedFiles();
  document.getElementById('modal-upload-photos').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeUploadModal() {
  document.getElementById('modal-upload-photos').classList.add('hidden');
  clearSelectedFiles();
}

function handleBulkFilesSelected(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  selectedBulkFiles = Array.from(files);
  document.getElementById('upload-preview-container').classList.remove('hidden');
  document.getElementById('selected-files-count').innerText = `${selectedBulkFiles.length} photos selected`;
  document.getElementById('btn-start-upload').disabled = false;
  document.getElementById('upload-status-text').innerText = 'Ready to upload and run AI face detection';
}

function clearSelectedFiles() {
  selectedBulkFiles = [];
  document.getElementById('bulk-file-input').value = '';
  document.getElementById('upload-preview-container').classList.add('hidden');
  document.getElementById('btn-start-upload').disabled = true;
  document.getElementById('upload-progress-bar').style.width = '0%';
  document.getElementById('upload-progress-bar-container').classList.add('hidden');
}

async function startBulkUpload() {
  if (!selectedBulkFiles || selectedBulkFiles.length === 0 || !targetUploadEventId) return;

  const dayId = document.getElementById('upload-day-select').value;
  const btn = document.getElementById('btn-start-upload');
  btn.disabled = true;

  const progressBar = document.getElementById('upload-progress-bar');
  const progressContainer = document.getElementById('upload-progress-bar-container');
  const statusText = document.getElementById('upload-status-text');

  progressContainer.classList.remove('hidden');
  progressBar.style.width = '30%';
  statusText.innerText = `Uploading ${selectedBulkFiles.length} photos and extracting facial embeddings...`;

  const formData = new FormData();
  formData.append('day_id', dayId);
  selectedBulkFiles.forEach(file => {
    formData.append('files', file);
  });

  try {
    const res = await fetch(`${API_BASE}/api/events/${targetUploadEventId}/photos`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('Upload failed');
    const result = await res.json();

    progressBar.style.width = '100%';
    statusText.innerText = `Success! Uploaded ${result.uploaded_count} photos and indexed all faces.`;
    showToast(`${result.uploaded_count} Photos uploaded and AI indexed!`);

    setTimeout(() => {
      closeUploadModal();
      fetchEvents();
    }, 1500);
  } catch (err) {
    console.error(err);
    statusText.innerText = 'Upload failed. Please check file sizes or format.';
    showToast('Photo upload failed', true);
    btn.disabled = false;
  }
}

// ----------------- QR CODE & SHARE LINK -----------------

async function openQrModal(eventId) {
  try {
    const res = await fetch(`${API_BASE}/api/events/${eventId}/qr`);
    const data = await res.json();

    document.getElementById('qr-code-img').src = data.qr_code_base64;
    document.getElementById('qr-event-title').innerText = data.title;
    document.getElementById('qr-client-url-input').value = data.client_url;

    // WhatsApp share link
    const waText = encodeURIComponent(`Hi! Here are your wedding photos from ${data.title}. Just scan your face to get all your photos from Day 1 to the last day:\n${data.client_url}`);
    document.getElementById('btn-share-whatsapp').href = `https://api.whatsapp.com/send?text=${waText}`;

    document.getElementById('modal-share-qr').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error(err);
    showToast('Failed to load QR code', true);
  }
}

function closeQrModal() {
  document.getElementById('modal-share-qr').classList.add('hidden');
}

function copyClientLink() {
  const input = document.getElementById('qr-client-url-input');
  navigator.clipboard.writeText(input.value);
  showToast('Client link copied to clipboard!');
}

function downloadQrImage() {
  const qrImg = document.getElementById('qr-code-img');
  const a = document.createElement('a');
  a.href = qrImg.src;
  a.download = `wedding_qr_code.png`;
  a.click();
}

function printWeddingStandee() {
  const qrImg = document.getElementById('qr-code-img').src;
  const title = document.getElementById('qr-event-title').innerText;
  const clientUrl = document.getElementById('qr-client-url-input').value;

  const printWindow = window.open('', '_blank', 'width=800,height=1000');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Wedding Standee - ${title}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 30px;
          text-align: center;
          background: #fafafa;
          color: #1e293b;
        }
        .poster {
          border: 8px double #c026d3;
          border-radius: 28px;
          padding: 40px 30px;
          background: white;
          box-shadow: 0 10px 25px rgba(0,0,0,0.05);
          max-width: 600px;
          margin: 0 auto;
        }
        .badge {
          display: inline-block;
          background: #fae8ff;
          color: #a21caf;
          font-weight: 800;
          font-size: 14px;
          padding: 6px 18px;
          border-radius: 50px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 15px;
        }
        h1 {
          font-size: 30px;
          font-weight: 900;
          margin: 0 0 10px 0;
          color: #0f172a;
        }
        p.sub {
          font-size: 15px;
          color: #64748b;
          margin: 0 0 25px 0;
        }
        .qr-box {
          display: inline-block;
          padding: 18px;
          border: 3px solid #e2e8f0;
          border-radius: 24px;
          background: #f8fafc;
          margin-bottom: 25px;
        }
        .qr-box img {
          width: 260px;
          height: 260px;
          display: block;
        }
        .steps {
          display: flex;
          justify-content: space-around;
          margin: 25px 0 35px 0;
          text-align: center;
        }
        .step {
          flex: 1;
          padding: 0 10px;
        }
        .step-icon {
          font-size: 28px;
          margin-bottom: 8px;
        }
        .step-title {
          font-weight: 800;
          font-size: 14px;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .step-desc {
          font-size: 12px;
          color: #64748b;
        }
        .footer {
          border-top: 1px solid #e2e8f0;
          padding-top: 20px;
          font-size: 13px;
          color: #94a3b8;
          font-weight: 600;
        }
        .url-text {
          font-family: monospace;
          font-size: 12px;
          color: #6366f1;
          margin-top: 6px;
        }
      </style>
    </head>
    <body>
      <div class="poster">
        <div class="badge">AI Face Recognition Gallery</div>
        <h1>${title}</h1>
        <p class="sub">Find all your photos across Day 1 to the Wedding Reception!</p>

        <div class="qr-box">
          <img src="${qrImg}" alt="QR Code">
        </div>

        <div class="steps">
          <div class="step">
            <div class="step-icon">📱</div>
            <div class="step-title">1. Scan QR Code</div>
            <div class="step-desc">Open phone camera & scan</div>
          </div>
          <div class="step">
            <div class="step-icon">🤳</div>
            <div class="step-title">2. Take a Selfie</div>
            <div class="step-desc">No app download needed</div>
          </div>
          <div class="step">
            <div class="step-icon">✨</div>
            <div class="step-title">3. Instant Photos</div>
            <div class="step-desc">Get & download all photos</div>
          </div>
        </div>

        <div class="footer">
          Captured with love & Powered by FaceSnap AI
          <div class="url-text">${clientUrl}</div>
        </div>
      </div>
      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ----------------- CLIENT FACE SCAN PORTAL -----------------

async function loadClientViewForEvent(eventId) {
  try {
    activeEventId = eventId;
    const res = await fetch(`${API_BASE}/api/events/${eventId}`);
    if (!res.ok) throw new Error('Event not found');
    const event = await res.json();
    activeEventData = event;

    // Update Client Header
    document.getElementById('client-event-title').innerText = event.title;
    document.getElementById('client-event-studio').innerText = event.photographer_name || 'Studio Pro';
    document.getElementById('client-event-meta').innerText = `${event.date || 'Wedding Ceremony'} • ${event.location || 'India'}`;

    // Reset scanner and results UI
    document.getElementById('selfie-scanner-box').classList.add('hidden');
    document.getElementById('selfie-upload-card').classList.remove('hidden');
    document.getElementById('searching-loader').classList.add('hidden');
    document.getElementById('matched-results-section').classList.add('hidden');

    switchView('client');
  } catch (err) {
    console.error(err);
    showToast('Error loading event portal', true);
  }
}

function triggerSelfieScan() {
  startCamera();
}

async function startCamera() {
  const scannerBox = document.getElementById('selfie-scanner-box');
  const uploadCard = document.getElementById('selfie-upload-card');
  const video = document.getElementById('webcam-video');

  scannerBox.classList.remove('hidden');
  uploadCard.classList.add('hidden');

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = cameraStream;
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Camera access denied or unavailable:', err);
    showToast('Camera access nahi mila. Kripya selfie file upload karein.', true);
    stopCamera();
    uploadCard.classList.remove('hidden');
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  const scannerBox = document.getElementById('selfie-scanner-box');
  if (scannerBox) scannerBox.classList.add('hidden');
}

function captureSelfieFromCamera() {
  const video = document.getElementById('webcam-video');
  const canvas = document.getElementById('selfie-canvas');
  const countdownEl = document.getElementById('camera-countdown');
  const snapBtn = document.getElementById('btn-snap');

  snapBtn.disabled = true;
  countdownEl.classList.remove('hidden');

  let count = 3;
  countdownEl.innerText = count;

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownEl.innerText = count;
    } else {
      clearInterval(interval);
      countdownEl.classList.add('hidden');

      // Draw video frame to canvas
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 640;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(blob => {
        stopCamera();
        performFaceSearch(blob);
      }, 'image/jpeg', 0.9);

      snapBtn.disabled = false;
    }
  }, 700);
}

function handleSelfieFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  performFaceSearch(file);
}

async function performFaceSearch(selfieBlobOrFile) {
  if (!activeEventId) {
    showToast('Please select an event order first', true);
    return;
  }

  // Show searching loader
  document.getElementById('selfie-upload-card').classList.add('hidden');
  document.getElementById('selfie-scanner-box').classList.add('hidden');
  document.getElementById('searching-loader').classList.remove('hidden');
  document.getElementById('matched-results-section').classList.add('hidden');
  if (window.lucide) lucide.createIcons();

  const formData = new FormData();
  formData.append('selfie', selfieBlobOrFile, 'selfie.jpg');

  try {
    const res = await fetch(`${API_BASE}/api/events/${activeEventId}/search`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    document.getElementById('searching-loader').classList.add('hidden');

    if (!data.success) {
      showToast(data.message || 'No face recognized', true);
      document.getElementById('selfie-upload-card').classList.remove('hidden');
      return;
    }

    currentMatchedPhotos = data.photos || [];
    renderMatchedResults(data);
  } catch (err) {
    console.error(err);
    document.getElementById('searching-loader').classList.add('hidden');
    document.getElementById('selfie-upload-card').classList.remove('hidden');
    showToast('Face search failed', true);
  }
}

function renderMatchedResults(data) {
  const section = document.getElementById('matched-results-section');
  section.classList.remove('hidden');

  document.getElementById('matched-count-badge').innerText = `${data.total_matches} Photos Found`;

  // Render Day Filter Tabs
  const dayTabsContainer = document.getElementById('client-day-tabs');
  const days = activeEventData?.days || [];

  let tabsHtml = `
    <button onclick="filterPhotosByDay('all')" class="day-filter-btn px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeDayFilter === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}">
      All Days (${currentMatchedPhotos.length})
    </button>
  `;

  days.forEach(d => {
    const count = currentMatchedPhotos.filter(p => p.day_id === d.id).length;
    tabsHtml += `
      <button onclick="filterPhotosByDay('${d.id}')" class="day-filter-btn px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeDayFilter === d.id ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}">
        ${d.title} (${count})
      </button>
    `;
  });

  dayTabsContainer.innerHTML = tabsHtml;
  renderPhotosGrid();

  // Scroll to results
  section.scrollIntoView({ behavior: 'smooth' });
}

function filterPhotosByDay(dayId) {
  activeDayFilter = dayId;
  renderMatchedResults({ total_matches: currentMatchedPhotos.length, photos: currentMatchedPhotos });
}

function renderPhotosGrid() {
  const container = document.getElementById('matched-photos-grid');
  const filtered = activeDayFilter === 'all'
    ? currentMatchedPhotos
    : currentMatchedPhotos.filter(p => p.day_id === activeDayFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-400">
        <i data-lucide="image-off" class="w-12 h-12 mx-auto mb-2 text-slate-300"></i>
        <p class="font-semibold text-slate-700">Is din me aapki koi photo nahi mili</p>
        <p class="text-xs text-slate-400">Try selecting 'All Days' above</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = filtered.map(p => {
    const isFav = albumFavorites.has(p.id);
    return `
      <div class="group relative rounded-2xl overflow-hidden bg-slate-100 aspect-square border border-slate-200/80 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer" onclick="openLightbox('${p.id}')">
        <img src="${(p.thumbnail_url || p.original_url).startsWith('http') ? (p.thumbnail_url || p.original_url) : (API_BASE + (p.thumbnail_url || p.original_url))}" alt="Matched Photo" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">

        <!-- Gradient overlay -->
        <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>

        <!-- Badges -->
        <div class="absolute top-2 left-2">
          <span class="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold">
            ${p.day_title}
          </span>
        </div>

        <div class="absolute top-2 right-2">
          <span class="px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold shadow-sm">
            ${p.match_percentage}% Match
          </span>
        </div>

        <!-- Quick Actions Overlay -->
        <div class="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation()">
          <button onclick="toggleFavoritePhoto('${p.id}', event)" class="p-2 rounded-xl bg-white/90 backdrop-blur-md hover:bg-white text-slate-800 transition-all ${isFav ? 'text-rose-500' : ''}" title="Select for Album">
            <i data-lucide="heart" class="w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}"></i>
          </button>
          <a href="${p.original_url.startsWith('http') ? p.original_url : (API_BASE + p.original_url)}" download="${p.filename}" class="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all flex items-center shadow-md">
            <i data-lucide="download" class="w-3.5 h-3.5 mr-1"></i> Save
          </a>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ----------------- FAVORITES & LIGHTBOX -----------------

function toggleFavoritePhoto(photoId, e) {
  if (e) e.stopPropagation();
  if (albumFavorites.has(photoId)) {
    albumFavorites.delete(photoId);
    showToast('Removed from Album Selection');
  } else {
    albumFavorites.add(photoId);
    showToast('Saved to Album Selection! ❤️');
  }
  localStorage.setItem('facesnap_favorites', JSON.stringify(Array.from(albumFavorites)));
  renderPhotosGrid();
}

function openLightbox(photoId) {
  const photo = currentMatchedPhotos.find(p => p.id === photoId);
  if (!photo) return;

  currentLightboxPhoto = photo;
  document.getElementById('lightbox-img').src = photo.original_url;
  document.getElementById('lightbox-day-tag').innerText = `${photo.day_title} • ${photo.match_percentage}% Match`;
  document.getElementById('lightbox-filename').innerText = photo.filename;

  const downloadBtn = document.getElementById('lightbox-btn-download');
  downloadBtn.href = photo.original_url;
  downloadBtn.download = photo.filename;

  const favBtn = document.getElementById('lightbox-btn-fav');
  const isFav = albumFavorites.has(photoId);
  favBtn.innerHTML = isFav 
    ? `<i data-lucide="heart" class="w-4 h-4 mr-1.5 fill-rose-500 text-rose-500"></i> Selected for Album`
    : `<i data-lucide="heart" class="w-4 h-4 mr-1.5"></i> Select for Album`;

  document.getElementById('modal-lightbox').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeLightbox(e) {
  document.getElementById('modal-lightbox').classList.add('hidden');
}

function toggleFavoriteCurrentPhoto() {
  if (currentLightboxPhoto) {
    toggleFavoritePhoto(currentLightboxPhoto.id);
    openLightbox(currentLightboxPhoto.id);
  }
}

// ----------------- DOWNLOAD ALL MATCHED PHOTOS (ZIP) -----------------

async function downloadAllMatchedZip() {
  if (!currentMatchedPhotos || currentMatchedPhotos.length === 0 || !activeEventId) {
    showToast('No matched photos to download', true);
    return;
  }

  showToast('Creating high-res ZIP package of all your photos...');
  try {
    const photoIds = currentMatchedPhotos.map(p => p.id);
    const res = await fetch(`${API_BASE}/api/events/${activeEventId}/download-zip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_ids: photoIds })
    });

    if (!res.ok) throw new Error('ZIP generation failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeEventData?.title || 'wedding'}_my_photos.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    showToast('All photos downloaded successfully!');
  } catch (err) {
    console.error(err);
    showToast('Failed to download ZIP', true);
  }
}

// ----------------- SAAS PRICING PLANS -----------------

async function fetchPricing() {
  try {
    const res = await fetch(`${API_BASE}/api/pricing`);
    const plans = await res.json();
    renderPricingCards(plans);
  } catch (err) {
    console.error('Failed to load pricing:', err);
  }
}

function renderPricingCards(plans) {
  const container = document.getElementById('pricing-cards-container');
  if (!plans || plans.length === 0) return;

  container.innerHTML = plans.map(p => {
    const isPopular = p.recommended;
    return `
      <div class="relative bg-white rounded-3xl p-8 border ${isPopular ? 'border-brand-500 shadow-2xl scale-105 z-10' : 'border-slate-200 shadow-sm'} flex flex-col justify-between space-y-6">
        ${isPopular ? `
          <div class="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-brand-600 to-accent-600 text-white text-xs font-black uppercase tracking-wider shadow">
            Most Popular for Photographers
          </div>
        ` : ''}

        <div>
          <h3 class="text-xl font-bold text-slate-900">${p.name}</h3>
          <p class="text-xs text-slate-500 mt-1">${p.events_limit}</p>

          <div class="mt-4 flex items-baseline">
            <span class="text-4xl font-black text-slate-900">${p.price_inr}</span>
            <span class="text-xs text-slate-400 ml-2 font-medium">(${p.price_usd})</span>
          </div>
          <p class="text-xs text-brand-600 font-semibold mt-1">${p.storage}</p>

          <ul class="mt-6 space-y-3 text-xs text-slate-600 border-t border-slate-100 pt-6">
            ${p.features.map(f => `
              <li class="flex items-start">
                <i data-lucide="check" class="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0 mt-0.5"></i>
                <span>${f}</span>
              </li>
            `).join('')}
          </ul>
        </div>

        <button onclick="showToast('Subscription checkout ready! Razorpay / Stripe connected.')" class="w-full py-3 rounded-xl ${isPopular ? 'bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-lg shadow-brand-600/30' : 'bg-slate-900 hover:bg-slate-800 text-white font-semibold'} text-sm transition-all">
          Sell This Plan
        </button>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ----------------- SUBSCRIPTION & PAYWALL ENGINE -----------------

let subscriptionData = null;

async function fetchSubscriptionStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/subscription/status`);
    const data = await res.json();
    subscriptionData = data;
    updateSubscriptionUI(data);
  } catch (err) {
    console.error('Failed to load subscription status:', err);
  }
}

function updateSubscriptionUI(data) {
  const badge = document.getElementById('nav-sub-badge');
  const badgeText = document.getElementById('nav-sub-text');
  const upiEl = document.getElementById('sub-seller-upi');
  const waBtn = document.getElementById('btn-whatsapp-buy');

  if (upiEl && data.upi_id) upiEl.innerText = data.upi_id;
  if (waBtn && data.seller_contact) {
    const cleanPhone = data.seller_contact.replace(/[^0-9]/g, '');
    waBtn.href = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent('Hi! I want to buy the 1-Year Photo AI Plan for Rs.4999')}`;
  }

  if (badge && badgeText) {
    if (data.is_active) {
      badge.className = "inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all shadow-sm";
      badgeText.innerHTML = `🟢 1-Year Active (${data.days_left}d left)`;
    } else {
      badge.className = "inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all shadow-sm";
      badgeText.innerHTML = `🔒 1-Year Pass: Inactive (Buy ₹4,999)`;
    }
  }
}

function openSubscriptionModal() {
  document.getElementById('modal-subscription').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeSubscriptionModal() {
  document.getElementById('modal-subscription').classList.add('hidden');
}

async function handleActivateLicenseKey() {
  const input = document.getElementById('sub-license-input');
  const key = input.value.trim();
  if (!key) {
    showToast('Kripya license key enter karein', true);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/subscription/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.detail || data.message || 'Invalid License Key', true);
      return;
    }

    showToast(data.message || '1-Year Subscription Activated Successfully! 🎉');
    closeSubscriptionModal();
    fetchSubscriptionStatus();
  } catch (err) {
    console.error(err);
    showToast('Failed to activate key', true);
  }
}

function copySellerUpi() {
  const upi = document.getElementById('sub-seller-upi').innerText;
  navigator.clipboard.writeText(upi);
  showToast('UPI ID copied to clipboard!');
}

// ----------------- SUPER ADMIN LICENSE GENERATOR (FOR SELLER) -----------------

const ADMIN_SECRET_PIN = "8669";

function promptAdminPin() {
  const enteredPin = prompt("🔒 Admin Security PIN enter karein:");
  if (enteredPin === null) return;

  if (enteredPin.trim() === ADMIN_SECRET_PIN) {
    sessionStorage.setItem('facescan_admin_auth', 'true');
    document.getElementById('modal-admin-keys').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    showToast("Admin Verified Successfully! 🔑");
  } else {
    showToast("Galat Admin PIN! Access Denied.", true);
  }
}

function openAdminKeyModal() {
  if (sessionStorage.getItem('facescan_admin_auth') === 'true') {
    document.getElementById('modal-admin-keys').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  } else {
    promptAdminPin();
  }
}

function closeAdminKeyModal() {
  document.getElementById('modal-admin-keys').classList.add('hidden');
}

async function handleGenerateNewKey() {
  try {
    const res = await fetch(`${API_BASE}/api/subscription/generate-key`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast('Key generate nahi ho saki', true);
      return;
    }

    document.getElementById('new-key-display-box').classList.remove('hidden');
    document.getElementById('generated-key-text').innerText = data.key;
    showToast('New 1-Year Key generated for ₹4,999!');
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error(err);
    showToast('Error generating key', true);
  }
}

function copyGeneratedKey() {
  const key = document.getElementById('generated-key-text').innerText;
  navigator.clipboard.writeText(key);
  showToast('License Key copied! Send to photographer on WhatsApp.');
}

// ----------------- SHARE PITCH MODAL FOR PHOTOGRAPHERS -----------------

function openSharePitchModal() {
  const currentOrigin = window.location.origin;
  const demoEventId = (eventsList && eventsList.length > 0) ? eventsList[0].id : 'evt_5a538daa';
  const defaultTunnel = 'https://screens-wrapped-vol-representative.trycloudflare.com';
  const activeBase = (currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1'))
    ? defaultTunnel
    : currentOrigin;
  const fullDemoUrl = `${activeBase}/event/${demoEventId}`;

  const pitchUrlInput = document.getElementById('pitch-public-url');
  if (pitchUrlInput) pitchUrlInput.value = fullDemoUrl;

  const pitchTextEl = document.getElementById('pitch-whatsapp-text');
  if (pitchTextEl) {
    pitchTextEl.value = `📸 *Wedding & Event Photographers ke liye AI Smart Photo Sharing Software!* 🚀

Kya aapke wedding clients ko 3,000–5,000 photos me apni photo dhoondhne me ghanto lagte hain?

Ab aap apne clients ko direct QR Code aur link de sakte hain:
✨ *Client sirf apna Face Scan (Selfie) karega* aur Day 1 (Haldi) se lekar last day tak ki uski saari photos 1 second me mil jayengi!

👉 *Live Demo Link check karein:*
${fullDemoUrl}
*(Apna chehra scan karke dekhein AI kaise turant photos dhoondhta hai!)*

🔥 *Special Offer for Photographers:*
Pura 1 Saal (365 Days) Unlimited Weddings ke liye — *Sirf ₹4,999!*

✅ Unlimited Events & Photos
✅ Wedding Hall Standee & QR Code Generator
✅ Client Single-Click ZIP Downloads
✅ Watermark & Album Selection (❤️ Favorites)

💳 UPI Payment: 8669173204@upi
Buy karne ke liye abhi WhatsApp karein: +91 8669173204`;
  }

  document.getElementById('modal-share-pitch').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeSharePitchModal() {
  document.getElementById('modal-share-pitch').classList.add('hidden');
}

function copyPitchUrl() {
  const url = document.getElementById('pitch-public-url').value;
  navigator.clipboard.writeText(url);
  showToast('Live Demo link copied to clipboard!');
}

function copyPitchText() {
  const text = document.getElementById('pitch-whatsapp-text').value;
  navigator.clipboard.writeText(text);
  showToast('WhatsApp Pitch message copied! Paste in WhatsApp.');
}

function sharePitchDirectWhatsApp() {
  const text = document.getElementById('pitch-whatsapp-text').value;
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}

// ----------------- ADMIN HASH & SECRET ACCESS -----------------
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#admin') {
    promptAdminPin();
  }
});
if (window.location.hash === '#admin') {
  setTimeout(promptAdminPin, 500);
}

