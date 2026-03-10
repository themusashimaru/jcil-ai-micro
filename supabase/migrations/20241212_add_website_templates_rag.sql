-- ============================================
-- FORGE & MUSASHI: Website Template RAG System
-- The most comprehensive template library ever built
-- Makes Arnold look like he never lifted
-- ============================================

-- Create enum for template categories
DO $$ BEGIN
    CREATE TYPE template_category AS ENUM (
        -- Business & Professional
        'restaurant', 'cafe', 'bar', 'food-truck', 'catering',
        'salon', 'spa', 'barbershop', 'beauty', 'wellness',
        'gym', 'fitness', 'yoga', 'martial-arts', 'personal-trainer',
        'dental', 'medical', 'healthcare', 'pharmacy', 'veterinary',
        'law-firm', 'accounting', 'consulting', 'financial', 'insurance',
        'real-estate', 'property', 'construction', 'architecture', 'interior-design',
        'auto-detailing', 'car-wash', 'mechanic', 'auto-dealer', 'towing',
        'plumbing', 'electrical', 'hvac', 'roofing', 'landscaping',
        'cleaning', 'maid-service', 'pest-control', 'moving', 'storage',

        -- Creative & Agency
        'agency', 'marketing', 'advertising', 'pr', 'branding',
        'photography', 'videography', 'film', 'studio', 'production',
        'design', 'graphic-design', 'ui-ux', 'web-design', 'illustration',
        'music', 'band', 'dj', 'producer', 'record-label',
        'art', 'gallery', 'artist', 'sculptor', 'painter',

        -- Tech & SaaS
        'saas', 'startup', 'tech', 'app', 'software',
        'ai', 'machine-learning', 'data', 'analytics', 'cloud',
        'devtools', 'api', 'platform', 'marketplace', 'fintech',

        -- E-commerce & Retail
        'ecommerce', 'shop', 'boutique', 'fashion', 'jewelry',
        'electronics', 'furniture', 'home-goods', 'sports', 'outdoor',

        -- Events & Entertainment
        'wedding', 'event-planning', 'party', 'venue', 'catering',
        'entertainment', 'comedy', 'theater', 'cinema', 'gaming',

        -- Education & Non-profit
        'education', 'school', 'tutoring', 'online-course', 'coaching',
        'nonprofit', 'charity', 'foundation', 'church', 'community',

        -- Personal & Portfolio
        'portfolio', 'resume', 'personal-brand', 'blog', 'writer',
        'developer', 'freelancer', 'creator', 'influencer', 'podcast',

        -- Other
        'landing-page', 'coming-soon', 'waitlist', 'launch', 'general'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for design styles
DO $$ BEGIN
    CREATE TYPE design_style AS ENUM (
        'modern', 'minimal', 'bold', 'elegant', 'playful',
        'corporate', 'creative', 'dark', 'light', 'colorful',
        'glassmorphism', 'neumorphism', 'brutalist', 'retro', 'futuristic'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for layout types
DO $$ BEGIN
    CREATE TYPE layout_type AS ENUM (
        'single-page', 'multi-section', 'split-screen', 'hero-focused',
        'grid-based', 'magazine', 'portfolio-grid', 'timeline', 'cards'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Main templates table
CREATE TABLE IF NOT EXISTS website_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic info
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,

    -- Categorization
    category template_category NOT NULL,
    subcategories TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',

    -- Design metadata
    style design_style DEFAULT 'modern',
    layout layout_type DEFAULT 'single-page',
    color_scheme JSONB DEFAULT '{"primary": "#3B82F6", "secondary": "#10B981", "accent": "#F59E0B", "background": "#FFFFFF", "text": "#1F2937"}',
    fonts JSONB DEFAULT '{"heading": "Inter", "body": "Inter"}',

    -- The actual template content
    html_template TEXT NOT NULL,
    css_template TEXT,
    js_template TEXT,

    -- Responsive breakpoints included
    has_mobile BOOLEAN DEFAULT true,
    has_tablet BOOLEAN DEFAULT true,
    has_desktop BOOLEAN DEFAULT true,

    -- Features included
    features TEXT[] DEFAULT '{}', -- e.g., ['contact-form', 'testimonials', 'pricing', 'gallery']
    sections TEXT[] DEFAULT '{}', -- e.g., ['hero', 'about', 'services', 'contact']

    -- AI generation hints
    placeholder_mappings JSONB DEFAULT '{}', -- Maps placeholders to business data
    image_slots JSONB DEFAULT '{}', -- Where to inject AI-generated images
    customization_hints TEXT, -- Instructions for AI on how to customize

    -- Thumbnail/preview
    thumbnail_url TEXT,
    preview_url TEXT,

    -- Usage stats
    times_used INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_premium BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_templates_category ON website_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_style ON website_templates(style);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON website_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_templates_features ON website_templates USING GIN(features);
CREATE INDEX IF NOT EXISTS idx_templates_active ON website_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_rating ON website_templates(rating DESC);
CREATE INDEX IF NOT EXISTS idx_templates_usage ON website_templates(times_used DESC);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_templates_search ON website_templates
USING GIN(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || array_to_string(tags, ' ')));

-- Template variations table (for A/B testing and color variants)
CREATE TABLE IF NOT EXISTS template_variations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES website_templates(id) ON DELETE CASCADE,
    variation_name TEXT NOT NULL,
    color_scheme JSONB NOT NULL,
    custom_css TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User generated sites tracking (for analytics)
CREATE TABLE IF NOT EXISTS generated_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    template_id UUID REFERENCES website_templates(id),
    business_name TEXT,
    business_type TEXT,
    generated_html TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    deployed_url TEXT,
    github_repo TEXT,
    vercel_project_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_generated_sites_user ON generated_sites(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_sites_template ON generated_sites(template_id);

-- Function to increment template usage
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE website_templates
    SET times_used = times_used + 1,
        updated_at = NOW()
    WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- Function to search templates by text
CREATE OR REPLACE FUNCTION search_templates(search_query TEXT)
RETURNS SETOF website_templates AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM website_templates
    WHERE is_active = true
    AND (
        to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || array_to_string(tags, ' '))
        @@ plainto_tsquery('english', search_query)
        OR name ILIKE '%' || search_query || '%'
        OR description ILIKE '%' || search_query || '%'
        OR search_query = ANY(tags)
    )
    ORDER BY rating DESC, times_used DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Function to get best template for a category
CREATE OR REPLACE FUNCTION get_best_template(cat template_category)
RETURNS website_templates AS $$
DECLARE
    result website_templates;
BEGIN
    SELECT * INTO result
    FROM website_templates
    WHERE category = cat
    AND is_active = true
    ORDER BY rating DESC, times_used DESC
    LIMIT 1;

    RETURN result;
END;
$$ LANGUAGE plpgsql;
