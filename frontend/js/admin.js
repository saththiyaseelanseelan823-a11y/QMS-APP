/**
 * QMS Admin Command Dashboard Controller
 * Orchestrates analytics metrics, real-time filters, live queues, counters configuration,
 * Divisional Secretariat offices, staff rosters, shift schedulers, activity logging, and vocal alerts.
 */

let loadChart = null;
let deptChart = null;
let currentRole = 'admin';
let currentBranchScope = 'all';
let currentRegionScope = 'all';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Authentication Check & Role Permissions
    const sessionUser = localStorage.getItem('qms_logged_in_user');
    if (!sessionUser) {
        window.location.href = 'login.html';
        return;
    }

    const user = JSON.parse(sessionUser);
    const permittedRoles = ['admin', 'regional-manager', 'branch-manager'];
    if (!permittedRoles.includes(user.role)) {
        window.location.href = 'login.html';
        return;
    }

    currentRole = user.role;
    
    // Greet Admin
    const adminNameText = document.getElementById('adminName');
    if (adminNameText) adminNameText.innerText = user.name;

    // Apply Branch Lock if logged in as Branch Manager
    if (user.role === 'branch-manager') {
        currentBranchScope = user.assignedBranchId;
        const filterBar = document.querySelector('.filter-controls-row');
        if (filterBar) filterBar.classList.add('d-none'); // Hide filter choices
        
        // Hide global Emergency Trigger from branch manager (only super-admin overrides)
        const trig = document.getElementById('btnEmergencyTrigger');
        if (trig) trig.classList.add('d-none');
    }

    // Apply Region Lock if logged in as Regional Manager
    if (user.role === 'regional-manager') {
        currentRegionScope = user.assignedRegion || 'Northern';
        const regionSelect = document.getElementById('adminRegionSelect');
        if (regionSelect) {
            regionSelect.value = currentRegionScope;
            regionSelect.disabled = true;
        }
    }

    // 2. Initialize Navigation and Content Panels
    initSidebarNavigation();
    initAdminUI();
    initAnalyticsCharts();

    // 3. Bind Actions
    document.getElementById('adminLogout').addEventListener('click', () => {
        localStorage.removeItem('qms_logged_in_user');
        window.qms.showToast('Logged Out', 'Admin session terminated safely.', 'info');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    });

    // Theme changes updates chart layout colors
    window.addEventListener('qmsStateUpdated', () => {
        updateDashboardState();
    });

    // Reload charts when theme changes
    const themeBtn = document.querySelectorAll('.theme-switch-btn');
    themeBtn.forEach(btn => {
        btn.addEventListener('click', () => {
            setTimeout(() => {
                initAnalyticsCharts(); // redraw
            }, 150);
        });
    });
});

/* --- SIDEBAR PANEL NAVIGATION --- */
function initSidebarNavigation() {
    const sidebar = document.getElementById('sidebarMenu');
    const toggleBtn = document.getElementById('sidebarToggle');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    const links = [
        { btn: 'linkAnalytics', sec: 'secAnalytics' },
        { btn: 'linkQueueMonitor', sec: 'secQueueMonitor' },
        { btn: 'linkCounters', sec: 'secCounters' },
        { btn: 'linkBranches', sec: 'secBranches' },
        { btn: 'linkStaff', sec: 'secStaff' },
        { btn: 'linkLogs', sec: 'secLogs' },
        { btn: 'linkVoice', sec: 'secVoice' }
    ];

    links.forEach(item => {
        const btn = document.getElementById(item.btn);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                
                links.forEach(l => {
                    const el = document.getElementById(l.btn);
                    if (el) el.classList.remove('active');
                });
                btn.classList.add('active');
                
                links.forEach(l => {
                    const el = document.getElementById(l.sec);
                    if (el) el.classList.add('d-none');
                });
                const activeSec = document.getElementById(item.sec);
                if (activeSec) activeSec.classList.remove('d-none');
                
                if (sidebar) sidebar.classList.remove('active');
            });
        }
    });
}

