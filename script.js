let currentUser = null;
let transactions = [];

// ==================== NAVIGATION ====================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    window.scrollTo(0, 0);

    if (pageId === 'page-login') {
        const link = document.getElementById('login-setup-link');
        if (link) link.style.display = hasAdmin() ? 'none' : 'block';
    }
}

function switchTab(tabId, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');
    document.querySelector('.sidebar').classList.remove('open');

    if (tabId === 'tab-dashboard') updateDashboard();
    if (tabId === 'tab-history') renderHistory();
    if (tabId === 'tab-report') renderReport();
    if (tabId === 'tab-members') renderMembers();
    if (tabId === 'tab-recap') renderRecapTab();
    if (tabId === 'tab-admin') updateAdminPanel();
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
}

// ==================== TOAST ====================
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast ' + type + ' show';
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ==================== AUTH (ADMIN ONLY) ====================
function getAdmin() {
    return JSON.parse(localStorage.getItem('kasku_admin'));
}

function saveAdmin(admin) {
    localStorage.setItem('kasku_admin', JSON.stringify(admin));
}

function hasAdmin() {
    return getAdmin() !== null;
}

function handleSetup(e) {
    e.preventDefault();
    const name = document.getElementById('setup-name').value.trim();
    const email = document.getElementById('setup-email').value.trim();
    const password = document.getElementById('setup-password').value;
    const confirm = document.getElementById('setup-confirm').value;

    if (password !== confirm) {
        showToast('Password tidak cocok!', 'error');
        return;
    }

    const admin = { name, email, password, role: 'admin', createdAt: new Date().toISOString() };
    saveAdmin(admin);
    showToast('Akun admin berhasil dibuat! Silakan masuk.');
    document.getElementById('form-setup').reset();
    showPage('page-login');
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const admin = getAdmin();
    if (!admin || admin.email !== email || admin.password !== password) {
        showToast('Email atau password salah!', 'error');
        return;
    }

    currentUser = admin;
    localStorage.setItem('kasku_session', JSON.stringify(admin));
    localStorage.setItem('kasku_saved_credentials', JSON.stringify({ email, password }));
    enterDashboard();
    document.getElementById('form-login').reset();
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('kasku_session');
    transactions = [];
    showPage('page-login');
    autoFillLogin();
    showToast('Berhasil keluar.');
}

function checkSession() {
    if (!hasAdmin()) {
        showPage('page-setup');
    } else {
        showPage('page-login');
        autoFillLogin();
    }
}

function autoFillLogin() {
    const saved = JSON.parse(localStorage.getItem('kasku_saved_credentials'));
    if (saved && saved.email && saved.password) {
        setTimeout(() => {
            document.getElementById('login-email').value = saved.email;
            document.getElementById('login-password').value = saved.password;
        }, 100);
    }
}

function enterDashboard() {
    document.getElementById('welcome-name').textContent = currentUser.name;
    document.getElementById('user-name-display').textContent = currentUser.name;
    loadTransactions();
    showPage('page-dashboard');
    switchTab('tab-dashboard', document.querySelector('.nav-item'));
}

// ==================== ADMIN PANEL ====================
function updateAdminPanel() {
    const admin = getAdmin();
    if (!admin) return;

    document.getElementById('admin-name').value = admin.name;
    document.getElementById('admin-email').value = admin.email;
    document.getElementById('admin-total-tx').textContent = transactions.length;

    const dataStr = localStorage.getItem(getStorageKey()) || '[]';
    const sizeKB = (new Blob([dataStr]).size / 1024).toFixed(1);
    document.getElementById('admin-data-size').textContent = sizeKB + ' KB';
    document.getElementById('admin-last-active').textContent = new Date().toLocaleString('id-ID');

    const fonnteKey = getFonnteKey();
    document.getElementById('fonnte-api-key').value = fonnteKey;
    document.getElementById('fonnte-status').innerHTML = fonnteKey
        ? '<span style="color:var(--primary)"><i class="fas fa-check-circle"></i> API Key sudah terisi</span>'
        : '<span style="color:var(--gray-400)">Belum diatur</span>';

    updatePenaltyUI();
}

function updateAdminProfile(e) {
    e.preventDefault();
    const name = document.getElementById('admin-name').value.trim();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    const admin = getAdmin();
    admin.name = name;
    admin.email = email;
    if (password) admin.password = password;

    saveAdmin(admin);
    currentUser = admin;
    localStorage.setItem('kasku_session', JSON.stringify(admin));

    document.getElementById('welcome-name').textContent = name;
    document.getElementById('user-name-display').textContent = name;
    document.getElementById('admin-password').value = '';
    showToast('Profil admin berhasil diperbarui!');
}

function exportAllData() {
    const data = {
        admin: getAdmin(),
        transactions: transactions,
        members: getMembers(),
        payments: getPayments(),
        exportDate: new Date().toISOString(),
        version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kasku-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup berhasil didownload!');
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const data = JSON.parse(ev.target.result);
            if (!data.transactions) throw new Error('Format file tidak valid');

            if (confirm('Ini akan mengganti semua data yang ada. Lanjutkan?')) {
                transactions = data.transactions;
                saveTransactions();
                if (data.members) {
                    saveMembers(data.members);
                }
                if (data.payments) {
                    savePayments(data.payments);
                }
                if (data.admin) {
                    localStorage.setItem('kasku_admin', JSON.stringify(data.admin));
                }
                updateDashboard();
                showToast('Data berhasil diimport! Silakan login.');
                showPage('page-login');
                document.getElementById('login-setup-link').style.display = 'none';
            }
        } catch (err) {
            showToast('Gagal import: Format file tidak valid', 'error');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function confirmClearAllData() {
    if (confirm('PERINGATAN: Semua data transaksi akan dihapus permanen. Lanjutkan?')) {
        if (confirm('Satu kali lagi - benar-benar hapus semua data?')) {
            transactions = [];
            saveTransactions();
            localStorage.removeItem('kasku_members');
            localStorage.removeItem('kasku_payments');
            updateDashboard();
            showToast('Semua data telah dihapus.', 'error');
        }
    }
}

// ==================== TRANSACTIONS ====================
function getStorageKey() {
    return 'kasku_tx_admin';
}

function loadTransactions() {
    transactions = JSON.parse(localStorage.getItem(getStorageKey()) || '[]');
}

function saveTransactions() {
    localStorage.setItem(getStorageKey(), JSON.stringify(transactions));
}

function addTransaction(e) {
    e.preventDefault();
    const tx = {
        id: Date.now(),
        type: 'expense',
        amount: parseInt(document.getElementById('tx-amount').value),
        desc: document.getElementById('tx-desc').value.trim(),
        category: document.getElementById('tx-category').value,
        date: document.getElementById('tx-date').value,
    };

    transactions.unshift(tx);
    saveTransactions();
    document.getElementById('form-transaction').reset();
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
    showToast('Transaksi berhasil ditambahkan!');
    switchTab('tab-dashboard', document.querySelector('.nav-item'));
}

function deleteTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveTransactions();
    renderHistory();
    showToast('Transaksi dihapus.');
}

// ==================== FORMATTER ====================
function formatRupiah(num) {
    return 'Rp ' + num.toLocaleString('id-ID');
}

function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return d.toLocaleDateString('id-ID', options);
}

