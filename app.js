// ===== Firebase (Compat SDK v10 — chạy được như file tĩnh, không cần server) =====
// === THAY THẾ CONFIG FIREBASE CỦA BẠN VÀO ĐÂY ===
const firebaseConfig = {
    apiKey: "AIzaSyDmzHTFW5LVuO1fFAX44eJAuI1fwSrV2Yg",
    authDomain: "ksk-crud.firebaseapp.com",
    databaseURL: "https://ksk-crud-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ksk-crud",
    storageBucket: "ksk-crud.appspot.com",
    messagingSenderId: "598973564084",
    appId: "1:598973564084:web:fbca8dda4e7ead360503e1"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

function ref(_db, path) { return path ? _db.ref(path) : _db.ref(); }
function push(r, data) { return r.push(data); }
function update(r, updates) { return r.update(updates); }
function remove(r) { return r.remove(); }
function onValue(r, cb) { r.on('value', cb); return () => r.off('value', cb); }
function onAuthStateChanged(a, cb) { return a.onAuthStateChanged(cb); }
function signInWithEmailAndPassword(a, email, pw) { return a.signInWithEmailAndPassword(email, pw); }
function signOut(a) { return a.signOut(); }
function sendPasswordResetEmail(a, email) { return a.sendPasswordResetEmail(email); }

// ===== DOM refs =====
const loginScreen = document.getElementById('loginScreen');
const appShell = document.getElementById('appShell');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const logoutBtn = document.getElementById('logoutBtn');
const staffEmailLabel = document.getElementById('staffEmailLabel');

const batchSelect = document.getElementById('batchSelect');
const newBatchBtn = document.getElementById('newBatchBtn');
const newBatchModal = document.getElementById('newBatchModal');
const newBatchForm = document.getElementById('newBatchForm');
const cancelNewBatchBtn = document.getElementById('cancelNewBatchBtn');
const noBatchBanner = document.getElementById('noBatchBanner');
const tableBody = document.getElementById('tableBody');
const tableHead = document.querySelector('#dataTable thead');

// ===== State =====
let currentUser = null;
let batchListCache = {};
let activeBatchId = localStorage.getItem('activeBatchId') || null;
let rawRecordsCache = null;
let currentSortField = 'stt';
let currentSortOrder = 'asc';
let unsubBatchRecords = null;

window.__appState = { activeBatchId: null, activeBatchName: '' };

// ===== Helpers =====
function toUpperVN(str) {
    return (str || '').toString().toLocaleUpperCase('vi-VN');
}

function formatTimestamp(ts) {
    if (!ts) return '---';
    let date = new Date(Number(ts));
    let day = String(date.getDate()).padStart(2, '0');
    let month = String(date.getMonth() + 1).padStart(2, '0');
    let year = date.getFullYear();
    let hours = String(date.getHours()).padStart(2, '0');
    let minutes = String(date.getMinutes()).padStart(2, '0');
    let seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function getTimeFromFirebaseId(id) {
    if (!id || id.length < 8) return Date.now();
    let PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
    let timestamp = 0;
    for (let i = 0; i < 8; i++) {
        timestamp = timestamp * 64 + PUSH_CHARS.indexOf(id[i]);
    }
    return timestamp;
}

function setEntryEnabled(enabled) {
    document.querySelectorAll('#entrySections input, #entrySections select, #entrySections button')
        .forEach(el => { el.disabled = !enabled; });
    noBatchBanner.style.display = enabled ? 'none' : 'block';
}

// ===== Auth =====
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginScreen.style.display = 'none';
        appShell.style.display = 'block';
        staffEmailLabel.textContent = user.email;
        attachBatchMetaListener();
    } else {
        currentUser = null;
        detachBatchMetaListener();
        detachBatchListeners();
        activeBatchId = null;
        window.__appState.activeBatchId = null;
        window.__appState.activeBatchName = '';
        appShell.style.display = 'none';
        loginScreen.style.display = 'flex';
        loginForm.reset();
        loginError.textContent = '';
    }
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginError.textContent = '';
    signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value)
        .catch(() => {
            loginError.textContent = 'Email hoặc mật khẩu không đúng.';
        });
});