/* --- ADMINISTRATIVE LAYOUT & MUTATIONS --- */
function initAdminUI() {
    const db = window.qms.getDB();
    const sessionUser = JSON.parse(localStorage.getItem('qms_logged_in_user'));

    // Populate dynamic select filters in header
    const branchFilter = document.getElementById('adminBranchFilter');
    const monitorBranchSelect = document.getElementById('adminBranchSelect');
    const transferBranchSelect = document.getElementById('transferBranchSelect');
    const newCounterBranch = document.getElementById('newCounterBranch');
    const newBranchBranch = document.getElementById('shiftBranch');
    const shiftBranch = document.getElementById('shiftBranch');

    const renderBranchOptions = () => {
        const dbCurrent = window.qms.getDB();
        let filteredBranches = dbCurrent.branches;
        
        if (currentRegionScope !== 'all') {
            filteredBranches = filteredBranches.filter(b => b.region === currentRegionScope);
        }

        const optionsHtml = filteredBranches.map(br => `<option value="${br.id}">${br.name}</option>`).join('');
        
        if (branchFilter) {
            branchFilter.innerHTML = '<option value="all">All DS Offices</option>' + optionsHtml;
            if (currentBranchScope !== 'all') {
                branchFilter.value = currentBranchScope;
            }
        }
        if (monitorBranchSelect) {
            monitorBranchSelect.innerHTML = optionsHtml;
        }
        if (transferBranchSelect) {
            transferBranchSelect.innerHTML = optionsHtml;
        }
        if (newCounterBranch) {
            newCounterBranch.innerHTML = optionsHtml;
        }
        if (shiftBranch) {
            shiftBranch.innerHTML = optionsHtml;
        }
    };

    renderBranchOptions();

    // Populate service options for counter and transfer forms
    const serviceSelects = [
        document.getElementById('transferServiceSelect'),
        document.getElementById('newCounterService')
    ];
    serviceSelects.forEach(select => {
        if (select) {
            select.innerHTML = db.services.map(sv => `<option value="${sv.id}">${sv.name} (${sv.code})</option>`).join('');
        }
    });

    // Populate officers for shift form
    const shiftOfficer = document.getElementById('shiftOfficer');
    if (shiftOfficer) {
        const officers = db.users.filter(u => u.role === 'officer');
        shiftOfficer.innerHTML = officers.map(o => `<option value="${o.email}">${o.name} (${o.email})</option>`).join('');
    }

    // 1. Bind Filter Changes
    const regionSelect = document.getElementById('adminRegionSelect');
    if (regionSelect) {
        regionSelect.addEventListener('change', () => {
            currentRegionScope = regionSelect.value;
            renderBranchOptions();
            updateDashboardState();
            initAnalyticsCharts();
        });
    }

    if (branchFilter) {
        branchFilter.addEventListener('change', () => {
            currentBranchScope = branchFilter.value;
            updateDashboardState();
            initAnalyticsCharts();
        });
    }

    if (monitorBranchSelect) {
        monitorBranchSelect.addEventListener('change', () => {
            renderLiveQueueMonitor();
        });
    }

    document.getElementById('btnRefreshAnalytics').addEventListener('click', () => {
        updateDashboardState();
        initAnalyticsCharts();
        window.qms.showToast('Stats Updated', 'Roster and counters database refreshed.', 'success');
    });

    // 2. Bind Emergency Override Buttons
    const btnEmergency = document.getElementById('btnEmergencyTrigger');
    const btnRelease = document.getElementById('btnReleaseEmergencyBanner');
    
    if (btnEmergency) {
        btnEmergency.addEventListener('click', () => {
            if (confirm("Are you sure you want to trigger a GLOBAL EMERGENCY lock? This freezes all queues!")) {
                window.qms.toggleEmergencyMode(true, 'all', sessionUser.email);
                window.qms.showToast('Lockout Enabled', 'All calling operations suspended.', 'danger');
                updateDashboardState();
            }
        });
    }

    if (btnRelease) {
        btnRelease.addEventListener('click', () => {
            window.qms.toggleEmergencyMode(false, 'all', sessionUser.email);
            window.qms.showToast('Lockout Released', 'Queue operations resumed.', 'success');
            updateDashboardState();
        });
    }

    // 3. Bind Modal Form Submissions
    
    // Ticket Transfer Form
    const formTransfer = document.getElementById('formTransferTicket');
    if (formTransfer) {
        formTransfer.addEventListener('submit', (e) => {
            e.preventDefault();
            const ticketId = document.getElementById('transferTicketId').value;
            const targetService = document.getElementById('transferServiceSelect').value;
            const targetBranch = document.getElementById('transferBranchSelect').value;
            
            const success = window.qms.transferTicket(ticketId, targetService, targetBranch, '', sessionUser.email);
            if (success) {
                // Hide modal using standard BS
                const modalEl = document.getElementById('modalTransferTicket');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                window.qms.showToast('Ticket Transferred', 'Queue number successfully rerouted.', 'success');
                updateDashboardState();
            }
        });
    }

    // Add Counter Form
    const formCounter = document.getElementById('formAddCounter');
    if (formCounter) {
        formCounter.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('newCounterName').value.trim();
            const branch = document.getElementById('newCounterBranch').value;
            const service = document.getElementById('newCounterService').value;
            const agent = document.getElementById('newCounterAgent').value.trim();
            
            let dbCurrent = window.qms.getDB();
            const newCtr = {
                id: 'ctr-' + Date.now(),
                name: name,
                agent: agent,
                activeService: service,
                status: 'Offline',
                currentTicket: '',
                branchId: branch
            };
            dbCurrent.counters.push(newCtr);
            window.qms.saveDB(dbCurrent);
            window.qms.addLog(`New counter station configured: ${name} assigned to ${agent}.`, sessionUser.email, branch, 'INFO');
            
            const modalEl = document.getElementById('modalAddCounter');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            formCounter.reset();
            window.qms.showToast('Counter Configured', `${name} successfully added to database.`, 'success');
            updateDashboardState();
        });
    }

    // Add Branch Form
    const formBranch = document.getElementById('formAddBranch');
    if (formBranch) {
        formBranch.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('newBranchName').value.trim();
            const region = document.getElementById('newBranchRegion').value;
            const address = document.getElementById('newBranchAddress').value.trim();
            
            let dbCurrent = window.qms.getDB();
            const newBr = {
                id: 'br-' + Date.now(),
                name: name,
                region: region,
                address: address,
                active: true
            };
            dbCurrent.branches.push(newBr);
            window.qms.saveDB(dbCurrent);
            window.qms.addLog(`New DS Branch registered: ${name} in ${region} Region.`, sessionUser.email, newBr.id, 'INFO');
            
            const modalEl = document.getElementById('modalAddBranch');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            formBranch.reset();
            renderBranchOptions();
            window.qms.showToast('Branch Configured', `${name} added successfully.`, 'success');
            updateDashboardState();
        });
    }

    // Assign Shift Form
    const formShift = document.getElementById('formAssignShift');
    if (formShift) {
        formShift.addEventListener('submit', (e) => {
            e.preventDefault();
            const officer = document.getElementById('shiftOfficer').value;
            const name = document.getElementById('shiftName').value;
            const branch = document.getElementById('shiftBranch').value;
            
            // Collect checked days
            const daysChecked = Array.from(document.querySelectorAll('input[name="shiftDays"]:checked')).map(cb => cb.value);
            if (daysChecked.length === 0) {
                alert("Please select at least one rostered day.");
                return;
            }

            const hours = name.includes('Morning') ? '08:00 - 13:00' : '13:00 - 18:00';
            
            let dbCurrent = window.qms.getDB();
            const newSh = {
                id: 'sh-' + Date.now(),
                name: name,
                hours: hours,
                officerId: officer,
                branchId: branch,
                days: daysChecked
            };
            if (!dbCurrent.shifts) dbCurrent.shifts = [];
            dbCurrent.shifts.push(newSh);
            window.qms.saveDB(dbCurrent);
            window.qms.addLog(`Assigned Shift timetable ${name} to ${officer}.`, sessionUser.email, branch, 'INFO');
            
            const modalEl = document.getElementById('modalAssignShift');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            formShift.reset();
            window.qms.showToast('Shift Scheduled', 'Rostered shift scheduled successfully.', 'success');
            updateDashboardState();
        });
    }

    // 4. Log Auditing Listeners
    const logSearchInput = document.getElementById('logSearchInput');
    const logTypeFilter = document.getElementById('logTypeFilter');
    if (logSearchInput) logSearchInput.addEventListener('input', renderActivityLogs);
    if (logTypeFilter) logTypeFilter.addEventListener('change', renderActivityLogs);

    updateDashboardState();
    initVoiceSettingsPanel();
}

