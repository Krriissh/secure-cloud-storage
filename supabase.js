/**
 * SCS — Supabase Storage Provider
 * Implements the storage interface using Supabase (PostgreSQL + Buckets).
 */

const SCSSupabaseProvider = (() => {
    'use strict';

    let supabaseClient = null;
    const BUCKET_NAME = 'scs_files';
    const TABLE_NAME = 'scs_metadata';

    // Built-in Managed Cloud Credentials (User provided)
    const MANAGED_CONFIG = {
        url: 'https://umbbmjyxxvvutlvnkdtf.supabase.co',
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYmJtanl4eHZ2dXRsdm5rZHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5OTgzMjcsImV4cCI6MjA4NjU3NDMyN30.3o5aqCTFfDD4w-BePDrWoCmJvLk0DkLY7NSvRGRdMK0'
    };

    /**
     * Initialize the Supabase client.
     */
    function init(url, key, isManaged = false) {
        const targetUrl = isManaged ? MANAGED_CONFIG.url : url;
        const targetKey = isManaged ? MANAGED_CONFIG.key : key;

        if (!targetUrl || !targetKey) return false;
        try {
            // Use global 'supabase' (from CDN) to create the client
            supabaseClient = supabase.createClient(targetUrl, targetKey);
            return true;
        } catch (err) {
            console.error('[Supabase] Init failed:', err);
            return false;
        }
    }

    return {
        name: 'Supabase Cloud',

        init,

        async saveFile(email, passwordHash, encryptedBlob, metadata, filename) {
            if (!supabaseClient) throw new Error('Supabase not initialized.');

            // 1. Upload Encrypted Blob to Bucket
            // Path: <email_hash>/<filename>
            const emailHash = await SCSCrypto.hashEmail(email);
            const filePath = `${emailHash}/${filename}`;

            const { error: uploadError } = await supabaseClient.storage
                .from(BUCKET_NAME)
                .upload(filePath, encryptedBlob, {
                    upsert: true,
                    contentType: 'application/octet-stream'
                });

            if (uploadError) throw new Error(`Supabase Upload failed: ${uploadError.message}`);

            // 2. Store Metadata in Table
            const { error: dbError } = await supabaseClient
                .from(TABLE_NAME)
                .upsert({
                    email: email,
                    filename: filename,
                    metadata: metadata,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'email, filename' });

            if (dbError) throw new Error(`Supabase DB update failed: ${dbError.message}`);

            return { status: 'success', source: 'supabase' };
        },

        async listFiles(email) {
            if (!supabaseClient) throw new Error('Supabase not initialized.');

            const { data, error } = await supabaseClient
                .from(TABLE_NAME)
                .select('*')
                .eq('email', email)
                .order('updated_at', { ascending: false });

            if (error) throw new Error(`Supabase list failed: ${error.message}`);

            // Transform to match standardized UI format
            return data.map(item => ({
                original_name: item.filename,
                stored_name: item.filename,
                original_size: item.metadata.original_size || 0,
                uploaded_at: item.updated_at
            }));
        },

        async getFileBlob(email, filename) {
            if (!supabaseClient) throw new Error('Supabase not initialized.');

            const emailHash = await SCSCrypto.hashEmail(email);
            const filePath = `${emailHash}/${filename}`;

            const { data, error } = await supabaseClient.storage
                .from(BUCKET_NAME)
                .download(filePath);

            if (error) throw new Error(`Supabase download failed: ${error.message}`);

            return await data.arrayBuffer();
        },

        async getMetadata(email, filename) {
            if (!supabaseClient) throw new Error('Supabase not initialized.');

            const { data, error } = await supabaseClient
                .from(TABLE_NAME)
                .select('metadata')
                .eq('email', email)
                .eq('filename', filename)
                .single();

            if (error) throw new Error(`Supabase metadata fetch failed: ${error.message}`);
            return data.metadata;
        },

        async deleteFile(email, filename, passwordHash) {
            if (!supabaseClient) throw new Error('Supabase not initialized.');

            const emailHash = await SCSCrypto.hashEmail(email);
            const filePath = `${emailHash}/${filename}`;

            // 1. Delete from Bucket
            const { error: storageError } = await supabaseClient.storage
                .from(BUCKET_NAME)
                .remove([filePath]);

            if (storageError) throw new Error(`Supabase delete failed: ${storageError.message}`);

            // 2. Delete from DB
            const { error: dbError } = await supabaseClient
                .from(TABLE_NAME)
                .delete()
                .eq('email', email)
                .eq('filename', filename);

            if (dbError) throw new Error(`Supabase DB delete failed: ${dbError.message}`);

            return { status: 'success' };
        }
    };
})();
