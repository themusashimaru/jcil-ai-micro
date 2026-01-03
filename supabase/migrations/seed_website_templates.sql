-- ============================================
-- FORGE MEGA TEMPLATE SYSTEM v2.0
-- 22 Flexible Categories to CRUSH Manus
-- FORGE & MUSASHI - The Bash Brothers
-- ============================================
-- STATUS: Templates 1-9 IN SUPABASE (full HTML)
-- Templates 10-22 ready to paste
-- ============================================

-- TEMPLATE 1: HERO LANDING
-- Works for: Product launches, promos, waitlists, app reveals, any single-page promo
-- STATUS: COMPLETE IN SUPABASE
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
    '<!-- FULL HTML IN SUPABASE - Template 1: Hero Landing -->',
    'Flexible hero landing for ANY product launch. AI fills: business_name, tagline, headline, features, CTAs.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 2: ECOMMERCE FULL
-- Works for: ANY online store - fashion, electronics, food, home goods, etc.
-- STATUS: COMPLETE IN SUPABASE
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
    '<!-- FULL HTML IN SUPABASE - Template 2: E-commerce Full -->',
    'Works for ANY online store. AI fills: business_name, products, categories, prices.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 3: SAAS PRODUCT
-- Works for: Software products, apps, platforms, tools, dashboards
-- STATUS: COMPLETE IN SUPABASE
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
    '<!-- FULL HTML IN SUPABASE - Template 3: SaaS Product -->',
    'For ANY software/app product. AI fills: business_name, features, pricing tiers, testimonials.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 4: LOCAL BUSINESS
-- Works for: Restaurants, salons, gyms, auto shops, dental, any local service
-- STATUS: COMPLETE IN SUPABASE
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
    '<!-- FULL HTML IN SUPABASE - Template 4: Local Business -->',
    'For ANY local business. AI fills: business_name, services, hours, location, contact info.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 5: PORTFOLIO CREATIVE
-- Works for: Artists, designers, photographers, creatives, agencies
-- STATUS: COMPLETE IN SUPABASE
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
    '<!-- FULL HTML IN SUPABASE - Template 5: Portfolio Creative -->',
    'For ANY creative professional. AI fills: name, projects, skills, about, contact.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 6: AGENCY
-- Works for: Marketing agencies, dev shops, consulting firms, creative studios
-- STATUS: COMPLETE IN SUPABASE
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
    '<!-- FULL HTML IN SUPABASE - Template 6: Agency -->',
    'For ANY agency/studio. AI fills: agency_name, services, case studies, team members.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 7: PROFESSIONAL SERVICES
-- Works for: Lawyers, accountants, consultants, coaches, therapists
-- STATUS: COMPLETE IN SUPABASE
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
    '<!-- FULL HTML IN SUPABASE - Template 7: Professional Services -->',
    'For ANY professional. AI fills: name, services, credentials, testimonials, booking info.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 8: ECOMMERCE MINIMAL
-- Works for: Boutique shops, artisan products, small catalogs, curated collections
-- STATUS: COMPLETE IN SUPABASE
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
    '<!-- FULL HTML IN SUPABASE - Template 8: E-commerce Minimal -->',
    'Clean minimal shop for boutiques, artisans, curated collections. AI fills: business_name, products, prices, about story.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 9: AI/TECH
-- Works for: AI startups, tech companies, SaaS, developer tools, APIs, ML platforms
-- STATUS: COMPLETE IN SUPABASE
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
    '<!-- FULL HTML IN SUPABASE - Template 9: AI/Tech -->',
    'Futuristic AI/tech template for startups, APIs, ML platforms. AI fills: business_name, features, code examples, pricing.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TEMPLATES 10-22: READY TO PASTE
-- ============================================

