-- ============================================
-- FORGE & MUSASHI: Professional Website Templates
-- Each template is production-ready, mobile-first
-- Makes Arnold look like he never lifted
-- ============================================

-- Modern Restaurant Template
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Savory Modern',
    'savory-modern-restaurant',
    'Elegant modern restaurant template with hero image, menu showcase, and reservation CTA',
    'restaurant',
    'modern',
    'hero-focused',
    '{"primary": "#D4A373", "secondary": "#FAEDCD", "accent": "#E63946", "background": "#FEFAE0", "text": "#283618"}',
    ARRAY['hero', 'menu', 'about', 'testimonials', 'reservation', 'contact'],
    ARRAY['hero', 'features', 'menu', 'about', 'testimonials', 'cta', 'footer'],
    ARRAY['restaurant', 'food', 'dining', 'elegant', 'modern'],
    '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{business_name}} - Fine Dining Experience</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: ''Lato'', sans-serif; background: #FEFAE0; color: #283618; }
        h1, h2, h3 { font-family: ''Playfair Display'', serif; }

        /* Hero Section */
        .hero {
            min-height: 100vh;
            background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(''{{hero_url}}'') center/cover;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            color: white;
            padding: 2rem;
        }
        .hero img.logo { height: 80px; margin-bottom: 2rem; }
        .hero h1 { font-size: clamp(2.5rem, 8vw, 5rem); margin-bottom: 1rem; }
        .hero p { font-size: 1.25rem; max-width: 600px; margin-bottom: 2rem; opacity: 0.9; }
        .btn {
            display: inline-block;
            padding: 1rem 2.5rem;
            background: #D4A373;
            color: white;
            text-decoration: none;
            font-weight: 600;
            border-radius: 4px;
            transition: transform 0.3s, box-shadow 0.3s;
        }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }

        /* Navigation */
        nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 100;
            background: rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
        }
        nav a { color: white; text-decoration: none; margin-left: 2rem; font-weight: 500; }
        nav a:hover { color: #D4A373; }

        /* Sections */
        section { padding: 5rem 2rem; max-width: 1200px; margin: 0 auto; }
        .section-title { text-align: center; margin-bottom: 3rem; }
        .section-title h2 { font-size: 2.5rem; color: #283618; margin-bottom: 0.5rem; }
        .section-title p { color: #606C38; }

        /* Menu Grid */
        .menu-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
        }
        .menu-item {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .menu-item img { width: 100%; height: 200px; object-fit: cover; }
        .menu-item-content { padding: 1.5rem; }
        .menu-item h3 { margin-bottom: 0.5rem; }
        .menu-item .price { color: #D4A373; font-weight: 600; font-size: 1.25rem; }

        /* About */
        .about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; }
        .about-grid img { width: 100%; border-radius: 12px; }
        @media (max-width: 768px) { .about-grid { grid-template-columns: 1fr; } }

        /* Testimonials */
        .testimonials { background: #283618; color: white; padding: 5rem 2rem; }
        .testimonial-card { background: rgba(255,255,255,0.1); padding: 2rem; border-radius: 12px; margin: 1rem; }

        /* Footer */
        footer {
            background: #283618;
            color: white;
            padding: 3rem 2rem;
            text-align: center;
        }
        footer a { color: #D4A373; }

        /* Mobile */
        @media (max-width: 768px) {
            nav { flex-direction: column; gap: 1rem; }
            .hero h1 { font-size: 2rem; }
        }
    </style>
</head>
<body>
    <nav>
        <span style="font-family: ''Playfair Display''; font-size: 1.5rem;">{{business_name}}</span>
        <div>
            <a href="#menu">Menu</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
            <a href="#reserve" class="btn" style="padding: 0.5rem 1rem;">Reserve</a>
        </div>
    </nav>

    <section class="hero">
        <h1>{{business_name}}</h1>
        <p>{{tagline}}</p>
        <a href="#reserve" class="btn">Make a Reservation</a>
    </section>

    <section id="menu">
        <div class="section-title">
            <h2>Our Menu</h2>
            <p>Crafted with passion, served with love</p>
        </div>
        <div class="menu-grid">
            <div class="menu-item">
                <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400" alt="Dish">
                <div class="menu-item-content">
                    <h3>Signature Dish</h3>
                    <p>Fresh ingredients, bold flavors</p>
                    <span class="price">$28</span>
                </div>
            </div>
            <div class="menu-item">
                <img src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400" alt="Dish">
                <div class="menu-item-content">
                    <h3>Chef''s Special</h3>
                    <p>Daily rotating masterpiece</p>
                    <span class="price">$34</span>
                </div>
            </div>
            <div class="menu-item">
                <img src="https://images.unsplash.com/photo-1482049016gy67f3e13?w=400" alt="Dish">
                <div class="menu-item-content">
                    <h3>Seasonal Delight</h3>
                    <p>Farm-to-table freshness</p>
                    <span class="price">$26</span>
                </div>
            </div>
        </div>
    </section>

    <section id="about" style="background: #FAEDCD;">
        <div class="about-grid" style="max-width: 1200px; margin: 0 auto;">
            <img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600" alt="Restaurant Interior">
            <div>
                <h2 style="margin-bottom: 1rem;">Our Story</h2>
                <p style="line-height: 1.8; margin-bottom: 1rem;">{{description}}</p>
                <p style="line-height: 1.8;">Every dish tells a story of tradition, innovation, and love for great food.</p>
            </div>
        </div>
    </section>

    <section id="reserve" style="text-align: center; background: #D4A373; color: white;">
        <h2 style="margin-bottom: 1rem;">Reserve Your Table</h2>
        <p style="margin-bottom: 2rem;">Experience culinary excellence</p>
        <a href="tel:{{phone}}" class="btn" style="background: white; color: #283618;">Call {{phone}}</a>
    </section>

    <footer id="contact">
        <h3 style="margin-bottom: 1rem;">{{business_name}}</h3>
        <p>{{address}}</p>
        <p>{{phone}} | {{email}}</p>
        <p style="margin-top: 2rem; opacity: 0.7;">&copy; 2024 {{business_name}}. All rights reserved.</p>
    </footer>
</body>
</html>',
    'Replace {{business_name}} with the restaurant name. Replace {{tagline}} with a short catchy phrase. Replace {{hero_url}} with the generated hero image.'
) ON CONFLICT (slug) DO NOTHING;

-- Modern SaaS Landing Page
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'LaunchPad Pro',
    'launchpad-pro-saas',
    'High-converting SaaS landing page with gradient hero, features grid, pricing, and testimonials',
    'saas',
    'modern',
    'hero-focused',
    '{"primary": "#6366F1", "secondary": "#8B5CF6", "accent": "#EC4899", "background": "#0F172A", "text": "#F8FAFC"}',
    ARRAY['hero', 'features', 'pricing', 'testimonials', 'faq', 'cta'],
    ARRAY['hero', 'logos', 'features', 'how-it-works', 'pricing', 'testimonials', 'cta', 'footer'],
    ARRAY['saas', 'startup', 'tech', 'app', 'software', 'dark'],
    '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{business_name}} - {{tagline}}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: ''Inter'', sans-serif; background: #0F172A; color: #F8FAFC; line-height: 1.6; }

        /* Gradient Text */
        .gradient-text {
            background: linear-gradient(135deg, #6366F1, #8B5CF6, #EC4899);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        /* Navigation */
        nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 100;
            background: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .logo { font-weight: 800; font-size: 1.5rem; }
        nav a { color: #94A3B8; text-decoration: none; margin-left: 2rem; transition: color 0.3s; }
        nav a:hover { color: white; }

        /* Buttons */
        .btn {
            display: inline-block;
            padding: 0.875rem 2rem;
            border-radius: 8px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.3s;
        }
        .btn-primary {
            background: linear-gradient(135deg, #6366F1, #8B5CF6);
            color: white;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 20px 40px rgba(99, 102, 241, 0.3); }
        .btn-secondary { border: 1px solid #475569; color: white; }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); }

        /* Hero */
        .hero {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 8rem 2rem 4rem;
            position: relative;
            overflow: hidden;
        }
        .hero::before {
            content: "";
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle at 30% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
                        radial-gradient(circle at 70% 70%, rgba(139, 92, 246, 0.1) 0%, transparent 50%);
            animation: rotate 30s linear infinite;
        }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .hero-content { position: relative; z-index: 1; max-width: 900px; }
        .hero h1 { font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 800; margin-bottom: 1.5rem; }
        .hero p { font-size: 1.25rem; color: #94A3B8; max-width: 600px; margin: 0 auto 2rem; }
        .hero-buttons { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

        /* Features */
        section { padding: 6rem 2rem; max-width: 1200px; margin: 0 auto; }
        .section-header { text-align: center; margin-bottom: 4rem; }
        .section-header h2 { font-size: 2.5rem; margin-bottom: 1rem; }
        .section-header p { color: #94A3B8; max-width: 600px; margin: 0 auto; }

        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
        }
        .feature-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 2rem;
            transition: all 0.3s;
        }
        .feature-card:hover {
            background: rgba(255,255,255,0.05);
            border-color: rgba(99, 102, 241, 0.5);
            transform: translateY(-4px);
        }
        .feature-icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #6366F1, #8B5CF6);
            border-radius: 12px;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
        }
        .feature-card h3 { margin-bottom: 0.5rem; }
        .feature-card p { color: #94A3B8; font-size: 0.95rem; }

        /* Pricing */
        .pricing-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            max-width: 1000px;
            margin: 0 auto;
        }
        .pricing-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            padding: 2.5rem;
            text-align: center;
        }
        .pricing-card.featured {
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2));
            border-color: #6366F1;
            transform: scale(1.05);
        }
        .pricing-card h3 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .price { font-size: 3rem; font-weight: 800; margin: 1rem 0; }
        .price span { font-size: 1rem; color: #94A3B8; }
        .pricing-features { list-style: none; margin: 2rem 0; text-align: left; }
        .pricing-features li { padding: 0.75rem 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .pricing-features li::before { content: "✓"; color: #10B981; margin-right: 0.5rem; }

        /* CTA */
        .cta {
            background: linear-gradient(135deg, #6366F1, #8B5CF6);
            border-radius: 24px;
            padding: 4rem 2rem;
            text-align: center;
            margin: 4rem auto;
            max-width: 900px;
        }
        .cta h2 { font-size: 2rem; margin-bottom: 1rem; }
        .cta p { margin-bottom: 2rem; opacity: 0.9; }

        /* Footer */
        footer {
            border-top: 1px solid rgba(255,255,255,0.1);
            padding: 3rem 2rem;
            text-align: center;
            color: #64748B;
        }

        @media (max-width: 768px) {
            nav { flex-direction: column; gap: 1rem; padding: 1rem; }
            .pricing-card.featured { transform: scale(1); }
        }
    </style>
</head>
<body>
    <nav>
        <span class="logo gradient-text">{{business_name}}</span>
        <div>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#" class="btn btn-primary" style="padding: 0.5rem 1.5rem; margin-left: 1rem;">Get Started</a>
        </div>
    </nav>

    <section class="hero">
        <div class="hero-content">
            <h1>{{tagline}}</h1>
            <p>{{description}}</p>
            <div class="hero-buttons">
                <a href="#" class="btn btn-primary">Start Free Trial</a>
                <a href="#" class="btn btn-secondary">Watch Demo →</a>
            </div>
        </div>
    </section>

    <section id="features">
        <div class="section-header">
            <h2>Everything you need to <span class="gradient-text">scale</span></h2>
            <p>Powerful features to help you manage, grow, and succeed</p>
        </div>
        <div class="features-grid">
            <div class="feature-card">
                <div class="feature-icon">⚡</div>
                <h3>Lightning Fast</h3>
                <p>Built for speed with cutting-edge technology that keeps you ahead of the competition.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🔒</div>
                <h3>Enterprise Security</h3>
                <p>Bank-grade encryption and security protocols to keep your data safe.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">📊</div>
                <h3>Advanced Analytics</h3>
                <p>Deep insights and real-time metrics to make data-driven decisions.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🔄</div>
                <h3>Seamless Integration</h3>
                <p>Connect with 100+ tools you already use. No coding required.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🎯</div>
                <h3>AI-Powered</h3>
                <p>Smart automation that learns and adapts to your workflow.</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">💬</div>
                <h3>24/7 Support</h3>
                <p>Our team is always here to help you succeed, around the clock.</p>
            </div>
        </div>
    </section>

    <section id="pricing">
        <div class="section-header">
            <h2>Simple, transparent <span class="gradient-text">pricing</span></h2>
            <p>No hidden fees. No surprises. Cancel anytime.</p>
        </div>
        <div class="pricing-grid">
            <div class="pricing-card">
                <h3>Starter</h3>
                <p style="color: #94A3B8;">For individuals</p>
                <div class="price">$19<span>/mo</span></div>
                <ul class="pricing-features">
                    <li>Up to 5 projects</li>
                    <li>Basic analytics</li>
                    <li>Email support</li>
                    <li>API access</li>
                </ul>
                <a href="#" class="btn btn-secondary" style="width: 100%;">Get Started</a>
            </div>
            <div class="pricing-card featured">
                <h3>Pro</h3>
                <p style="color: #94A3B8;">For growing teams</p>
                <div class="price">$49<span>/mo</span></div>
                <ul class="pricing-features">
                    <li>Unlimited projects</li>
                    <li>Advanced analytics</li>
                    <li>Priority support</li>
                    <li>API access</li>
                    <li>Custom integrations</li>
                </ul>
                <a href="#" class="btn btn-primary" style="width: 100%;">Start Free Trial</a>
            </div>
            <div class="pricing-card">
                <h3>Enterprise</h3>
                <p style="color: #94A3B8;">For large organizations</p>
                <div class="price">Custom</div>
                <ul class="pricing-features">
                    <li>Everything in Pro</li>
                    <li>Dedicated support</li>
                    <li>Custom contracts</li>
                    <li>SLA guarantee</li>
                    <li>On-premise option</li>
                </ul>
                <a href="#" class="btn btn-secondary" style="width: 100%;">Contact Sales</a>
            </div>
        </div>
    </section>

    <div class="cta">
        <h2>Ready to get started?</h2>
        <p>Join thousands of companies already using {{business_name}}</p>
        <a href="#" class="btn" style="background: white; color: #6366F1;">Start Your Free Trial</a>
    </div>

    <footer>
        <p>&copy; 2024 {{business_name}}. All rights reserved.</p>
        <p style="margin-top: 0.5rem;">{{email}}</p>
    </footer>
</body>
</html>',
    'Replace {{business_name}} with the SaaS product name. Replace {{tagline}} with the main value proposition.'
) ON CONFLICT (slug) DO NOTHING;

-- Auto Detailing Template
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'Shine Pro',
    'shine-pro-detailing',
    'Premium auto detailing landing page with service packages, gallery, and booking CTA',
    'auto-detailing',
    'bold',
    'hero-focused',
    '{"primary": "#DC2626", "secondary": "#1F2937", "accent": "#FBBF24", "background": "#111827", "text": "#F9FAFB"}',
    ARRAY['hero', 'services', 'gallery', 'pricing', 'booking', 'contact'],
    ARRAY['hero', 'services', 'gallery', 'pricing', 'testimonials', 'cta', 'footer'],
    ARRAY['auto', 'detailing', 'car', 'wash', 'ceramic', 'coating'],
    '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{business_name}} - Premium Auto Detailing</title>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: ''Inter'', sans-serif; background: #111827; color: #F9FAFB; }
        h1, h2, h3 { font-family: ''Bebas Neue'', sans-serif; letter-spacing: 2px; }

        nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 100;
            background: rgba(17, 24, 39, 0.95);
        }
        .logo { font-family: ''Bebas Neue''; font-size: 2rem; color: #DC2626; }
        nav a { color: #9CA3AF; text-decoration: none; margin-left: 2rem; }
        nav a:hover { color: white; }

        .btn {
            display: inline-block;
            padding: 1rem 2rem;
            background: #DC2626;
            color: white;
            text-decoration: none;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            transition: all 0.3s;
        }
        .btn:hover { background: #B91C1C; transform: translateY(-2px); }

        .hero {
            min-height: 100vh;
            background: linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url(''{{hero_url}}'') center/cover;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 2rem;
        }
        .hero-content { max-width: 800px; }
        .hero h1 { font-size: clamp(3rem, 10vw, 6rem); line-height: 1; margin-bottom: 1rem; }
        .hero .highlight { color: #DC2626; }
        .hero p { font-size: 1.25rem; color: #9CA3AF; margin-bottom: 2rem; max-width: 500px; }

        section { padding: 5rem 2rem; max-width: 1200px; margin: 0 auto; }
        .section-title { text-align: center; margin-bottom: 3rem; }
        .section-title h2 { font-size: 3rem; }
        .section-title span { color: #DC2626; }

        .services-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
        }
        .service-card {
            background: #1F2937;
            border-radius: 8px;
            overflow: hidden;
            transition: transform 0.3s;
        }
        .service-card:hover { transform: translateY(-8px); }
        .service-card img { width: 100%; height: 200px; object-fit: cover; }
        .service-content { padding: 1.5rem; }
        .service-content h3 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .service-content .price { color: #DC2626; font-size: 1.5rem; font-weight: 700; }

        .cta-section {
            background: linear-gradient(135deg, #DC2626, #B91C1C);
            padding: 4rem 2rem;
            text-align: center;
            margin: 4rem 0;
            border-radius: 16px;
        }
        .cta-section h2 { font-size: 3rem; margin-bottom: 1rem; }
        .cta-section .btn { background: white; color: #DC2626; }

        footer {
            background: #0F172A;
            padding: 3rem 2rem;
            text-align: center;
        }

        @media (max-width: 768px) {
            nav { flex-direction: column; gap: 1rem; }
            .hero h1 { font-size: 3rem; }
        }
    </style>
</head>
<body>
    <nav>
        <span class="logo">{{business_name}}</span>
        <div>
            <a href="#services">Services</a>
            <a href="#pricing">Pricing</a>
            <a href="#contact">Contact</a>
            <a href="tel:{{phone}}" class="btn" style="padding: 0.5rem 1rem; margin-left: 1rem;">Call Now</a>
        </div>
    </nav>

    <section class="hero">
        <div class="hero-content">
            <h1>PREMIUM <span class="highlight">DETAIL</span> FOR YOUR RIDE</h1>
            <p>{{tagline}}</p>
            <a href="#services" class="btn">View Services</a>
        </div>
    </section>

    <section id="services">
        <div class="section-title">
            <h2>OUR <span>SERVICES</span></h2>
        </div>
        <div class="services-grid">
            <div class="service-card">
                <img src="https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=400" alt="Exterior Detail">
                <div class="service-content">
                    <h3>EXTERIOR DETAIL</h3>
                    <p style="color: #9CA3AF; margin-bottom: 1rem;">Complete exterior wash, clay bar, polish, and wax protection.</p>
                    <span class="price">From $149</span>
                </div>
            </div>
            <div class="service-card">
                <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400" alt="Interior Detail">
                <div class="service-content">
                    <h3>INTERIOR DETAIL</h3>
                    <p style="color: #9CA3AF; margin-bottom: 1rem;">Deep clean, leather conditioning, and odor elimination.</p>
                    <span class="price">From $129</span>
                </div>
            </div>
            <div class="service-card">
                <img src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400" alt="Ceramic Coating">
                <div class="service-content">
                    <h3>CERAMIC COATING</h3>
                    <p style="color: #9CA3AF; margin-bottom: 1rem;">Ultimate protection with multi-year ceramic coating.</p>
                    <span class="price">From $599</span>
                </div>
            </div>
        </div>
    </section>

    <div class="cta-section" style="max-width: 1200px; margin: 4rem auto;">
        <h2>READY TO SHINE?</h2>
        <p style="margin-bottom: 2rem; opacity: 0.9;">Book your appointment today and experience the difference.</p>
        <a href="tel:{{phone}}" class="btn">Call {{phone}}</a>
    </div>

    <footer id="contact">
        <h3 style="font-size: 2rem; margin-bottom: 1rem;">{{business_name}}</h3>
        <p style="color: #9CA3AF;">{{address}}</p>
        <p style="color: #9CA3AF;">{{phone}} | {{email}}</p>
        <p style="margin-top: 2rem; color: #6B7280;">&copy; 2024 {{business_name}}. All rights reserved.</p>
    </footer>
</body>
</html>',
    'Replace {{business_name}} with business name. Great for auto detailing, car wash, ceramic coating businesses.'
) ON CONFLICT (slug) DO NOTHING;

-- Portfolio/Developer Template
INSERT INTO website_templates (
    name, slug, description, category, style, layout,
    color_scheme, features, sections, tags,
    html_template, customization_hints
) VALUES (
    'DevFolio Dark',
    'devfolio-dark-portfolio',
    'Modern dark developer portfolio with animated gradient, project showcase, and contact form',
    'developer',
    'dark',
    'single-page',
    '{"primary": "#10B981", "secondary": "#3B82F6", "accent": "#F59E0B", "background": "#0A0A0A", "text": "#FAFAFA"}',
    ARRAY['hero', 'about', 'skills', 'projects', 'contact'],
    ARRAY['hero', 'about', 'skills', 'projects', 'experience', 'contact'],
    ARRAY['developer', 'portfolio', 'programmer', 'coder', 'dark', 'minimal'],
    '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{business_name}} - Developer Portfolio</title>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: ''Inter'', sans-serif; background: #0A0A0A; color: #FAFAFA; }
        code, .mono { font-family: ''JetBrains Mono'', monospace; }

        .gradient-text {
            background: linear-gradient(135deg, #10B981, #3B82F6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            padding: 1.5rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 100;
            background: rgba(10, 10, 10, 0.8);
            backdrop-filter: blur(10px);
        }
        .logo { font-family: ''JetBrains Mono''; font-weight: 700; }
        nav a { color: #A1A1AA; text-decoration: none; margin-left: 2rem; transition: color 0.3s; }
        nav a:hover { color: #10B981; }

        .hero {
            min-height: 100vh;
            display: flex;
            align-items: center;
            padding: 6rem 2rem;
            max-width: 1200px;
            margin: 0 auto;
        }
        .hero-content { max-width: 700px; }
        .hero .greeting { color: #10B981; font-family: ''JetBrains Mono''; margin-bottom: 1rem; }
        .hero h1 { font-size: clamp(2.5rem, 6vw, 4rem); margin-bottom: 1rem; }
        .hero p { font-size: 1.25rem; color: #A1A1AA; line-height: 1.7; margin-bottom: 2rem; }
        .hero-links a {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            border: 1px solid #27272A;
            color: #FAFAFA;
            text-decoration: none;
            margin-right: 1rem;
            margin-bottom: 1rem;
            transition: all 0.3s;
        }
        .hero-links a:hover { border-color: #10B981; background: rgba(16, 185, 129, 0.1); }

        section { padding: 6rem 2rem; max-width: 1200px; margin: 0 auto; }
        .section-title { margin-bottom: 3rem; }
        .section-title span { color: #10B981; font-family: ''JetBrains Mono''; }
        .section-title h2 { font-size: 2rem; margin-top: 0.5rem; }

        .projects-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 2rem;
        }
        .project-card {
            background: #18181B;
            border: 1px solid #27272A;
            border-radius: 12px;
            overflow: hidden;
            transition: all 0.3s;
        }
        .project-card:hover { border-color: #10B981; transform: translateY(-4px); }
        .project-card img { width: 100%; height: 200px; object-fit: cover; }
        .project-content { padding: 1.5rem; }
        .project-content h3 { margin-bottom: 0.5rem; }
        .project-content p { color: #A1A1AA; font-size: 0.95rem; margin-bottom: 1rem; }
        .project-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .project-tags span {
            background: #27272A;
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-size: 0.8rem;
            font-family: ''JetBrains Mono'';
            color: #10B981;
        }

        .skills-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }
        .skill-item {
            background: #18181B;
            border: 1px solid #27272A;
            padding: 1rem;
            border-radius: 8px;
            font-family: ''JetBrains Mono'';
            text-align: center;
        }

        .contact-section {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1));
            border: 1px solid #27272A;
            border-radius: 16px;
            padding: 3rem;
            text-align: center;
        }
        .contact-section a {
            display: inline-block;
            padding: 1rem 2rem;
            background: #10B981;
            color: #0A0A0A;
            text-decoration: none;
            font-weight: 600;
            border-radius: 8px;
            margin-top: 1rem;
        }

        footer { padding: 3rem 2rem; text-align: center; color: #52525B; }

        @media (max-width: 768px) {
            nav { flex-direction: column; gap: 1rem; }
        }
    </style>
</head>
<body>
    <nav>
        <span class="logo">&lt;{{business_name}} /&gt;</span>
        <div>
            <a href="#about">About</a>
            <a href="#projects">Projects</a>
            <a href="#contact">Contact</a>
        </div>
    </nav>

    <section class="hero">
        <div class="hero-content">
            <p class="greeting">Hi, my name is</p>
            <h1>{{business_name}}.</h1>
            <h1 style="color: #A1A1AA;">I build things for the web.</h1>
            <p>{{description}}</p>
            <div class="hero-links">
                <a href="#projects">View My Work</a>
                <a href="#contact">Get In Touch</a>
            </div>
        </div>
    </section>

    <section id="about">
        <div class="section-title">
            <span>01.</span>
            <h2>About Me</h2>
        </div>
        <p style="max-width: 600px; color: #A1A1AA; line-height: 1.8;">
            {{description}}
        </p>
    </section>

    <section id="skills">
        <div class="section-title">
            <span>02.</span>
            <h2>Skills & Technologies</h2>
        </div>
        <div class="skills-grid">
            <div class="skill-item">JavaScript</div>
            <div class="skill-item">TypeScript</div>
            <div class="skill-item">React</div>
            <div class="skill-item">Next.js</div>
            <div class="skill-item">Node.js</div>
            <div class="skill-item">Python</div>
            <div class="skill-item">PostgreSQL</div>
            <div class="skill-item">AWS</div>
        </div>
    </section>

    <section id="projects">
        <div class="section-title">
            <span>03.</span>
            <h2>Featured Projects</h2>
        </div>
        <div class="projects-grid">
            <div class="project-card">
                <img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400" alt="Project">
                <div class="project-content">
                    <h3>Project Alpha</h3>
                    <p>A full-stack web application built with modern technologies.</p>
                    <div class="project-tags">
                        <span>React</span>
                        <span>Node.js</span>
                        <span>PostgreSQL</span>
                    </div>
                </div>
            </div>
            <div class="project-card">
                <img src="https://images.unsplash.com/photo-1551650975-87deedd944c3?w=400" alt="Project">
                <div class="project-content">
                    <h3>Project Beta</h3>
                    <p>Mobile-first responsive design with seamless UX.</p>
                    <div class="project-tags">
                        <span>Next.js</span>
                        <span>Tailwind</span>
                        <span>Vercel</span>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section id="contact">
        <div class="contact-section">
            <span style="color: #10B981; font-family: ''JetBrains Mono'';">04. What''s Next?</span>
            <h2 style="font-size: 2.5rem; margin: 1rem 0;">Get In Touch</h2>
            <p style="color: #A1A1AA; max-width: 500px; margin: 0 auto;">
                I''m currently open to new opportunities. Whether you have a question or just want to say hi, I''ll do my best to get back to you!
            </p>
            <a href="mailto:{{email}}">Say Hello</a>
        </div>
    </section>

    <footer>
        <p>Designed & Built by {{business_name}}</p>
        <p style="margin-top: 0.5rem;">{{email}}</p>
    </footer>
</body>
</html>',
    'Perfect for developers, programmers, and tech freelancers. Replace {{business_name}} with your name.'
) ON CONFLICT (slug) DO NOTHING;

-- Set all templates as active
UPDATE website_templates SET is_active = true WHERE is_active IS NULL;
