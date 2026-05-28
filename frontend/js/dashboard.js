/**
 * QMS Customer Dashboard Controller
 * Orchestrates customer interactions: bookings, active queue checks, ticket QR rendering, PDF downloads, and logout routines.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Authentication Gate
    const sessionUser = localStorage.getItem('qms_logged_in_user');
    if (!sessionUser) {
        window.location.href = 'login.html';
        return;
    }

    const user = JSON.parse(sessionUser);
    
    // Greeting UI
    const dashGreeting = document.getElementById('dashGreeting');
    const userWelcomeText = document.getElementById('userWelcomeText');
    if (dashGreeting) dashGreeting.innerText = `Hello, ${user.name}`;
    if (userWelcomeText) userWelcomeText.innerText = `Welcome, ${user.name}`;

    // Logout
    document.getElementById('btnLogoutBtn').addEventListener('click', () => {
        localStorage.removeItem('qms_logged_in_user');
        window.qms.showToast('Logged Out', 'Successfully signed out of session.', 'info');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    });

    // Toggle Book Ticket Tab via Jumbotron CTA
    const btnShowBookingTab = document.getElementById('btnShowBookingTab');
    if (btnShowBookingTab) {
        btnShowBookingTab.addEventListener('click', () => {
            const bookingTab = document.getElementById('book-ticket-tab');
            if (bookingTab) bookingTab.click();
        });
    }

    // Initialize Page features
    initDashboardUI(user);

    // Watch local state changes
    window.addEventListener('qmsStateUpdated', () => {
        initDashboardUI(user);
    });
});

function initDashboardUI(user) {
    const db = window.qms.getDB();
    
    // Seed selectors
    const bookBranch = document.getElementById('bookBranch');
    const bookService = document.getElementById('bookService');
    const bookPriority = document.getElementById('bookPriority');

    if (bookBranch && bookBranch.children.length === 0) {
        bookBranch.innerHTML = db.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    }
    
    if (bookService && bookService.children.length === 0) {
        bookService.innerHTML = db.services.map(s => `<option value="${s.id}" data-code="${s.code}">${s.name}</option>`).join('');
        
        // Setup wait info hook
        const updateEstWait = () => {
            const sId = bookService.value;
            const service = db.services.find(s => s.id === sId);
            const branchId = bookBranch.value;
            const pGroup = bookPriority ? bookPriority.value : 'Regular';
            
            const waitingTickets = db.tickets.filter(t => t.branchId === branchId && t.serviceId === sId && t.status === 'Waiting');
            
            // Simulate adding a dummy ticket
            const dummyTicket = { id: 'dummy', priorityGroup: pGroup, timeCreated: new Date().toISOString() };
            const sorted = window.qms.sortTickets([...waitingTickets, dummyTicket]);
            const position = sorted.findIndex(t => t.id === 'dummy') + 1;
            
            const totalWait = position * service.avgWait;
            document.getElementById('bookEstWaitText').innerHTML = `Currently <strong>${waitingTickets.length}</strong> people in line. Your simulated queue position would be <strong># ${position}</strong>. Expected wait time: ~<strong>${totalWait} minutes</strong>.`;
        };

        bookService.addEventListener('change', updateEstWait);
        bookBranch.addEventListener('change', updateEstWait);
        if (bookPriority) {
            bookPriority.addEventListener('change', updateEstWait);
        }
        updateEstWait();
    }

    // Render active ticket cards
    renderActiveTickets(user, db);

    // Render history records
    renderHistoryTickets(user, db);

    // Form submission
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm && !bookingForm.dataset.listenerBound) {
        bookingForm.dataset.listenerBound = 'true';
        bookingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitTicketBooking(user);
        });
    }
}

function renderActiveTickets(user, db) {
    const container = document.getElementById('activeTicketsContainer');
    if (!container) return;

    // Filter tickets registered under user details
    const activeTickets = db.tickets.filter(t => 
        t.customerName.toLowerCase() === user.name.toLowerCase() && 
        (t.status === 'Waiting' || t.status === 'Serving')
    );

    if (activeTickets.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="glass-panel p-5 text-center">
                    <i class="fas fa-ticket-alt text-muted fs-1 mb-3"></i>
                    <h5 class="fw-bold">No Active Tickets</h5>
                    <p class="text-muted small mb-0">You don't have any tickets in progress. Click the "Book Ticket" tab above to generate one.</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = activeTickets.map(ticket => {
        const branch = db.branches.find(b => b.id === ticket.branchId);
        const service = db.services.find(s => s.id === ticket.serviceId);
        
        let positionInfo = "";
        let cardAlertBorder = "border-secondary border-opacity-10";
        let statusBadge = "";

        if (ticket.status === 'Serving') {
            cardAlertBorder = "border-info pulse-glow-primary";
            statusBadge = `<span class="status-badge status-badge-serving"><i class="fas fa-bell animate-bounce"></i> Serving Now</span>`;
            positionInfo = `
                <div class="text-center py-3">
                    <h5 class="fw-bold text-info">Proceed to Counter</h5>
                    <h2 class="fw-extrabold text-white mt-1">${ticket.counter || 'Active Counter'}</h2>
                    <small class="text-muted d-block small mt-2">Officer is waiting for you now.</small>
                </div>
            `;
        } else {
            statusBadge = `<span class="status-badge status-badge-waiting"><i class="fas fa-clock"></i> Waiting</span>`;
            // Calculate line position
            const serviceWaiting = window.qms.sortTickets(db.tickets.filter(t => 
                t.branchId === ticket.branchId && 
                t.serviceId === ticket.serviceId && 
                t.status === 'Waiting'
            ));
            
            const position = serviceWaiting.findIndex(t => t.id === ticket.id) + 1;
            const estTime = position * service.avgWait;

            positionInfo = `
                <div class="row g-3 text-center my-2">
                    <div class="col-6 border-end border-secondary border-opacity-10">
                        <small class="text-muted d-block small">Queue Position</small>
                        <h4 class="fw-bold text-primary mb-0"># ${position}</h4>
                    </div>
                    <div class="col-6">
                        <small class="text-muted d-block small">Estimated Wait</small>
                        <h4 class="fw-bold text-accent mb-0">~ ${estTime}m</h4>
                    </div>
                </div>
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
            priorityBadge = `<span class="status-badge ms-2" style="background: rgba(255,255,255,0.05); color: ${pColor}; border: 1px solid ${pColor}50;"><i class="fas ${pIcon} me-1"></i>${pGroup}</span>`;
        }

        return `
            <div class="col-md-6 col-lg-4">
                <div class="glass-panel p-4 h-100 d-flex flex-column justify-content-between border ${cardAlertBorder}">
                    <div>
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div class="d-flex align-items-center">
                                ${statusBadge}
                                ${priorityBadge}
                            </div>
                            <span class="text-muted small">ID: ${ticket.number}</span>
                        </div>
                        <h4 class="fw-bold mb-1">${ticket.number}</h4>
                        <small class="text-muted d-block mb-3">${service.name}</small>
                        <div class="small text-muted"><i class="fas fa-map-marker-alt text-primary me-1"></i> ${branch.name}</div>
                        <div class="small text-muted mt-1"><i class="fas fa-clock me-1 text-primary"></i> Booked: ${new Date(ticket.timeCreated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                    
                    <div class="mt-4 pt-3 border-top border-secondary border-opacity-10">
                        ${positionInfo}
                        <div class="d-flex gap-2 mt-4">
                            <button class="glass-btn glass-btn-primary py-2 px-3 flex-grow-1 small" onclick="viewTicketConfirmation('${ticket.id}')">
                                <i class="fas fa-qrcode"></i> View Code
                            </button>
                            <button class="glass-btn border-danger text-danger py-2 px-3 small" onclick="cancelTicket('${ticket.id}')">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderHistoryTickets(user, db) {
    const tbody = document.getElementById('historyTicketsTableBody');
    if (!tbody) return;

    const history = db.tickets.filter(t => 
        t.customerName.toLowerCase() === user.name.toLowerCase() && 
        (t.status === 'Completed' || t.status === 'Cancelled' || t.status === 'No Show')
    ).sort((a,b) => new Date(b.timeCreated) - new Date(a.timeCreated));

    if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-muted text-center py-4">No historical records available.</td></tr>`;
        return;
    }

    tbody.innerHTML = history.map(ticket => {
        const branch = db.branches.find(b => b.id === ticket.branchId);
        const service = db.services.find(s => s.id === ticket.serviceId);
        
        let statusBadge = "";
        if (ticket.status === 'Completed') statusBadge = `<span class="status-badge status-badge-completed">Completed</span>`;
        if (ticket.status === 'Cancelled') statusBadge = `<span class="status-badge status-badge-noshow">Cancelled</span>`;
        if (ticket.status === 'No Show') statusBadge = `<span class="status-badge status-badge-noshow">No Show</span>`;

        let pBadge = "";
        const pGroup = ticket.priorityGroup || 'Regular';
        if (pGroup !== 'Regular') {
            let pColor = "#94a3b8";
            if (pGroup === 'Emergency') pColor = "#ef4444";
            else if (pGroup === 'Disabled') pColor = "#f59e0b";
            else if (pGroup === 'Elderly') pColor = "#06b6d4";
            else if (pGroup === 'VIP') pColor = "#8b5cf6";
            pBadge = `<br><span style="font-size: 0.7rem; color: ${pColor}; font-weight: bold;">[${pGroup}]</span>`;
        }

        return `
            <tr>
                <td class="fw-bold">${ticket.number}${pBadge}</td>
                <td>${branch ? branch.name : 'Unknown Branch'}</td>
                <td>${service ? service.name : 'Service'}</td>
                <td>${new Date(ticket.timeCreated).toLocaleDateString()} ${new Date(ticket.timeCreated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="glass-btn py-1 px-2 small" onclick="viewTicketConfirmation('${ticket.id}')">
                        <i class="fas fa-eye text-primary"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function submitTicketBooking(user) {
    const db = window.qms.getDB();
    const branchId = document.getElementById('bookBranch').value;
    const serviceId = document.getElementById('bookService').value;
    const priorityGroup = document.getElementById('bookPriority') ? document.getElementById('bookPriority').value : 'Regular';

    const service = db.services.find(s => s.id === serviceId);

    // Calculate next token number for this service category
    const sameServiceTickets = db.tickets.filter(t => t.serviceId === serviceId);
    let nextNum = 101;
    if (sameServiceTickets.length > 0) {
        // extract numbers from service letter (e.g. A-102 -> 102)
        const nums = sameServiceTickets.map(t => {
            const parts = t.number.split('-');
            return parts.length > 1 ? parseInt(parts[1]) : 100;
        });
        nextNum = Math.max(...nums) + 1;
    }

    const tokenNumber = `${service.code}-${nextNum}`;
    const newTicket = {
        id: `tk-${Date.now()}`,
        number: tokenNumber,
        branchId: branchId,
        serviceId: serviceId,
        customerName: user.name,
        phone: user.phone || '+1 555-0100',
        status: 'Waiting',
        priorityGroup: priorityGroup,
        timeCreated: new Date().toISOString()
    };

    db.tickets.push(newTicket);
    window.qms.saveDB(db);

    const logMsg = `Customer ${user.name} booked ticket ${tokenNumber} for ${service.name}${priorityGroup !== 'Regular' ? ' (' + priorityGroup + ' Priority)' : ''}.`;
    window.qms.addLog(logMsg, user.email, branchId, 'INFO');

    window.qms.showToast('Ticket Generated', `Token ${tokenNumber} has been successfully added to the line.`, 'success');
    
    // Switch to active tab
    const activeTab = document.getElementById('active-tickets-tab');
    if (activeTab) activeTab.click();

    // Reset Booking Forms
    document.getElementById('bookingForm').reset();

    // Trigger Popup
    viewTicketConfirmation(newTicket.id);
}

// Global functions linked to onclick buttons
window.cancelTicket = function(ticketId) {
    if (confirm('Are you sure you want to cancel this ticket?')) {
        let db = window.qms.getDB();
        const ticket = db.tickets.find(t => t.id === ticketId);
        if (ticket) {
            ticket.status = 'Cancelled';
            window.qms.saveDB(db);
            window.qms.showToast('Ticket Cancelled', `Token ${ticket.number} was marked cancelled.`, 'warning');
        }
    }
};

window.viewTicketConfirmation = function(ticketId) {
    const db = window.qms.getDB();
    const ticket = db.tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const branch = db.branches.find(b => b.id === ticket.branchId);
    const service = db.services.find(s => s.id === ticket.serviceId);

    // Populate Modal
    document.getElementById('ticketBranchName').innerText = branch.name;
    document.getElementById('ticketTokenNumber').innerText = ticket.number;
    document.getElementById('ticketServiceName').innerText = service.name;
    document.getElementById('ticketDate').innerText = new Date(ticket.timeCreated).toLocaleDateString();
    document.getElementById('ticketCustomer').innerText = ticket.customerName;

    const priorityBadge = document.getElementById('ticketPriorityBadge');
    if (priorityBadge) {
        const pGroup = ticket.priorityGroup || 'Regular';
        if (pGroup !== 'Regular') {
            priorityBadge.innerText = pGroup + " Priority";
            priorityBadge.classList.remove('d-none');
            
            let pColor = "#94a3b8";
            if (pGroup === 'Emergency') pColor = "#ef4444";
            else if (pGroup === 'Disabled') pColor = "#f59e0b";
            else if (pGroup === 'Elderly') pColor = "#06b6d4";
            else if (pGroup === 'VIP') pColor = "#8b5cf6";
            
            priorityBadge.style.color = pColor;
            priorityBadge.style.borderColor = pColor + "50";
        } else {
            priorityBadge.classList.add('d-none');
        }
    }

    // Render QR Code
    const qrContainer = document.getElementById('qrcodeCanvas');
    qrContainer.innerHTML = ''; // Clear previous
    new QRCode(qrContainer, {
        text: JSON.stringify({
            ticketId: ticket.id,
            number: ticket.number,
            branch: branch.name,
            service: service.name
        }),
        width: 128,
        height: 128,
        colorDark : "#0f172a",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    // Handle PDF Download
    const btnDownloadPDF = document.getElementById('btnDownloadPDF');
    btnDownloadPDF.onclick = () => {
        const element = document.getElementById('ticketPDFWrapper');
        const opt = {
            margin:       10,
            filename:     `qms_ticket_${ticket.number}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
        window.qms.showToast('PDF Exported', 'Ticket PDF download triggered.', 'success');
    };

    // Trigger BS Modal Show
    const confirmModalEl = document.getElementById('confirmationModal');
    const bsModal = new bootstrap.Modal(confirmModalEl);
    bsModal.show();
};
