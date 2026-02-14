/**
 * SCS — UI Helper Module
 * DOM manipulation, animations, toast notifications, and UX utilities.
 */

const SCSUI = (() => {
    'use strict';

    // ──────────── TOAST NOTIFICATIONS ────────────

    const TOAST_ICONS = {
        success: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
        error: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
        info: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>',
    };

    function showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ──────────── PASSWORD STRENGTH ────────────

    function getPasswordStrength(password) {
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        if (score <= 1) return { level: 'weak', label: 'Weak' };
        if (score <= 2) return { level: 'fair', label: 'Fair' };
        if (score <= 3) return { level: 'good', label: 'Good' };
        return { level: 'strong', label: 'Strong' };
    }

    function updatePasswordStrength(password) {
        const fill = document.getElementById('strength-fill');
        const label = document.getElementById('strength-label');

        if (!password) {
            fill.className = 'password-strength-fill';
            label.className = 'password-strength-label';
            label.textContent = '';
            return;
        }

        const strength = getPasswordStrength(password);
        fill.className = `password-strength-fill ${strength.level}`;
        label.className = `password-strength-label ${strength.level}`;
        label.textContent = strength.label;
    }

    // ──────────── FILE TYPE ICONS ────────────

    const FILE_TYPE_MAP = {
        // Images
        jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', svg: 'image', webp: 'image', bmp: 'image',
        // Video
        mp4: 'video', avi: 'video', mkv: 'video', mov: 'video', webm: 'video',
        // Audio
        mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio',
        // Documents
        pdf: 'doc', doc: 'doc', docx: 'doc', txt: 'doc', rtf: 'doc', xls: 'doc', xlsx: 'doc', ppt: 'doc', pptx: 'doc', csv: 'doc',
        // Archives
        zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
        // Code
        js: 'code', ts: 'code', py: 'code', java: 'code', cpp: 'code', html: 'code', css: 'code', json: 'code', xml: 'code',
    };

    const FILE_TYPE_ICONS = {
        image: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/></svg>',
        video: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/></svg>',
        audio: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/></svg>',
        doc: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>',
        archive: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM8 11a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>',
        code: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>',
        default: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>',
    };

    function getFileTypeInfo(filename) {
        if (!filename || typeof filename !== 'string') {
            return {
                type: 'default',
                icon: FILE_TYPE_ICONS.default,
                cssClass: 'icon-default',
            };
        }
        const ext = filename.split('.').pop().toLowerCase();
        const type = FILE_TYPE_MAP[ext] || 'default';
        return {
            type,
            icon: FILE_TYPE_ICONS[type] || FILE_TYPE_ICONS.default,
            cssClass: `icon-${type}`,
        };
    }

    // ──────────── FORMAT HELPERS ────────────

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
    }

    function formatDate(isoString) {
        try {
            const d = new Date(isoString);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return isoString;
        }
    }

    // ──────────── FILE LIST RENDERING ────────────

    function renderFileList(files, filter = '') {
        const listEl = document.getElementById('files-list');
        const emptyEl = document.getElementById('files-empty');

        // Filter files if search query is provided
        const filteredFiles = filter ?
            files.filter(f => (f.original_name || f.stored_name).toLowerCase().includes(filter.toLowerCase())) :
            files;

        // Clear existing file cards (keep empty state)
        listEl.querySelectorAll('.file-card').forEach(el => el.remove());

        if (!filteredFiles || filteredFiles.length === 0) {
            emptyEl.style.display = 'block';
            if (filter) {
                emptyEl.querySelector('p').textContent = 'No matches found';
                emptyEl.querySelector('.files-empty-sub').textContent = `Adjust your search for "${filter}"`;
            } else {
                emptyEl.querySelector('p').textContent = 'No files yet';
                emptyEl.querySelector('.files-empty-sub').textContent = 'Upload your first file to get started';
            }
            return;
        }

        emptyEl.style.display = 'none';

        filteredFiles.forEach((file, index) => {
            const typeInfo = getFileTypeInfo(file.original_name || file.stored_name);
            const card = document.createElement('div');
            card.className = 'file-card';
            card.style.animationDelay = `${index * 40}ms`;
            card.style.animation = 'slideUp 0.4s var(--transition-base) both';

            card.innerHTML = `
                <div class="file-card-icon ${typeInfo.cssClass}">${typeInfo.icon}</div>
                <div class="file-card-info">
                    <div class="file-card-name" title="${file.original_name || file.stored_name}">${file.original_name || file.stored_name}</div>
                    <div class="file-card-meta">
                        <span>${formatFileSize(file.original_size || 0)}</span>
                        <span>•</span>
                        <span>${formatDate(file.uploaded_at)}</span>
                        <span class="file-card-badge">
                            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
                            Encrypted
                        </span>
                    </div>
                </div>
                <div class="file-card-actions">
                    <button class="btn file-action-download" data-filename="${file.stored_name}" data-original="${file.original_name}" title="Download & Decrypt">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                    </button>
                    <button class="btn file-action-delete" data-filename="${file.stored_name}" data-original="${file.original_name}" title="Delete file">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
                    </button>
                </div>
            `;

            listEl.appendChild(card);
        });
    }

    // ──────────── UPLOAD PROGRESS ────────────

    function showUploadProgress(file) {
        const zone = document.getElementById('upload-zone-content');
        const progress = document.getElementById('upload-progress');
        const preview = document.getElementById('upload-file-preview');
        const typeInfo = getFileTypeInfo(file.name);

        zone.style.display = 'none';
        progress.style.display = 'block';

        preview.innerHTML = `
            <div class="file-icon">${typeInfo.icon}</div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
        `;

        // Reset steps
        ['step-encrypt', 'step-upload', 'step-done'].forEach(id => {
            const el = document.getElementById(id);
            el.className = 'upload-status-step';
        });
        document.querySelectorAll('.step-connector').forEach(el => {
            el.className = 'step-connector';
        });

        document.getElementById('step-encrypt').classList.add('active');
        updateUploadProgressBar(0, 'Encrypting file...');
    }

    function setUploadStep(step) {
        const steps = ['step-encrypt', 'step-upload', 'step-done'];
        const connectors = document.querySelectorAll('.step-connector');
        const stepIndex = steps.indexOf(step);

        steps.forEach((id, i) => {
            const el = document.getElementById(id);
            el.className = 'upload-status-step';
            if (i < stepIndex) el.classList.add('done');
            else if (i === stepIndex) el.classList.add('active');
        });

        connectors.forEach((el, i) => {
            el.className = 'step-connector';
            if (i < stepIndex) el.classList.add('done');
            else if (i === stepIndex) el.classList.add('active');
        });
    }

    function updateUploadProgressBar(percent, text) {
        document.getElementById('upload-progress-fill').style.width = `${percent}%`;
        document.getElementById('upload-progress-text').textContent = text;
    }

    function resetUploadZone() {
        document.getElementById('upload-zone-content').style.display = 'block';
        document.getElementById('upload-progress').style.display = 'none';
    }

    // ──────────── STATS UPDATE ────────────

    function updateStats(files) {
        document.getElementById('stat-files').textContent = files.length;
        const totalSize = files.reduce((sum, f) => sum + (f.encrypted_size || 0), 0);
        document.getElementById('stat-storage').textContent = formatFileSize(totalSize);
    }

    // ──────────── BUTTON LOADING STATE ────────────

    function setButtonLoading(btn, loading) {
        if (loading) {
            btn.classList.add('loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    // ──────────── SCREEN NAVIGATION ────────────

    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }

    // ──────────── MODAL HELPERS ────────────

    function showModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    }

    function hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    function showModalState(stateId) {
        const modal = stateId.startsWith('modal-') ?
            document.getElementById('download-modal') : null;
        if (!modal) return;

        modal.querySelectorAll('.modal-state').forEach(s => s.style.display = 'none');
        document.getElementById(stateId).style.display = 'block';
    }

    function setDecryptStep(stepId) {
        const steps = ['d-step-fetch', 'd-step-decrypt', 'd-step-verify'];
        const stepIndex = steps.indexOf(stepId);

        steps.forEach((id, i) => {
            const el = document.getElementById(id);
            el.className = 'decrypt-step';
            if (i < stepIndex) el.classList.add('done');
            else if (i === stepIndex) el.classList.add('active');
        });
    }

    // ──────────── PASSWORD TOGGLE ────────────

    function initPasswordToggles() {
        document.querySelectorAll('.password-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);
                const eyeOpen = btn.querySelector('.eye-open');
                const eyeClosed = btn.querySelector('.eye-closed');

                if (input.type === 'password') {
                    input.type = 'text';
                    eyeOpen.style.display = 'none';
                    eyeClosed.style.display = 'block';
                } else {
                    input.type = 'password';
                    eyeOpen.style.display = 'block';
                    eyeClosed.style.display = 'none';
                }
            });
        });
    }

    return {
        showToast,
        updatePasswordStrength,
        getPasswordStrength,
        getFileTypeInfo,
        formatFileSize,
        formatDate,
        renderFileList,
        showUploadProgress,
        setUploadStep,
        updateUploadProgressBar,
        resetUploadZone,
        updateStats,
        setButtonLoading,
        showScreen,
        showModal,
        hideModal,
        showModalState,
        setDecryptStep,
        initPasswordToggles,
    };
})();
