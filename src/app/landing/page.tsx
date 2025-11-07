'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, BookOpen, Heart, Newspaper, Mic, Shield, Sparkles, Zap, Clock, Users, Search, Brain, CheckCircle, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();

  const features = [
    {
      icon: <Brain className="h-8 w-8" />,
      title: 'Conversation Memory',
      description: 'Full chat history recall across all conversations. The AI remembers everything you\'ve discussed, building deeper understanding over time.',
    },
    {
      icon: <Search className="h-8 w-8" />,
      title: 'Real-Time Search',
      description: 'Instant access to current events, news, and information. Get up-to-date answers with live web search integrated directly into every conversation. (Pro+)',
    },
    {
      icon: <CheckCircle className="h-8 w-8" />,
      title: 'Fact Checking',
      description: 'Integrated Perplexity fact-checking within every chat. Verify claims, check sources, and get the truth - all in real-time. (Premium+)',
    },
    {
      icon: <BookOpen className="h-8 w-8" />,
      title: 'Deep Bible Research',
      description: 'PhD-level biblical scholarship at your fingertips. Search Scripture, cross-reference verses, and get theological insights.',
    },
    {
      icon: <Mic className="h-8 w-8" />,
      title: 'Voice-to-Text',
      description: 'Speak naturally and get instant transcription. Perfect for prayers, thoughts, or quick questions on the go.',
    },
    {
      icon: <Newspaper className="h-8 w-8" />,
      title: 'News Analysis',
      description: 'Cut through media bias with Biblical perspective. Analyze headlines through the lens of Scripture and conservative values.',
    },
    {
      icon: <Heart className="h-8 w-8" />,
      title: 'Prayer Journal',
      description: 'Track your prayers and see God\'s faithfulness. AI-powered insights show answered prayers and build your testimony.',
    },
    {
      icon: <Sparkles className="h-8 w-8" />,
      title: 'Daily Devotionals',
      description: 'Fresh, Spirit-led devotionals every day. Start your morning with Scripture-based encouragement and Biblical truth.',
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: 'Apologetics Training',
      description: 'Defend your faith confidently. Practice debates, learn logical arguments, and stand firm on Biblical truth.',
    },
  ];

  const pricingTiers = [
    {
      name: 'Free',
      price: '$0',
      period: '/month',
      messages: '10 messages/day',
      model: 'Haiku 4',
      features: [
        'Basic chat access',
        'Conversation memory',
        'Daily devotionals',
        'Bible search & study',
        'Scripture tools for all',
      ],
      cta: 'Start Free',
      popular: false,
    },
    {
      name: 'Pro',
      price: '$12',
      period: '/month',
      messages: 'No daily message cap',
      model: 'Haiku 4.5',
      features: [
        'Everything in Free',
        'Real-time web search',
        'Tools up to Bachelor\'s level',
        'Voice-to-text',
        'Prayer journal',
        'News analysis',
      ],
      cta: 'Get Pro',
      popular: false,
    },
    {
      name: 'Premium',
      price: '$30',
      period: '/month',
      messages: 'No daily message cap',
      model: 'Sonnet 4',
      features: [
        'Everything in Pro',
        'Master\'s & PhD level tools',
        'Cascading AI models',
        'Advanced research writing',
        'Fact-checking (Perplexity)',
        'Priority support',
      ],
      cta: 'Get Premium',
      popular: true,
    },
    {
      name: 'Executive',
      price: '$150',
      period: '/month',
      messages: 'No daily message cap',
      model: 'Sonnet 4+',
      features: [
        'Everything in Premium',
        'Most powerful AI available',
        'Custom feature requests',
        'Premium exports',
        'VIP support & training',
        'Early access to new tools',
      ],
      cta: 'Get Executive',
      popular: false,
    },
  ];

  const trustSignals = [
    { icon: <Shield className="h-6 w-6" />, text: 'No Woke Agenda' },
    { icon: <BookOpen className="h-6 w-6" />, text: 'Scripture-Based' },
    { icon: <Check className="h-6 w-6" />, text: 'Conservative Values' },
    { icon: <Users className="h-6 w-6" />, text: 'Christian Community' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 bg-blue-800/50 backdrop-blur-sm rounded-full border border-blue-700 mb-8">
              <Sparkles className="h-4 w-4 mr-2 text-yellow-400" />
              <span className="text-sm font-medium">Built by Christians, For Christians</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight mb-6">
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200">
                Slingshot 2.0
              </span>
              <span className="text-3xl sm:text-4xl md:text-5xl block mt-2">
                Biblical AI with Real-Time Intelligence
              </span>
            </h1>

            <p className="text-xl sm:text-2xl text-blue-100 mb-4 max-w-3xl mx-auto font-light">
              Your Conservative Christian AI Assistant with real-time search, conversation memory,
              fact-checking, and deep Bible research - all rooted in Scripture and Truth.
            </p>
            <p className="text-lg text-yellow-400 mb-8 font-semibold">
              Powered by JCIL.ai
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Button
                onClick={() => router.push('/signup')}
                size="lg"
                className="bg-yellow-500 hover:bg-yellow-600 text-blue-900 font-bold text-lg px-8 py-6 rounded-xl shadow-2xl hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105"
              >
                Start Free - 10 Messages/Day
                <Zap className="ml-2 h-5 w-5" />
              </Button>
              <Button
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                size="lg"
                variant="outline"
                className="border-2 border-blue-400 text-white hover:bg-blue-800 font-semibold text-lg px-8 py-6 rounded-xl"
              >
                See Pricing
              </Button>
            </div>

            {/* Trust Signals */}
            <div className="flex flex-wrap justify-center gap-6 max-w-2xl mx-auto">
              {trustSignals.map((signal, idx) => (
                <div key={idx} className="flex items-center gap-2 text-blue-200">
                  <div className="text-yellow-400">{signal.icon}</div>
                  <span className="text-sm font-medium">{signal.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
                Tired of AI That Pushes
                <span className="text-red-600"> Woke Ideology?</span>
              </h2>
              <p className="text-lg text-slate-600 mb-6">
                Most AI assistants promote leftist narratives, contradict Scripture, and undermine
                conservative values. You need an AI that stands firm on Biblical truth.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1 bg-red-100 rounded-full">
                    <div className="h-2 w-2 bg-red-600 rounded-full"></div>
                  </div>
                  <p className="text-slate-700">Other AIs: Promote moral relativism and progressive talking points</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1 bg-red-100 rounded-full">
                    <div className="h-2 w-2 bg-red-600 rounded-full"></div>
                  </div>
                  <p className="text-slate-700">Other AIs: Contradict or ignore Biblical teachings</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1 bg-red-100 rounded-full">
                    <div className="h-2 w-2 bg-red-600 rounded-full"></div>
                  </div>
                  <p className="text-slate-700">Other AIs: Can't handle theological questions properly</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-2xl border-2 border-blue-200">
              <h3 className="text-2xl sm:text-3xl font-bold text-blue-900 mb-6">
                Biblical Filtering System
              </h3>
              <p className="text-slate-700 mb-6 font-medium">
                AI is not God - it's a tool. Slingshot 2.0 doesn't replace your pastor, teacher, or counselor.
                It's designed to supplement your spiritual journey while always encouraging you to seek guidance
                from Scripture and local church leadership.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1 bg-blue-600 rounded-full">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-slate-800 font-medium">Proprietary Biblical filtering on every response</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1 bg-blue-600 rounded-full">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-slate-800 font-medium">Real-time search & fact-checking with Perplexity</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1 bg-blue-600 rounded-full">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-slate-800 font-medium">Full conversation memory across all chats</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1 bg-blue-600 rounded-full">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-slate-800 font-medium">Encourages local pastoral and scriptural guidance</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1 bg-blue-600 rounded-full">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-slate-800 font-medium">Conservative values built into every response</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold text-slate-900 mb-4">
              Real-Time Intelligence Meets Biblical Truth
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Live search, conversation memory, fact-checking, and deep Bible research - all in one powerful platform
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <Card key={idx} className="p-6 hover:shadow-xl transition-all duration-300 hover:scale-105 bg-white border-slate-200">
                <div className="text-blue-600 mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold text-slate-900 mb-4">
              Choose Your Plan
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Start free, upgrade anytime. All plans include Biblical grounding and conservative values.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingTiers.map((tier, idx) => (
              <Card
                key={idx}
                className={`p-6 relative ${
                  tier.popular
                    ? 'border-2 border-yellow-500 shadow-2xl scale-105'
                    : 'border border-slate-200'
                } hover:shadow-xl transition-all duration-300`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-blue-900 font-bold text-sm px-4 py-1 rounded-full">
                    MOST POPULAR
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">{tier.name}</h3>
                  <div className="flex items-baseline justify-center mb-2">
                    <span className="text-4xl font-black text-blue-900">{tier.price}</span>
                    <span className="text-slate-600 ml-1">{tier.period}</span>
                  </div>
                  <p className="text-sm font-semibold text-blue-600">{tier.messages}</p>
                  <p className="text-xs text-slate-500 mt-1">{tier.model}</p>
                </div>

                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, featureIdx) => (
                    <li key={featureIdx} className="flex items-start gap-2 text-sm">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => router.push('/signup')}
                  className={`w-full ${
                    tier.popular
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-blue-900 shadow-lg'
                      : 'bg-blue-900 hover:bg-blue-800 text-white'
                  } font-bold py-6 rounded-xl transition-all duration-300 hover:scale-105`}
                >
                  {tier.cta}
                </Button>
              </Card>
            ))}
          </div>

          <p className="text-center text-sm text-slate-500 mt-8">
            All plans include 24/7 access • Cancel anytime • No hidden fees
          </p>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-5xl font-bold mb-6">
            Join Thousands of Christians Using AI for Good
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Start your free account today. No credit card required.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => router.push('/signup')}
              size="lg"
              className="bg-yellow-500 hover:bg-yellow-600 text-blue-900 font-bold text-xl px-10 py-8 rounded-xl shadow-2xl hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105"
            >
              Start Free - No Credit Card
              <Zap className="ml-2 h-6 w-6" />
            </Button>
          </div>

          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-blue-200">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <span>5 min setup</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span>Privacy first</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold text-lg mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/terms" className="hover:text-white transition">Terms of Service</a></li>
                <li><a href="/privacy" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="/cookies" className="hover:text-white transition">Cookie Policy</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-4">Contact</h3>
              <p className="text-sm">
                <a href="mailto:info@jcil.ai" className="hover:text-white transition">info@jcil.ai</a>
              </p>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-sm">
            <p>© {new Date().getFullYear()} Slingshot 2.0 by JCIL.ai. Built for Christians, By Christians.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
