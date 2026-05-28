/**
 * QMS Frontend Core Orchestrator
 * Coordinates global themes, toasts, mock data state, and Socket.io hookups.
 */

class QMSApp {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'dark';
        this.dbKey = 'qms_local_db';
        this.socket = null;
        this.db = null;
        this.priorityLevels = {
            'Emergency': 1,
            'Disabled': 2,
            'Elderly': 3,
            'VIP': 4,
            'Regular': 5
        };
    }

    sortTickets(tickets) {
        return [...tickets].sort((a, b) => {
            const p1 = this.priorityLevels[a.priorityGroup || 'Regular'] || 5;
            const p2 = this.priorityLevels[b.priorityGroup || 'Regular'] || 5;
            if (p1 !== p2) {
                return p1 - p2;
            }
            return new Date(a.timeCreated) - new Date(b.timeCreated);
        });
    }

    init() {
        // Apply initial theme
        this.applyTheme();
        
        // Seed database if empty
        this.initDatabase();

        // Bind theme button
        document.addEventListener('DOMContentLoaded', () => {
            this.bindThemeToggles();
            this.setupSocketConnection();
            
            // Global wheel events for horizontal scrolling elements
            document.body.addEventListener('wheel', (evt) => {
                const hzContainer = evt.target.closest('.horizontal-scroll-container');
                if (hzContainer && evt.deltaY !== 0) {
                    evt.preventDefault();
                    hzContainer.scrollLeft += evt.deltaY;
                }
            }, { passive: false });
        });
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
        
        // Update any icon toggles if present
        const icons = document.querySelectorAll('.theme-switch-btn i');
        icons.forEach(icon => {
            if (this.theme === 'light') {
                icon.className = 'fas fa-moon';
            } else {
                icon.className = 'fas fa-sun';
            }
        });
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
        this.showToast('Theme Changed', `Switched to ${this.theme} mode.`, 'info');
    }

    bindThemeToggles() {
        const toggleBtns = document.querySelectorAll('.theme-switch-btn');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => this.toggleTheme());
        });
    }

    /* --- TOAST SYSTEM --- */
    showToast(title, message, type = 'info') {
        let container = document.querySelector('.toast-container-custom');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container-custom';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'toast-custom';
        
        let iconClass = 'fas fa-info-circle text-info';
        if (type === 'success') iconClass = 'fas fa-check-circle text-success';
        if (type === 'warning') iconClass = 'fas fa-exclamation-triangle text-warning';
        if (type === 'danger') iconClass = 'fas fa-exclamation-circle text-danger';

        toast.innerHTML = `
            <div class="toast-icon">
                <i class="${iconClass}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close"><i class="fas fa-times"></i></button>
        `;

        container.appendChild(toast);

        // Bind close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.dismissToast(toast);
        });

        // Auto dismiss
        setTimeout(() => {
            this.dismissToast(toast);
        }, 5000);
    }

    dismissToast(toast) {
        toast.classList.add('hide');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }

    /* --- DATABASE & SEED DATA --- */
    initDatabase() {
        let rawData = localStorage.getItem(this.dbKey);
        let forceReSeed = false;
        
        if (rawData) {
            try {
                const parsed = JSON.parse(rawData);
                // Force a reset if the database contains the old structure (e.g. misses shifts or activity logs)
                if (!parsed.activityLogs || !parsed.shifts || (parsed.branches && parsed.branches.some(b => !b.region))) {
                    forceReSeed = true;
                }
            } catch (e) {
                forceReSeed = true;
            }
        }

        if (!rawData || forceReSeed) {
            const seedData = {
                branches: [
                    { id: 'br-1', name: 'Vavuniya DS Office', address: 'Kandy Road, Vavuniya', region: 'Northern', active: true },
                    { id: 'br-2', name: 'Jaffna DS Office', address: 'Hospital Road, Jaffna', region: 'Northern', active: true },
                    { id: 'br-3', name: 'Colombo DS Office', address: 'Galle Road, Colombo', region: 'Western', active: true },
                    { id: 'br-4', name: 'Kilinochchi DS Office', address: 'A9 Road, Kilinochchi', region: 'Northern', active: true },
                    { id: 'br-5', name: 'Mullaithivu DS Office', address: 'Beach Road, Mullaithivu', region: 'Northern', active: true },
                    { id: 'br-6', name: 'Nedunkerny DS Office', address: 'Main Street, Nedunkerny', region: 'Northern', active: true },
                    { id: 'br-7', name: 'Trincomalee DS Office', address: 'Dockyard Road, Trincomalee', region: 'Eastern', active: true }
                ],
                services: [
                    { id: 'sv-1', code: 'BC', name: 'Birth Certificate', avgWait: 15, icon: 'fa-baby' },
                    { id: 'sv-2', code: 'MC', name: 'Marriage Certificate', avgWait: 20, icon: 'fa-ring' },
                    { id: 'sv-3', code: 'DC', name: 'Death Certificate', avgWait: 10, icon: 'fa-book-dead' },
                    { id: 'sv-4', code: 'RL', name: 'Revenue License', avgWait: 8, icon: 'fa-file-invoice-dollar' },
                    { id: 'sv-5', code: 'SS', name: 'Samurdhi Services', avgWait: 25, icon: 'fa-hand-holding-heart' },
                    { id: 'sv-6', code: 'LS', name: 'Land Services', avgWait: 30, icon: 'fa-map-marked-alt' },
                    { id: 'sv-7', code: 'NIC', name: 'NIC Services', avgWait: 18, icon: 'fa-id-card' },
                    { id: 'sv-8', code: 'PR', name: 'Permit Requests', avgWait: 12, icon: 'fa-file-signature' },
                    { id: 'sv-9', code: 'GN', name: 'Grama Niladhari Meetings', avgWait: 15, icon: 'fa-comments' }
                ],
                counters: [
                    { id: 'ctr-1', name: 'Counter 1', agent: 'Alice Miller', activeService: 'sv-1', status: 'Active', currentTicket: 'BC-102', branchId: 'br-1' },
                    { id: 'ctr-2', name: 'Counter 2', agent: 'Bob Jenkins', activeService: 'sv-2', status: 'Active', currentTicket: 'MC-205', branchId: 'br-1' },
                    { id: 'ctr-3', name: 'Counter 3', agent: 'Charlie Cooper', activeService: 'sv-3', status: 'Active', currentTicket: 'DC-401', branchId: 'br-1' },
                    { id: 'ctr-4', name: 'Counter 4', agent: 'Diana Prince', activeService: 'sv-4', status: 'Offline', currentTicket: '', branchId: 'br-1' },
                    { id: 'ctr-5', name: 'Counter 1', agent: 'Eva Green', activeService: 'sv-1', status: 'Active', currentTicket: 'BC-501', branchId: 'br-2' },
                    { id: 'ctr-6', name: 'Counter 2', agent: 'Frank Castle', activeService: 'sv-2', status: 'Active', currentTicket: 'MC-602', branchId: 'br-2' }
                ],
                tickets: [
                    // Active Waiting Tickets
                    { id: 'tk-101', number: 'BC-103', branchId: 'br-1', serviceId: 'sv-1', customerName: 'Frank Sinatra', phone: '+94 77 123 4567', status: 'Waiting', priorityGroup: 'Regular', timeCreated: new Date(Date.now() - 1000 * 60 * 18).toISOString() },
                    { id: 'tk-102', number: 'MC-206', branchId: 'br-1', serviceId: 'sv-2', customerName: 'Grace Hopper', phone: '+94 77 234 5678', status: 'Waiting', priorityGroup: 'Elderly', timeCreated: new Date(Date.now() - 1000 * 60 * 10).toISOString() },
                    { id: 'tk-103', number: 'DC-402', branchId: 'br-1', serviceId: 'sv-3', customerName: 'Steve Rogers', phone: '+94 77 345 6789', status: 'Waiting', priorityGroup: 'Regular', timeCreated: new Date(Date.now() - 1000 * 60 * 22).toISOString() },
                    { id: 'tk-104', number: 'RL-313', branchId: 'br-1', serviceId: 'sv-4', customerName: 'Bruce Wayne', phone: '+94 77 456 7890', status: 'Waiting', priorityGroup: 'Disabled', timeCreated: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
                    { id: 'tk-105', number: 'BC-104', branchId: 'br-1', serviceId: 'sv-1', customerName: 'Tony Stark', phone: '+94 77 567 8901', status: 'Waiting', priorityGroup: 'Emergency', timeCreated: new Date(Date.now() - 1000 * 60 * 2).toISOString() },
                    // Active Serving Tickets
                    { id: 'tk-90', number: 'BC-102', branchId: 'br-1', serviceId: 'sv-1', customerName: 'Clara Barton', phone: '+94 77 678 9012', status: 'Serving', counter: 'Counter 1', priorityGroup: 'Regular', timeCreated: new Date(Date.now() - 1000 * 60 * 25).toISOString() },
                    { id: 'tk-91', number: 'MC-205', branchId: 'br-1', serviceId: 'sv-2', customerName: 'Peter Parker', phone: '+94 77 789 0123', status: 'Serving', counter: 'Counter 2', priorityGroup: 'Regular', timeCreated: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
                    { id: 'tk-92', number: 'DC-401', branchId: 'br-1', serviceId: 'sv-3', customerName: 'John Doe', phone: '+94 77 890 1234', status: 'Serving', counter: 'Counter 3', priorityGroup: 'Regular', timeCreated: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
                    // History
                    { id: 'tk-80', number: 'BC-101', branchId: 'br-1', serviceId: 'sv-1', customerName: 'Clark Kent', phone: '+94 77 901 2345', status: 'Completed', counter: 'Counter 1', priorityGroup: 'Regular', timeCreated: new Date(Date.now() - 1000 * 60 * 55).toISOString(), timeCompleted: new Date(Date.now() - 1000 * 60 * 40).toISOString() },
                    { id: 'tk-81', number: 'MC-204', branchId: 'br-1', serviceId: 'sv-2', customerName: 'Barry Allen', phone: '+94 77 012 3456', status: 'Completed', counter: 'Counter 2', priorityGroup: 'Regular', timeCreated: new Date(Date.now() - 1000 * 60 * 30).toISOString(), timeCompleted: new Date(Date.now() - 1000 * 60 * 20).toISOString() }
                ],
                users: [
                    { email: 'admin@qms.com', name: 'Super Administrator', password: 'admin', role: 'admin', assignedBranchId: 'all', attendanceStatus: 'Active' },
                    { email: 'northern@qms.com', name: 'Northern Regional Manager', password: 'password', role: 'regional-manager', assignedBranchId: 'all', assignedRegion: 'Northern', attendanceStatus: 'Active' },
                    { email: 'vavuniya@qms.com', name: 'Vavuniya Branch Manager', password: 'password', role: 'branch-manager', assignedBranchId: 'br-1', attendanceStatus: 'Active' },
                    { email: 'alice@qms.com', name: 'Alice Miller', password: 'password', role: 'officer', assignedBranchId: 'br-1', assignedCounterId: 'ctr-1', attendanceStatus: 'Active' },
                    { email: 'bob@qms.com', name: 'Bob Jenkins', password: 'password', role: 'officer', assignedBranchId: 'br-1', assignedCounterId: 'ctr-2', attendanceStatus: 'Active' },
                    { email: 'charlie@qms.com', name: 'Charlie Cooper', password: 'password', role: 'officer', assignedBranchId: 'br-1', assignedCounterId: 'ctr-3', attendanceStatus: 'On Break' },
                    { email: 'diana@qms.com', name: 'Diana Prince', password: 'password', role: 'officer', assignedBranchId: 'br-1', assignedCounterId: 'ctr-4', attendanceStatus: 'Offline' },
                    { email: 'customer@qms.com', name: 'John Doe', password: 'password', role: 'customer' }
                ],
                shifts: [
                    { id: 'sh-1', name: 'Morning Shift', hours: '08:00 - 13:00', officerId: 'alice@qms.com', branchId: 'br-1', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
                    { id: 'sh-2', name: 'Morning Shift', hours: '08:00 - 13:00', officerId: 'bob@qms.com', branchId: 'br-1', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
                    { id: 'sh-3', name: 'Afternoon Shift', hours: '13:00 - 18:00', officerId: 'charlie@qms.com', branchId: 'br-1', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
                    { id: 'sh-4', name: 'Afternoon Shift', hours: '13:00 - 18:00', officerId: 'diana@qms.com', branchId: 'br-1', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }
                ],
                attendanceLogs: [
                    { id: 'att-1', email: 'alice@qms.com', action: 'Clock In', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), status: 'Active' },
                    { id: 'att-2', email: 'bob@qms.com', action: 'Clock In', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3.5).toISOString(), status: 'Active' },
                    { id: 'att-3', email: 'charlie@qms.com', action: 'Clock In', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), status: 'On Break' }
                ],
                activityLogs: [
                    { id: 'log-1', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), user: 'System', action: 'QMS Database initialization completed.', type: 'INFO', branchId: 'all' },
                    { id: 'log-2', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), user: 'alice@qms.com', action: 'Counter 1 logged in & went online.', type: 'SUCCESS', branchId: 'br-1' },
                    { id: 'log-3', timestamp: new Date(Date.now() - 1000 * 60 * 50).toISOString(), user: 'bob@qms.com', action: 'Counter 2 went online.', type: 'SUCCESS', branchId: 'br-1' },
                    { id: 'log-4', timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), user: 'vavuniya@qms.com', action: 'Branch settings audit ran.', type: 'INFO', branchId: 'br-1' }
                ],
                systemSettings: {
                    emergencyActive: false,
                    holdQueueList: []
                },
                voiceSettings: {
                    enabled: true,
                    rate: 0.95,
                    pitch: 1.0,
                    voiceIndex: 0
                }
            };
            localStorage.setItem(this.dbKey, JSON.stringify(seedData));
            this.db = seedData;
        } else {
            this.db = JSON.parse(rawData);
        }
    }

    addLog(action, user, branchId = 'all', type = 'INFO') {
        let db = this.getDB();
        if (!db.activityLogs) db.activityLogs = [];
        db.activityLogs.unshift({
            id: 'log-' + Date.now() + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            user: user,
            action: action,
            type: type,
            branchId: branchId
        });
        if (db.activityLogs.length > 200) db.activityLogs.pop();
        this.saveDB(db);
    }

    transferTicket(ticketId, targetServiceId, targetBranchId, targetCounterId = '', officerName = 'System') {
        let db = this.getDB();
        const ticket = db.tickets.find(t => t.id === ticketId);
        if (!ticket) return false;

        const oldService = db.services.find(s => s.id === ticket.serviceId);
        const newService = db.services.find(s => s.id === targetServiceId);
        const oldBranch = db.branches.find(b => b.id === ticket.branchId);
        const newBranch = db.branches.find(b => b.id === targetBranchId);

        ticket.serviceId = targetServiceId;
        ticket.branchId = targetBranchId;
        ticket.status = 'Waiting';

        if (newService && oldService && newService.code !== oldService.code) {
            const serviceTickets = db.tickets.filter(t => t.serviceId === targetServiceId && t.branchId === targetBranchId);
            const nextIndex = serviceTickets.length + 101;
            ticket.number = `${newService.code}-${nextIndex}`;
        }

        if (ticket.counter) {
            const counter = db.counters.find(c => c.name === ticket.counter && c.branchId === oldBranch.id);
            if (counter) counter.currentTicket = '';
            ticket.counter = '';
        }

        this.saveDB(db);
        
        const logMsg = `Transferred token ${ticket.number} from ${oldService ? oldService.name : 'Unknown'} (${oldBranch ? oldBranch.name : 'Unknown'}) to ${newService ? newService.name : 'Unknown'} (${newBranch ? newBranch.name : 'Unknown'}).`;
        this.addLog(logMsg, officerName, targetBranchId, 'INFO');
        return true;
    }

    logAttendance(email, action, status) {
        let db = this.getDB();
        if (!db.attendanceLogs) db.attendanceLogs = [];
        db.attendanceLogs.unshift({
            id: 'att-' + Date.now(),
            email: email,
            action: action,
            timestamp: new Date().toISOString(),
            status: status
        });
        
        const user = db.users.find(u => u.email === email);
        if (user) {
            user.attendanceStatus = status;
        }
        this.saveDB(db);
    }

    toggleEmergencyMode(activeState, branchId = 'all', officerName = 'System') {
        let db = this.getDB();
        if (!db.systemSettings) db.systemSettings = { emergencyActive: false, holdQueueList: [] };
        db.systemSettings.emergencyActive = activeState;
        this.saveDB(db);
        
        const logMsg = activeState ? 'GLOBAL EMERGENCY STATE ACTIVATED - ALL QUEUES PAUSED.' : 'GLOBAL EMERGENCY STATE RELEASED - Queues resumed.';
        this.addLog(logMsg, officerName, branchId, activeState ? 'EMERGENCY' : 'SUCCESS');
    }


    getDB() {
        if (!this.db) this.initDatabase();
        return this.db;
    }

    saveDB(updatedData) {
        this.db = updatedData;
        localStorage.setItem(this.dbKey, JSON.stringify(updatedData));
        
        // Dispatch custom event to notify listeners of local state changes
        const event = new CustomEvent('qmsStateUpdated', { detail: this.db });
        window.dispatchEvent(event);
    }

    /* --- REALTIME SOCKET.IO SIMULATOR / HOOKS --- */
    setupSocketConnection() {
        // Attempt to load Socket.io client if library is loaded via script tag
        if (typeof io !== 'undefined') {
            try {
                // Initialize socket connection using standard endpoints
                this.socket = io('http://localhost:3000', {
                    autoConnect: true,
                    reconnectionAttempts: 3
                });

                this.socket.on('connect', () => {
                    console.log('QMS connected to Live WebSocket Server');
                    this.showToast('Live Connected', 'Real-time sync established with server.', 'success');
                });

                this.socket.on('queueUpdate', (data) => {
                    // Update local storage and trigger page updates
                    this.saveDB(data);
                });
                
                this.socket.on('connect_error', () => {
                    console.warn('Real Socket.IO server offline. Operating in simulation mode.');
                    this.runFallbackSimulation();
                });
            } catch (e) {
                console.error('Socket.IO Connection failed. Falling back to local simulation.', e);
                this.runFallbackSimulation();
            }
        } else {
            console.log('Socket.IO library unavailable. Launching client-side simulation.');
            this.runFallbackSimulation();
        }
    }

    runFallbackSimulation() {
        if (window.qmsSimulationInterval) clearInterval(window.qmsSimulationInterval);
        
        window.qmsSimulationInterval = setInterval(() => {
            let db = this.getDB();
            
            // 1. Emergency lockdown check
            if (db.systemSettings && db.systemSettings.emergencyActive) {
                console.log('QMS is in Emergency Lockdown. Queue updates are suspended.');
                return;
            }
            
            // 2. Simulate random customer arrival (25% chance)
            if (Math.random() > 0.75) {
                const randomBranch = db.branches[Math.floor(Math.random() * db.branches.length)];
                const randomService = db.services[Math.floor(Math.random() * db.services.length)];
                const firstNames = ["James", "Emma", "Liam", "Sophia", "Noah", "Olivia", "Sanduni", "Dilshan", "Nimal", "Tharindu", "Kamil", "Fathima"];
                const lastNames = ["Silva", "Perera", "Fernando", "Jayawardena", "Rodrigo", "Rathnayake", "Ahamed", "Rahman"];
                const randomName = firstNames[Math.floor(Math.random() * firstNames.length)] + " " + lastNames[Math.floor(Math.random() * lastNames.length)];
                
                const serviceCodeTickets = db.tickets.filter(t => t.serviceId === randomService.id && t.branchId === randomBranch.id);
                const ticketIndex = serviceCodeTickets.length + 101;
                
                // 15% chance of a priority category
                let pGroup = 'Regular';
                const pRand = Math.random();
                if (pRand > 0.85) {
                    const groups = ['Elderly', 'Disabled', 'Emergency', 'VIP'];
                    pGroup = groups[Math.floor(Math.random() * groups.length)];
                }

                const newTicket = {
                    id: 'tk-' + Date.now(),
                    number: `${randomService.code}-${ticketIndex}`,
                    branchId: randomBranch.id,
                    serviceId: randomService.id,
                    customerName: randomName,
                    phone: '+94 77 ' + Math.floor(1000000 + Math.random() * 9000000),
                    status: 'Waiting',
                    priorityGroup: pGroup,
                    timeCreated: new Date().toISOString()
                };
                
                db.tickets.push(newTicket);
                this.saveDB(db);
                
                const logMsg = `New customer ${randomName} booked token ${newTicket.number} for ${randomService.name}${pGroup !== 'Regular' ? ' (' + pGroup + ' Priority)' : ''}.`;
                this.addLog(logMsg, 'Kiosk Terminal', randomBranch.id, 'INFO');
                this.showToast('New Ticket Issued', `Token ${newTicket.number} booked by ${randomName} at ${randomBranch.name} (${pGroup} Priority)`, 'info');
                return;
            }

            // 3. Simulate counter serving next ticket (40% chance)
            let waitingTickets = this.sortTickets(db.tickets.filter(t => t.status === 'Waiting'));
            if (waitingTickets.length > 0 && Math.random() > 0.6) {
                // Find active, free counter station
                const activeCounters = db.counters.filter(c => c.status === 'Active');
                if (activeCounters.length === 0) return;
                
                const availableCounter = activeCounters[Math.floor(Math.random() * activeCounters.length)];
                const nextTicket = waitingTickets.find(t => t.serviceId === availableCounter.activeService && t.branchId === availableCounter.branchId);
                
                if (!nextTicket) return;

                // Complete current counter ticket first
                if (availableCounter.currentTicket) {
                    const counterPrevTicket = db.tickets.find(t => t.number === availableCounter.currentTicket && t.status === 'Serving');
                    if (counterPrevTicket) {
                        counterPrevTicket.status = 'Completed';
                        counterPrevTicket.timeCompleted = new Date().toISOString();
                    }
                }

                nextTicket.status = 'Serving';
                nextTicket.counter = availableCounter.name;
                availableCounter.currentTicket = nextTicket.number;

                this.saveDB(db);
                
                this.addLog(`Officer ${availableCounter.agent} called token ${nextTicket.number} (${nextTicket.priorityGroup || 'Regular'} Priority) to ${availableCounter.name}.`, availableCounter.agent, availableCounter.branchId, 'SUCCESS');
                this.showToast('Counter Calling', `${availableCounter.name} is now calling ticket ${nextTicket.number}`, 'info');

                this.triggerVocalAnnouncement(nextTicket.number, availableCounter.name);
            }
        }, 35000); // 35 seconds tick
    }


    triggerVocalAnnouncement(ticketNumber, counterName) {
        const db = this.getDB();
        if (db.voiceSettings && db.voiceSettings.enabled) {
            // Wait for window load
            if ('speechSynthesis' in window) {
                const phrase = `Ticket number, ${ticketNumber.split('').join(' ')}, please proceed to ${counterName}`;
                const utterance = new SpeechSynthesisUtterance(phrase);
                
                // Get voices
                const voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) {
                    utterance.voice = voices[db.voiceSettings.voiceIndex || 0] || voices[0];
                }
                utterance.rate = db.voiceSettings.rate || 0.95;
                utterance.pitch = db.voiceSettings.pitch || 1.0;
                
                // Play
                window.speechSynthesis.speak(utterance);
            }
        }
    }
}

// Instantiate and expose globally
const app = new QMSApp();
app.init();
window.qms = app;
