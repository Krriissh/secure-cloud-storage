/**
 * SCS — Local Storage Provider
 * Implements the storage interface by calling the existing FastAPI backend.
 */

const SCSLocalProvider = (() => {
    'use strict';

    return {
        name: 'Local Server',

        async saveFile(email, passwordHash, encryptedBlob, metadata, filename) {
            return await SCSApi.uploadFile(email, passwordHash, encryptedBlob, metadata, filename);
        },

        async listFiles(email) {
            const data = await SCSApi.listFiles(email);
            return data.files || [];
        },

        async getFileBlob(email, filename) {
            return await SCSApi.downloadBlob(email, filename);
        },

        async getMetadata(email, filename) {
            const data = await SCSApi.getFileInfo(email, filename);
            return data.metadata;
        },

        async deleteFile(email, filename, passwordHash) {
            return await SCSApi.deleteFile(email, filename, passwordHash);
        }
    };
})();
