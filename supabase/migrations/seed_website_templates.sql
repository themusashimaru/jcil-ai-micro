-- ============================================
-- FORGE MEGA TEMPLATE SYSTEM v2.0
-- 22 Flexible Categories to CRUSH Manus
-- FORGE & MUSASHI - The Bash Brothers
-- ============================================
-- TEMPLATES 1-9: COMPLETE (in Supabase)
-- TEMPLATES 10-22: READY TO PASTE
-- ============================================

-- ============================================
-- TEMPLATE 1: HERO LANDING
-- Works for: Product launches, promos, waitlists, app reveals, any single-page promo
-- STATUS: COMPLETE IN SUPABASE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Impact Hero',
    'impact-hero-landing',
    'High-converting hero landing page with bold headline, features, social proof, and CTA',
    'hero-landing',
    'modern',
    'hero-focused',
    '{"primary": "#6366F1", "secondary": "#EC4899", "accent": "#F59E0B", "background": "#0F172A", "text": "#F8FAFC"}',
    ARRAY['hero', 'features', 'social-proof', 'cta', 'responsive'],
    ARRAY['hero', 'features', 'testimonials', 'cta', 'footer'],
    ARRAY['landing', 'launch', 'product', 'waitlist', 'promo', 'startup', 'hero'],
    '<!-- FULL HTML IN SUPABASE -->',
    'Flexible hero landing for ANY product launch. AI fills: business_name, tagline, headline, features, CTAs.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 2: ECOMMERCE FULL
-- Works for: ANY online store - fashion, electronics, food, home goods, etc.
-- STATUS: COMPLETE IN SUPABASE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'StoreFront Pro',
    'storefront-pro-ecommerce',
    'Full-featured e-commerce template with product grid, categories, cart preview, and checkout CTA',
    'ecommerce-full',
    'modern',
    'grid-based',
    '{"primary": "#18181B", "secondary": "#F4F4F5", "accent": "#EAB308", "background": "#FFFFFF", "text": "#18181B"}',
    ARRAY['products', 'categories', 'cart', 'search', 'responsive', 'filters'],
    ARRAY['header', 'hero', 'categories', 'products', 'features', 'newsletter', 'footer'],
    ARRAY['ecommerce', 'shop', 'store', 'products', 'retail', 'buy', 'cart'],
    '<!-- FULL HTML IN SUPABASE -->',
    'Works for ANY online store. AI fills: business_name, products, categories, prices.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 3: SAAS PRODUCT
-- Works for: Software products, apps, platforms, tools, dashboards
-- STATUS: COMPLETE IN SUPABASE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'SaaS Launch',
    'saas-launch-product',
    'Modern SaaS product page with features, pricing tiers, testimonials, and signup flow',
    'saas-product',
    'modern',
    'hero-focused',
    '{"primary": "#3B82F6", "secondary": "#10B981", "accent": "#8B5CF6", "background": "#FFFFFF", "text": "#1E293B"}',
    ARRAY['hero', 'features', 'pricing', 'testimonials', 'cta', 'responsive'],
    ARRAY['header', 'hero', 'features', 'pricing', 'testimonials', 'cta', 'footer'],
    ARRAY['saas', 'software', 'app', 'platform', 'startup', 'product', 'pricing'],
    '<!-- FULL HTML IN SUPABASE -->',
    'For ANY software/app product. AI fills: business_name, features, pricing tiers, testimonials.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 4: LOCAL BUSINESS
-- Works for: Restaurants, salons, gyms, auto shops, dental, any local service
-- STATUS: COMPLETE IN SUPABASE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Local Pro',
    'local-pro-business',
    'Professional local business template with services, hours, location map, and contact form',
    'local-business',
    'professional',
    'multi-section',
    '{"primary": "#1E40AF", "secondary": "#F59E0B", "accent": "#10B981", "background": "#FFFFFF", "text": "#1F2937"}',
    ARRAY['services', 'hours', 'map', 'contact', 'testimonials', 'responsive'],
    ARRAY['header', 'hero', 'services', 'about', 'hours', 'testimonials', 'contact', 'footer'],
    ARRAY['local', 'business', 'restaurant', 'salon', 'gym', 'service', 'location'],
    '<!-- FULL HTML IN SUPABASE -->',
    'For ANY local business. AI fills: business_name, services, hours, location, contact info.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 5: PORTFOLIO CREATIVE