function getCategoryEmoji(cat) {
    const map = {
        umum: '📋',
        makanan: '🍔',
        transportasi: '🚗',
        belanja: '🛒',
        tagihan: '📄',
        hiburan: '🎮',
        gaji: '💰',
        lainnya: '📁'
    };
    return map[cat] || '📋';
}

// ==================== DASHBOARD ====================
function updateDashboard() {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;

    document.getElementById('total-income').textContent = formatRupiah(income);
    document.getElementById('total-expense').textContent = formatRupiah(expense);
    document.getElementById('total-balance').textContent = formatRupiah(balance);

    const recentContainer = document.getElementById('recent-transactions');
    const recent = transactions.slice(0, 5);

    if (recent.length === 0) {
        recentContainer.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada transaksi</p></div>';
        return;
    }

    recentContainer.innerHTML = recent.map(tx => `
        <div class="tx-item ${tx.type}">
            <div class="tx-left">
                <div class="tx-icon"><i class="fas fa-${tx.type === 'income' ? 'arrow-down' : 'arrow-up'}"></i></div>
                <div class="tx-info">
                    <h4>${tx.desc}</h4>
                    <span>${getCategoryEmoji(tx.category)} ${tx.category.charAt(0).toUpperCase() + tx.category.slice(1)} &bull; ${formatDate(tx.date)}</span>
                </div>
            </div>
            <div class="tx-right">
                <span class="tx-amount">${tx.type === 'income' ? '+' : '-'}${formatRupiah(tx.amount)}</span>
                <button class="tx-delete" onclick="deleteTransaction(${tx.id})" title="Hapus"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

// ==================== HISTORY ====================
function renderHistory() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const filterType = document.getElementById('filter-type').value;

    let filtered = transactions.filter(tx => {
        const matchSearch = tx.desc.toLowerCase().includes(search) || tx.category.toLowerCase().includes(search);
        const matchType = filterType === 'all' || tx.type === filterType;
        return matchSearch && matchType;
    });

    const container = document.getElementById('history-list');

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>Tidak ada transaksi ditemukan</p></div>';
        return;
    }

    container.innerHTML = filtered.map(tx => `
        <div class="tx-item ${tx.type}">
            <div class="tx-left">
                <div class="tx-icon"><i class="fas fa-${tx.type === 'income' ? 'arrow-down' : 'arrow-up'}"></i></div>
                <div class="tx-info">
                    <h4>${tx.desc}</h4>
                    <span>${getCategoryEmoji(tx.category)} ${tx.category.charAt(0).toUpperCase() + tx.category.slice(1)} &bull; ${formatDate(tx.date)}</span>
                </div>
            </div>
            <div class="tx-right">
                <span class="tx-amount">${tx.type === 'income' ? '+' : '-'}${formatRupiah(tx.amount)}</span>
                <button class="tx-delete" onclick="deleteTransaction(${tx.id})" title="Hapus"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

// ==================== REPORTS ====================
function renderReport() {
    const startVal = document.getElementById('report-start').value;
    const endVal = document.getElementById('report-end').value;

    let filtered = transactions;
    if (startVal) filtered = filtered.filter(t => t.date >= startVal);
    if (endVal) filtered = filtered.filter(t => t.date <= endVal);

    const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    document.getElementById('report-income').textContent = formatRupiah(income);
    document.getElementById('report-expense').textContent = formatRupiah(expense);
    document.getElementById('report-balance').textContent = formatRupiah(income - expense);

    renderBarChart(filtered);
    renderCategoryBreakdown(filtered);
}

function renderBarChart(data) {
    const container = document.getElementById('bar-chart');

    if (data.length === 0) {
        container.innerHTML = '<div class="empty-state" style="width:100%"><i class="fas fa-chart-bar"></i><p>Belum ada data</p></div>';
        return;
    }

    const grouped = {};
    data.forEach(tx => {
        const month = tx.date.substring(0, 7);
        if (!grouped[month]) grouped[month] = { income: 0, expense: 0 };
        grouped[month][tx.type] += tx.amount;
    });

    const months = Object.keys(grouped).sort();
    const maxVal = Math.max(...months.map(m => Math.max(grouped[m].income, grouped[m].expense)));

    container.innerHTML = months.map(m => {
        const incH = maxVal > 0 ? (grouped[m].income / maxVal * 160) : 0;
        const expH = maxVal > 0 ? (grouped[m].expense / maxVal * 160) : 0;
        const monthLabel = new Date(m + '-01').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });

        return `
            <div class="bar-group">
                <div class="bar-value" style="color:var(--danger)">${grouped[m].expense > 0 ? formatRupiah(grouped[m].expense) : ''}</div>
                <div class="bar expense-bar" style="height:${expH}px"></div>
                <div class="bar income-bar" style="height:${incH}px"></div>
                <div class="bar-value" style="color:var(--primary)">${grouped[m].income > 0 ? formatRupiah(grouped[m].income) : ''}</div>
                <div class="bar-label">${monthLabel}</div>
            </div>
        `;
    }).join('');
}

function renderCategoryBreakdown(data) {
    const container = document.getElementById('category-list');
    const expenses = data.filter(t => t.type === 'expense');

    if (expenses.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Belum ada data pengeluaran</p></div>';
        return;
    }

    const cats = {};
    expenses.forEach(tx => {
        cats[tx.category] = (cats[tx.category] || 0) + tx.amount;
    });

    const maxCat = Math.max(...Object.values(cats));

    container.innerHTML = Object.entries(cats)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amount]) => `
            <div class="category-item">
                <span style="min-width:140px">${getCategoryEmoji(cat)} ${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                <div class="category-bar-wrapper">
                    <div class="category-bar-fill" style="width:${(amount / maxCat * 100)}%"></div>
                </div>
                <span style="font-weight:700;min-width:120px;text-align:right">${formatRupiah(amount)}</span>
            </div>
        `).join('');
}