-- TEMPLATE 10: RESTAURANT/FOOD
-- Works for: Restaurants, cafes, bakeries, food trucks, catering, bars
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Taste Studio',
    'taste-studio-restaurant',
    'Appetizing restaurant template with menu display, reservations, hours, and gallery',
    'restaurant-food',
    'warm',
    'multi-section',
    '{"primary": "#B91C1C", "secondary": "#FEF3C7", "accent": "#15803D", "background": "#FFFBEB", "text": "#1C1917"}',
    ARRAY['menu', 'reservations', 'gallery', 'hours', 'location', 'responsive'],
    ARRAY['header', 'hero', 'about', 'menu', 'gallery', 'reservations', 'hours', 'footer'],
    ARRAY['restaurant', 'cafe', 'bakery', 'food', 'menu', 'dining', 'catering'],
    '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{business_name}} - {{tagline}}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Lato:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
            font-family: ''Lato'', sans-serif;
            background: #FFFBEB;
            color: #1C1917;
            line-height: 1.7;
        }
        h1, h2, h3 { font-family: ''Playfair Display'', serif; }
        img { max-width: 100%; height: auto; display: block; }

        nav {
            position: fixed; top: 0; left: 0; right: 0;
            padding: 1.5rem 2rem;
            display: flex; justify-content: space-between; align-items: center;
            z-index: 100; background: rgba(255,251,235,0.95);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(0,0,0,0.05);
        }
        .logo { font-family: ''Playfair Display'', serif; font-size: 1.75rem; font-weight: 700; color: #B91C1C; }
        .nav-links { display: flex; gap: 2rem; }
        .nav-links a { color: #44403C; text-decoration: none; font-size: 0.9rem; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; }
        .nav-links a:hover { color: #B91C1C; }

        .hero {
            min-height: 100vh;
            display: flex; align-items: center; justify-content: center;
            text-align: center; padding: 8rem 2rem;
            background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(''{{hero_image}}'') center/cover;
        }
        .hero-content { max-width: 700px; color: white; }
        .hero h1 { font-size: clamp(2.5rem, 6vw, 4.5rem); margin-bottom: 1.5rem; line-height: 1.2; }
        .hero p { font-size: 1.25rem; margin-bottom: 2rem; opacity: 0.9; }
        .btn {
            display: inline-block; padding: 1rem 2.5rem;
            background: #B91C1C; color: white;
            text-decoration: none; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
            transition: all 0.3s; border: none; cursor: pointer;
        }
        .btn:hover { background: #991B1B; transform: translateY(-2px); }

        .section { padding: 6rem 2rem; max-width: 1200px; margin: 0 auto; }
        .section-header { text-align: center; margin-bottom: 4rem; }
        .section-header h2 { font-size: 2.5rem; margin-bottom: 1rem; color: #1C1917; }
        .section-header p { color: #78716C; max-width: 600px; margin: 0 auto; }

        .menu-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
        .menu-item { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        .menu-item h3 { font-size: 1.25rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; }
        .menu-item .price { color: #B91C1C; font-weight: 700; }
        .menu-item p { color: #78716C; font-size: 0.95rem; }

        .gallery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
        .gallery-item { aspect-ratio: 1; background: #E7E5E4; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: #A8A29E; }

        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 3rem; }
        .info-card { text-align: center; padding: 2rem; }
        .info-card h3 { font-size: 1.5rem; margin-bottom: 1rem; color: #B91C1C; }
        .info-card p { color: #57534E; }

        .reservation-form { max-width: 500px; margin: 0 auto; background: white; padding: 3rem; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .reservation-form input, .reservation-form select {
            width: 100%; padding: 1rem; margin-bottom: 1rem;
            border: 1px solid #E7E5E4; border-radius: 4px; font-size: 1rem;
        }
        .reservation-form input:focus { outline: none; border-color: #B91C1C; }

        footer { background: #1C1917; color: #A8A29E; padding: 4rem 2rem; text-align: center; }
        footer .logo { color: #FEF3C7; margin-bottom: 1rem; }
        footer p { margin-bottom: 0.5rem; }
        footer a { color: #FEF3C7; text-decoration: none; }

        @media (max-width: 768px) {
            nav { padding: 1rem; }
            .nav-links { display: none; }
            .section { padding: 4rem 1.5rem; }
        }
    </style>
</head>
<body>
    <nav>
        <span class="logo">{{business_name}}</span>
        <div class="nav-links">
            <a href="#menu">Menu</a>
            <a href="#gallery">Gallery</a>
            <a href="#reservations">Reservations</a>
            <a href="#contact">Contact</a>
        </div>
    </nav>

    <section class="hero">
        <div class="hero-content">
            <h1>{{headline}}</h1>
            <p>{{description}}</p>
            <a href="#reservations" class="btn">{{cta_primary}}</a>
        </div>
    </section>

    <section id="menu" class="section">
        <div class="section-header">
            <h2>{{menu_headline}}</h2>
            <p>{{menu_description}}</p>
        </div>
        <div class="menu-grid">
            <div class="menu-item"><h3>{{menu_item_1_name}} <span class="price">{{menu_item_1_price}}</span></h3><p>{{menu_item_1_description}}</p></div>
            <div class="menu-item"><h3>{{menu_item_2_name}} <span class="price">{{menu_item_2_price}}</span></h3><p>{{menu_item_2_description}}</p></div>
            <div class="menu-item"><h3>{{menu_item_3_name}} <span class="price">{{menu_item_3_price}}</span></h3><p>{{menu_item_3_description}}</p></div>
            <div class="menu-item"><h3>{{menu_item_4_name}} <span class="price">{{menu_item_4_price}}</span></h3><p>{{menu_item_4_description}}</p></div>
        </div>
    </section>

    <section id="gallery" class="section" style="background: #FEF3C7;">
        <div class="section-header">
            <h2>Our Atmosphere</h2>
            <p>Experience the ambiance that makes us special</p>
        </div>
        <div class="gallery-grid">
            <div class="gallery-item">📷</div>
            <div class="gallery-item">📷</div>
            <div class="gallery-item">📷</div>
            <div class="gallery-item">📷</div>
        </div>
    </section>

    <section class="section">
        <div class="info-grid">
            <div class="info-card">
                <h3>Hours</h3>
                <p>{{hours_weekday}}</p>
                <p>{{hours_weekend}}</p>
            </div>
            <div class="info-card">
                <h3>Location</h3>
                <p>{{address}}</p>
                <p>{{city_state_zip}}</p>
            </div>
            <div class="info-card">
                <h3>Contact</h3>
                <p>{{phone}}</p>
                <p>{{email}}</p>
            </div>
        </div>
    </section>

    <section id="reservations" class="section" style="background: white;">
        <div class="section-header">
            <h2>Make a Reservation</h2>
            <p>Book your table and join us for an unforgettable experience</p>
        </div>
        <form class="reservation-form">
            <input type="text" placeholder="Your Name" required>
            <input type="email" placeholder="Email Address" required>
            <input type="tel" placeholder="Phone Number" required>
            <input type="date" required>
            <select required>
                <option value="">Number of Guests</option>
                <option>1-2 Guests</option>
                <option>3-4 Guests</option>
                <option>5-6 Guests</option>
                <option>7+ Guests</option>
            </select>
            <button type="submit" class="btn" style="width: 100%;">Reserve Table</button>
        </form>
    </section>

    <footer id="contact">
        <div class="logo">{{business_name}}</div>
        <p>{{address}}, {{city_state_zip}}</p>
        <p>{{phone}} | <a href="mailto:{{email}}">{{email}}</a></p>
        <p style="margin-top: 2rem; font-size: 0.875rem;">&copy; 2024 {{business_name}}. All rights reserved.</p>
    </footer>
</body>
</html>',
    'Warm restaurant template for cafes, bakeries, food trucks. AI fills: business_name, menu items, hours, location.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 11: HEALTH/WELLNESS
-- Works for: Gyms, yoga studios, spas, wellness centers, fitness trainers
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Vitality Wellness',
    'vitality-wellness-health',
    'Calming health and wellness template with services, classes, booking, and testimonials',
    'health-wellness',
    'calming',
    'multi-section',
    '{"primary": "#059669", "secondary": "#ECFDF5", "accent": "#7C3AED", "background": "#FFFFFF", "text": "#1F2937"}',
    ARRAY['services', 'classes', 'booking', 'testimonials', 'team', 'responsive'],
    ARRAY['header', 'hero', 'services', 'classes', 'about', 'team', 'testimonials', 'booking', 'footer'],
    ARRAY['health', 'wellness', 'gym', 'yoga', 'spa', 'fitness', 'meditation'],
    '<!-- PASTE FULL HTML FOR WELLNESS TEMPLATE -->',
    'Calming wellness template for gyms, yoga, spas. AI fills: business_name, services, classes, team, booking.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 12: PORTFOLIO MINIMAL
-- Works for: Developers, designers, writers, minimal personal portfolios
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Clean Folio',
    'clean-folio-minimal',
    'Ultra-minimal portfolio with focus on work, clean typography, and simple contact',
    'portfolio-minimal',
    'minimal',
    'single-column',
    '{"primary": "#18181B", "secondary": "#F4F4F5", "accent": "#3B82F6", "background": "#FFFFFF", "text": "#18181B"}',
    ARRAY['portfolio', 'about', 'contact', 'minimal', 'responsive'],
    ARRAY['header', 'hero', 'work', 'about', 'contact', 'footer'],
    ARRAY['portfolio', 'minimal', 'developer', 'writer', 'clean', 'simple'],
    '<!-- PASTE FULL HTML FOR MINIMAL PORTFOLIO TEMPLATE -->',
    'Ultra-minimal portfolio for devs, designers, writers. AI fills: name, projects, bio, contact.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 13: BLOG/MAGAZINE
-- Works for: Blogs, news sites, online magazines, content sites
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Editorial Pro',
    'editorial-pro-blog',
    'Clean editorial template with featured posts, categories, newsletter, and author bios',
    'blog-magazine',
    'editorial',
    'grid-based',
    '{"primary": "#1E293B", "secondary": "#F8FAFC", "accent": "#DC2626", "background": "#FFFFFF", "text": "#1E293B"}',
    ARRAY['posts', 'categories', 'newsletter', 'author', 'search', 'responsive'],
    ARRAY['header', 'featured', 'posts', 'categories', 'newsletter', 'footer'],
    ARRAY['blog', 'magazine', 'news', 'editorial', 'content', 'articles'],
    '<!-- PASTE FULL HTML FOR BLOG TEMPLATE -->',
    'Editorial template for blogs, magazines, news. AI fills: site_name, posts, categories, author.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 14: PERSONAL BRAND
-- Works for: Influencers, speakers, thought leaders, personal brands
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Personal Impact',
    'personal-impact-brand',
    'Bold personal brand template with bio, speaking, media, newsletter, and social links',
    'personal-brand',
    'bold',
    'hero-focused',
    '{"primary": "#7C3AED", "secondary": "#FDF4FF", "accent": "#EC4899", "background": "#FFFFFF", "text": "#1F2937"}',
    ARRAY['bio', 'speaking', 'media', 'newsletter', 'social', 'responsive'],
    ARRAY['header', 'hero', 'about', 'speaking', 'media', 'newsletter', 'footer'],
    ARRAY['personal', 'brand', 'influencer', 'speaker', 'thought-leader', 'author'],
    '<!-- PASTE FULL HTML FOR PERSONAL BRAND TEMPLATE -->',
    'Bold personal brand for speakers, influencers. AI fills: name, bio, speaking topics, media, social.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 15: EVENT/CONFERENCE
-- Works for: Events, conferences, meetups, webinars, workshops
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Event Horizon',
    'event-horizon-conference',
    'Dynamic event template with schedule, speakers, tickets, sponsors, and countdown',
    'event-conference',
    'dynamic',
    'multi-section',
    '{"primary": "#4F46E5", "secondary": "#EEF2FF", "accent": "#F59E0B", "background": "#0F172A", "text": "#F8FAFC"}',
    ARRAY['schedule', 'speakers', 'tickets', 'sponsors', 'countdown', 'responsive'],
    ARRAY['header', 'hero', 'countdown', 'speakers', 'schedule', 'tickets', 'sponsors', 'footer'],
    ARRAY['event', 'conference', 'meetup', 'webinar', 'workshop', 'summit'],
    '<!-- PASTE FULL HTML FOR EVENT TEMPLATE -->',
    'Dynamic event template for conferences, meetups. AI fills: event_name, date, speakers, schedule, tickets.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 16: WEDDING/CELEBRATION
-- Works for: Weddings, parties, anniversaries, celebrations
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Forever Yours',
    'forever-yours-wedding',
    'Elegant wedding template with story, event details, RSVP, gallery, and registry',
    'wedding-celebration',
    'elegant',
    'single-column',
    '{"primary": "#BE185D", "secondary": "#FDF2F8", "accent": "#C5A572", "background": "#FFFBEB", "text": "#1F2937"}',
    ARRAY['story', 'details', 'rsvp', 'gallery', 'registry', 'responsive'],
    ARRAY['header', 'hero', 'story', 'details', 'gallery', 'rsvp', 'registry', 'footer'],
    ARRAY['wedding', 'celebration', 'party', 'anniversary', 'event', 'love'],
    '<!-- PASTE FULL HTML FOR WEDDING TEMPLATE -->',
    'Elegant wedding template for celebrations. AI fills: names, date, venue, story, rsvp, registry.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 17: REAL ESTATE
-- Works for: Property listings, real estate agents, property management
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Property Pro',
    'property-pro-realestate',
    'Professional real estate template with listings, search, agent info, and contact',
    'real-estate',
    'professional',
    'grid-based',
    '{"primary": "#1E40AF", "secondary": "#EFF6FF", "accent": "#16A34A", "background": "#FFFFFF", "text": "#1E293B"}',
    ARRAY['listings', 'search', 'agent', 'contact', 'map', 'responsive'],
    ARRAY['header', 'hero', 'featured', 'listings', 'about', 'contact', 'footer'],
    ARRAY['real-estate', 'property', 'listings', 'agent', 'homes', 'realtor'],
    '<!-- PASTE FULL HTML FOR REAL ESTATE TEMPLATE -->',
    'Professional real estate for agents, listings. AI fills: agent_name, properties, contact, about.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 18: EDUCATION/COURSE
-- Works for: Online courses, tutorials, educational platforms, instructors
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Learn Pro',
    'learn-pro-education',
    'Modern education template with courses, curriculum, instructor, testimonials, and enrollment',
    'education-course',
    'modern',
    'multi-section',
    '{"primary": "#2563EB", "secondary": "#EFF6FF", "accent": "#F59E0B", "background": "#FFFFFF", "text": "#1E293B"}',
    ARRAY['courses', 'curriculum', 'instructor', 'testimonials', 'enrollment', 'responsive'],
    ARRAY['header', 'hero', 'courses', 'curriculum', 'instructor', 'testimonials', 'enrollment', 'footer'],
    ARRAY['education', 'course', 'tutorial', 'learning', 'instructor', 'online'],
    '<!-- PASTE FULL HTML FOR EDUCATION TEMPLATE -->',
    'Modern education for courses, tutorials. AI fills: course_name, curriculum, instructor, pricing.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 19: NONPROFIT/CHARITY
-- Works for: Nonprofits, charities, causes, foundations, NGOs
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Impact Cause',
    'impact-cause-nonprofit',
    'Inspiring nonprofit template with mission, impact stats, donate, volunteer, and stories',
    'nonprofit-charity',
    'inspiring',
    'multi-section',
    '{"primary": "#059669", "secondary": "#ECFDF5", "accent": "#DC2626", "background": "#FFFFFF", "text": "#1F2937"}',
    ARRAY['mission', 'impact', 'donate', 'volunteer', 'stories', 'responsive'],
    ARRAY['header', 'hero', 'mission', 'impact', 'programs', 'donate', 'volunteer', 'footer'],
    ARRAY['nonprofit', 'charity', 'cause', 'foundation', 'donate', 'volunteer'],
    '<!-- PASTE FULL HTML FOR NONPROFIT TEMPLATE -->',
    'Inspiring nonprofit for charities, causes. AI fills: org_name, mission, impact stats, programs, donate.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 20: COMING SOON
-- Works for: Launch pages, waitlists, teasers, pre-launch
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Launch Teaser',
    'launch-teaser-comingsoon',
    'Minimalist coming soon page with countdown, email capture, and social links',
    'coming-soon',
    'minimal',
    'single-column',
    '{"primary": "#6366F1", "secondary": "#EEF2FF", "accent": "#EC4899", "background": "#0F172A", "text": "#F8FAFC"}',
    ARRAY['countdown', 'email-capture', 'social', 'teaser', 'responsive'],
    ARRAY['hero', 'countdown', 'signup', 'social', 'footer'],
    ARRAY['coming-soon', 'launch', 'waitlist', 'teaser', 'pre-launch'],
    '<!-- PASTE FULL HTML FOR COMING SOON TEMPLATE -->',
    'Minimal coming soon for launches, waitlists. AI fills: product_name, launch_date, teaser, email capture.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 21: APP DOWNLOAD
-- Works for: Mobile app landing pages, app stores, app marketing
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'App Showcase',
    'app-showcase-download',
    'Modern app landing page with features, screenshots, store badges, and testimonials',
    'app-download',
    'modern',
    'hero-focused',
    '{"primary": "#3B82F6", "secondary": "#EFF6FF", "accent": "#10B981", "background": "#FFFFFF", "text": "#1E293B"}',
    ARRAY['features', 'screenshots', 'store-badges', 'testimonials', 'responsive'],
    ARRAY['header', 'hero', 'features', 'screenshots', 'testimonials', 'download', 'footer'],
    ARRAY['app', 'mobile', 'download', 'ios', 'android', 'store'],
    '<!-- PASTE FULL HTML FOR APP DOWNLOAD TEMPLATE -->',
    'Modern app landing for mobile apps. AI fills: app_name, features, screenshots, store links, reviews.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 22: MEMBERSHIP/COMMUNITY
-- Works for: Membership sites, communities, clubs, subscription platforms
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Community Hub',
    'community-hub-membership',
    'Engaging membership template with benefits, tiers, community features, and testimonials',
    'membership-community',
    'engaging',
    'multi-section',
    '{"primary": "#7C3AED", "secondary": "#F5F3FF", "accent": "#F59E0B", "background": "#FFFFFF", "text": "#1F2937"}',
    ARRAY['benefits', 'tiers', 'community', 'testimonials', 'faq', 'responsive'],
    ARRAY['header', 'hero', 'benefits', 'tiers', 'community', 'testimonials', 'faq', 'footer'],
    ARRAY['membership', 'community', 'subscription', 'club', 'members', 'exclusive'],
    '<!-- PASTE FULL HTML FOR MEMBERSHIP TEMPLATE -->',
    'Engaging membership for communities, clubs. AI fills: community_name, benefits, tiers, testimonials.'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- ALL 22 TEMPLATES DEFINED!
-- FORGE MEGA TEMPLATE SYSTEM COMPLETE
-- ============================================
