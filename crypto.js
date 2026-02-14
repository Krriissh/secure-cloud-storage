/**
 * SCS — Client-Side Cryptography Module
 * Zero-Knowledge Architecture: All crypto happens in the browser.
 * Uses Web Crypto API exclusively.
 *
 * Algorithms:
 *   Key Derivation: PBKDF2 with SHA-256, 100,000 iterations
 *   Encryption:     AES-256-GCM with random 12-byte IV
 *   Integrity:      SHA-256 file hash
 */

window.SCSCrypto = (() => {
    'use strict';

    const PBKDF2_ITERATIONS = 100000;
    const SALT_BYTES = 16;
    const IV_BYTES = 12;

    /**
     * Generate cryptographically random bytes as hex string.
     */
    function generateRandomHex(bytes) {
        const array = new Uint8Array(bytes);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Convert hex string to Uint8Array.
     */
    function hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    /**
     * Convert ArrayBuffer to hex string.
     */
    function bufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Convert string to Uint8Array (UTF-8).
     */
    function stringToBytes(str) {
        return new TextEncoder().encode(str);
    }

    /**
     * Derive an AES-256-GCM key from password + salt using PBKDF2.
     * @param {string} password - User's password
     * @param {Uint8Array} salt - 16-byte salt
     * @returns {Promise<CryptoKey>}
     */
    async function deriveKey(password, salt) {
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            stringToBytes(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: PBKDF2_ITERATIONS,
                hash: 'SHA-256',
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Hash password with PBKDF2 for authentication (not encryption).
     * Returns hex string of derived key.
     * @param {string} password
     * @param {Uint8Array} salt
     * @returns {Promise<string>} hex hash
     */
    async function hashPassword(password, salt) {
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            stringToBytes(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );

        const bits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: PBKDF2_ITERATIONS,
                hash: 'SHA-256',
            },
            keyMaterial,
            256
        );

        return bufferToHex(bits);
    }

    /**
     * Hash email address for secure storage paths.
     * @param {string} email
     * @returns {Promise<string>} hex hash
     */
    async function hashEmail(email) {
        const data = stringToBytes(email.toLowerCase().trim());
        const hash = await crypto.subtle.digest('SHA-256', data);
        return bufferToHex(hash);
    }

    /**
     * Compute SHA-256 hash of data.
     * @param {ArrayBuffer} data
     * @returns {Promise<string>} hex hash
     */
    async function hashFile(data) {
        const hash = await crypto.subtle.digest('SHA-256', data);
        return bufferToHex(hash);
    }

    /**
     * Encrypt a file's ArrayBuffer with AES-256-GCM.
     * Generates fresh salt + IV per file.
     * @param {ArrayBuffer} data - plaintext file data
     * @param {string} password - user's password
     * @returns {Promise<{ciphertext: ArrayBuffer, iv: string, salt: string, fileHash: string}>}
     */
    async function encryptFile(data, password) {
        // Generate unique salt and IV for this file
        const salt = hexToBytes(generateRandomHex(SALT_BYTES));
        const iv = hexToBytes(generateRandomHex(IV_BYTES));

        // Hash the plaintext for integrity verification
        const fileHash = await hashFile(data);

        // Derive encryption key
        const key = await deriveKey(password, salt);

        // Encrypt with AES-256-GCM (auth tag is appended automatically)
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );

        return {
            ciphertext,
            iv: bufferToHex(iv),
            salt: bufferToHex(salt),
            fileHash,
        };
    }

    /**
     * Decrypt a file encrypted with AES-256-GCM.
     * Will throw if password is wrong (auth tag fails).
     * @param {ArrayBuffer} ciphertext
     * @param {string} ivHex - IV as hex
     * @param {string} saltHex - salt as hex
     * @param {string} password
     * @returns {Promise<ArrayBuffer>} plaintext data
     */
    async function decryptFile(ciphertext, ivHex, saltHex, password) {
        const iv = hexToBytes(ivHex);
        const salt = hexToBytes(saltHex);
        const key = await deriveKey(password, salt);

        // AES-GCM decryption — will throw OperationError if auth tag fails
        return crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            ciphertext
        );
    }

    /**
     * Securely clear a string from memory by overwriting.
     * Note: JS strings are immutable, so we can only clear the reference
     * and rely on GC. This clears typed array copies.
     */
    function secureClear(buffer) {
        if (buffer instanceof Uint8Array || buffer instanceof ArrayBuffer) {
            const view = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
            crypto.getRandomValues(view);
            view.fill(0);
        }
    }

    return {
        generateRandomHex,
        hexToBytes,
        bufferToHex,
        hashPassword,
        hashFile,
        hashEmail,
        encryptFile,
        decryptFile,
        deriveKey,
        secureClear,
        PBKDF2_ITERATIONS,
    };
})();