/* --- STATE RECALCULATION & KPI UPDATES --- */
function updateDashboardState() {
    const db = window.qms.getDB();

    // 1. Apply Emergency Status Banner toggles
    const emergencyBanner = document.getElementById('emergencyStatusBanner');
    const btnEmergency = document.getElementById('btnEmergencyTrigger');
    if (db.systemSettings && db.systemSettings.emergencyActive) {
        if (emergencyBanner) emergencyBanner.classList.remove('d-none');
        if (btnEmergency) {
            btnEmergency.innerText = "Locked State Active";
            btnEmergency.disabled = true;
        }
    } else {
        if (emergencyBanner) emergencyBanner.classList.add('d-none');
        if (btnEmergency) {
            btnEmergency.innerHTML = `Emergency Override <i class="fas fa-exclamation-triangle ms-1"></i>`;
            btnEmergency.disabled = false;
        }
    }

    // 2. Aggregate statistics filtered by region/branch scopes
    let activeBranches = db.branches;
    if (currentRegionScope !== 'all') {
        activeBranches = activeBranches.filter(b => b.region === currentRegionScope);
    }
    if (currentBranchScope !== 'all') {
        activeBranches = activeBranches.filter(b => b.id === currentBranchScope);
    }
    const branchIds = activeBranches.map(b => b.id);

    // Calculate real-time tickets metrics
    const todayTickets = db.tickets.filter(t => branchIds.includes(t.branchId));
    
    // Total Visitors today
    const totalVisitors = todayTickets.length;
    document.getElementById('kpiTotalVisitors').innerText = totalVisitors;

    // Active waiting tickets
    const activeWaiting = todayTickets.filter(t => t.status === 'Waiting').length;
    document.getElementById('kpiWaiting').innerText = activeWaiting;

    // Staff present on duty
    const activeStaff = db.users.filter(u => 
        (u.role === 'officer' || u.role === 'branch-manager') && 
        (u.assignedBranchId === 'all' || branchIds.includes(u.assignedBranchId)) &&
        (u.attendanceStatus === 'Active' || u.attendanceStatus === 'On Break')
    ).length;
    document.getElementById('kpiAttendance').innerText = `${activeStaff} Present`;

    // Busy counters (Active and occupied)
    const activeCounters = db.counters.filter(c => 
        branchIds.includes(c.branchId) && 
        c.status === 'Active' && 
        c.currentTicket !== ''
    );
    const busyCounterText = activeCounters.length > 0 ? activeCounters.map(c => c.name).join(', ') : 'None';
    document.getElementById('kpiBusy').innerText = busyCounterText;
    document.getElementById('kpiBusy').title = busyCounterText;

    // Average waiting calculation (real wait times mapped dynamically)
    let totalWaitEstimate = db.services.reduce((acc, s) => acc + s.avgWait, 0) / db.services.length;
    document.getElementById('kpiWait').innerText = activeWaiting > 0 ? `${Math.round(totalWaitEstimate * activeWaiting * 0.45)}m` : '0m';

    // Service Completion Rate
    const completed = todayTickets.filter(t => t.status === 'Completed').length;
    const noShow = todayTickets.filter(t => t.status === 'No Show').length;
    const rate = (completed + noShow) > 0 ? ((completed / (completed + noShow)) * 100).toFixed(1) : '100.0';
    document.getElementById('kpiCompletionRate').innerText = `${rate}%`;

    // 3. Render all config/roster tables
    renderLiveQueueMonitor();
    renderCountersConfig();
    renderBranchesConfig();
    renderStaffConfig();
    renderActivityLogs();
}

/* --- RENDER INDIVIDUAL PANELS --- */

