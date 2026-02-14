/**
 * SCS — API Client Module
 * Thin wrappers around fetch() for the 3 core APIs + helpers.
 * All errors are caught and translated to user-friendly messages.
 */

const SCSApi = (() => {
    'use strict';

    const BASE_URL = '/api';

    /**
     * Safe JSON parse with fallback.
     */
    async function parseResponse(response) {
        try {
            return await response.json();
        } catch {
            return { detail: 'Unexpected server response.' };
        }
    }

    /**
     * Register a new user.
     * @param {string} email
     * @param {string} passwordHash - PBKDF2 hash (hex)
     * @param {string} salt - salt used for hashing (hex)
     */
    async function register(email, passwordHash, salt) {
        const res = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password_hash: passwordHash, salt }),
        });

        const data = await parseResponse(res);
        if (!res.ok) throw new Error(data.detail || 'Registration failed.');
        return data;
    }

    /**
     * Login and retrieve user salt.
     * @param {string} email
     * @param {string} passwordHash - PBKDF2 hash (hex)
     */
    async function login(email, passwordHash) {
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password_hash: passwordHash }),
        });

        const data = await parseResponse(res);
        if (!res.ok) throw new Error(data.detail || 'Login failed.');
        return data;
    }

    /**
     * Upload an encrypted file.
     * @param {string} email
     * @param {string} passwordHash
     * @param {Blob} encryptedBlob - encrypted file data
     * @param {Object} metadata - { original_name, original_size, iv, salt, file_hash }
     * @param {string} filename - sanitized filename for the upload
     */
    async function uploadFile(email, passwordHash, encryptedBlob, metadata, filename) {
        const formData = new FormData();
        formData.append('email', email);
        formData.append('password_hash', passwordHash);
        formData.append('metadata', JSON.stringify(metadata));
        formData.append('file', encryptedBlob, filename);

        const res = await fetch(`${BASE_URL}/upload`, {
            method: 'POST',
            body: formData,
        });

        const data = await parseResponse(res);
        if (!res.ok) throw new Error(data.detail || 'Upload failed.');
        return data;
    }

    /**
     * Get file metadata and download URL.
     * @param {string} email
     * @param {string} filename
     */
    async function getFileInfo(email, filename) {
        const params = new URLSearchParams({ email, filename });
        const res = await fetch(`${BASE_URL}/download?${params}`);

        const data = await parseResponse(res);
        if (!res.ok) throw new Error(data.detail || 'File not found.');
        return data;
    }

    /**
     * Download encrypted file blob.
     * @param {string} email
     * @param {string} filename
     * @returns {Promise<ArrayBuffer>}
     */
    async function downloadBlob(email, filename) {
        const params = new URLSearchParams({ email, filename });
        const res = await fetch(`${BASE_URL}/download/blob?${params}`);

        if (!res.ok) {
            const data = await parseResponse(res);
            throw new Error(data.detail || 'Download failed.');
        }

        return res.arrayBuffer();
    }

    /**
     * List all files for a user.
     * @param {string} email
     */
    async function listFiles(email) {
        const params = new URLSearchParams({ email });
        const res = await fetch(`${BASE_URL}/files?${params}`);

        const data = await parseResponse(res);
        if (!res.ok) throw new Error(data.detail || 'Failed to load files.');
        return data;
    }

    /**
     * Delete a file.
     * @param {string} email
     * @param {string} filename
     * @param {string} passwordHash
     */
    async function deleteFile(email, filename, passwordHash) {
        const res = await fetch(`${BASE_URL}/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, filename, password_hash: passwordHash }),
        });

        const data = await parseResponse(res);
        if (!res.ok) throw new Error(data.detail || 'Delete failed.');
        return data;
    }

    return {
        register,
        login,
        uploadFile,
        getFileInfo,
        downloadBlob,
        listFiles,
        deleteFile,
    };
})();
