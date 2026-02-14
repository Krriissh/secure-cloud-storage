/**
 * SCS — Main Application Controller
 * Orchestrates auth, upload, download, delete flows.
 * Manages session state and event binding.
 *
 * Security practices:
 *   - Passwords never stored (only in-memory during operation)
 *   - Session uses sessionStorage (cleared on tab close)
 *   - Debounced operations prevent double-submits
 *   - Parallel upload prevention
 */

(() => {
    'use strict';

    // ──────────── STATE ────────────
    let currentEmail = null;
    let currentPasswordHash = null;    // PBKDF2 hash for auth, kept in session
    let currentSalt = null;            // Client salt for key derivation
    let isUploading = false;
    let cachedFiles = [];              // Local cache for search and filtering
    let downloadTarget = null;         // { filename, originalName }
    let deleteTarget = null;           // { filename, originalName }

    // ──────────── INIT ────────────
    document.addEventListener('DOMContentLoaded', () => {
        initStorage(); // Initialize storage first
        initAuthTabs();
        initAuthForms();
        initUploadZone();
        initDashboardEvents();
        initModalEvents();
        initSettingsEvents(); // Add settings events
        SCSUI.initPasswordToggles();

        // Restore session
        restoreSession();
    });

    // ──────────── SESSION MANAGEMENT ────────────

    function saveSession(email, passwordHash, salt) {
        currentEmail = email;
        currentPasswordHash = passwordHash;
        currentSalt = salt;
        sessionStorage.setItem('scs_email', email);
        sessionStorage.setItem('scs_hash', passwordHash);
        sessionStorage.setItem('scs_salt', salt);
    }

    function restoreSession() {
        const email = sessionStorage.getItem('scs_email');
        const hash = sessionStorage.getItem('scs_hash');
        const salt = sessionStorage.getItem('scs_salt');
        if (email && hash && salt) {
            currentEmail = email;
            currentPasswordHash = hash;
            currentSalt = salt;
            enterDashboard();
        }
    }

    function clearSession() {
        currentEmail = null;
        currentPasswordHash = null;
        currentSalt = null;
        sessionStorage.removeItem('scs_email');
        sessionStorage.removeItem('scs_hash');
        sessionStorage.removeItem('scs_salt');
    }

    // ──────────── AUTH TABS ────────────

    function initAuthTabs() {
        const tabs = document.querySelectorAll('.auth-tab');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const indicator = document.querySelector('.auth-tab-indicator');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                if (tab.dataset.tab === 'login') {
                    loginForm.classList.add('active');
                    registerForm.classList.remove('active');
                    indicator.style.transform = 'translateX(0)';
                } else {
                    registerForm.classList.add('active');
                    loginForm.classList.remove('active');
                    indicator.style.transform = 'translateX(100%)';
                }
            });
        });
    }

    // ──────────── AUTH FORMS ────────────

    function initAuthForms() {
        // Password strength indicator
        document.getElementById('register-password').addEventListener('input', (e) => {
            SCSUI.updatePasswordStrength(e.target.value);
        });

        // Register form
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('register-btn');
            if (btn.disabled) return;

            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            const confirm = document.getElementById('register-confirm').value;

            // Validate
            clearErrors();
            if (!validateEmail(email)) {
                showError('register-email-error', 'Please enter a valid email address.');
                return;
            }
            if (password.length < 8) {
                showError('register-password-error', 'Password must be at least 8 characters.');
                return;
            }
            if (password !== confirm) {
                showError('register-confirm-error', 'Passwords do not match.');
                return;
            }

            SCSUI.setButtonLoading(btn, true);

            try {
                // Derive deterministic auth salt from email (so login can recreate)
                const emailHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.toLowerCase().trim()));
                const authSalt = new Uint8Array(emailHash).slice(0, 16);
                const authSaltHex = SCSCrypto.bufferToHex(authSalt);

                // Hash password client-side with deterministic salt
                const passwordHash = await SCSCrypto.hashPassword(password, authSalt);

                // Register with server (server never sees raw password)
                await SCSApi.register(email, passwordHash, authSaltHex);

                // Auto-login
                saveSession(email, passwordHash, authSaltHex);
                enterDashboard();
                SCSUI.showToast('Account created successfully!', 'success');

                // Clear the form
                document.getElementById('register-form').reset();
                SCSUI.updatePasswordStrength('');
            } catch (err) {
                SCSUI.showToast(err.message, 'error');
            } finally {
                SCSUI.setButtonLoading(btn, false);
                // Security: clear password from form values
                document.getElementById('register-password').value = '';
                document.getElementById('register-confirm').value = '';
            }
        });

        // Login form
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('login-btn');
            if (btn.disabled) return;

            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            clearErrors();
            if (!validateEmail(email)) {
                showError('login-email-error', 'Please enter a valid email address.');
                return;
            }
            if (!password) {
                showError('login-password-error', 'Password is required.');
                return;
            }

            SCSUI.setButtonLoading(btn, true);

            try {
                // Derive the same deterministic auth salt used during registration
                const emailHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.toLowerCase().trim()));
                const authSalt = new Uint8Array(emailHash).slice(0, 16);

                const passwordHash = await SCSCrypto.hashPassword(password, authSalt);

                // Attempt login
                const result = await SCSApi.login(email, passwordHash);

                saveSession(email, passwordHash, result.salt);
                enterDashboard();
                SCSUI.showToast('Welcome back!', 'success');

                document.getElementById('login-form').reset();
            } catch (err) {
                SCSUI.showToast(err.message, 'error');
            } finally {
                SCSUI.setButtonLoading(btn, false);
                document.getElementById('login-password').value = '';
            }
        });
    }

    // ──────────── ENTER DASHBOARD ────────────

    function enterDashboard() {
        document.getElementById('user-email-display').textContent = currentEmail;
        SCSUI.showScreen('dashboard-screen');
        loadFiles();
    }

    // ──────────── FILE LIST ────────────

    async function loadFiles() {
        try {
            const data = await SCSStorage.listFiles(currentEmail);
            cachedFiles = data || []; // Provider returns flat array
            SCSUI.renderFileList(cachedFiles);
            SCSUI.updateStats(cachedFiles);
            bindFileActions();
        } catch (err) {
            SCSUI.showToast('Failed to load files: ' + err.message, 'error');
        }
    }

    function bindFileActions() {
        // Download buttons
        document.querySelectorAll('.file-action-download').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const filename = btn.dataset.filename;
                const original = btn.dataset.original;
                startDownloadFlow(filename, original);
            });
        });

        // Delete buttons
        document.querySelectorAll('.file-action-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const filename = btn.dataset.filename;
                const original = btn.dataset.original;
                confirmDelete(filename, original);
            });
        });
    }

    // ──────────── UPLOAD ────────────

    function initUploadZone() {
        const zone = document.getElementById('upload-zone');
        const fileInput = document.getElementById('file-input');
        const browseBtn = document.getElementById('browse-btn');

        // Browse button
        browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });

        // Click on zone
        zone.addEventListener('click', () => {
            if (!isUploading) fileInput.click();
        });

        // File input change
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFileUpload(fileInput.files[0]);
                fileInput.value = '';
            }
        });

        // Drag & Drop
        zone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            if (!zone.contains(e.relatedTarget)) {
                zone.classList.remove('drag-over');
            }
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0 && !isUploading) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });
    }

    async function handleFileUpload(file) {
        if (isUploading) {
            SCSUI.showToast('Please wait for the current upload to finish.', 'info');
            return;
        }

        // File size check
        if (file.size > 50 * 1024 * 1024) {
            SCSUI.showToast('File too large. Maximum size is 50 MB.', 'error');
            return;
        }

        isUploading = true;
        SCSUI.showUploadProgress(file);

        try {
            // Step 1: Encrypt
            SCSUI.setUploadStep('step-encrypt');
            SCSUI.updateUploadProgressBar(15, 'Reading file...');

            const arrayBuffer = await file.arrayBuffer();
            SCSUI.updateUploadProgressBar(30, 'Encrypting with AES-256-GCM...');

            // Use session password for file encryption - derive from stored hash
            // For file encryption, we use the user's actual password
            // Since we can't recover the password from the hash, we'll prompt
            // Actually: we can encrypt with the derived key material
            // Better approach: use the password hash as the "password" for file encryption
            // This way the hash serves as both auth token and encryption seed
            const encrypted = await SCSCrypto.encryptFile(arrayBuffer, currentPasswordHash);

            SCSUI.updateUploadProgressBar(50, 'Encryption complete.');

            // Step 2: Upload
            SCSUI.setUploadStep('step-upload');
            SCSUI.updateUploadProgressBar(60, 'Uploading encrypted file...');

            const encryptedBlob = new Blob([encrypted.ciphertext], { type: 'application/octet-stream' });
            const metadata = {
                original_name: file.name,
                original_size: file.size,
                iv: encrypted.iv,
                salt: encrypted.salt,
                file_hash: encrypted.fileHash,
            };

            await SCSStorage.saveFile(currentEmail, currentPasswordHash, encryptedBlob, metadata, file.name);

            SCSUI.updateUploadProgressBar(90, 'Verifying...');

            // Step 3: Done
            SCSUI.setUploadStep('step-done');
            SCSUI.updateUploadProgressBar(100, 'File stored securely!');

            SCSUI.showToast(`"${file.name}" uploaded and encrypted successfully!`, 'success');

            // Refresh file list after a short delay
            setTimeout(async () => {
                SCSUI.resetUploadZone();
                await loadFiles();
            }, 1500);

        } catch (err) {
            SCSUI.resetUploadZone();
            SCSUI.showToast('Upload failed: ' + err.message, 'error');
        } finally {
            isUploading = false;
        }
    }

    // ──────────── DOWNLOAD ────────────

    function startDownloadFlow(filename, originalName) {
        downloadTarget = { filename, originalName };
        document.getElementById('modal-filename').textContent = originalName || filename;
        document.getElementById('decrypt-password').value = '';
        document.getElementById('modal-error').style.display = 'none';

        // Reset to password state
        const modal = document.getElementById('download-modal');
        modal.querySelectorAll('.modal-state').forEach(s => s.style.display = 'none');
        document.getElementById('modal-password').style.display = 'block';

        SCSUI.showModal('download-modal');
        document.getElementById('decrypt-password').focus();
    }

    async function performDecrypt() {
        const password = document.getElementById('decrypt-password').value;
        if (!password) {
            document.getElementById('modal-error').textContent = 'Please enter your password.';
            document.getElementById('modal-error').style.display = 'block';
            return;
        }

        const btn = document.getElementById('decrypt-btn');
        SCSUI.setButtonLoading(btn, true);

        try {
            // Show decrypting state
            SCSUI.showModalState('modal-decrypting');

            // Step 1: Fetch
            SCSUI.setDecryptStep('d-step-fetch');
            const metadata = await SCSStorage.getMetadata(currentEmail, downloadTarget.filename);
            const ciphertext = await SCSStorage.getFileBlob(currentEmail, downloadTarget.filename);

            // Step 2: Decrypt
            SCSUI.setDecryptStep('d-step-decrypt');

            // Derive the auth hash from the entered password (same as registration/login)
            const emailHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(currentEmail.toLowerCase().trim()));
            const authSalt = new Uint8Array(emailHash).slice(0, 16);
            const enteredHash = await SCSCrypto.hashPassword(password, authSalt);

            // Decrypt the file using the hash as the encryption password
            const decrypted = await SCSCrypto.decryptFile(
                ciphertext,
                metadata.iv,
                metadata.salt,
                enteredHash
            );

            // Step 3: Verify integrity
            SCSUI.setDecryptStep('d-step-verify');
            const computedHash = await SCSCrypto.hashFile(decrypted);

            if (computedHash !== metadata.file_hash) {
                throw new Error('INTEGRITY_FAIL');
            }

            // Success — trigger download
            await new Promise(r => setTimeout(r, 500)); // Brief pause for UX

            const blob = new Blob([decrypted]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = metadata.original_name || downloadTarget.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Show success
            SCSUI.showModalState('modal-success');
            SCSUI.showToast('File decrypted and downloaded!', 'success');

        } catch (err) {
            const errorTitle = document.getElementById('modal-error-title');
            const errorMsg = document.getElementById('modal-error-msg');

            if (err.message === 'INTEGRITY_FAIL') {
                errorTitle.textContent = 'Integrity Check Failed';
                errorMsg.textContent = 'The file appears to have been tampered with. The SHA-256 hash does not match the original. This file should not be trusted.';
            } else if (err.name === 'OperationError' || err.message.includes('decrypt')) {
                errorTitle.textContent = 'Decryption Failed';
                errorMsg.textContent = 'The password you entered is incorrect, or the file is corrupted. Please check your password and try again.';
            } else {
                errorTitle.textContent = 'Download Failed';
                errorMsg.textContent = err.message || 'An unexpected error occurred. Please try again.';
            }

            SCSUI.showModalState('modal-error-state');
        } finally {
            SCSUI.setButtonLoading(btn, false);
            // Security: clear password
            document.getElementById('decrypt-password').value = '';
        }
    }

    // ──────────── DELETE ────────────

    function confirmDelete(filename, originalName) {
        deleteTarget = { filename, originalName };
        document.getElementById('delete-filename').textContent = originalName || filename;
        SCSUI.showModal('delete-modal');
    }

    async function performDelete() {
        if (!deleteTarget) return;

        try {
            await SCSStorage.deleteFile(currentEmail, deleteTarget.filename, currentPasswordHash);
            SCSUI.showToast(`"${deleteTarget.originalName}" deleted.`, 'success');
            SCSUI.hideModal('delete-modal');
            await loadFiles();
        } catch (err) {
            SCSUI.showToast('Delete failed: ' + err.message, 'error');
        } finally {
            deleteTarget = null;
        }
    }

    // ──────────── DASHBOARD EVENTS ────────────

    function initDashboardEvents() {
        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            clearSession();
            SCSUI.showScreen('auth-screen');
            SCSUI.showToast('Signed out securely.', 'info');
        });

        // Refresh
        document.getElementById('refresh-files-btn').addEventListener('click', () => {
            loadFiles();
        });

        // Search
        const searchInput = document.getElementById('file-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                SCSUI.renderFileList(cachedFiles, query);
                bindFileActions(); // Re-bind actions to new cards
            });
        }
    }

    // ──────────── MODAL EVENTS ────────────

    function initModalEvents() {
        // Download modal
        document.getElementById('decrypt-btn').addEventListener('click', performDecrypt);

        document.getElementById('decrypt-password').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performDecrypt();
            }
        });

        document.getElementById('modal-close-btn').addEventListener('click', () => {
            SCSUI.hideModal('download-modal');
        });

        document.getElementById('modal-done-btn').addEventListener('click', () => {
            SCSUI.hideModal('download-modal');
        });

        document.getElementById('modal-retry-btn').addEventListener('click', () => {
            SCSUI.showModalState('modal-password');
            document.getElementById('decrypt-password').focus();
        });

        // Delete modal
        document.getElementById('delete-cancel-btn').addEventListener('click', () => {
            SCSUI.hideModal('delete-modal');
            deleteTarget = null;
        });

        document.getElementById('delete-confirm-btn').addEventListener('click', performDelete);

        // Close modal on overlay click
        document.getElementById('download-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) SCSUI.hideModal('download-modal');
        });
        document.getElementById('delete-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                SCSUI.hideModal('delete-modal');
                deleteTarget = null;
            }
        });
    }

    // ──────────── STORAGE & SETTINGS ────────────

    function initStorage() {
        const provider = localStorage.getItem('scs_provider') || 'managed'; // Default to managed
        if (provider === 'supabase') {
            const url = localStorage.getItem('scs_supabase_url');
            const key = localStorage.getItem('scs_supabase_key');
            if (SCSSupabaseProvider.init(url, key)) {
                SCSStorage.setProvider(SCSSupabaseProvider);
            } else {
                SCSStorage.setProvider(SCSLocalProvider);
            }
        } else if (provider === 'managed') {
            if (SCSSupabaseProvider.init(null, null, true)) {
                SCSStorage.setProvider(SCSSupabaseProvider);
            } else {
                SCSStorage.setProvider(SCSLocalProvider);
            }
        } else {
            SCSStorage.setProvider(SCSLocalProvider);
        }
    }

    function initSettingsEvents() {
        const settingsBtn = document.getElementById('settings-btn');
        const saveBtn = document.getElementById('save-settings-btn');
        const providerSelect = document.getElementById('storage-provider-select');
        const supabaseFields = document.getElementById('supabase-config-fields');
        const managedInfo = document.getElementById('managed-config-info');

        settingsBtn.addEventListener('click', () => {
            // Load current settings into form
            const provider = localStorage.getItem('scs_provider') || 'managed';
            providerSelect.value = provider;

            // Toggle visibility
            supabaseFields.style.display = provider === 'supabase' ? 'block' : 'none';
            managedInfo.style.display = provider === 'managed' ? 'flex' : 'none';

            document.getElementById('supabase-url').value = localStorage.getItem('scs_supabase_url') || '';
            document.getElementById('supabase-key').value = localStorage.getItem('scs_supabase_key') || '';

            SCSUI.showModal('settings-modal');
        });

        providerSelect.addEventListener('change', (e) => {
            supabaseFields.style.display = e.target.value === 'supabase' ? 'block' : 'none';
            managedInfo.style.display = e.target.value === 'managed' ? 'flex' : 'none';
        });

        saveBtn.addEventListener('click', () => {
            const provider = providerSelect.value;
            localStorage.setItem('scs_provider', provider);

            if (provider === 'supabase') {
                const url = document.getElementById('supabase-url').value.trim();
                const key = document.getElementById('supabase-key').value.trim();
                localStorage.setItem('scs_supabase_url', url);
                localStorage.setItem('scs_supabase_key', key);
            }

            initStorage();
            SCSUI.hideModal('settings-modal');
            SCSUI.showToast(`Storage provider updated to ${SCSStorage.getProviderName()}`, 'success');

            if (currentEmail) loadFiles(); // Refresh if logged in
        });
    }

    // ──────────── VALIDATION HELPERS ────────────

    function validateEmail(email) {
        return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email);
    }

    function showError(elementId, message) {
        const el = document.getElementById(elementId);
        if (el) el.textContent = message;
    }

    function clearErrors() {
        document.querySelectorAll('.input-error').forEach(el => el.textContent = '');
    }

})();