-- Works for: Artists, designers, photographers, creatives, agencies
-- STATUS: COMPLETE IN SUPABASE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Creative Folio',
    'creative-folio-portfolio',
    'Stunning creative portfolio with project showcase, about section, and contact',
    'portfolio-creative',
    'creative',
    'grid-based',
    '{"primary": "#000000", "secondary": "#FFFFFF", "accent": "#FF3366", "background": "#0A0A0A", "text": "#FFFFFF"}',
    ARRAY['portfolio', 'gallery', 'projects', 'about', 'contact', 'responsive'],
    ARRAY['header', 'hero', 'portfolio', 'about', 'services', 'contact', 'footer'],
    ARRAY['portfolio', 'creative', 'designer', 'artist', 'photographer', 'agency'],
    '<!-- FULL HTML IN SUPABASE -->',
    'For ANY creative professional. AI fills: name, projects, skills, about, contact.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 6: AGENCY
-- Works for: Marketing agencies, dev shops, consulting firms, creative studios
-- STATUS: COMPLETE IN SUPABASE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Agency Pro',
    'agency-pro-studio',
    'Professional agency template with services, case studies, team, and contact',
    'agency',
    'professional',
    'multi-section',
    '{"primary": "#0F172A", "secondary": "#3B82F6", "accent": "#F59E0B", "background": "#FFFFFF", "text": "#1E293B"}',
    ARRAY['services', 'case-studies', 'team', 'clients', 'contact', 'responsive'],
    ARRAY['header', 'hero', 'services', 'work', 'about', 'team', 'contact', 'footer'],
    ARRAY['agency', 'studio', 'marketing', 'consulting', 'development', 'creative'],
    '<!-- FULL HTML IN SUPABASE -->',
    'For ANY agency/studio. AI fills: agency_name, services, case studies, team members.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 7: PROFESSIONAL SERVICES
-- Works for: Lawyers, accountants, consultants, coaches, therapists
-- STATUS: COMPLETE IN SUPABASE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Professional Edge',
    'professional-edge-services',
    'Elegant professional services template with expertise, testimonials, and booking',
    'professional-services',
    'elegant',
    'multi-section',
    '{"primary": "#1E3A5F", "secondary": "#C5A572", "accent": "#2E7D32", "background": "#FAFAFA", "text": "#1A1A1A"}',
    ARRAY['services', 'expertise', 'testimonials', 'booking', 'credentials', 'responsive'],
    ARRAY['header', 'hero', 'services', 'about', 'credentials', 'testimonials', 'booking', 'footer'],
    ARRAY['professional', 'lawyer', 'accountant', 'consultant', 'coach', 'therapist'],
    '<!-- FULL HTML IN SUPABASE -->',
    'For ANY professional. AI fills: name, services, credentials, testimonials, booking info.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 8: ECOMMERCE MINIMAL
-- Works for: Boutique shops, artisan products, small catalogs, curated collections
-- STATUS: COMPLETE IN SUPABASE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Minimal Shop',
    'minimal-shop-ecommerce',
    'Clean, minimal e-commerce template for boutique and curated product collections',
    'ecommerce-minimal',
    'minimal',
    'grid-based',
    '{"primary": "#1A1A1A", "secondary": "#F5F5F5", "accent": "#000000", "background": "#FFFFFF", "text": "#1A1A1A"}',
    ARRAY['products', 'cart', 'minimal-design', 'responsive'],
    ARRAY['header', 'hero', 'products', 'about', 'footer'],
    ARRAY['shop', 'boutique', 'minimal', 'artisan', 'curated', 'clean'],
    '<!-- FULL HTML IN SUPABASE -->',
    'Clean minimal shop for boutiques, artisans, curated collections. AI fills: business_name, products, prices, about story.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 9: AI/TECH
-- Works for: AI startups, tech companies, SaaS, developer tools, APIs, ML platforms
-- STATUS: COMPLETE IN SUPABASE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Neural Tech',
    'neural-tech-ai',
    'Futuristic AI/tech template with animated gradients, code aesthetics, and modern tech feel',
    'ai-tech',
    'modern',
    'hero-focused',
    '{"primary": "#00D4FF", "secondary": "#7C3AED", "accent": "#10B981", "background": "#030712", "text": "#F9FAFB"}',
    ARRAY['hero', 'features', 'code-display', 'pricing', 'responsive'],
    ARRAY['header', 'hero', 'features', 'how-it-works', 'pricing', 'cta', 'footer'],
    ARRAY['ai', 'tech', 'startup', 'api', 'developer', 'ml', 'saas', 'futuristic'],
    '<!-- FULL HTML IN SUPABASE -->',
    'Futuristic AI/tech template for startups, APIs, ML platforms. AI fills: business_name, features, code examples, pricing.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 10: RESTAURANT/FOOD