function renderLiveQueueMonitor() {
    const db = window.qms.getDB();
    const branchSelector = document.getElementById('adminBranchSelect');
    if (!branchSelector) return;
    const branchId = branchSelector.value;
    
    // 1. Station Roster cards
    const roster = document.getElementById('adminCountersRoster');
    if (roster) {
        const branchCounters = db.counters.filter(c => c.branchId === branchId);
        if (branchCounters.length === 0) {
            roster.innerHTML = '<div class="col-12 text-center text-muted py-3">No active counters at this branch. Add counters below.</div>';
        } else {
            roster.innerHTML = branchCounters.map(c => {
                const service = db.services.find(s => s.id === c.activeService);
                const activeToken = c.status === 'Active' ? (c.currentTicket || 'Serving Idle') : 'Offline';
                const colorClass = c.status === 'Active' ? (c.currentTicket ? 'text-primary pulse-glow-primary' : 'text-success') : 'text-muted';
                return `
                    <div class="col-sm-6 col-xl-3 animate-fade-in-up">
                        <div class="glass-panel p-3 text-center">
                            <small class="text-muted fw-bold text-uppercase d-block">${c.name}</small>
                            <h2 class="${colorClass} my-2 py-1 rounded d-inline-block px-3">${activeToken}</h2>
                            <div class="small mt-1 text-main">Operator: <strong>${c.agent}</strong></div>
                            <div class="small text-muted text-truncate">Service: ${service ? service.name : 'General'}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // 2. Queued waitlists table
    const tableBody = document.getElementById('adminQueueTableBody');
    if (tableBody) {
        const activeTickets = window.qms.sortTickets(db.tickets.filter(t => t.branchId === branchId && (t.status === 'Waiting' || t.status === 'Serving' || t.status === 'Hold')));

        if (activeTickets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-muted text-center py-4">No active tickets waiting in line.</td></tr>`;
            return;
        }

        tableBody.innerHTML = activeTickets.map(ticket => {
            const service = db.services.find(s => s.id === ticket.serviceId);
            const arrivalTime = new Date(ticket.timeCreated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            let statusBadge = "";
            let actionBtn = "";

            if (ticket.status === 'Serving') {
                statusBadge = `<span class="status-badge status-badge-serving">Serving (${ticket.counter})</span>`;
                actionBtn = `
                    <button class="glass-btn glass-btn-success py-1 px-2 small" onclick="closeTicket('${ticket.id}')" title="Mark Completed">
                        Complete <i class="fas fa-check"></i>
                    </button>
                    <button class="glass-btn border-info text-info py-1 px-2 small" onclick="recallVoiceCall('${ticket.id}')" title="Recall audio">
                        Recall <i class="fas fa-volume-up"></i>
                    </button>
                `;
            } else if (ticket.status === 'Hold') {
                statusBadge = `<span class="status-badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-25">Holding</span>`;
                actionBtn = `
                    <button class="glass-btn glass-btn-primary py-1 px-2 small" onclick="callTargetTicket('${ticket.id}')">
                        Call Now <i class="fas fa-bullhorn"></i>
                    </button>
                `;
            } else {
                statusBadge = `<span class="status-badge status-badge-waiting">Waiting</span>`;
                actionBtn = `
                    <button class="glass-btn glass-btn-primary py-1 px-2 small" onclick="callTargetTicket('${ticket.id}')" title="Call to Counter">
                        Call Next <i class="fas fa-bullhorn"></i>
                    </button>
                    <button class="glass-btn border-warning text-warning py-1 px-2 small" onclick="holdTicket('${ticket.id}')" title="Hold Queue">
                        Hold <i class="fas fa-pause"></i>
                    </button>
                    <button class="glass-btn border-info text-info py-1 px-2 small" onclick="transferTicketModal('${ticket.id}')" title="Transfer Token">
                        Transfer <i class="fas fa-exchange-alt"></i>
                    </button>
                    <button class="glass-btn border-danger text-danger py-1 px-2 small" onclick="skipTicket('${ticket.id}')" title="Mark No Show">
                        Skip
                    </button>
                `;
            }

            let priorityBadge = "";
            const pGroup = ticket.priorityGroup || 'Regular';
            if (pGroup !== 'Regular') {
                let pColor = "var(--text-muted)";
                let pIcon = "fa-user-shield";
                if (pGroup === 'Emergency') { pColor = "#ef4444"; pIcon = "fa-exclamation-triangle"; }
                else if (pGroup === 'Disabled') { pColor = "#f59e0b"; pIcon = "fa-wheelchair"; }
                else if (pGroup === 'Elderly') { pColor = "#06b6d4"; pIcon = "fa-blind"; }
                else if (pGroup === 'VIP') { pColor = "#8b5cf6"; pIcon = "fa-crown"; }
                priorityBadge = `<span class="badge" style="background: rgba(255,255,255,0.05); color: ${pColor}; border: 1px solid ${pColor}50;"><i class="fas ${pIcon} me-1"></i>${pGroup}</span>`;
            } else {
                priorityBadge = `<span class="text-muted small">Regular</span>`;
            }

            return `
                <tr class="animate-fade-in-up">
                    <td class="fw-bold text-primary">${ticket.number}</td>
                    <td>${ticket.customerName}</td>
                    <td>${service ? service.name : 'Unknown'}</td>
                    <td>${priorityBadge}</td>
                    <td>${arrivalTime}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="d-flex gap-2 justify-content-center">
                            ${actionBtn}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

function renderCountersConfig() {
    const db = window.qms.getDB();
    const configTable = document.getElementById('adminCountersConfigTable');
    if (!configTable) return;

    let activeCounters = db.counters;
    if (currentRegionScope !== 'all') {
        const regionBranches = db.branches.filter(b => b.region === currentRegionScope).map(b => b.id);
        activeCounters = activeCounters.filter(c => regionBranches.includes(c.branchId));
    }
    if (currentBranchScope !== 'all') {
        activeCounters = activeCounters.filter(c => c.branchId === currentBranchScope);
    }

    if (activeCounters.length === 0) {
        configTable.innerHTML = `<tr><td colspan="7" class="text-muted text-center py-3">No counter stations configured for selected filters.</td></tr>`;
        return;
    }

    configTable.innerHTML = activeCounters.map(c => {
        const service = db.services.find(s => s.id === c.activeService);
        const branch = db.branches.find(b => b.id === c.branchId);
        const isOnline = c.status === 'Active';
        return `
            <tr>
                <td class="fw-bold">${c.name}</td>
                <td>${branch ? branch.name : 'Unknown Branch'}</td>
                <td><strong>${c.agent}</strong></td>
                <td>${service ? service.name : 'General Operations'}</td>
                <td><strong class="text-accent">${c.currentTicket || '---'}</strong></td>
                <td>
                    <span class="status-badge ${isOnline ? 'status-badge-completed' : 'status-badge-noshow'}">
                        ${c.status}
                    </span>
                </td>
                <td>
                    <button class="glass-btn py-1 px-2 small ${isOnline ? 'border-danger text-danger' : 'glass-btn-success'}" onclick="toggleCounterStatus('${c.id}')">
                        ${isOnline ? 'Go Offline' : 'Go Online'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderBranchesConfig() {
    const db = window.qms.getDB();
    const tableBody = document.getElementById('adminBranchesTableBody');
    if (!tableBody) return;

    let branchesList = db.branches;
    if (currentRegionScope !== 'all') {
        branchesList = branchesList.filter(b => b.region === currentRegionScope);
    }
    if (currentBranchScope !== 'all') {
        branchesList = branchesList.filter(b => b.id === currentBranchScope);
    }

    tableBody.innerHTML = branchesList.map(br => {
        const totalCtrs = db.counters.filter(c => c.branchId === br.id).length;
        const totalWaits = db.tickets.filter(t => t.branchId === br.id && t.status === 'Waiting').length;
        const isOnline = br.active !== false;

        return `
            <tr>
                <td><strong>${br.name}</strong></td>
                <td><span class="badge bg-secondary bg-opacity-25 text-primary px-3 py-1 fs-7">${br.region} Region</span></td>
                <td><small class="text-muted">${br.address}</small></td>
                <td class="fw-bold text-main">${totalCtrs} Desks</td>
                <td><span class="badge bg-secondary bg-opacity-15 text-accent px-2 py-1">${totalWaits} Tickets Waiting</span></td>
                <td>
                    <span class="status-badge ${isOnline ? 'status-badge-completed' : 'status-badge-noshow'}">
                        ${isOnline ? 'Active' : 'Suspended'}
                    </span>
                </td>
                <td>
                    <button class="glass-btn py-1 px-2 small ${isOnline ? 'border-danger text-danger' : 'glass-btn-success'}" onclick="toggleBranchStatus('${br.id}')">
                        ${isOnline ? 'Suspend' : 'Activate'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderStaffConfig() {
    const db = window.qms.getDB();
    const staffTable = document.getElementById('adminStaffTableBody');
    const shiftsTable = document.getElementById('adminShiftsTableBody');
    if (!staffTable) return;

    let staffList = db.users.filter(u => u.role !== 'customer');
    if (currentRegionScope !== 'all') {
        const regionBranches = db.branches.filter(b => b.region === currentRegionScope).map(b => b.id);
        staffList = staffList.filter(u => u.assignedBranchId === 'all' || regionBranches.includes(u.assignedBranchId));
    }
    if (currentBranchScope !== 'all') {
        staffList = staffList.filter(u => u.assignedBranchId === 'all' || u.assignedBranchId === currentBranchScope);
    }

    // Set dynamic attendance counts
    const activeStaff = staffList.filter(s => s.attendanceStatus === 'Active');
    const breakStaff = staffList.filter(s => s.attendanceStatus === 'On Break');
    const offlineStaff = staffList.filter(s => !s.attendanceStatus || s.attendanceStatus === 'Offline');

    document.getElementById('staffPresentCount').innerText = activeStaff.length;
    document.getElementById('staffBreakCount').innerText = breakStaff.length;
    document.getElementById('staffOfflineCount').innerText = offlineStaff.length;

    // Renders Operator roster table
    staffTable.innerHTML = staffList.map(u => {
        const branch = db.branches.find(b => b.id === u.assignedBranchId);
        const branchName = u.assignedBranchId === 'all' ? 'All Branches' : (branch ? branch.name : 'Unassigned');
        
        let attendanceBadge = "";
        let attendanceStatus = u.attendanceStatus || 'Offline';
        if (attendanceStatus === 'Active') {
            attendanceBadge = `<span class="status-badge status-badge-completed">Present</span>`;
        } else if (attendanceStatus === 'On Break') {
            attendanceBadge = `<span class="status-badge bg-warning bg-opacity-25 text-warning border-warning border-opacity-25">On Break</span>`;
        } else {
            attendanceBadge = `<span class="status-badge bg-secondary bg-opacity-25 text-muted">Offline</span>`;
        }

        let shiftsAssigned = db.shifts ? db.shifts.filter(s => s.officerId === u.email) : [];
        let shiftDesc = shiftsAssigned.length > 0 ? shiftsAssigned.map(s => s.name).join(', ') : 'Unscheduled';

        let toggles = `
            <div class="btn-group gap-1">
                <button class="glass-btn px-2 py-1 small text-success" onclick="toggleStaffDuty('${u.email}', 'Active')">Clock In</button>
                <button class="glass-btn px-2 py-1 small text-warning" onclick="toggleStaffDuty('${u.email}', 'On Break')">Break</button>
                <button class="glass-btn px-2 py-1 small text-danger" onclick="toggleStaffDuty('${u.email}', 'Offline')">Clock Out</button>
            </div>
        `;

        return `
            <tr>
                <td><strong>${u.name}</strong></td>
                <td><small class="font-monospace text-muted">${u.email}</small></td>
                <td><span class="badge bg-secondary bg-opacity-25 text-accent px-2 py-1 fs-7">${u.role.toUpperCase()}</span></td>
                <td>${branchName}</td>
                <td><small>${shiftDesc}</small></td>
                <td>${attendanceBadge}</td>
                <td>${toggles}</td>
            </tr>
        `;
    }).join('');

    // Renders Shifts timetable visual calendar
    if (shiftsTable && db.shifts) {
        let branchShifts = db.shifts;
        if (currentBranchScope !== 'all') {
            branchShifts = branchShifts.filter(s => s.branchId === currentBranchScope);
        }

        if (branchShifts.length === 0) {
            shiftsTable.innerHTML = `<tr><td colspan="6" class="text-muted text-center py-3">No shifts scheduled for selected offices.</td></tr>`;
            return;
        }

        shiftsTable.innerHTML = branchShifts.map(sh => {
            const officer = db.users.find(u => u.email === sh.officerId);
            const branch = db.branches.find(b => b.id === sh.branchId);
            
            return `
                <tr>
                    <td class="fw-bold">${sh.name}</td>
                    <td><strong>${officer ? officer.name : 'Unknown Officer'}</strong></td>
                    <td>${branch ? branch.name : 'Global'}</td>
                    <td><code class="text-primary">${sh.hours}</code></td>
                    <td><small class="text-muted">${sh.days.join(', ')}</small></td>
                    <td>
                        <button class="glass-btn border-danger text-danger py-1 px-2 small" onclick="removeScheduledShift('${sh.id}')">
                            Delete Schedule <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

function renderActivityLogs() {
    const db = window.qms.getDB();
    const tbody = document.getElementById('adminLogsTableBody');
    if (!tbody) return;

    let logsList = db.activityLogs || [];
    
    // Filters by Branch Scope
    if (currentBranchScope !== 'all') {
        logsList = logsList.filter(l => l.branchId === 'all' || l.branchId === currentBranchScope);
    } else if (currentRegionScope !== 'all') {
        const regionBranches = db.branches.filter(b => b.region === currentRegionScope).map(b => b.id);
        logsList = logsList.filter(l => l.branchId === 'all' || regionBranches.includes(l.branchId));
    }

    // Filter by Type
    const typeFilter = document.getElementById('logTypeFilter').value;
    if (typeFilter !== 'all') {
        logsList = logsList.filter(l => l.type === typeFilter);
    }

    // Search bar filter
    const searchVal = document.getElementById('logSearchInput').value.trim().toLowerCase();
    if (searchVal !== '') {
        logsList = logsList.filter(l => 
            l.action.toLowerCase().includes(searchVal) ||
            l.user.toLowerCase().includes(searchVal)
        );
    }

    if (logsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-4">No audit logs match current filter descriptors.</td></tr>`;
        return;
    }

    tbody.innerHTML = logsList.map(l => {
        let badgeClass = "bg-secondary text-white";
        if (l.type === 'SUCCESS') badgeClass = "bg-success text-success bg-opacity-25";
        if (l.type === 'WARNING') badgeClass = "bg-warning text-warning bg-opacity-25";
        if (l.type === 'EMERGENCY') badgeClass = "bg-danger text-danger bg-opacity-25 animate-pulse";
        
        const timestamp = new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + new Date(l.timestamp).toLocaleDateString();
        const branch = db.branches.find(b => b.id === l.branchId);
        const branchLabel = l.branchId === 'all' ? 'System Global' : (branch ? branch.name : 'Unknown Branch');
        
        return `
            <tr>
                <td><small class="text-muted font-monospace">${timestamp}</small></td>
                <td><span class="badge ${badgeClass} text-uppercase font-monospace" style="font-size:0.75rem;">${l.type}</span></td>
                <td><strong>${l.user}</strong></td>
                <td><small>${branchLabel}</small></td>
                <td class="text-start text-main small" style="max-width:320px; white-space: normal;">${l.action}</td>
            </tr>
        `;
    }).join('');
}

/* --- ADMIN MUTATION HANDLERS --- */

window.holdTicket = function(ticketId) {
    let db = window.qms.getDB();
    const sessionUser = JSON.parse(localStorage.getItem('qms_logged_in_user'));
    const ticket = db.tickets.find(t => t.id === ticketId);
    
    if (ticket) {
        ticket.status = 'Hold';
        window.qms.saveDB(db);
        window.qms.addLog(`Queue token ${ticket.number} put on hold state.`, sessionUser.email, ticket.branchId, 'WARNING');
        window.qms.showToast('Ticket Held', `Token ${ticket.number} moved to hold roster.`, 'warning');
        updateDashboardState();
    }
};

window.transferTicketModal = function(ticketId) {
    document.getElementById('transferTicketId').value = ticketId;
    
    // Open standard Bootstrap Modal
    const modalEl = document.getElementById('modalTransferTicket');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
};

window.skipTicket = function(ticketId) {
    let db = window.qms.getDB();
    const sessionUser = JSON.parse(localStorage.getItem('qms_logged_in_user'));
    const ticket = db.tickets.find(t => t.id === ticketId);
    
    if (ticket) {
        ticket.status = 'No Show';
        
        // Remove ticket from counter serving block if it was active
        if (ticket.counter) {
            const counter = db.counters.find(c => c.name === ticket.counter && c.branchId === ticket.branchId);
            if (counter) counter.currentTicket = '';
            ticket.counter = '';
        }

        window.qms.saveDB(db);
        window.qms.addLog(`Customer skipped: token ${ticket.number} marked No Show.`, sessionUser.email, ticket.branchId, 'WARNING');
        window.qms.showToast('Ticket Skipped', `Token ${ticket.number} flagged as no-show.`, 'warning');
        updateDashboardState();
    }
};

window.closeTicket = function(ticketId) {
    let db = window.qms.getDB();
    const sessionUser = JSON.parse(localStorage.getItem('qms_logged_in_user'));
    const ticket = db.tickets.find(t => t.id === ticketId);
    
    if (ticket) {
        ticket.status = 'Completed';
        ticket.timeCompleted = new Date().toISOString();
        
        // Remove ticket from counter serving block
        if (ticket.counter) {
            const counter = db.counters.find(c => c.name === ticket.counter && c.branchId === ticket.branchId);
            if (counter) counter.currentTicket = '';
        }

        window.qms.saveDB(db);
        window.qms.addLog(`Ticket ${ticket.number} served completely.`, sessionUser.email, ticket.branchId, 'SUCCESS');
        window.qms.showToast('Completed Turn', `Token ${ticket.number} completed successfully.`, 'success');
        updateDashboardState();
    }
};

window.callTargetTicket = function(ticketId) {
    let db = window.qms.getDB();
    const sessionUser = JSON.parse(localStorage.getItem('qms_logged_in_user'));
    const ticket = db.tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    // Pick first active, free counter station at this branch
    const branchCounters = db.counters.filter(c => c.branchId === ticket.branchId && c.status === 'Active');
    const counter = branchCounters.find(c => c.currentTicket === '') || branchCounters[0];

    if (!counter) {
        window.qms.showToast('No Counter Available', 'All active desks at this branch are occupied or offline.', 'warning');
        return;
    }

    // Complete previous ticket on this counter
    if (counter.currentTicket) {
        const prevTicket = db.tickets.find(t => t.number === counter.currentTicket && t.branchId === counter.branchId && t.status === 'Serving');
        if (prevTicket) {
            prevTicket.status = 'Completed';
            prevTicket.timeCompleted = new Date().toISOString();
        }
    }

    // Call current ticket
    ticket.status = 'Serving';
    ticket.counter = counter.name;
    counter.currentTicket = ticket.number;

    window.qms.saveDB(db);
    window.qms.addLog(`Officer called token ${ticket.number} to ${counter.name}.`, sessionUser.email, ticket.branchId, 'SUCCESS');
    window.qms.showToast('Number Called', `Now calling token ${ticket.number} to ${counter.name}`, 'success');

    // Trigger Vocal Announcement
    window.qms.triggerVocalAnnouncement(ticket.number, counter.name);
    updateDashboardState();
};

window.recallVoiceCall = function(ticketId) {
    const db = window.qms.getDB();
    const ticket = db.tickets.find(t => t.id === ticketId);
    if (ticket) {
        window.qms.showToast('Recall Token', `Recalling token ${ticket.number} to ${ticket.counter}`, 'info');
        window.qms.triggerVocalAnnouncement(ticket.number, ticket.counter || 'Counter');
    }
};

window.toggleCounterStatus = function(counterId) {
    let db = window.qms.getDB();
    const sessionUser = JSON.parse(localStorage.getItem('qms_logged_in_user'));
    const counter = db.counters.find(c => c.id === counterId);
    if (counter) {
        counter.status = counter.status === 'Active' ? 'Offline' : 'Active';
        if (counter.status === 'Offline') counter.currentTicket = '';
        
        window.qms.saveDB(db);
        window.qms.addLog(`Counter configured: ${counter.name} toggled ${counter.status.toLowerCase()}.`, sessionUser.email, counter.branchId, 'INFO');
        window.qms.showToast('Counter Configured', `${counter.name} is now ${counter.status.toLowerCase()}.`, 'info');
        updateDashboardState();
    }
};

window.toggleBranchStatus = function(branchId) {
    let db = window.qms.getDB();
    const sessionUser = JSON.parse(localStorage.getItem('qms_logged_in_user'));
    const branch = db.branches.find(b => b.id === branchId);
    if (branch) {
        branch.active = branch.active === false ? true : false;
        
        // If suspending branch, go all its counters offline
        if (branch.active === false) {
            db.counters.filter(c => c.branchId === branchId).forEach(c => {
                c.status = 'Offline';
                c.currentTicket = '';
            });
        }

        window.qms.saveDB(db);
        window.qms.addLog(`DS Branch status edited: ${branch.name} toggled ${branch.active ? 'active' : 'suspended'}.`, sessionUser.email, branch.id, 'WARNING');
        window.qms.showToast('Branch Status Updated', `${branch.name} is now ${branch.active ? 'active' : 'suspended'}.`, 'info');
        updateDashboardState();
    }
};

window.toggleStaffDuty = function(email, status) {
    const sessionUser = JSON.parse(localStorage.getItem('qms_logged_in_user'));
    window.qms.logAttendance(email, `Attendance Manual Set: ${status}`, status);
    
    // Find assigned branch for logging
    const db = window.qms.getDB();
    const user = db.users.find(u => u.email === email);
    const branchId = user ? user.assignedBranchId : 'all';

    window.qms.addLog(`Staff roster updated: ${email} attendance marked as ${status}.`, sessionUser.email, branchId, 'INFO');
    window.qms.showToast('Roster Scheduled', `Attendance updated safely to ${status}.`, 'success');
    updateDashboardState();
};

window.removeScheduledShift = function(shiftId) {
    let db = window.qms.getDB();
    const sessionUser = JSON.parse(localStorage.getItem('qms_logged_in_user'));
    const shiftIndex = db.shifts.findIndex(s => s.id === shiftId);
    
    if (shiftIndex !== -1) {
        const sh = db.shifts[shiftIndex];
        db.shifts.splice(shiftIndex, 1);
        window.qms.saveDB(db);
        window.qms.addLog(`Removed shift scheduler ${sh.name} for ${sh.officerId}.`, sessionUser.email, sh.branchId, 'INFO');
        window.qms.showToast('Schedule Removed', 'Staff rostered timetable shift deleted.', 'success');
        updateDashboardState();
    }
};

/* --- VOICE ANNOUNCEMENT Synthesis Panel --- */
function initVoiceSettingsPanel() {
    const form = document.getElementById('voiceSettingsForm');
    if (!form) return;

    const db = window.qms.getDB();
    const settings = db.voiceSettings || { enabled: true, rate: 0.95, pitch: 1.0, voiceIndex: 0 };

    const rateRange = document.getElementById('voiceRate');
    const pitchRange = document.getElementById('voicePitch');
    const toggleEnabled = document.getElementById('voiceToggleEnabled');

    rateRange.value = settings.rate;
    pitchRange.value = settings.pitch;
    toggleEnabled.checked = settings.enabled;

    document.getElementById('voiceRateVal').innerText = settings.rate;
    document.getElementById('voicePitchVal').innerText = settings.pitch;

    rateRange.addEventListener('input', () => {
        document.getElementById('voiceRateVal').innerText = rateRange.value;
    });
    pitchRange.addEventListener('input', () => {
        document.getElementById('voicePitchVal').innerText = pitchRange.value;
    });

    const voiceSelect = document.getElementById('voiceSelectModel');
    
    const populateVoices = () => {
        if (!('speechSynthesis' in window)) return;
        const voices = window.speechSynthesis.getVoices();
        voiceSelect.innerHTML = voices.map((v, i) => 
            `<option value="${i}" ${i === settings.voiceIndex ? 'selected' : ''}>${v.name} (${v.lang})</option>`
        ).join('');
    };

    populateVoices();
    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = populateVoices;
    }

    document.getElementById('btnTestAnnouncement').onclick = () => {
        const rate = parseFloat(rateRange.value);
        const pitch = parseFloat(pitchRange.value);
        const voiceIdx = parseInt(voiceSelect.value) || 0;

        if ('speechSynthesis' in window) {
            const phrase = "Testing vocal announcement system. Ticket A 1 0 1, proceed to Counter 1.";
            const utterance = new SpeechSynthesisUtterance(phrase);
            const voices = window.speechSynthesis.getVoices();
            
            if (voices.length > 0) utterance.voice = voices[voiceIdx];
            utterance.rate = rate;
            utterance.pitch = pitch;

            window.speechSynthesis.speak(utterance);
            window.qms.showToast('Vocal Sound Test', 'Synthesizer voice triggered successfully.', 'info');
        }
    };

    form.onsubmit = (e) => {
        e.preventDefault();
        
        let dbCurrent = window.qms.getDB();
        dbCurrent.voiceSettings = {
            enabled: toggleEnabled.checked,
            rate: parseFloat(rateRange.value),
            pitch: parseFloat(pitchRange.value),
            voiceIndex: parseInt(voiceSelect.value) || 0
        };

        window.qms.saveDB(dbCurrent);
        window.qms.showToast('Settings Saved', 'Speech voice parameters successfully saved.', 'success');
    };
}

/* --- CHARTS INITIALIZATIONS --- */
function initAnalyticsCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
    const db = window.qms.getDB();

    // 1. Hourly Peak congestion line chart (filters by scope)
    const trendsCtx = document.getElementById('chartLoadTrends');
    if (trendsCtx) {
        if (loadChart) loadChart.destroy();

        let branchLabels = db.branches;
        if (currentRegionScope !== 'all') {
            branchLabels = branchLabels.filter(b => b.region === currentRegionScope);
        }
        if (currentBranchScope !== 'all') {
            branchLabels = branchLabels.filter(b => b.id === currentBranchScope);
        }

        // Generate line series dynamically per branch
        const datasets = branchLabels.slice(0, 3).map((br, index) => {
            const colors = ['#7c3aed', '#0d9488', '#f59e0b'];
            const fills = ['rgba(124, 58, 237, 0.12)', 'rgba(13, 148, 136, 0.08)', 'rgba(245, 158, 11, 0.06)'];
            // Generate some realistic seed data points based on branch waitlist sizes
            const base = 10 + index * 5 + Math.min(10, db.tickets.filter(t => t.branchId === br.id).length);
            const lineData = [base, base + 8, base + 15, base + 22, base + 12, base + 18, base + 28, Math.max(2, base - 5)];
            
            return {
                label: br.name,
                data: lineData,
                borderColor: colors[index % colors.length],
                backgroundColor: fills[index % fills.length],
                fill: true,
                tension: 0.4
            };
        });

        loadChart = new Chart(trendsCtx, {
            type: 'line',
            data: {
                labels: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
                datasets: datasets.length > 0 ? datasets : [{
                    label: 'Mock Line Roster',
                    data: [0, 0, 0, 0, 0, 0, 0, 0],
                    borderColor: '#7c3aed'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: textColor } }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    }
                }
            }
        });
    }

    // 2. Department wait distribution bar chart
    const deptCtx = document.getElementById('chartDepartmentWait');
    if (deptCtx) {
        if (deptChart) deptChart.destroy();
        
        let activeBranchIds = db.branches.map(b => b.id);
        if (currentRegionScope !== 'all') {
            activeBranchIds = db.branches.filter(b => b.region === currentRegionScope).map(b => b.id);
        }
        if (currentBranchScope !== 'all') {
            activeBranchIds = [currentBranchScope];
        }

        const labels = db.services.slice(0, 5).map(s => s.name);
        const ticketCounts = db.services.slice(0, 5).map(s => {
            // Count total matching tickets
            return db.tickets.filter(t => t.serviceId === s.id && activeBranchIds.includes(t.branchId)).length + Math.floor(Math.random() * 2 + 1);
        });

        deptChart = new Chart(deptCtx, {
            type: 'bar',
            data: {
                labels: labels.map(l => l.length > 15 ? l.substring(0, 15) + '..' : l),
                datasets: [{
                    label: 'Active Tokens Created',
                    data: ticketCounts,
                    backgroundColor: ['#8b5cf6', '#6366f1', '#f59e0b', '#0d9488', '#ec4899'],
                    borderWidth: 0,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { size: 9 } }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: textColor, precision: 0 }
                    }
                }
            }
        });
    }
}