logoutBtn.addEventListener('click', () => signOut(auth));

forgotPasswordLink.addEventListener('click', () => {
    let email = loginEmail.value.trim();
    if (!email) {
        email = prompt('Nhập email nhân viên để nhận link đặt lại mật khẩu:') || '';
    }
    if (!email) return;
    sendPasswordResetEmail(auth, email)
        .then(() => alert('Đã gửi email đặt lại mật khẩu (nếu email tồn tại trong hệ thống).'))
        .catch(() => alert('Không thể gửi email đặt lại mật khẩu. Kiểm tra lại địa chỉ email.'));
});

// ===== Batch list (dropdown) =====
let unsubBatchMeta = null;

function attachBatchMetaListener() {
    unsubBatchMeta = onValue(ref(db, 'batchMeta'), (snapshot) => {
        batchListCache = snapshot.val() || {};
        renderBatchDropdown();
    });
}

function detachBatchMetaListener() {
    if (unsubBatchMeta) { unsubBatchMeta(); unsubBatchMeta = null; }
    batchListCache = {};
}

function renderBatchDropdown() {
    const entries = Object.entries(batchListCache)
        .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

    batchSelect.innerHTML = '<option value="">-- Chọn đợt khám --</option>';
    entries.forEach(([id, meta]) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = meta.date ? `${meta.name} (${meta.date})` : meta.name;
        if (meta.status === 'archived') opt.textContent += ' [Đã lưu trữ]';
        batchSelect.appendChild(opt);
    });

    // Khôi phục đợt khám đã chọn lần trước trên trình duyệt này, nếu vẫn còn tồn tại
    if (activeBatchId && batchListCache[activeBatchId]) {
        batchSelect.value = activeBatchId;
        if (!unsubBatchRecords) selectBatch(activeBatchId, false);
    } else {
        // Đợt khám cũ đã bị xóa/không còn tồn tại, hoặc chưa từng chọn đợt nào
        activeBatchId = null;
        localStorage.removeItem('activeBatchId');
        detachBatchListeners();
        setEntryEnabled(false);
    }
}

batchSelect.addEventListener('change', () => {
    const id = batchSelect.value;
    if (id) selectBatch(id, true);
    else {
        detachBatchListeners();
        activeBatchId = null;
        window.__appState.activeBatchId = null;
        window.__appState.activeBatchName = '';
        localStorage.removeItem('activeBatchId');
        setEntryEnabled(false);
        tableBody.innerHTML = '';
    }
});

function selectBatch(id, persist) {
    activeBatchId = id;
    const meta = batchListCache[id] || {};
    window.__appState.activeBatchId = id;
    window.__appState.activeBatchName = meta.name || '';
    if (persist) localStorage.setItem('activeBatchId', id);
    batchSelect.value = id;
    setEntryEnabled(true);
    attachBatchListeners(id);
}

// ===== Batch-scoped records listener =====
function attachBatchListeners(batchId) {
    detachBatchListeners();

    unsubBatchRecords = onValue(ref(db, `batchRecords/${batchId}`), (snapshot) => {
        rawRecordsCache = snapshot.val();
        renderTable();
    });
}

function detachBatchListeners() {
    if (unsubBatchRecords) { unsubBatchRecords(); unsubBatchRecords = null; }
    rawRecordsCache = null;
    tableBody.innerHTML = '';
}

// ===== Tạo đợt khám mới =====
newBatchBtn.addEventListener('click', () => {
    newBatchForm.reset();
    newBatchModal.style.display = 'flex';
});
cancelNewBatchBtn.addEventListener('click', () => { newBatchModal.style.display = 'none'; });

newBatchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newBatchName').value.trim();
    const date = document.getElementById('newBatchDate').value;
    const location = document.getElementById('newBatchLocation').value.trim();
    if (!name) { alert('Vui lòng nhập tên đợt khám!'); return; }

    const newRef = push(ref(db, 'batchMeta'));
    const id = newRef.key;
    const updates = {};
    updates[`batchMeta/${id}`] = {
        name, date: date || '', location: location || '',
        status: 'active',
        createdByEmail: currentUser.email,
        createdAt: Date.now()
    };
    await update(ref(db), updates);
    newBatchModal.style.display = 'none';
    selectBatch(id, true);
});