-- Works for: Restaurants, cafes, bakeries, food trucks, bars, catering, pizzerias
-- STATUS: READY TO PASTE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Flavor House',
    'flavor-house-restaurant',
    'Appetizing restaurant template with menu, reservations, gallery, and location',
    'restaurant-food',
    'warm',
    'multi-section',
    '{"primary": "#B91C1C", "secondary": "#FEF3C7", "accent": "#166534", "background": "#FFFBEB", "text": "#1C1917"}',
    ARRAY['menu', 'reservations', 'gallery', 'hours', 'location', 'responsive'],
    ARRAY['header', 'hero', 'about', 'menu', 'gallery', 'reservations', 'location', 'footer'],
    ARRAY['restaurant', 'cafe', 'bakery', 'food', 'dining', 'menu', 'reservations'],
    '<!-- PASTE FULL HTML HERE -->',
    'For ANY food business. AI fills: restaurant_name, menu items, prices, hours, location, reservation info.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 11: HEALTH/WELLNESS
-- Works for: Gyms, yoga studios, spas, wellness centers, fitness trainers, meditation
-- STATUS: READY TO PASTE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Vitality Hub',
    'vitality-hub-wellness',
    'Energizing health and wellness template with classes, trainers, membership, and booking',
    'health-wellness',
    'fresh',
    'multi-section',
    '{"primary": "#059669", "secondary": "#ECFDF5", "accent": "#7C3AED", "background": "#FFFFFF", "text": "#1F2937"}',
    ARRAY['classes', 'trainers', 'membership', 'booking', 'testimonials', 'responsive'],
    ARRAY['header', 'hero', 'about', 'classes', 'trainers', 'membership', 'testimonials', 'booking', 'footer'],
    ARRAY['gym', 'fitness', 'yoga', 'spa', 'wellness', 'health', 'trainer'],
    '<!-- PASTE FULL HTML HERE -->',
    'For ANY wellness business. AI fills: business_name, classes, trainers, membership tiers, booking.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 12: PORTFOLIO MINIMAL
-- Works for: Developers, designers, writers, minimal personal portfolios
-- STATUS: READY TO PASTE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Clean Folio',
    'clean-folio-minimal',
    'Ultra-minimal portfolio with clean typography, project list, and simple contact',
    'portfolio-minimal',
    'minimal',
    'single-column',
    '{"primary": "#171717", "secondary": "#FAFAFA", "accent": "#3B82F6", "background": "#FFFFFF", "text": "#171717"}',
    ARRAY['projects', 'about', 'contact', 'minimal', 'responsive'],
    ARRAY['header', 'hero', 'projects', 'about', 'contact', 'footer'],
    ARRAY['portfolio', 'developer', 'designer', 'minimal', 'clean', 'simple'],
    '<!-- PASTE FULL HTML HERE -->',
    'Ultra-minimal portfolio. AI fills: name, title, projects, skills, contact, social links.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 13: BLOG/MAGAZINE
-- Works for: Blogs, news sites, online magazines, content creators, publications
-- STATUS: READY TO PASTE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Ink Press',
    'ink-press-blog',
    'Editorial blog/magazine template with featured posts, categories, and newsletter',
    'blog-magazine',
    'editorial',
    'grid-based',
    '{"primary": "#0F172A", "secondary": "#F1F5F9", "accent": "#DC2626", "background": "#FFFFFF", "text": "#1E293B"}',
    ARRAY['posts', 'categories', 'featured', 'newsletter', 'search', 'responsive'],
    ARRAY['header', 'featured', 'posts', 'categories', 'newsletter', 'footer'],
    ARRAY['blog', 'magazine', 'news', 'publication', 'content', 'articles'],
    '<!-- PASTE FULL HTML HERE -->',
    'For ANY blog/publication. AI fills: site_name, featured posts, categories, newsletter CTA.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 14: PERSONAL BRAND
