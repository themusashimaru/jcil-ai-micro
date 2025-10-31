// /lib/file-cleanup.ts
// Automatic File Cleanup System - 3 Day Retention

import { createClient } from '@supabase/supabase-js';

// ===== CONFIGURATION =====
const FILE_RETENTION_DAYS = 3; // Files older than 3 days will be deleted
const BATCH_SIZE = 100; // Process 100 files at a time

// ===== TYPES =====
interface CleanupStats {
  filesFound: number;
  filesDeleted: number;
  messagesUpdated: number;
  storageFreed: string;
  errors: number;
  duration: string;
}

interface FileToClean {
  message_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
}

// ===== HELPER FUNCTIONS =====

/**
 * Initialize Supabase admin client with service role
 * 🔒 CRITICAL: Validates service role key before creating client
 */
function getSupabaseAdmin() {
  // 🔥 FIXED: Check BEFORE using the values
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing required environment variables: ' +
      (!supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL ' : '') +
      (!supabaseServiceKey ? 'SUPABASE_SERVICE_ROLE_KEY' : '')
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Extract storage path from Supabase URL
 */
function extractStoragePath(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/uploads\/(.+)$/);
    return pathMatch ? pathMatch[1] : null;
  } catch (error) {
    console.error('Error parsing file URL:', error);
    return null;
  }
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// ===== MAIN CLEANUP FUNCTION =====

/**
 * Clean up files older than FILE_RETENTION_DAYS
 * Deletes from storage and clears file_url from messages table
 */
export async function cleanupOldFiles(): Promise<CleanupStats> {
  const startTime = Date.now();
  
  const stats: CleanupStats = {
    filesFound: 0,
    filesDeleted: 0,
    messagesUpdated: 0,
    storageFreed: '0 Bytes',
    errors: 0,
    duration: '0s',
  };

  try {
    const supabase = getSupabaseAdmin();

    // Calculate cutoff date (3 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - FILE_RETENTION_DAYS);

    console.log(`🧹 Starting cleanup for files older than ${cutoffDate.toISOString()}`);

    // Find messages with files older than retention period
    const { data: oldFiles, error: fetchError } = await supabase
      .from('messages')
      .select('id, file_url, file_size, created_at')
      .not('file_url', 'is', null)
      .lt('created_at', cutoffDate.toISOString())
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('Error fetching old files:', fetchError);
      throw fetchError;
    }

    if (!oldFiles || oldFiles.length === 0) {
      console.log('✅ No files to clean up');
      stats.duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
      return stats;
    }

    stats.filesFound = oldFiles.length;
    console.log(`📋 Found ${stats.filesFound} files to clean up`);

    let totalBytesFreed = 0;

    // Process each file
    for (const file of oldFiles) {
      try {
        const storagePath = extractStoragePath(file.file_url);
        
        if (!storagePath) {
          console.warn(`⚠️ Could not parse storage path: ${file.file_url}`);
          stats.errors++;
          continue;
        }

        // Delete from Supabase Storage
        const { error: storageError } = await supabase.storage
          .from('uploads')
          .remove([storagePath]);

        if (storageError) {
          console.error(`❌ Failed to delete file ${storagePath}:`, storageError);
          stats.errors++;
          continue;
        }

        // Clear file_url from messages table
        const { error: updateError } = await supabase
          .from('messages')
          .update({ 
            file_url: null,
            file_type: null,
            file_size: null,
          })
          .eq('id', file.id);

        if (updateError) {
          console.error(`❌ Failed to update message ${file.id}:`, updateError);
          stats.errors++;
          continue;
        }

        // Track success
        stats.filesDeleted++;
        stats.messagesUpdated++;
        
        if (file.file_size) {
          totalBytesFreed += file.file_size;
        }

        console.log(`✅ Deleted: ${storagePath}`);

      } catch (error) {
        console.error('Error processing file:', error);
        stats.errors++;
      }
    }

    stats.storageFreed = formatBytes(totalBytesFreed);
    stats.duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

    // Log cleanup results to database
    await logCleanup(supabase, stats);

    console.log('🎉 Cleanup complete:', stats);
    return stats;

  } catch (error) {
    console.error('Fatal error during cleanup:', error);
    stats.duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    throw error;
  }
}

// ===== PREVIEW FUNCTION (SAFE - NO DELETION) =====

/**
 * Preview what files would be deleted without actually deleting them
 * Safe to run - performs no deletions
 */
export async function previewCleanup() {
  const supabase = getSupabaseAdmin();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - FILE_RETENTION_DAYS);

  const { data: oldFiles, error } = await supabase
    .from('messages')
    .select('id, file_url, file_size, created_at')
    .not('file_url', 'is', null)
    .lt('created_at', cutoffDate.toISOString())
    .limit(BATCH_SIZE);

  if (error) {
    throw error;
  }

  const totalSize = oldFiles?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0;

  return {
    filesToDelete: oldFiles?.length || 0,
    estimatedSize: formatBytes(totalSize),
    oldestFile: oldFiles?.[0]?.created_at || null,
    retentionDays: FILE_RETENTION_DAYS,
  };
}

// ===== LOGGING =====

/**
 * Log cleanup results to database for monitoring
 */
async function logCleanup(supabase: any, stats: CleanupStats) {
  try {
    const { error } = await supabase.from('cleanup_logs').insert({
      files_found: stats.filesFound,
      files_deleted: stats.filesDeleted,
      messages_updated: stats.messagesUpdated,
      storage_freed: stats.storageFreed,
      errors: stats.errors,
      duration: stats.duration,
    });

    if (error) {
      console.error('Failed to log cleanup:', error);
    }
  } catch (error) {
    console.error('Error logging cleanup:', error);
  }
}