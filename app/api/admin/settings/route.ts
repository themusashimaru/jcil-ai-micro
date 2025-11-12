/**
 * ADMIN SETTINGS API
 * Handles saving and retrieving design settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const CONFIG_DIR = join(process.cwd(), 'config');
const CONFIG_FILE = join(CONFIG_DIR, 'design-settings.json');

interface DesignSettings {
  mainLogo: string;
  headerLogo: string;
  loginLogo: string;
  favicon: string;
  siteName: string;
  subtitle: string;
}

const DEFAULT_SETTINGS: DesignSettings = {
  mainLogo: '/images/logo.png',
  headerLogo: '',
  loginLogo: '',
  favicon: '/favicon.ico',
  siteName: 'JCIL.ai',
  subtitle: 'Your AI Assistant',
};

async function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

async function getSettings(): Promise<DesignSettings> {
  try {
    await ensureConfigDir();

    if (!existsSync(CONFIG_FILE)) {
      // Create default config if it doesn't exist
      await writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
      return DEFAULT_SETTINGS;
    }

    const data = await readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading settings:', error);
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(settings: DesignSettings): Promise<void> {
  await ensureConfigDir();
  await writeFile(CONFIG_FILE, JSON.stringify(settings, null, 2));
}

// GET - Retrieve current settings
export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error getting settings:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve settings' },
      { status: 500 }
    );
  }
}

// POST - Save settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const settings: DesignSettings = {
      mainLogo: body.mainLogo || DEFAULT_SETTINGS.mainLogo,
      headerLogo: body.headerLogo || DEFAULT_SETTINGS.headerLogo,
      loginLogo: body.loginLogo || DEFAULT_SETTINGS.loginLogo,
      favicon: body.favicon || DEFAULT_SETTINGS.favicon,
      siteName: body.siteName || DEFAULT_SETTINGS.siteName,
      subtitle: body.subtitle || DEFAULT_SETTINGS.subtitle,
    };

    await saveSettings(settings);

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