// ===== Sắp xếp bảng: bấm vào tiêu đề cột bất kỳ để sắp xếp theo cột đó =====
function updateSortHeaders() {
    tableHead.querySelectorAll('th[data-field]').forEach((th) => {
        if (th.dataset.field === currentSortField) {
            th.setAttribute('data-sort', currentSortOrder);
        } else {
            th.removeAttribute('data-sort');
        }
    });
}

tableHead.addEventListener('click', (e) => {
    const th = e.target.closest('th[data-field]');
    if (!th) return;
    const field = th.dataset.field;
    if (currentSortField === field) {
        currentSortOrder = (currentSortOrder === 'asc') ? 'desc' : 'asc';
    } else {
        currentSortField = field;
        currentSortOrder = 'asc';
    }
    updateSortHeaders();
    renderTable();
});

updateSortHeaders();

// ===== Ghi bản ghi mới vào đợt khám đang chọn =====
function pushRecord(data) {
    if (!activeBatchId) {
        alert('Vui lòng chọn hoặc tạo đợt khám trước khi thêm dữ liệu!');
        return;
    }
    const nowMs = Date.now();
    push(ref(db, `batchRecords/${activeBatchId}`), {
        ...data,
        name: toUpperVN(data.name),
        createdAt: formatTimestamp(nowMs),
        timestamp: nowMs,
        createdByEmail: currentUser.email,
        createdBy: currentUser.uid
    });
}

function updateRecordField(key, field, rawValue) {
    if (!activeBatchId) return;
    const value = (field === 'name') ? toUpperVN(rawValue) : rawValue;
    update(ref(db, `batchRecords/${activeBatchId}/${key}`), {
        [field]: value,
        updatedByEmail: currentUser.email,
        updatedBy: currentUser.uid,
        updatedAt: Date.now()
    });
}

// ===== Xóa bản ghi =====
function deleteRecord(key) {
    if (!activeBatchId) return;
    const item = rawRecordsCache && rawRecordsCache[key];
    const label = item && item.name ? `"${item.name}"` : 'này';
    if (!confirm(`Xóa bản ghi ${label}? Không thể hoàn tác.`)) return;
    remove(ref(db, `batchRecords/${activeBatchId}/${key}`));
}

// ===== Sửa bản ghi (modal đầy đủ các trường) =====
const editRecordModal = document.getElementById('editRecordModal');
const editRecordForm = document.getElementById('editRecordForm');
const cancelEditBtn = document.getElementById('cancelEditBtn');
let editingRecordKey = null;

function openEditModal(key) {
    const item = rawRecordsCache && rawRecordsCache[key];
    if (!item) return;
    editingRecordKey = key;
    document.getElementById('editCccd').value = item.cccd || '';
    document.getElementById('editName').value = item.name || '';
    document.getElementById('editDob').value = item.dob || '';
    document.getElementById('editGender').value = item.gender || 'Nam';
    document.getElementById('editAddress').value = item.address || '';
    document.getElementById('editPhone').value = item.phone || '';
    editRecordModal.style.display = 'flex';
}

cancelEditBtn.addEventListener('click', () => {
    editRecordModal.style.display = 'none';
    editingRecordKey = null;
});

editRecordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!editingRecordKey || !activeBatchId) return;

    const name = document.getElementById('editName').value.trim();
    if (!name) { alert('Vui lòng nhập họ và tên!'); return; }

    update(ref(db, `batchRecords/${activeBatchId}/${editingRecordKey}`), {
        cccd: document.getElementById('editCccd').value.trim(),
        name: toUpperVN(name),
        dob: document.getElementById('editDob').value.trim(),
        gender: document.getElementById('editGender').value,
        address: document.getElementById('editAddress').value.trim(),
        phone: document.getElementById('editPhone').value.trim(),
        updatedByEmail: currentUser.email,
        updatedBy: currentUser.uid,
        updatedAt: Date.now()
    });

    editRecordModal.style.display = 'none';
    editingRecordKey = null;
});

