#!/bin/bash

# ============================================
# SQL Update Script Runner
# ============================================
# This script helps you run the subscription tiers SQL update
#
# USAGE OPTIONS:
#
# Option 1: Run via Supabase CLI (RECOMMENDED)
# --------------------------------------------
# If you have Supabase CLI installed:
#   supabase db execute -f update-subscription-tiers-with-limits.sql
#
# Option 2: Run via psql (if you have direct database access)
# --------------------------------------------
# If you have psql and your database connection string:
#   psql "your-connection-string-here" -f update-subscription-tiers-with-limits.sql
#
# Option 3: Copy-paste into Supabase Dashboard (EASIEST)
# --------------------------------------------
# 1. Go to your Supabase project dashboard
# 2. Navigate to: SQL Editor (in the left sidebar)
# 3. Click "New Query"
# 4. Copy the entire contents of update-subscription-tiers-with-limits.sql
# 5. Paste into the SQL editor
# 6. Click "Run" button
#
# ============================================

echo "================================================"
echo "SQL Update Script for Subscription Tiers"
echo "================================================"
echo ""
echo "This script will help you run the SQL update."
echo ""
echo "Choose an option:"
echo "1) Run via Supabase CLI (requires supabase CLI)"
echo "2) Run via psql (requires connection string)"
echo "3) Show instructions for Supabase Dashboard (recommended)"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
  1)
    echo ""
    echo "Running via Supabase CLI..."
    if command -v supabase &> /dev/null; then
      supabase db execute -f update-subscription-tiers-with-limits.sql
      echo "✅ SQL update completed!"
    else
      echo "❌ Error: Supabase CLI not found. Install it first:"
      echo "   npm install -g supabase"
    fi
    ;;
  2)
    echo ""
    read -p "Enter your database connection string: " conn_string
    if command -v psql &> /dev/null; then
      psql "$conn_string" -f update-subscription-tiers-with-limits.sql
      echo "✅ SQL update completed!"
    else
      echo "❌ Error: psql not found. Install PostgreSQL client first."
    fi
    ;;
  3)
    echo ""
    echo "============================================"
    echo "INSTRUCTIONS FOR SUPABASE DASHBOARD:"
    echo "============================================"
    echo ""
    echo "1. Go to: https://supabase.com/dashboard"
    echo "2. Select your project"
    echo "3. Click 'SQL Editor' in the left sidebar"
    echo "4. Click 'New Query'"
    echo "5. Copy the contents of: update-subscription-tiers-with-limits.sql"
    echo "6. Paste into the SQL editor"
    echo "7. Click the 'Run' button (or press Ctrl+Enter)"
    echo ""
    echo "The file is located at:"
    echo "  $(pwd)/update-subscription-tiers-with-limits.sql"
    echo ""
    echo "✅ You can now copy the file contents!"
    ;;
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

echo ""
echo "================================================"
echo "Done!"
echo "================================================"