-- Works for: Influencers, speakers, thought leaders, authors, coaches
-- STATUS: READY TO PASTE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Personal Pro',
    'personal-pro-brand',
    'Bold personal brand template with bio, offerings, media features, and booking',
    'personal-brand',
    'bold',
    'hero-focused',
    '{"primary": "#7C3AED", "secondary": "#FDE68A", "accent": "#EC4899", "background": "#0F0F0F", "text": "#FFFFFF"}',
    ARRAY['bio', 'offerings', 'media', 'testimonials', 'booking', 'responsive'],
    ARRAY['header', 'hero', 'about', 'offerings', 'media', 'testimonials', 'booking', 'footer'],
    ARRAY['personal', 'influencer', 'speaker', 'author', 'coach', 'brand'],
    '<!-- PASTE FULL HTML HERE -->',
    'For ANY personal brand. AI fills: name, bio, offerings, media features, testimonials, booking.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 15: EVENT/CONFERENCE
-- Works for: Conferences, meetups, webinars, workshops, summits, festivals
-- STATUS: READY TO PASTE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Summit Stage',
    'summit-stage-event',
    'Dynamic event template with schedule, speakers, tickets, and sponsors',
    'event-conference',
    'dynamic',
    'multi-section',
    '{"primary": "#4F46E5", "secondary": "#FCD34D", "accent": "#10B981", "background": "#030712", "text": "#F9FAFB"}',
    ARRAY['schedule', 'speakers', 'tickets', 'sponsors', 'venue', 'responsive'],
    ARRAY['header', 'hero', 'about', 'speakers', 'schedule', 'tickets', 'sponsors', 'venue', 'footer'],
    ARRAY['event', 'conference', 'summit', 'meetup', 'webinar', 'workshop'],
    '<!-- PASTE FULL HTML HERE -->',
    'For ANY event. AI fills: event_name, date, speakers, schedule, ticket tiers, sponsors, venue.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 16: WEDDING/CELEBRATION
-- Works for: Weddings, engagements, anniversaries, birthdays, celebrations
-- STATUS: READY TO PASTE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Forever Yours',
    'forever-yours-wedding',
    'Elegant wedding/celebration template with story, details, RSVP, and gallery',
    'wedding-celebration',
    'elegant',
    'single-column',
    '{"primary": "#BE185D", "secondary": "#FDF2F8", "accent": "#A16207", "background": "#FFFBEB", "text": "#1C1917"}',
    ARRAY['story', 'details', 'rsvp', 'gallery', 'registry', 'responsive'],
    ARRAY['header', 'hero', 'story', 'details', 'gallery', 'rsvp', 'registry', 'footer'],
    ARRAY['wedding', 'celebration', 'engagement', 'party', 'anniversary', 'event'],
    '<!-- PASTE FULL HTML HERE -->',
    'For ANY celebration. AI fills: couple_names, date, venue, story, event details, RSVP, registry.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 17: REAL ESTATE
-- Works for: Property listings, real estate agents, brokers, property management
-- STATUS: READY TO PASTE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Prime Property',
    'prime-property-realestate',
    'Professional real estate template with listings, agent bio, and contact',
    'real-estate',
    'professional',
    'grid-based',
    '{"primary": "#1E3A5F", "secondary": "#F0FDF4", "accent": "#B45309", "background": "#FFFFFF", "text": "#1F2937"}',
    ARRAY['listings', 'search', 'agent-bio', 'testimonials', 'contact', 'responsive'],
    ARRAY['header', 'hero', 'featured-listings', 'search', 'about', 'testimonials', 'contact', 'footer'],
    ARRAY['realestate', 'property', 'listings', 'agent', 'broker', 'homes'],
    '<!-- PASTE FULL HTML HERE -->',
    'For ANY real estate. AI fills: agent_name, listings, property details, testimonials, contact.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 18: EDUCATION/COURSE
-- Works for: Online courses, tutorials, coaching, e-learning, bootcamps
-- STATUS: READY TO PASTE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Learn Pro',
    'learn-pro-education',
    'Engaging education template with curriculum, instructor, pricing, and enrollment',
    'education-course',
    'friendly',
    'multi-section',
    '{"primary": "#2563EB", "secondary": "#FEF3C7", "accent": "#16A34A", "background": "#FFFFFF", "text": "#1E293B"}',
    ARRAY['curriculum', 'instructor', 'pricing', 'testimonials', 'enrollment', 'responsive'],
    ARRAY['header', 'hero', 'benefits', 'curriculum', 'instructor', 'pricing', 'testimonials', 'faq', 'footer'],
    ARRAY['education', 'course', 'learning', 'tutorial', 'bootcamp', 'coaching'],
    '<!-- PASTE FULL HTML HERE -->',
    'For ANY course/education. AI fills: course_name, curriculum, instructor, pricing, testimonials.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 19: NONPROFIT/CHARITY