// ===== Sắp xếp dữ liệu ngày sinh (DD/MM/YYYY) theo thứ tự thời gian thực =====
function dobSortKey(dob) {
    const parts = (dob || '').split('/');
    if (parts.length === 3 && parts.every(p => /^\d+$/.test(p))) {
        return Number(parts[2]) * 10000 + Number(parts[1]) * 100 + Number(parts[0]);
    }
    return -1;
}

function getSortValue(item, field) {
    switch (field) {
        case 'stt': return item.sttNum;
        case 'createdAt': return item.timestampRaw;
        case 'dob': return dobSortKey(item.dob);
        default: return (item[field] || '').toString().toLocaleLowerCase('vi-VN');
    }
}

// ===== Vẽ lại bảng lưới dựa trên cache dữ liệu =====
function renderTable() {
    tableBody.innerHTML = '';
    if (!rawRecordsCache) return;

    const startNum = 1;
    let records = Object.entries(rawRecordsCache);

    records.sort((a, b) => {
        let sttA = a[1].customSTT !== undefined ? Number(a[1].customSTT) : 0;
        let sttB = b[1].customSTT !== undefined ? Number(b[1].customSTT) : 0;
        if (sttA !== 0 && sttB !== 0 && sttA !== sttB) {
            return sttA - sttB;
        }
        let timeA = a[1].timestamp || getTimeFromFirebaseId(a[0]);
        let timeB = b[1].timestamp || getTimeFromFirebaseId(b[0]);
        return timeA - timeB;
    });

    let formattedRecords = records.map(([key, item], index) => {
        let assignedNum = (item.customSTT !== undefined && item.customSTT !== '') ? Number(item.customSTT) : (startNum + index);
        let exactTime = item.timestamp || getTimeFromFirebaseId(key);

        return {
            key: key,
            sttNum: assignedNum,
            sttFormatted: String(assignedNum).padStart(4, '0'),
            cccd: item.cccd || '',
            name: item.name || '',
            dob: item.dob || '',
            gender: item.gender || 'Nam',
            address: item.address || '',
            phone: item.phone || '',
            timestampRaw: exactTime,
            createdAt: formatTimestamp(exactTime),
            createdByEmail: item.createdByEmail || '---'
        };
    });

    formattedRecords.sort((a, b) => {
        const va = getSortValue(a, currentSortField);
        const vb = getSortValue(b, currentSortField);
        const cmp = (typeof va === 'number' && typeof vb === 'number')
            ? va - vb
            : String(va).localeCompare(String(vb), 'vi');
        return currentSortOrder === 'asc' ? cmp : -cmp;
    });

    formattedRecords.forEach((item) => {
        let row = `<tr>
            <td style="text-align: center;"><input type="checkbox" class="row-checkbox" data-stt="${item.sttFormatted}" data-name="${item.name}" data-dob="${item.dob}" data-gender="${item.gender}"></td>
            <td class="editable-cell" data-key="${item.key}" data-field="customSTT" style="text-align: center; font-weight: bold;">${item.sttFormatted}</td>
            <td style="text-align: center;">${item.cccd}</td>
            <td class="editable-cell" data-key="${item.key}" data-field="name">${item.name}</td>
            <td style="text-align: center;">${item.dob}</td>
            <td style="text-align: center;">${item.gender}</td>
            <td>${item.address}</td>
            <td style="text-align: center;">${item.phone}</td>
            <td style="text-align: center;">${item.createdAt}</td>
            <td style="text-align: center; font-size: 12px; color: var(--ink-muted);">${item.createdByEmail}</td>
            <td class="row-actions">
                <button class="btn-print" onclick="printSingleSTT('${item.sttFormatted}', '${item.name}', '${item.dob}', '${item.gender}')">In Tem</button>
                <button class="btn-edit" onclick="openEditModal('${item.key}')">Sửa</button>
                <button class="btn-delete" onclick="deleteRecord('${item.key}')">Xóa</button>
            </td>
        </tr>`;
        tableBody.insertAdjacentHTML('beforeend', row);
    });
}

