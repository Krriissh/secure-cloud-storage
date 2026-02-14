/**
 * SCS — Storage Manager Module
 * This module provides a unified interface for different storage backends.
 * It allows the app to switch between Local (FastAPI) and Cloud (Supabase) storage.
 */

const SCSStorage = (() => {
    'use strict';

    let currentProvider = null;

    /**
     * Set the active storage provider.
     * @param {Object} provider - An object implementing the storage interface.
     */
    function setProvider(provider) {
        currentProvider = provider;
        console.log(`[SCSStorage] Provider set to: ${provider.name}`);
    }

    /**
     * Get the current provider name.
     */
    function getProviderName() {
        return currentProvider ? currentProvider.name : 'None';
    }

    /**
     * Unified interface for saving an encrypted file.
     */
    async function saveFile(email, passwordHash, encryptedBlob, metadata, filename) {
        if (!currentProvider) throw new Error('No storage provider configured.');
        return await currentProvider.saveFile(email, passwordHash, encryptedBlob, metadata, filename);
    }

    /**
     * Unified interface for listing files.
     */
    async function listFiles(email) {
        if (!currentProvider) throw new Error('No storage provider configured.');
        return await currentProvider.listFiles(email);
    }

    /**
     * Unified interface for getting a file's encrypted blob.
     */
    async function getFileBlob(email, filename) {
        if (!currentProvider) throw new Error('No storage provider configured.');
        return await currentProvider.getFileBlob(email, filename);
    }

    /**
     * Unified interface for deleting a file.
     */
    async function deleteFile(email, filename, passwordHash) {
        if (!currentProvider) throw new Error('No storage provider configured.');
        return await currentProvider.deleteFile(email, filename, passwordHash);
    }

    /**
     * Unified interface for getting metadata.
     */
    async function getMetadata(email, filename) {
        if (!currentProvider) throw new Error('No storage provider configured.');
        return await currentProvider.getMetadata(email, filename);
    }

    return {
        setProvider,
        getProviderName,
        saveFile,
        listFiles,
        getFileBlob,
        getMetadata,
        deleteFile
    };
})();
