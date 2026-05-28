/**
 * QMS Authentication Handlers
 * Handles form validation, credential checks, registration hooks, and interactive forgotten-password screens.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Determine which auth page is loaded
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        initLoginHandlers();
    }
    if (registerForm) {
        initRegisterHandlers();
    }
});

/* --- LOGIN CONTROLLER --- */
function initLoginHandlers() {
    const loginForm = document.getElementById('loginForm');
    const forgotForm = document.getElementById('forgotForm');
    const btnShowForgot = document.getElementById('btnShowForgot');
    const btnBackToLogin = document.getElementById('btnBackToLogin');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    const authFooter = document.getElementById('authFooter');

    // Toggle forgot password section
    btnShowForgot.addEventListener('click', (e) => {
        e.preventDefault();
        
        loginForm.classList.add('d-none');
        forgotForm.classList.remove('d-none');
        authFooter.classList.add('d-none');
        
        authTitle.innerText = "Reset Password";
        authSubtitle.innerText = "Enter your email to receive recovery instructions";
    });

    btnBackToLogin.addEventListener('click', () => {
        forgotForm.classList.add('d-none');
        loginForm.classList.remove('d-none');
        authFooter.classList.remove('d-none');
        
        authTitle.innerText = "Welcome Back";
        authSubtitle.innerText = "Sign in to book queue tokens or manage your counters";
    });

    // Form submission validation
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const role = document.querySelector('input[name="role"]:checked').value;
        
        let isValid = true;

        // Simple Email check
        if (!emailInput.value.includes('@') || emailInput.value.trim() === '') {
            emailInput.classList.add('is-invalid');
            isValid = false;
        } else {
            emailInput.classList.remove('is-invalid');
            emailInput.classList.add('is-valid');
        }

        // Password check
        if (passwordInput.value.length < 4) {
            passwordInput.classList.add('is-invalid');
            isValid = false;
        } else {
            passwordInput.classList.remove('is-invalid');
            passwordInput.classList.add('is-valid');
        }

        if (!isValid) {
            window.qms.showToast('Validation Error', 'Please check the credentials entered.', 'danger');
            return;
        }

        // Authenticate using Mock DB
        const db = window.qms.getDB();
        const user = db.users.find(u => u.email.toLowerCase() === emailInput.value.toLowerCase().trim() && u.password === passwordInput.value);

        if (user) {
            // Verify roles align for demonstration (admin.html vs dashboard.html)
            if (role === 'admin') {
                const staffRoles = ['admin', 'regional-manager', 'branch-manager', 'officer'];
                if (!staffRoles.includes(user.role)) {
                    window.qms.showToast('Role Mismatch', `Access denied: user accounts do not have staff/admin permissions.`, 'warning');
                    return;
                }
            } else {
                if (user.role !== 'customer') {
                    window.qms.showToast('Role Mismatch', `Access denied: this section is for customer self-service.`, 'warning');
                    return;
                }
            }

            // Set session details
            localStorage.setItem('qms_logged_in_user', JSON.stringify(user));
            
            // Auto clock-in on successful login for staff
            if (user.role !== 'customer') {
                window.qms.logAttendance(user.email, 'Logged in via portal', 'Active');
                window.qms.addLog(`Staff member logged in: ${user.name} (${user.role.toUpperCase()}) clock-in success.`, user.email, user.assignedBranchId || 'all', 'SUCCESS');
            }

            window.qms.showToast('Authentication Successful', `Welcome, ${user.name}! Redirecting...`, 'success');
            
            setTimeout(() => {
                if (user.role === 'officer') {
                    window.location.href = 'counter.html';
                } else if (user.role === 'admin' || user.role === 'regional-manager' || user.role === 'branch-manager') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            }, 1200);
        } else {
            window.qms.showToast('Auth Failure', 'Incorrect email address or password.', 'danger');
            passwordInput.classList.add('is-invalid');
        }
    });

    // Reset password form trigger
    forgotForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const forgotEmail = document.getElementById('forgotEmail');
        
        if (!forgotEmail.value.includes('@') || forgotEmail.value.trim() === '') {
            forgotEmail.classList.add('is-invalid');
            return;
        }
        forgotEmail.classList.remove('is-invalid');
        forgotEmail.classList.add('is-valid');

        window.qms.showToast('Reset Transmitted', `Instructions sent to ${forgotEmail.value.trim()}`, 'success');
        
        setTimeout(() => {
            btnBackToLogin.click();
            forgotEmail.value = '';
            forgotEmail.classList.remove('is-valid');
        }, 2000);
    });
}