// ==================== EXPORT CSV ====================
function exportCSV() {
    if (transactions.length === 0) {
        showToast('Tidak ada data untuk diexport.', 'error');
        return;
    }

    let csv = 'Tanggal,Jenis,Kategori,Keterangan,Jumlah\n';
    transactions.forEach(tx => {
        csv += `${tx.date},${tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'},${tx.category},"${tx.desc}",${tx.amount}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-kasku-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV berhasil didownload!');
}

// ==================== PENALTY SETTINGS ====================
function getPenaltyConfig() {
    const cfg = localStorage.getItem('kasku_penalty');
    return cfg ? JSON.parse(cfg) : { enabled: false, deadlineDay: 18, amountPerDay: 5000 };
}

function savePenaltyConfig(cfg) {
    localStorage.setItem('kasku_penalty', JSON.stringify(cfg));
}

function savePenaltySettings(e) {
    e.preventDefault();
    const cfg = {
        enabled: document.getElementById('penalty-enabled').checked,
        deadlineDay: parseInt(document.getElementById('penalty-deadline').value) || 10,
        amountPerDay: parseInt(document.getElementById('penalty-amount').value) || 1000,
    };
    savePenaltyConfig(cfg);
    updatePenaltyUI();
    showToast('Pengaturan denda berhasil disimpan!');
}

function updatePenaltyUI() {
    const cfg = getPenaltyConfig();
    document.getElementById('penalty-enabled').checked = cfg.enabled;
    document.getElementById('penalty-deadline').value = cfg.deadlineDay;
    document.getElementById('penalty-amount').value = cfg.amountPerDay;
    document.getElementById('penalty-status').innerHTML = cfg.enabled
        ? `<span style="color:var(--primary)"><i class="fas fa-check-circle"></i> Aktif - Deadline tanggal ${cfg.deadlineDay}, denda ${formatRupiah(cfg.amountPerDay)}/hari</span>`
        : '<span style="color:var(--gray-400)">Nonaktif</span>';
}

function calculatePenalty(month) {
    const cfg = getPenaltyConfig();
    if (!cfg.enabled) return 0;

    const deadline = new Date(month + '-' + String(cfg.deadlineDay).padStart(2, '0') + 'T23:59:59');
    const now = new Date();

    if (now <= deadline) return 0;

    const diffMs = now - deadline;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays * cfg.amountPerDay;
}

// ==================== MEMBERS & KAS BULANAN ====================
function getMembers() {
    return JSON.parse(localStorage.getItem('kasku_members') || '[]');
}

function saveMembers(members) {
    localStorage.setItem('kasku_members', JSON.stringify(members));
}

function getPayments() {
    return JSON.parse(localStorage.getItem('kasku_payments') || '[]');
}

function savePayments(payments) {
    localStorage.setItem('kasku_payments', JSON.stringify(payments));
}

function addMember(e) {
    e.preventDefault();
    const member = {
        id: Date.now(),
        name: document.getElementById('member-name').value.trim(),
        phone: document.getElementById('member-phone').value.trim(),
        category: document.getElementById('member-category').value,
        amount: parseInt(document.getElementById('member-amount').value) || 10000,
        active: true,
        createdAt: new Date().toISOString()
    };

    const members = getMembers();
    members.push(member);
    saveMembers(members);
    document.getElementById('form-member').reset();
    document.getElementById('member-amount').value = '10000';
    showToast('Anggota berhasil ditambahkan!');
    renderMembers();
}

function deleteMember(id) {
    if (!confirm('Yakin ingin menghapus anggota ini?')) return;
    let members = getMembers();
    members = members.filter(m => m.id !== id);
    saveMembers(members);
    let payments = getPayments();
    payments = payments.filter(p => p.memberId !== id);
    savePayments(payments);
    showToast('Anggota dihapus.');
    renderMembers();
}

function openEditMember(id) {
    const members = getMembers();
    const member = members.find(m => m.id === id);
    if (!member) return;

    document.getElementById('edit-member-id').value = member.id;
    document.getElementById('edit-member-name').value = member.name;
    document.getElementById('edit-member-phone').value = member.phone || '';
    document.getElementById('edit-member-category').value = member.category;
    document.getElementById('edit-member-amount').value = member.amount;
    document.getElementById('edit-member-modal').classList.add('active');
}

function saveEditMember(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('edit-member-id').value);
    const members = getMembers();
    const member = members.find(m => m.id === id);
    if (!member) return;

    member.name = document.getElementById('edit-member-name').value.trim();
    member.phone = document.getElementById('edit-member-phone').value.trim();
    member.category = document.getElementById('edit-member-category').value;
    member.amount = parseInt(document.getElementById('edit-member-amount').value) || 10000;

    saveMembers(members);
    closeEditMember();
    showToast('Data anggota berhasil diupdate!');
    renderMembers();
}

function closeEditMember() {
    document.getElementById('edit-member-modal').classList.remove('active');
}

let sendWAMemberId = null;

function openSendWAMember(id) {
    const apiKey = getFonnteKey();
    if (!apiKey) {
        showToast('Atur API Key Fonnte di Panel Admin terlebih dahulu!', 'error');
        return;
    }

    const members = getMembers();
    const member = members.find(m => m.id === id);
    if (!member) return;
    if (!member.phone) {
        showToast('Isi nomor HP anggota ini terlebih dahulu!', 'error');
        openEditMember(id);
        return;
    }

    sendWAMemberId = id;
    const monthInput = document.getElementById('kas-month').value;
    const month = monthInput || new Date().toISOString().substring(0, 7);
    const monthLabel = new Date(month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    document.getElementById('send-wa-member-info').innerHTML = `
        <div style="padding:12px;background:var(--gray-50);border-radius:8px;margin-bottom:4px">
            <strong><i class="fas fa-user"></i> ${member.name}</strong><br>
            <span style="color:var(--gray-500);font-size:0.85rem"><i class="fas fa-phone"></i> ${member.phone} &bull; ${formatRupiah(member.amount)}/bulan</span>
        </div>
    `;
    document.getElementById('send-wa-member-msg').value = `Assalamu'alaikum ${member.name}.\n\nMohon maaf mengganggu. Ini pengingat untuk pembayaran kas *${monthLabel}* sebesar *${formatRupiah(member.amount)}*.\n\n${calculatePenalty(month) > 0 ? 'Denda keterlambatan berlaku.\n\n' : ''}Terima kasih.\n\nAlhamdulillah, Jazakumullah Khairan.`;
    document.getElementById('send-wa-member-modal').classList.add('active');
}

async function sendWAMemberNow() {
    const msg = document.getElementById('send-wa-member-msg').value.trim();
    if (!msg) {
        showToast('Pesan tidak boleh kosong!', 'error');
        return;
    }

    const members = getMembers();
    const member = members.find(m => m.id === sendWAMemberId);
    if (!member) return;

    closeSendWAMember();
    showToast(`Mengirim pesan ke ${member.name}...`);

    const result = await sendWAFonnte(member.phone, msg);

    if (result && (result.status === true || result.success !== false)) {
        showToast(`Pesan berhasil dikirim ke ${member.name}!`);
    } else {
        showToast(`Gagal mengirim ke ${member.name}: ${result?.message || 'Error'}`, 'error');
    }
}

function closeSendWAMember() {
    document.getElementById('send-wa-member-modal').classList.remove('active');
    sendWAMemberId = null;
}

function toggleMemberStatus(id) {
    const members = getMembers();
    const member = members.find(m => m.id === id);
    if (member) {
        member.active = !member.active;
        saveMembers(members);
        showToast(member.active ? 'Anggota diaktifkan.' : 'Anggota dinonaktifkan.');
        renderMembers();
    }
}

function payKas(memberId) {
    const members = getMembers();
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const monthInput = document.getElementById('kas-month').value;
    const month = monthInput || new Date().toISOString().substring(0, 7);

    const payments = getPayments();
    const existing = payments.find(p => p.memberId === memberId && p.month === month);

    if (existing) {
        showToast('Anggota ini sudah membayar bulan ini!', 'error');
        return;
    }

    const penalty = calculatePenalty(month);

    const payment = {
        id: Date.now(),
        memberId: memberId,
        memberName: member.name,
        amount: member.amount,
        penalty: penalty,
        month: month,
        paidAt: new Date().toISOString()
    };

    payments.push(payment);
    savePayments(payments);

    const tx = {
        id: payment.id,
        type: 'income',
        amount: payment.amount,
        desc: `Iuran kas - ${member.name} (${month})`,
        category: 'umum',
        date: month + '-01',
    };
    loadTransactions();
    transactions.unshift(tx);
    saveTransactions();

    if (penalty > 0) {
        const penaltyTx = {
            id: payment.id + 1,
            type: 'income',
            amount: penalty,
            desc: `Denda telat - ${member.name} (${month})`,
            category: 'umum',
            date: new Date().toISOString().split('T')[0],
        };
        transactions.unshift(penaltyTx);
        saveTransactions();
        showToast(`${member.name} membayar kas + denda ${formatRupiah(penalty)}!`);
    } else {
        showToast(`${member.name} berhasil membayar kas!`);
    }

    updateDashboard();
    renderMembers();
}

function undoPayKas(memberId) {
    const members = getMembers();
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const monthInput = document.getElementById('kas-month').value;
    const month = monthInput || new Date().toISOString().substring(0, 7);

    let payments = getPayments();
    payments = payments.filter(p => !(p.memberId === memberId && p.month === month));
    savePayments(payments);

    loadTransactions();
    const txDesc = `Iuran kas - ${member.name} (${month})`;
    const penaltyDesc = `Denda telat - ${member.name} (${month})`;
    transactions = transactions.filter(t => t.desc !== txDesc && t.desc !== penaltyDesc);
    saveTransactions();

    showToast('Pembayaran dibatalkan.');
    updateDashboard();
    renderMembers();
}

function renderMembers() {
    const allMembers = getMembers();
    const filterCat = document.getElementById('filter-member-category').value;
    const members = filterCat === 'all' ? allMembers : allMembers.filter(m => m.category === filterCat);
    const payments = getPayments();
    const monthInput = document.getElementById('kas-month').value;
    const month = monthInput || new Date().toISOString().substring(0, 7);

    const memberTotalEl = document.getElementById('nav-member-total');
    if (memberTotalEl) memberTotalEl.textContent = allMembers.length;

    const paidIds = payments.filter(p => p.month === month).map(p => p.memberId);
    const paidCount = paidIds.length;
    const totalExpected = members.filter(m => m.active).length;
    const totalCollected = payments.filter(p => p.month === month).reduce((s, p) => s + p.amount, 0);
    const totalExpectedAmount = members.filter(m => m.active).reduce((s, p) => s + p.amount, 0);

    document.getElementById('kas-summary').innerHTML = `
        <div class="summary-mini">
            <span class="summary-mini-item paid"><i class="fas fa-check-circle"></i> Sudah Bayar: <strong>${paidCount}/${totalExpected}</strong></span>
            <span class="summary-mini-item collected"><i class="fas fa-coins"></i> Terkumpul: <strong>${formatRupiah(totalCollected)}</strong></span>
            <span class="summary-mini-item expected"><i class="fas fa-bullseye"></i> Target: <strong>${formatRupiah(totalExpectedAmount)}</strong></span>
        </div>
    `;

    const container = document.getElementById('members-list');

    if (members.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Belum ada anggota. Tambahkan anggota baru di atas.</p></div>';
        return;
    }

    const totalPenalty = members.filter(m => m.active && !paidIds.includes(m.id)).reduce((s, m) => s + calculatePenalty(month), 0);

    container.innerHTML = `
        <table class="member-table">
            <thead>
                <tr>
                    <th>No</th>
                    <th>Nama</th>
                    <th>Telepon</th>
                    <th>Kategori</th>
                    <th>Iuran/Bulan</th>
                    <th>Denda</th>
                    <th>Total</th>
                    <th>Status ${month}</th>
                    <th>Aksi</th>
                </tr>
            </thead>
            <tbody>
                ${members.map((m, i) => {
                    const isPaid = paidIds.includes(m.id);
                    const catLabel = m.category === 'pelajar' ? 'Pelajar' : 'Kerja';
                    const catIcon = m.category === 'pelajar' ? 'graduation-cap' : 'briefcase';
                    const penalty = !isPaid && m.active ? calculatePenalty(month) : 0;
                    const penaltyDisplay = penalty > 0
                        ? `<span style="color:#e65100;font-weight:600">${formatRupiah(penalty)}</span>`
                        : '<span style="color:var(--gray-400)">-</span>';
                    return `
                        <tr class="${!m.active ? 'member-inactive' : ''}">
                            <td>${i + 1}</td>
                            <td>
                                <span class="member-name-cell clickable" onclick="showMemberDetail(${m.id})">${m.name}</span>
                                ${!m.active ? '<span class="status-badge inactive">Nonaktif</span>' : ''}
                            </td>
                            <td>${m.phone || '-'}</td>
                            <td><span class="category-tag ${m.category}"><i class="fas fa-${catIcon}"></i> ${catLabel}</span></td>
                            <td>${formatRupiah(m.amount)}</td>
                            <td>${penaltyDisplay}</td>
                            <td style="font-weight:600">${formatRupiah(m.amount + penalty)}</td>
                            <td>
                                ${isPaid
                                    ? '<span class="status-badge paid"><i class="fas fa-check"></i> Lunas</span>'
                                    : '<span class="status-badge unpaid"><i class="fas fa-times"></i> Belum</span>'
                                }
                            </td>
                            <td class="action-cell">
                                <button class="btn-sm btn-info" onclick="openEditMember(${m.id})" title="Edit Anggota">
                                    <i class="fas fa-pen"></i>
                                </button>
                                ${m.phone ? `<button class="btn-sm btn-success" onclick="openSendWAMember(${m.id})" title="Kirim Pesan WA" style="background:#25d366;border-color:#25d366"><i class="fab fa-whatsapp"></i></button>` : `<button class="btn-sm btn-success" onclick="showToast('Isi nomor HP dulu di Edit Anggota!','error')" title="Kirim Pesan WA (isi nomor HP dulu)" style="background:#25d366;border-color:#25d366;opacity:0.5"><i class="fab fa-whatsapp"></i></button>`}
                                ${m.active
                                    ? (isPaid
                                        ? `<button class="btn-sm btn-warning" onclick="undoPayKas(${m.id})" title="Batalkan Pembayaran"><i class="fas fa-undo"></i></button>`
                                        : `<button class="btn-sm btn-success" onclick="payKas(${m.id})" title="Tandai Sudah Bayar"><i class="fas fa-money-bill-wave"></i></button>`
                                    )
                                    : ''
                                }
                                <button class="btn-sm btn-info" onclick="toggleMemberStatus(${m.id})" title="${m.active ? 'Nonaktifkan' : 'Aktifkan'}">
                                    <i class="fas fa-${m.active ? 'ban' : 'check'}"></i>
                                </button>
                                <button class="btn-sm btn-danger" onclick="deleteMember(${m.id})" title="Hapus">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        <div class="member-total-bar">
            <div class="member-total-item"><i class="fas fa-coins"></i> Total Iuran: <strong>${formatRupiah(totalCollected)}</strong></div>
            <div class="member-total-item penalty"><i class="fas fa-gavel"></i> Total Denda: <strong>${formatRupiah(totalPenalty)}</strong></div>
            <div class="member-total-item total"><i class="fas fa-wallet"></i> Total: <strong>${formatRupiah(totalCollected + totalPenalty)}</strong></div>
        </div>
    `;
}

function renderRecapTab() {
    const recapMonthInput = document.getElementById('recap-month');
    const kasMonthInput = document.getElementById('kas-month');
    const month = recapMonthInput.value || new Date().toISOString().substring(0, 7);

    if (kasMonthInput) kasMonthInput.value = month;

    renderKasHistory(month);
    renderRecap();
    renderMonthlyMatrix();
}

function renderMonthlyMatrix() {
    const container = document.getElementById('monthly-matrix');
    const members = getMembers().filter(m => m.active);
    const payments = getPayments();

    if (members.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-table"></i><p>Belum ada anggota aktif.</p></div>';
        return;
    }

    const allMonths = [...new Set(payments.map(p => p.month))].sort();
    const currentMonth = new Date().toISOString().substring(0, 7);
    if (!allMonths.includes(currentMonth)) allMonths.push(currentMonth);
    const months = allMonths.sort();

    if (months.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-table"></i><p>Belum ada data pembayaran.</p></div>';
        return;
    }

    let html = '<div class="matrix-scroll"><table class="matrix-table"><thead><tr><th>Nama</th>';
    months.forEach(m => {
        const label = new Date(m + '-01').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
        html += `<th>${label}</th>`;
    });
    html += '<th>Total</th></tr></thead><tbody>';

    members.forEach(m => {
        html += `<tr><td class="matrix-name">${m.name}</td>`;
        let totalPaid = 0;
        months.forEach(month => {
            const isPaid = payments.some(p => p.memberId === m.id && p.month === month);
            if (isPaid) totalPaid++;
            html += `<td class="matrix-cell ${isPaid ? 'paid' : 'unpaid'}">
                <i class="fas fa-${isPaid ? 'check-circle' : 'times-circle'}"></i>
            </td>`;
        });
        html += `<td class="matrix-total">${totalPaid}/${months.length}</td></tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function renderKasHistory(month) {
    const payments = getPayments().filter(p => p.month === month).sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
    const container = document.getElementById('kas-history-list');

    if (payments.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><p>Belum ada pembayaran kas bulan ini.</p></div>';
        return;
    }

    container.innerHTML = payments.map(p => {
        const penaltyTag = p.penalty > 0
            ? `<span style="color:#e65100;font-size:0.75rem;margin-left:6px"><i class="fas fa-gavel"></i> +${formatRupiah(p.penalty)}</span>`
            : '';
        return `
        <div class="kas-history-item">
            <div class="kas-history-left">
                <div class="kas-icon"><i class="fas fa-money-bill-wave"></i></div>
                <div class="kas-info">
                    <h4>${p.memberName}</h4>
                    <span>${formatDate(p.paidAt.split('T')[0])} &bull; ${p.month}</span>
                </div>
            </div>
            <div class="kas-amount">${formatRupiah(p.amount)}${penaltyTag}</div>
        </div>
    `}).join('');
}

// ==================== RECAP BULANAN ====================
function renderRecap() {
    const allMembers = getMembers();
    const payments = getPayments();
    const monthInput = document.getElementById('kas-month').value;
    const month = monthInput || new Date().toISOString().substring(0, 7);
    const monthLabel = new Date(month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const activeMembers = allMembers.filter(m => m.active);
    const paidThisMonth = payments.filter(p => p.month === month);
    const paidMemberIds = paidThisMonth.map(p => p.memberId);

    const paid = activeMembers.filter(m => paidMemberIds.includes(m.id));
    const unpaid = activeMembers.filter(m => !paidMemberIds.includes(m.id));

    const totalCollected = paidThisMonth.reduce((s, p) => s + p.amount, 0);
    const totalPenalty = paidThisMonth.reduce((s, p) => s + (p.penalty || 0), 0);
    const totalExpected = activeMembers.reduce((s, p) => s + p.amount, 0);
    const percent = activeMembers.length > 0 ? Math.round((paid.length / activeMembers.length) * 100) : 0;

    const penaltyConfig = getPenaltyConfig();
    const penaltyInfo = penaltyConfig.enabled && totalPenalty > 0
        ? `<div style="flex:1;min-width:140px;padding:12px;background:#fff3e0;border-radius:8px;text-align:center">
                <div style="font-size:0.8rem;color:#e65100">Total Denda</div>
                <div style="font-size:1.2rem;font-weight:700;color:#e65100">${formatRupiah(totalPenalty)}</div>
           </div>`
        : '';

    document.getElementById('recap-summary').innerHTML = `
        <div style="display:flex;gap:16px;flex-wrap:wrap">
            <div style="flex:1;min-width:140px;padding:12px;background:#e8f5e9;border-radius:8px;text-align:center">
                <div style="font-size:0.8rem;color:#2e7d32">Sudah Bayar</div>
                <div style="font-size:1.4rem;font-weight:700;color:#2e7d32">${paid.length}</div>
            </div>
            <div style="flex:1;min-width:140px;padding:12px;background:#ffebee;border-radius:8px;text-align:center">
                <div style="font-size:0.8rem;color:#c62828">Belum Bayar</div>
                <div style="font-size:1.4rem;font-weight:700;color:#c62828">${unpaid.length}</div>
            </div>
            <div style="flex:1;min-width:140px;padding:12px;background:#e3f2fd;border-radius:8px;text-align:center">
                <div style="font-size:0.8rem;color:#1565c0">Terkumpul</div>
                <div style="font-size:1.2rem;font-weight:700;color:#1565c0">${formatRupiah(totalCollected + totalPenalty)}</div>
                <div style="font-size:0.75rem;color:#1565c0">dari ${formatRupiah(totalExpected)}</div>
            </div>
            ${penaltyInfo}
        </div>
    `;

    document.getElementById('recap-progress').innerHTML = `
        <div style="display:flex;align-items:center;gap:12px">
            <div style="flex:1;height:12px;background:var(--gray-200);border-radius:6px;overflow:hidden">
                <div style="width:${percent}%;height:100%;background:linear-gradient(90deg,#4caf50,#2e7d32);border-radius:6px;transition:width 0.3s"></div>
            </div>
            <span style="font-weight:700;font-size:0.9rem;min-width:45px;text-align:right">${percent}%</span>
        </div>
        <div style="font-size:0.8rem;color:var(--gray-500);margin-top:4px">Progress pembayaran ${monthLabel}</div>
    `;

    if (paid.length > 0) {
        document.getElementById('recap-paid').innerHTML = `
            <div style="font-size:0.85rem;font-weight:600;color:#2e7d32;margin-bottom:6px"><i class="fas fa-check-circle"></i> Sudah Bayar (${paid.length})</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
                ${paid.map(m => {
                    const payment = paidThisMonth.find(p => p.memberId === m.id);
                    const penaltyInfo = payment.penalty > 0
                        ? `<span style="color:#e65100;font-size:0.7rem">+${formatRupiah(payment.penalty)} denda</span>`
                        : '';
                    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#e8f5e9;border-radius:20px;font-size:0.8rem">
                        <i class="fas fa-check-circle" style="color:#2e7d32"></i> ${m.name}
                        <span style="color:#81c784;font-size:0.7rem">${formatRupiah(payment.amount)}</span>
                        ${penaltyInfo}
                    </span>`;
                }).join('')}
            </div>
        `;
    } else {
        document.getElementById('recap-paid').innerHTML = '';
    }

    if (unpaid.length > 0) {
        document.getElementById('recap-unpaid').innerHTML = `
            <div style="font-size:0.85rem;font-weight:600;color:#c62828;margin-bottom:6px;margin-top:12px"><i class="fas fa-times-circle"></i> Belum Bayar (${unpaid.length})</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
                ${unpaid.map(m => `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#ffebee;border-radius:20px;font-size:0.8rem">
                    <i class="fas fa-times-circle" style="color:#c62828"></i> ${m.name}
                    <span style="color:#ef9a9a;font-size:0.7rem">${formatRupiah(m.amount)}</span>
                </span>`).join('')}
            </div>
        `;
    } else {
        document.getElementById('recap-unpaid').innerHTML = paid.length > 0
            ? '<div style="margin-top:12px;padding:10px;background:#e8f5e9;border-radius:8px;text-align:center;color:#2e7d32;font-size:0.85rem"><i class="fas fa-check-double"></i> Semua anggota sudah membayar!</div>'
            : '';
    }
}

// ==================== EXPORT RECAP ====================
function getRecapData() {
    const allMembers = getMembers();
    const payments = getPayments();
    const monthInput = document.getElementById('kas-month').value;
    const month = monthInput || new Date().toISOString().substring(0, 7);
    const monthLabel = new Date(month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const activeMembers = allMembers.filter(m => m.active);
    const paidThisMonth = payments.filter(p => p.month === month);
    const paidMemberIds = paidThisMonth.map(p => p.memberId);

    const paid = activeMembers.filter(m => paidMemberIds.includes(m.id));
    const unpaid = activeMembers.filter(m => !paidMemberIds.includes(m.id));
    const totalCollected = paidThisMonth.reduce((s, p) => s + p.amount, 0);
    const totalPenalty = paidThisMonth.reduce((s, p) => s + (p.penalty || 0), 0);
    const totalExpected = activeMembers.reduce((s, p) => s + p.amount, 0);

    return { month, monthLabel, activeMembers, paid, unpaid, paidThisMonth, totalCollected, totalPenalty, totalExpected };
}

function exportRecapExcel() {
    const d = getRecapData();

    const wb = XLSX.utils.book_new();

    const data = [
        ['REKAP KAS BULANAN'],
        ['Kas Mumi Al-Badar'],
        [d.monthLabel],
        [],
        ['No', 'Nama', 'Kategori', 'Iuran/Bulan', 'Denda', 'Total Bayar', 'Status', 'Tanggal Bayar'],
    ];

    d.paid.forEach((m, i) => {
        const p = d.paidThisMonth.find(x => x.memberId === m.id);
        const tgl = p ? new Date(p.paidAt).toLocaleDateString('id-ID') : '-';
        const penalty = p ? (p.penalty || 0) : 0;
        data.push([i + 1, m.name, m.category === 'pelajar' ? 'Pelajar' : 'Kerja', m.amount, penalty, m.amount + penalty, 'Lunas', tgl]);
    });
    d.unpaid.forEach((m, i) => {
        data.push([d.paid.length + i + 1, m.name, m.category === 'pelajar' ? 'Pelajar' : 'Kerja', m.amount, 0, m.amount, 'Belum', '-']);
    });

    data.push([]);
    data.push(['', 'TOTAL TERKUMPUL', '', '', '', d.totalCollected + d.totalPenalty, '', '']);
    data.push(['', 'TOTAL TARGET', '', '', '', d.totalExpected, '', '']);
    data.push(['', 'TOTAL DENDA', '', '', '', d.totalPenalty, '', '']);
    data.push(['', 'SUDAH BAYAR', '', '', '', d.paid.length + ' Orang', '', '']);
    data.push(['', 'BELUM BAYAR', '', '', '', d.unpaid.length + ' Orang', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!cols'] = [
        { wch: 5 }, { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 15 }
    ];

    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Rekap');
    XLSX.writeFile(wb, `rekap-kas-${d.month}.xlsx`);
    showToast('File Excel berhasil didownload!');
}

function exportRecapPDF() {
    const d = getRecapData();
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
<title>Rekap Kas ${d.monthLabel}</title>
<style>
    body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
    h1 { text-align: center; font-size: 18px; margin-bottom: 4px; }
    h2 { text-align: center; font-size: 14px; color: #666; font-weight: normal; margin-top: 0; }
    .summary { display: flex; gap: 16px; margin: 20px 0; }
    .summary-box { flex: 1; text-align: center; padding: 12px; border: 1px solid #ddd; border-radius: 8px; }
    .summary-box .label { font-size: 12px; color: #666; }
    .summary-box .value { font-size: 20px; font-weight: bold; }
    .green { color: #2e7d32; } .red { color: #c62828; } .blue { color: #1565c0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
    th { background: #f5f5f5; font-weight: bold; }
    .paid-row { background: #e8f5e9; }
    .unpaid-row { background: #ffebee; }
    .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #999; }
    @media print { body { padding: 15px; } }
</style>
</head>
<body>
<h1>Rekas Kas ${d.monthLabel}</h1>
<h2>Kas Mumi Al-Badar</h2>
<div class="summary">
    <div class="summary-box"><div class="label">Sudah Bayar</div><div class="value green">${d.paid.length} Orang</div></div>
    <div class="summary-box"><div class="label">Belum Bayar</div><div class="value red">${d.unpaid.length} Orang</div></div>
    <div class="summary-box"><div class="label">Terkumpul</div><div class="value blue">Rp ${(d.totalCollected + d.totalPenalty).toLocaleString('id-ID')}</div></div>
    <div class="summary-box"><div class="label">Target</div><div class="value">Rp ${d.totalExpected.toLocaleString('id-ID')}</div></div>
    ${d.totalPenalty > 0 ? `<div class="summary-box"><div class="label">Total Denda</div><div class="value" style="color:#e65100">Rp ${d.totalPenalty.toLocaleString('id-ID')}</div></div>` : ''}
</div>
<table>
<thead><tr><th>No</th><th>Nama</th><th>Kategori</th><th>Iuran/Bulan</th><th>Denda</th><th>Total</th><th>Status</th><th>Tanggal Bayar</th></tr></thead>
<tbody>
${d.paid.map((m, i) => {
    const p = d.paidThisMonth.find(x => x.memberId === m.id);
    const tgl = p ? new Date(p.paidAt).toLocaleDateString('id-ID') : '-';
    const penalty = p ? (p.penalty || 0) : 0;
    return `<tr class="paid-row"><td>${i+1}</td><td>${m.name}</td><td>${m.category === 'pelajar' ? 'Pelajar' : 'Kerja'}</td><td>Rp ${m.amount.toLocaleString('id-ID')}</td><td>${penalty > 0 ? 'Rp ' + penalty.toLocaleString('id-ID') : '-'}</td><td>Rp ${(m.amount + penalty).toLocaleString('id-ID')}</td><td>Lunas</td><td>${tgl}</td></tr>`;
}).join('')}
${d.unpaid.map((m, i) => `<tr class="unpaid-row"><td>${d.paid.length+i+1}</td><td>${m.name}</td><td>${m.category === 'pelajar' ? 'Pelajar' : 'Kerja'}</td><td>Rp ${m.amount.toLocaleString('id-ID')}</td><td>-</td><td>Rp ${m.amount.toLocaleString('id-ID')}</td><td>Belum</td><td>-</td></tr>`).join('')}
</tbody>
</table>
<div class="footer">Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
</body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 300);
}

// ==================== MEMBER DETAIL MODAL ====================
function showMemberDetail(memberId) {
    const member = getMembers().find(m => m.id === memberId);
    if (!member) return;

    const payments = getPayments().filter(p => p.memberId === memberId).sort((a, b) => b.month.localeCompare(a.month));
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const totalPenalty = payments.reduce((s, p) => s + (p.penalty || 0), 0);

    let html = `
        <div class="detail-info">
            <div class="detail-row"><span>Nama</span><strong>${member.name}</strong></div>
            <div class="detail-row"><span>Telepon</span><strong>${member.phone || '-'}</strong></div>
            <div class="detail-row"><span>Kategori</span><strong>${member.category === 'pelajar' ? 'Pelajar' : 'Kerja'}</strong></div>
            <div class="detail-row"><span>Iuran/Bulan</span><strong>${formatRupiah(member.amount)}</strong></div>
            <div class="detail-row"><span>Total Dibayar</span><strong style="color:var(--primary)">${formatRupiah(totalPaid)}</strong></div>
            ${totalPenalty > 0 ? `<div class="detail-row"><span>Total Denda</span><strong style="color:#e65100">${formatRupiah(totalPenalty)}</strong></div>` : ''}
            <div class="detail-row"><span>Jumlah Bayar</span><strong>${payments.length} kali</strong></div>
        </div>
    `;

    if (payments.length === 0) {
        html += '<div class="empty-state"><i class="fas fa-receipt"></i><p>Belum ada riwayat pembayaran.</p></div>';
    } else {
        html += '<h4 style="margin:16px 0 8px">Riwayat Pembayaran</h4>';
        html += payments.map(p => {
            const date = new Date(p.paidAt);
            const penaltyTag = p.penalty > 0
                ? `<span style="color:#e65100;font-size:0.75rem;margin-left:6px"><i class="fas fa-gavel"></i> +${formatRupiah(p.penalty)} denda</span>`
                : '';
            return `
                <div class="kas-history-item">
                    <div class="kas-history-left">
                        <div class="kas-icon"><i class="fas fa-check-circle"></i></div>
                        <div class="kas-info">
                            <h4>${new Date(p.month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</h4>
                            <span>${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                    <div class="kas-amount">${formatRupiah(p.amount)}${penaltyTag}</div>
                </div>
            `;
        }).join('');
    }

    document.getElementById('member-detail-body').innerHTML = html;
    document.getElementById('member-detail-modal').classList.add('active');
}

function closeMemberDetail() {
    document.getElementById('member-detail-modal').classList.remove('active');
}

// ==================== WHATSAPP REMINDER (FONNTE) ====================
let waMonthLabel = '';

function getFonnteKey() {
    return localStorage.getItem('kasku_fonnte_key') || 'vhJEZWN6q1NVqkK3FJnt';
}

function saveFonnteKey() {
    const key = document.getElementById('fonnte-api-key').value.trim();
    if (!key) {
        showToast('API Key tidak boleh kosong!', 'error');
        return;
    }
    localStorage.setItem('kasku_fonnte_key', key);
    document.getElementById('fonnte-status').innerHTML = '<span style="color:var(--primary)"><i class="fas fa-check-circle"></i> API Key berhasil disimpan!</span>';
    showToast('API Key Fonnte tersimpan!');
}

async function sendWAFonnte(phone, message) {
    const apiKey = getFonnteKey();
    if (!apiKey) return { success: false, error: 'API Key belum diatur' };

    const num = formatPhone(phone);
    const formData = new FormData();
    formData.append('target', num);
    formData.append('message', message);

    try {
        const res = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: { 'Authorization': apiKey },
            body: formData
        });
        const data = await res.json();
        return data;
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function formatPhone(phone) {
    let p = phone.replace(/[^0-9]/g, '');
    if (p.startsWith('0')) p = '62' + p.substring(1);
    if (!p.startsWith('62')) p = '62' + p;
    return p;
}

function getWAUrl(phone, name, amount) {
    const num = formatPhone(phone);
    const msg = encodeURIComponent(`Assalamu'alaikum ${name}.\n\nMohon maaf mengganggu. Ini pengingat untuk pembayaran kas *${waMonthLabel}* sebesar *${formatRupiah(amount)}*.\n\nTerima kasih.\n\nAlhamdulillah, Jazakumullah Khairan.`);
    return `https://wa.me/${num}?text=${msg}`;
}

function sendWAReminder() {
    const apiKey = getFonnteKey();
    if (!apiKey) {
        showToast('Atur API Key Fonnte di Panel Admin terlebih dahulu!', 'error');
        return;
    }

    const members = getMembers().filter(m => m.active);
    const payments = getPayments();
    const monthInput = document.getElementById('kas-month').value;
    const month = monthInput || new Date().toISOString().substring(0, 7);
    waMonthLabel = new Date(month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const unpaid = members.filter(m => !payments.some(p => p.memberId === m.id && p.month === month));

    if (unpaid.length === 0) {
        showToast('Semua anggota sudah membayar bulan ini!');
        return;
    }

    const withPhone = unpaid.filter(m => m.phone && m.phone.trim() !== '');
    const noPhone = unpaid.filter(m => !m.phone || m.phone.trim() === '');

    if (withPhone.length === 0) {
        showToast('Tidak ada nomor WA yang bisa dihubungi.', 'error');
        return;
    }

    let html = `<p style="margin-bottom:12px;color:var(--gray-600);font-size:0.9rem">
        Akan mengirim <strong>${withPhone.length}</strong> pesan otomatis ke anggota belum bayar <strong>${waMonthLabel}</strong>.
    </p>`;

    if (noPhone.length > 0) {
        html += `<div style="margin-bottom:12px;padding:10px;background:var(--warning-light);border-radius:8px;font-size:0.85rem;color:var(--gray-700)">
            <i class="fas fa-exclamation-triangle"></i> Tanpa nomor: ${noPhone.map(m => m.name).join(', ')}
        </div>`;
    }

    html += `<button class="btn-wa" onclick="startFonnteSend()" style="width:100%;justify-content:center">
        <i class="fab fa-whatsapp"></i> Kirim Sekarang
    </button>`;

    document.getElementById('wa-reminder-body').innerHTML = html;
    document.getElementById('wa-reminder-modal').classList.add('active');
}

async function startFonnteSend() {
    const apiKey = getFonnteKey();
    const members = getMembers().filter(m => m.active);
    const payments = getPayments();
    const monthInput = document.getElementById('kas-month').value;
    const month = monthInput || new Date().toISOString().substring(0, 7);
    const monthLabel = new Date(month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const unpaid = members.filter(m =>
        m.active && m.phone && m.phone.trim() !== '' &&
        !payments.some(p => p.memberId === m.id && p.month === month)
    );

    document.getElementById('wa-reminder-modal').classList.remove('active');

    let success = 0;
    let failed = 0;

    for (let i = 0; i < unpaid.length; i++) {
        const m = unpaid[i];
        const penalty = calculatePenalty(month);
        let msg = `Assalamu'alaikum ${m.name}.\n\nMohon maaf mengganggu. Ini pengingat untuk pembayaran kas *${monthLabel}* sebesar *${formatRupiah(m.amount)}*.`;
        if (penalty > 0) {
            msg += `\n\nDenda keterlambatan: *${formatRupiah(penalty)}* (${Math.floor((new Date() - new Date(month + '-' + String(getPenaltyConfig().deadlineDay).padStart(2, '0') + 'T23:59:59')) / (1000 * 60 * 60 * 24))} hari).`;
        }
        msg += `\n\nTerima kasih.\n\nAlhamdulillah, Jazakumullah Khairan.`;

        showToast(`Mengirim ke ${m.name}... (${i + 1}/${unpaid.length})`);

        const result = await sendWAFonnte(m.phone, msg);

        if (result && (result.status === true || result.success !== false)) {
            success++;
        } else {
            failed++;
        }

        await new Promise(r => setTimeout(r, 2000));
    }

    let msg = `Selesai! ${success} pesan berhasil dikirim.`;
    if (failed > 0) msg += ` ${failed} gagal.`;
    showToast(msg, failed > 0 ? 'error' : 'success');
}

function closeWAReminder() {
    document.getElementById('wa-reminder-modal').classList.remove('active');
}

// ==================== DEFAULT MEMBERS ====================
function initDefaultMembers() {
    const existing = JSON.parse(localStorage.getItem('kasku_members') || '[]');
    if (existing.length > 0) {
        existing.forEach(m => { m.category = "kerja"; });
        localStorage.setItem('kasku_members', JSON.stringify(existing));
        return;
    }

    const defaultMembers = [
        "Abdul Malik Z", "Afnan Labid Firdaus", "Ainur Dina Aisah",
        "Almahira Ayu. M", "Azzaria Ayu S", "Firli Safina Z",
        "Kresna Adinata", "M. Naufal Risydian", "M. Praja Bangun P",
        "M. Bagus Ardy Nugraha", "Nadirat Raka H", "Novira Ramadhani S",
        "Rifaul Jannah", "Saefadhli Khoiri", "Salsabila Khoirunisa",
        "Sylvani Humaira H", "Zahrani Tazkia", "Ziyad Naizar K",
        "Zulfa Zahira", "Hisyam Alfarisi"
    ];

    const members = defaultMembers.map((name, i) => ({
        id: Date.now() + i,
        name: name,
        phone: "",
        category: "kerja",
        amount: 10000,
        active: true,
        createdAt: new Date().toISOString()
    }));

    localStorage.setItem('kasku_members', JSON.stringify(members));
}

// ==================== INIT ====================
function initDefaultAdmin() {
    if (!hasAdmin()) {
        saveAdmin({ name: 'Admin', email: 'admin@gmail.com', password: 'admin354' });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('kas-month').value = new Date().toISOString().substring(0, 7);
    document.getElementById('recap-month').value = new Date().toISOString().substring(0, 7);
    initDefaultAdmin();
    initDefaultMembers();
    checkSession();
});
