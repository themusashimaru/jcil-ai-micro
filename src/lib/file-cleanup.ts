// /lib/file-cleanup.ts
// ⚠️ FILE DELETION DISABLED - All files now stored permanently
// To re-enable automatic cleanup, change CLEANUP_ENABLED to true

// ===== CONFIGURATION =====
const CLEANUP_ENABLED = false; // ✅ SET TO FALSE - Files kept permanently
const FILE_RETENTION_DAYS = 3; // Only applies if CLEANUP_ENABLED = true
const BATCH_SIZE = 100;

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

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing required environment variables: ' +
      (!supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL ' : '') +
      (!supabaseServiceKey ? 'SUPABASE_SERVICE_ROLE_KEY' : '')
    );
  }

  const { createClient } = require('@supabase/supabase-js');
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// ===== MAIN CLEANUP FUNCTION =====

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

  // ✅ CHECK IF CLEANUP IS ENABLED
  if (!CLEANUP_ENABLED) {
    console.log('⏸️ Automatic file cleanup is DISABLED - All files stored permanently');
    stats.duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    return stats;
  }

  try {
    const supabase = getSupabaseAdmin();

    // Calculate cutoff date
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

    console.log('🎉 Cleanup complete:', stats);
    return stats;

  } catch (error) {
    console.error('Fatal error during cleanup:', error);
    stats.duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    throw error;
  }
}

// ===== PREVIEW FUNCTION (SAFE - NO DELETION) =====

export async function previewCleanup() {
  if (!CLEANUP_ENABLED) {
    return {
      filesToDelete: 0,
      estimatedSize: '0 Bytes',
      oldestFile: null,
      retentionDays: FILE_RETENTION_DAYS,
      message: 'Cleanup is disabled - all files stored permanently',
    };
  }

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

  const totalSize = oldFiles?.reduce((sum: number, file) => sum + (file.file_size || 0), 0) || 0;

  return {
    filesToDelete: oldFiles?.length || 0,
    estimatedSize: formatBytes(totalSize),
    oldestFile: oldFiles?.[0]?.created_at || null,
    retentionDays: FILE_RETENTION_DAYS,
  };
}