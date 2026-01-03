-- ============================================
-- FORGE MEGA TEMPLATE SYSTEM v2.0
-- 22 Flexible Categories to CRUSH Manus
-- FORGE & MUSASHI - The Bash Brothers
-- ============================================

-- TEMPLATE 1: HERO LANDING
-- Works for: Product launches, promos, waitlists, app reveals, any single-page promo
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
    '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{business_name}} - {{tagline}}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        /* FORGE FLEX SYSTEM */
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
            font-family: ''Inter'', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
            color: #F8FAFC;
            line-height: 1.6;
            overflow-x: hidden;
            min-height: 100vh;
        }
        h1, h2, h3, h4, p, a, span, li { overflow-wrap: break-word; word-wrap: break-word; }
        img, video, iframe { max-width: 100%; height: auto; display: block; }
        input, textarea, button { font-family: inherit; font-size: 16px; }

        .bg-gradient {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background:
                radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 40% 60%, rgba(245, 158, 11, 0.05) 0%, transparent 50%);
            z-index: -1;
        }

        nav {
            position: fixed; top: 0; left: 0; right: 0;
            padding: 1.5rem 2rem;
            display: flex; justify-content: space-between; align-items: center;
            z-index: 100;
            background: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .logo {
            font-weight: 800; font-size: 1.5rem;
            background: linear-gradient(135deg, #6366F1, #EC4899);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        nav a { color: #94A3B8; text-decoration: none; margin-left: 2rem; font-weight: 500; transition: color 0.3s; }
        nav a:hover { color: #F8FAFC; }

        .hero {
            min-height: 100vh;
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            text-align: center;
            padding: 8rem 2rem 4rem;
            max-width: 1000px; margin: 0 auto;
        }
        .badge {
            display: inline-flex; align-items: center; gap: 0.5rem;
            background: rgba(99, 102, 241, 0.1);
            border: 1px solid rgba(99, 102, 241, 0.3);
            padding: 0.5rem 1rem; border-radius: 100px;
            font-size: 0.875rem; color: #A5B4FC; margin-bottom: 2rem;
        }
        .badge::before { content: "✨"; }
        .hero h1 {
            font-size: clamp(2.5rem, 7vw, 5rem); font-weight: 900; line-height: 1.1; margin-bottom: 1.5rem;
            background: linear-gradient(135deg, #F8FAFC 0%, #94A3B8 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .hero .highlight {
            background: linear-gradient(135deg, #6366F1, #EC4899);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .hero p { font-size: 1.25rem; color: #94A3B8; max-width: 600px; margin-bottom: 2.5rem; }

        .cta-group { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; }
        .btn {
            display: inline-flex; align-items: center; gap: 0.5rem;
            padding: 1rem 2rem; border-radius: 12px; font-weight: 600;
            text-decoration: none; transition: all 0.3s ease; cursor: pointer; border: none;
        }
        .btn-primary {
            background: linear-gradient(135deg, #6366F1, #8B5CF6); color: white;
            box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(99, 102, 241, 0.5); }
        .btn-secondary {
            background: rgba(255,255,255,0.05); color: #F8FAFC;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); }

        .social-proof { margin-top: 4rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .avatars { display: flex; }
        .avatars .avatar {
            width: 40px; height: 40px; border-radius: 50%; border: 2px solid #0F172A; margin-left: -10px;
            background: linear-gradient(135deg, #6366F1, #EC4899);
            display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600;
        }
        .avatars .avatar:first-child { margin-left: 0; }
        .social-proof p { font-size: 0.875rem; color: #64748B; margin: 0; }
        .social-proof strong { color: #F8FAFC; }

        .features { padding: 6rem 2rem; max-width: 1200px; margin: 0 auto; }
        .features-header { text-align: center; margin-bottom: 4rem; }
        .features-header h2 { font-size: 2.5rem; font-weight: 800; margin-bottom: 1rem; }
        .features-header p { color: #94A3B8; max-width: 600px; margin: 0 auto; }
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
        .feature-card {
            background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
            border-radius: 20px; padding: 2rem; transition: all 0.3s ease;
        }
        .feature-card:hover {
            background: rgba(255,255,255,0.05); border-color: rgba(99, 102, 241, 0.3);
            transform: translateY(-4px);
        }
        .feature-icon {
            width: 56px; height: 56px;
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(236, 72, 153, 0.2));
            border-radius: 16px; display: flex; align-items: center; justify-content: center;
            font-size: 1.5rem; margin-bottom: 1.5rem;
        }
        .feature-card h3 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.75rem; }
        .feature-card p { color: #94A3B8; font-size: 0.95rem; }

        .cta-section { padding: 6rem 2rem; text-align: center; }
        .cta-box {
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(236, 72, 153, 0.1));
            border: 1px solid rgba(99, 102, 241, 0.2);
            border-radius: 24px; padding: 4rem 2rem; max-width: 800px; margin: 0 auto;
        }
        .cta-box h2 { font-size: 2.5rem; font-weight: 800; margin-bottom: 1rem; }
        .cta-box p { color: #94A3B8; margin-bottom: 2rem; font-size: 1.125rem; }

        .email-form { display: flex; gap: 1rem; max-width: 500px; margin: 0 auto; flex-wrap: wrap; justify-content: center; }
        .email-form input {
            flex: 1; min-width: 250px; padding: 1rem 1.5rem; border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #F8FAFC;
        }
        .email-form input::placeholder { color: #64748B; }
        .email-form input:focus { outline: none; border-color: #6366F1; }

        footer {
            padding: 3rem 2rem; text-align: center;
            border-top: 1px solid rgba(255,255,255,0.05); color: #64748B;
        }
        footer a { color: #94A3B8; text-decoration: none; }
        footer a:hover { color: #F8FAFC; }

        @media (max-width: 768px) {
            nav { padding: 1rem; flex-direction: column; gap: 1rem; }
            .hero { padding: 6rem 1.5rem 3rem; }
            .hero h1 { font-size: 2.25rem; }
            .features, .cta-section { padding: 4rem 1.5rem; }
        }
    </style>
</head>
<body>
    <div class="bg-gradient"></div>
    <nav>
        <span class="logo">{{business_name}}</span>
        <div>
            <a href="#features">Features</a>
            <a href="#cta" class="btn btn-primary" style="padding: 0.5rem 1.5rem; margin-left: 1rem;">Get Started</a>
        </div>
    </nav>
    <section class="hero">
        <div class="badge">{{badge_text}}</div>
        <h1>{{headline}} <span class="highlight">{{headline_highlight}}</span></h1>
        <p>{{description}}</p>
        <div class="cta-group">
            <a href="#cta" class="btn btn-primary">{{cta_primary}} →</a>
            <a href="#features" class="btn btn-secondary">{{cta_secondary}}</a>
        </div>
        <div class="social-proof">
            <div class="avatars">
                <div class="avatar">JD</div><div class="avatar">MK</div><div class="avatar">AS</div><div class="avatar">RW</div><div class="avatar">+</div>
            </div>
            <p><strong>{{social_proof_number}}</strong> {{social_proof_text}}</p>
        </div>
    </section>
    <section id="features" class="features">
        <div class="features-header">
            <h2>{{features_headline}}</h2>
            <p>{{features_subheadline}}</p>
        </div>
        <div class="features-grid">
            <div class="feature-card"><div class="feature-icon">⚡</div><h3>{{feature_1_title}}</h3><p>{{feature_1_description}}</p></div>
            <div class="feature-card"><div class="feature-icon">🎯</div><h3>{{feature_2_title}}</h3><p>{{feature_2_description}}</p></div>
            <div class="feature-card"><div class="feature-icon">🚀</div><h3>{{feature_3_title}}</h3><p>{{feature_3_description}}</p></div>
        </div>
    </section>
    <section id="cta" class="cta-section">
        <div class="cta-box">
            <h2>{{cta_headline}}</h2>
            <p>{{cta_description}}</p>
            <form class="email-form" action="#" method="POST">
                <input type="email" placeholder="Enter your email" required>
                <button type="submit" class="btn btn-primary">{{cta_button}}</button>
            </form>
        </div>
    </section>
    <footer>
        <p>&copy; 2024 {{business_name}}. All rights reserved.</p>
        <p style="margin-top: 0.5rem;"><a href="mailto:{{email}}">{{email}}</a></p>
    </footer>
</body>
</html>',
    'Flexible hero landing for ANY product launch. AI fills: business_name, tagline, headline, features, CTAs.'
) ON CONFLICT (slug) DO NOTHING;

-- TEMPLATE 2: ECOMMERCE FULL
-- Works for: ANY online store - fashion, electronics, food, home goods, etc.
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
    '<!-- ECOMMERCE FULL TEMPLATE - See full HTML in Supabase -->',
    'Works for ANY online store. AI fills: business_name, products, categories, prices.'
) ON CONFLICT (slug) DO NOTHING;

-- MORE TEMPLATES WILL BE ADDED BELOW AS WE BUILD THEM