// ===== Sửa STT / Tên tại chỗ (inline edit) =====
tableBody.addEventListener('click', (e) => {
    const cell = e.target.closest('.editable-cell');
    if (!cell || cell.querySelector('input')) return;

    const currentText = cell.textContent.trim();
    const field = cell.dataset.field;
    const key = cell.dataset.key;

    const input = document.createElement('input');
    input.type = (field === 'customSTT') ? 'number' : 'text';
    input.value = (field === 'customSTT') ? parseInt(currentText, 10) : currentText;
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
        const newValue = input.value.trim();
        if (newValue !== '' && newValue !== currentText) {
            updateRecordField(key, field, field === 'customSTT' ? Number(newValue) : newValue);
        } else {
            renderTable();
        }
    };

    input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
        if (ev.key === 'Escape') { renderTable(); }
    });
    input.addEventListener('blur', commit);
});

// ===== 3. Xử lý khi quét mã QR CCCD (dùng chung cho máy quét vật lý và camera) =====
function handleScannedCccdPayload(rawData) {
    let data = (rawData || '').trim().split('|');

    if (data.length >= 6) {
        let cccd = data[0];
        let name = data[2];
        let dobRaw = data[3];

        let dobFormatted = dobRaw;
        if (dobRaw.length === 8) {
            dobFormatted = `${dobRaw.substring(0, 2)}/${dobRaw.substring(2, 4)}/${dobRaw.substring(4, 8)}`;
        }

        pushRecord({
            cccd: cccd,
            name: name,
            dob: dobFormatted,
            gender: data[4],
            address: data[5]
        });
        return true;
    }

    alert("Dữ liệu quét không phải mã QR CCCD hợp lệ!");
    return false;
}

const cccdInput = document.getElementById('cccdInput');
cccdInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleScannedCccdPayload(this.value);
        this.value = '';
    }
});

// ===== 3b. Quét CCCD bằng Camera điện thoại (tùy chọn thêm, không thay thế máy quét) =====
const openCameraScanBtn = document.getElementById('openCameraScanBtn');
const cameraScanModal = document.getElementById('cameraScanModal');
const closeCameraScanBtn = document.getElementById('closeCameraScanBtn');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const toggleTorchBtn = document.getElementById('toggleTorchBtn');
const captureScanBtn = document.getElementById('captureScanBtn');
const cameraScanStatus = document.getElementById('cameraScanStatus');

let html5QrCode = null;
let cameraDeviceList = [];
let currentCameraIndex = -1; // -1 = đang dùng camera sau mặc định (facingMode), chưa chọn camera cụ thể
let isProcessingScan = false;
let torchOn = false;

function setCameraStatus(msg, isError) {
    cameraScanStatus.textContent = msg || '';
    cameraScanStatus.classList.toggle('error', !!isError);
}

// Bật/tắt đèn flash chỉ hiện nút nếu máy hỗ trợ (nhiều thẻ CCCD ép plastic
// bóng, cần đủ sáng để camera đọc được mã QR dày đặc)
function refreshTorchAvailability() {
    torchOn = false;
    toggleTorchBtn.textContent = 'Bật đèn';
    toggleTorchBtn.style.display = 'none';
    try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && capabilities.torch) {
            toggleTorchBtn.style.display = '';
        }
    } catch (err) {
        // Máy/trình duyệt không hỗ trợ truy vấn capability — bỏ qua, không hiện nút
    }
}

function stopCameraIfRunning() {
    if (!html5QrCode) return Promise.resolve();
    // .stop() có thể throw đồng bộ (không phải reject promise) nếu camera chưa từng
    // start thành công — bọc try/catch để không bao giờ làm treo luồng gọi nó
    try {
        return Promise.resolve(html5QrCode.stop()).catch(() => {});
    } catch (err) {
        return Promise.resolve();
    }
}

function onCameraScanSuccess(decodedText) {
    if (isProcessingScan) return;
    isProcessingScan = true;
    stopCameraIfRunning().then(() => {
        cameraScanModal.style.display = 'none';
        handleScannedCccdPayload(decodedText);
    });
}