-- Works for: Nonprofits, charities, causes, foundations, NGOs, social impact
-- STATUS: READY TO PASTE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Impact Heart',
    'impact-heart-nonprofit',
    'Inspiring nonprofit template with mission, impact stats, programs, and donations',
    'nonprofit-charity',
    'inspiring',
    'multi-section',
    '{"primary": "#0891B2", "secondary": "#ECFEFF", "accent": "#EA580C", "background": "#FFFFFF", "text": "#1E293B"}',
    ARRAY['mission', 'impact', 'programs', 'donate', 'volunteer', 'responsive'],
    ARRAY['header', 'hero', 'mission', 'impact', 'programs', 'stories', 'donate', 'volunteer', 'footer'],
    ARRAY['nonprofit', 'charity', 'cause', 'foundation', 'ngo', 'donate'],
    '<!-- PASTE FULL HTML HERE -->',
    'For ANY nonprofit. AI fills: org_name, mission, impact stats, programs, donation tiers.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 20: COMING SOON
-- Works for: Product launches, waitlists, pre-launch, teasers, countdowns
-- STATUS: READY TO PASTE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Launch Hype',
    'launch-hype-coming',
    'High-impact coming soon page with countdown, email capture, and social links',
    'coming-soon',
    'dramatic',
    'hero-focused',
    '{"primary": "#F59E0B", "secondary": "#1E1B4B", "accent": "#EC4899", "background": "#0F0F0F", "text": "#FFFFFF"}',
    ARRAY['countdown', 'email-capture', 'social', 'teaser', 'responsive'],
    ARRAY['hero', 'countdown', 'email', 'social', 'footer'],
    ARRAY['coming-soon', 'launch', 'waitlist', 'teaser', 'countdown', 'pre-launch'],
    '<!-- PASTE FULL HTML HERE -->',
    'For ANY launch. AI fills: product_name, launch_date, teaser text, email capture, social links.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 21: APP DOWNLOAD
-- Works for: Mobile apps, iOS/Android apps, app landing pages
-- STATUS: READY TO PASTE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'App Showcase',
    'app-showcase-download',
    'Sleek app landing page with features, screenshots, reviews, and download buttons',
    'app-download',
    'sleek',
    'hero-focused',
    '{"primary": "#6366F1", "secondary": "#F0F9FF", "accent": "#10B981", "background": "#FFFFFF", "text": "#1E293B"}',
    ARRAY['features', 'screenshots', 'reviews', 'download-buttons', 'responsive'],
    ARRAY['header', 'hero', 'features', 'screenshots', 'reviews', 'download', 'footer'],
    ARRAY['app', 'mobile', 'ios', 'android', 'download', 'showcase'],
    '<!-- PASTE FULL HTML HERE -->',
    'For ANY app. AI fills: app_name, features, screenshots, reviews, app store links.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATE 22: MEMBERSHIP/COMMUNITY
-- Works for: Membership sites, communities, clubs, subscriptions, fan clubs
-- STATUS: READY TO PASTE
-- ============================================
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Inner Circle',
    'inner-circle-membership',
    'Exclusive membership template with tiers, benefits, community highlights, and signup',
    'membership-community',
    'exclusive',
    'multi-section',
    '{"primary": "#7C3AED", "secondary": "#FDF4FF", "accent": "#F59E0B", "background": "#0F0F0F", "text": "#FFFFFF"}',
    ARRAY['tiers', 'benefits', 'community', 'testimonials', 'signup', 'responsive'],
    ARRAY['header', 'hero', 'benefits', 'tiers', 'community', 'testimonials', 'faq', 'signup', 'footer'],
    ARRAY['membership', 'community', 'subscription', 'club', 'exclusive', 'members'],
    '<!-- PASTE FULL HTML HERE -->',
    'For ANY membership. AI fills: community_name, membership tiers, benefits, testimonials.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- FORGE MEGA TEMPLATE SYSTEM v2.0 - COMPLETE
-- 22 Flexible Categories Ready
-- ============================================