/* --- REGISTRATION CONTROLLER --- */
function initRegisterHandlers() {
    const registerForm = document.getElementById('registerForm');
    const nameInput = document.getElementById('regName');
    const emailInput = document.getElementById('regEmail');
    const phoneInput = document.getElementById('regPhone');
    const passwordInput = document.getElementById('regPassword');
    const agreeTerms = document.getElementById('agreeTerms');
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');

    // Live Password Strength calculations
    passwordInput.addEventListener('input', () => {
        const val = passwordInput.value;
        let score = 0;
        
        if (val.length >= 6) score += 1;
        if (val.length >= 10) score += 1;
        if (/[A-Z]/.test(val)) score += 1;
        if (/[0-9]/.test(val)) score += 1;
        if (/[^A-Za-z0-9]/.test(val)) score += 1;

        let width = '0%';
        let color = '#ef4444';
        let label = 'Weak';

        if (val.length === 0) {
            label = 'Empty';
        } else if (score <= 2) {
            width = '33%';
            color = '#ef4444';
            label = 'Weak';
        } else if (score <= 4) {
            width = '66%';
            color = '#f59e0b';
            label = 'Medium';
        } else {
            width = '100%';
            color = '#10b981';
            label = 'Strong';
        }

        strengthBar.style.width = width;
        strengthBar.style.backgroundColor = color;
        strengthText.innerText = `Password Strength: ${label}`;
        strengthText.style.color = color;
    });

    // Form validator
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let isValid = true;

        // Name Validation
        if (nameInput.value.trim().length < 2) {
            nameInput.classList.add('is-invalid');
            isValid = false;
        } else {
            nameInput.classList.remove('is-invalid');
            nameInput.classList.add('is-valid');
        }

        // Email Validation
        if (!emailInput.value.includes('@') || emailInput.value.trim() === '') {
            emailInput.classList.add('is-invalid');
            isValid = false;
        } else {
            emailInput.classList.remove('is-invalid');
            emailInput.classList.add('is-valid');
        }

        // Phone Validation (simple digit & sign check)
        const phoneRegex = /^[\d\s+\-()]{7,15}$/;
        if (!phoneRegex.test(phoneInput.value.trim())) {
            phoneInput.classList.add('is-invalid');
            isValid = false;
        } else {
            phoneInput.classList.remove('is-invalid');
            phoneInput.classList.add('is-valid');
        }

        // Password Minimum
        if (passwordInput.value.length < 6) {
            passwordInput.classList.add('is-invalid');
            isValid = false;
        } else {
            passwordInput.classList.remove('is-invalid');
            passwordInput.classList.add('is-valid');
        }

        // Terms checked
        if (!agreeTerms.checked) {
            agreeTerms.classList.add('is-invalid');
            isValid = false;
        } else {
            agreeTerms.classList.remove('is-invalid');
            agreeTerms.classList.add('is-valid');
        }

        if (!isValid) {
            window.qms.showToast('Validation Error', 'Please complete the form requirements.', 'danger');
            return;
        }

        // Save User in Mock DB
        let db = window.qms.getDB();
        const userExists = db.users.some(u => u.email.toLowerCase() === emailInput.value.toLowerCase().trim());
        
        if (userExists) {
            window.qms.showToast('Registration Error', 'An account with this email already exists.', 'warning');
            emailInput.classList.add('is-invalid');
            return;
        }

        const newUser = {
            email: emailInput.value.toLowerCase().trim(),
            name: nameInput.value.trim(),
            password: passwordInput.value,
            role: 'customer' // All self-service registrations default to customers
        };

        db.users.push(newUser);
        window.qms.saveDB(db);

        window.qms.showToast('Success!', 'Your account has been created. Redirecting to login...', 'success');

        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    });
}