// Ô quét thích ứng theo kích thước khung hình thực tế (thay vì cố định 250px),
// để không bị quá nhỏ so với video độ phân giải cao
function adaptiveQrBox(viewfinderWidth, viewfinderHeight) {
    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
    const size = Math.floor(minEdge * 0.75);
    return { width: size, height: size };
}

// Yêu cầu độ phân giải cao hơn mặc định — mã QR trên CCCD gắn chip khá dày đặc,
// độ phân giải thấp (mặc định trình duyệt hay dùng) thường không đọc nổi.
// Lưu ý: cameraIdOrConfig chỉ được phép có ĐÚNG 1 key (facingMode HOẶC deviceId),
// nên width/height phải truyền riêng qua videoConstraints, không được gộp chung.
// Trả về true/false để nơi gọi biết có cần thử phương án khác không.
async function startCameraWith(cameraIdOrConfig) {
    setCameraStatus('Đang mở camera...');
    try {
        await html5QrCode.start(
            cameraIdOrConfig,
            {
                fps: 10,
                qrbox: adaptiveQrBox,
                videoConstraints: {
                    width: { ideal: 2560 },
                    height: { ideal: 1440 },
                    advanced: [{ focusMode: 'continuous' }]
                }
            },
            onCameraScanSuccess,
            () => {} // lỗi giải mã từng khung hình, bỏ qua, camera tiếp tục tự quét
        );
        setCameraStatus('Đưa mã QR trên CCCD vào khung hình, cách khoảng 15–20cm, giữ yên tay — hệ thống tự nhận diện, không cần bấm nút chụp.');
        refreshTorchAvailability();
        return true;
    } catch (err) {
        console.error(err);
        setCameraStatus('Không mở được camera: ' + (err.message || err), true);
        return false;
    }
}

// facingMode (kể cả "exact") không đáng tin cậy trên Safari/iPhone — có thể "thành
// công" nhưng vẫn âm thầm trả về camera trước. Cách chắc chắn hơn: chọn đúng camera
// theo TÊN (label) trả về từ getCameras(), ưu tiên "Back Camera" thường (không phải
// ultra wide/tele, vì góc quá rộng sẽ khó lấy nét cận cảnh mã QR nhỏ).
function pickBackCameraId(devices) {
    if (!devices || devices.length === 0) return null;
    if (devices.length === 1) return devices[0].id;

    const isBack = (label) => /back|rear|environment/i.test(label || '');
    const isFront = (label) => /front|user|face|selfie/i.test(label || '');
    const isWideOrTele = (label) => /ultra ?wide|tele/i.test(label || '');

    let candidates = devices.filter((d) => isBack(d.label) && !isWideOrTele(d.label));
    if (candidates.length > 0) return candidates[0].id;

    candidates = devices.filter((d) => isBack(d.label));
    if (candidates.length > 0) return candidates[0].id;

    candidates = devices.filter((d) => !isFront(d.label));
    if (candidates.length > 0) return candidates[0].id;

    return null; // không nhận diện được camera nào chắc chắn không phải camera trước
}

openCameraScanBtn.addEventListener('click', async () => {
    isProcessingScan = false;
    cameraScanModal.style.display = 'flex';
    toggleTorchBtn.style.display = 'none';

    if (!window.isSecureContext) {
        setCameraStatus('Tính năng camera chỉ hoạt động khi mở trang qua đường link https (bản đã publish) — không dùng được khi mở trực tiếp file trên máy.', true);
        return;
    }

    if (!html5QrCode) {
        // experimentalFeatures.useBarCodeDetectorIfSupported: ưu tiên dùng engine
        // quét mã vạch/QR gốc của hệ điều hành (nhanh và đọc chính xác hơn nhiều so
        // với engine JS thuần) trên các trình duyệt hỗ trợ (chủ yếu Chrome Android)
        try {
            html5QrCode = new Html5Qrcode('qrReaderView', {
                verbose: false,
                experimentalFeatures: { useBarCodeDetectorIfSupported: true }
            });
        } catch (err) {
            html5QrCode = new Html5Qrcode('qrReaderView');
        }
    }

    try {
        cameraDeviceList = await Html5Qrcode.getCameras();
    } catch (err) {
        cameraDeviceList = [];
    }

    const backCameraId = pickBackCameraId(cameraDeviceList);
    if (backCameraId) {
        currentCameraIndex = cameraDeviceList.findIndex((d) => d.id === backCameraId);
        const ok = await startCameraWith(backCameraId);
        if (!ok) await startCameraWith({ facingMode: { ideal: 'environment' } });
    } else {
        currentCameraIndex = -1;
        await startCameraWith({ facingMode: { ideal: 'environment' } });
    }
});

