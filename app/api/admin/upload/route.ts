/**
 * ADMIN UPLOAD API
 * Handles file uploads for logos and favicons
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/x-icon', 'image/vnd.microsoft.icon'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PNG, JPEG, or ICO files.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine file extension
    let extension = 'png';
    if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      extension = 'jpg';
    } else if (file.type === 'image/x-icon' || file.type === 'image/vnd.microsoft.icon') {
      extension = 'ico';
    }

    // Create filename based on type
    let filename = '';
    switch (type) {
      case 'main-logo':
        filename = `logo.${extension}`;
        break;
      case 'header-logo':
        filename = `header-logo.${extension}`;
        break;
      case 'login-logo':
        filename = `login-logo.${extension}`;
        break;
      case 'favicon':
        filename = `favicon.${extension}`;
        break;
      default:
        filename = `upload-${Date.now()}.${extension}`;
    }

    // Ensure upload directory exists
    const uploadDir = join(process.cwd(), 'public', 'images');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Save file
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);

    // Return URL
    const url = `/images/${filename}`;

    return NextResponse.json({
      success: true,
      url,
      filename,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