closeCameraScanBtn.addEventListener('click', async () => {
    try {
        await stopCameraIfRunning();
    } finally {
        cameraScanModal.style.display = 'none';
    }
});

toggleTorchBtn.addEventListener('click', async () => {
    const nextState = !torchOn;
    try {
        await html5QrCode.applyVideoConstraints({ advanced: [{ torch: nextState }] });
        torchOn = nextState;
        toggleTorchBtn.textContent = torchOn ? 'Tắt đèn' : 'Bật đèn';
    } catch (err) {
        setCameraStatus('Không bật được đèn flash trên máy này.', true);
    }
});

switchCameraBtn.addEventListener('click', async () => {
    if (cameraDeviceList.length < 2) {
        setCameraStatus('Máy chỉ có 1 camera.', true);
        return;
    }
    try {
        await stopCameraIfRunning();
    } finally {
        currentCameraIndex = (currentCameraIndex + 1) % cameraDeviceList.length;
        startCameraWith(cameraDeviceList[currentCameraIndex].id);
    }
});

// Dự phòng cho trường hợp quét liên tục không nhận (thường gặp trên iPhone/Safari
// vì không có engine quét gốc, chỉ giải mã bằng JavaScript trên video thời gian
// thực): chụp đúng 1 khung hình ở độ phân giải đầy đủ, giải mã riêng ảnh đó —
// không bị giới hạn hiệu năng như quét video liên tục nên đọc được cả mã QR dày đặc.
captureScanBtn.addEventListener('click', async () => {
    const videoEl = document.querySelector('#qrReaderView video');
    if (!videoEl || !videoEl.videoWidth) {
        setCameraStatus('Camera chưa sẵn sàng, đợi vài giây rồi thử lại.', true);
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    setCameraStatus('Đang đọc ảnh vừa chụp...');
    await stopCameraIfRunning();

    canvas.toBlob(async (blob) => {
        if (!blob) {
            setCameraStatus('Chụp ảnh thất bại, thử lại.', true);
            startCameraWith({ facingMode: { ideal: 'environment' } });
            return;
        }
        try {
            const decodedText = await html5QrCode.scanFile(blob, true);
            cameraScanModal.style.display = 'none';
            handleScannedCccdPayload(decodedText);
        } catch (err) {
            setCameraStatus('Không đọc được mã QR trong ảnh vừa chụp — giữ thẻ phẳng, đủ sáng, không loá, gần khung hình hơn rồi thử lại.', true);
            startCameraWith({ facingMode: { ideal: 'environment' } });
        }
    }, 'image/jpeg', 0.92);
});

// ===== 4. Xử lý thêm mới thủ công =====
const manualForm = document.getElementById('manualForm');
manualForm.addEventListener('submit', function (e) {
    e.preventDefault();

    let cccd = document.getElementById('manualCCCD').value.trim();
    let name = document.getElementById('manualName').value.trim();
    let dob = document.getElementById('manualDob').value.trim();
    let gender = document.getElementById('manualGender').value;
    let address = document.getElementById('manualAddress').value.trim();
    let phone = document.getElementById('manualPhone').value.trim();

    if (!name) {
        alert("Vui lòng nhập tên khách hàng!");
        return;
    }

    pushRecord({ cccd, name, dob, gender, address, phone });

    manualForm.reset();
    alert("Đã thêm mới thành công!");
});
