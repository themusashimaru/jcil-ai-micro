'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Check, BookOpen, Heart, Newspaper, Mic, Shield, Sparkles, Zap, Clock, Users, Search, Brain, CheckCircle, Globe, Mail, Send, X, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();

  // Contact form state
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    category: 'general',
    subject: '',
    message: '',
  });
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState('');

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactLoading(true);
    setContactError('');

    try {
      const response = await fetch('/api/contact/external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send message');
      }

      setContactSuccess(true);
      setContactForm({
        name: '',
        email: '',
        phone: '',
        company: '',
        category: 'general',
        subject: '',
        message: '',
      });

      setTimeout(() => {
        setShowContactDialog(false);
        setContactSuccess(false);
      }, 3000);
    } catch (error: any) {
      setContactError(error.message);
    } finally {
      setContactLoading(false);
    }
  };

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
      model: 'Slingshot 2.0',
      poweredBy: 'Powered by XAI',
      features: [
        'Basic chat access',
        'Conversation memory',
        'Daily devotionals',
        'Bible search & study',
        'Scripture tools for all',
      ],
      cta: 'Start Free',
      paymentLink: null, // Free tier - go to signup
      showFreeTrial: false,
      popular: false,
    },
    {
      name: 'Basic',
      price: '$12',
      period: '/month',
      model: 'Slingshot 2.0',
      poweredBy: 'Powered by XAI',
      features: [
        'Everything in Free',
        'Real-time web search',
        'Tools up to Bachelor\'s level',
        'Voice-to-text',
        'Prayer journal',
        'News analysis',
      ],
      cta: 'Get Basic - 14 Days Free',
      paymentLink: 'https://buy.stripe.com/5kQaEW4Ouadpcoe7gC0gw00',
      showFreeTrial: true,
      popular: false,
    },
    {
      name: 'Pro',
      price: '$30',
      period: '/month',
      model: 'Slingshot 2.0',
      poweredBy: 'Powered by XAI',
      features: [
        'Everything in Basic',
        'Master\'s & PhD level tools',
        'Cascading AI models',
        'Advanced research writing',
        'Fact-checking (Perplexity)',
        'Priority support',
      ],
      cta: 'Get Pro - 14 Days Free',
      paymentLink: 'https://buy.stripe.com/9B63cu4Ou4T5dsiasO0gw01',
      showFreeTrial: true,
      popular: true,
    },
    {
      name: 'Executive',
      price: '$150',
      period: '/month',
      model: 'Slingshot 2.0',
      poweredBy: 'Powered by XAI',
      features: [
        'Everything in Pro',
        'Most powerful AI available',
        'Custom feature requests',
        'Premium exports',
        'VIP support & training',
        'Early access to new tools',
      ],
      cta: 'Get Executive - 14 Days Free',
      paymentLink: 'https://buy.stripe.com/7sYfZg4OufxJdsieJ40gw02',
      showFreeTrial: true,
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
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200 pb-2">
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
              Built by JCIL.ai
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
                <span className="text-red-600"> Misaligned Ideology?</span>
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

      {/* Academic Integrity & Guardrails Section */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-5xl font-bold text-slate-900 mb-4">
              We Don't Just Deliver Answers -<br />We Help You Course Correct
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Built-in guardrails to promote genuine learning, academic integrity, and pastoral responsibility
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Students */}
            <Card className="p-8 bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 hover:shadow-xl transition-all">
              <div className="text-blue-600 mb-4">
                <BookOpen className="h-12 w-12" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">For Students</h3>
              <p className="text-slate-600 mb-4">
                We detect academic shortcuts and redirect you toward genuine learning. Instead of just giving answers, we:
              </p>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Guide you through problem-solving processes</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Encourage diligent work and critical thinking</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Detect plagiarism attempts and redirect to study</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Promote intellectual growth over shortcuts</span>
                </li>
              </ul>
            </Card>

            {/* Pastors */}
            <Card className="p-8 bg-gradient-to-br from-yellow-50 to-white border-2 border-yellow-400 hover:shadow-xl transition-all">
              <div className="text-yellow-600 mb-4">
                <Heart className="h-12 w-12" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">For Pastors</h3>
              <p className="text-slate-600 mb-4">
                We respect the sacred calling of sermon preparation. We won't write your sermon, but we'll help you prepare:
              </p>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Outline sermon structure and flow</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Provide relevant Scripture references</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Explain historical and cultural context</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Honor Holy Spirit-led preparation process</span>
                </li>
              </ul>
            </Card>

            {/* Teachers */}
            <Card className="p-8 bg-gradient-to-br from-green-50 to-white border-2 border-green-200 hover:shadow-xl transition-all">
              <div className="text-green-600 mb-4">
                <Users className="h-12 w-12" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">For Teachers</h3>
              <p className="text-slate-600 mb-4">
                Want your students using AI? Choose us - we're designed with academic integrity at our core:
              </p>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Detects and redirects shortcut attempts</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Encourages original thinking and research</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Serves as a study partner, not a cheat tool</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Promotes genuine learning outcomes</span>
                </li>
              </ul>
            </Card>
          </div>

          <div className="mt-12 text-center">
            <div className="inline-block bg-blue-100 border-2 border-blue-300 rounded-xl p-6 max-w-3xl">
              <p className="text-lg text-blue-900 font-semibold">
                "Other AI tools enable cheating. We actively prevent it. That's the difference."
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <div className="mt-12 text-center">
            <Button
              onClick={() => router.push('/signup')}
              size="lg"
              className="bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-950 hover:to-blue-900 text-white font-bold text-xl px-12 py-8 rounded-2xl shadow-2xl hover:shadow-blue-900/50 transition-all duration-300 hover:scale-105"
            >
              Experience the Chat Now - FREE
              <Zap className="ml-3 h-6 w-6" />
            </Button>
            <p className="mt-4 text-sm text-slate-500">No credit card required • 10 free messages daily</p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 sm:py-24 bg-slate-50">
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
                  {tier.showFreeTrial && (
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full">
                        <Zap className="h-3 w-3" />
                        14 Days Free Trial
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-center mb-2">
                    <span className="text-4xl font-black text-blue-900">{tier.price}</span>
                    <span className="text-slate-600 ml-1">{tier.period}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 mt-2">{tier.model}</p>
                  <p className="text-xs text-slate-500">{tier.poweredBy}</p>
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
                  onClick={() => {
                    if (tier.paymentLink) {
                      window.location.href = tier.paymentLink;
                    } else {
                      router.push('/signup');
                    }
                  }}
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
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold text-lg mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/terms" className="hover:text-white transition">Terms of Service</a></li>
                <li><a href="/privacy" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="/cookies" className="hover:text-white transition">Cookie Policy</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-4">Contact Us</h3>
              <p className="text-sm mb-3">
                <a href="mailto:info@jcil.ai" className="hover:text-white transition">info@jcil.ai</a>
              </p>
              <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Contact JCIL.AI
                    </DialogTitle>
                    <DialogDescription>
                      Have questions? We'd love to hear from you. Fill out the form below and we'll get back to you soon.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleContactSubmit} className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Name *</label>
                        <Input
                          type="text"
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          placeholder="John Doe"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Email *</label>
                        <Input
                          type="email"
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          placeholder="john@example.com"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Phone</label>
                        <Input
                          type="tel"
                          value={contactForm.phone}
                          onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Company</label>
                        <Input
                          type="text"
                          value={contactForm.company}
                          onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                          placeholder="Company Name"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Inquiry Type *</label>
                      <Select value={contactForm.category} onValueChange={(value) => setContactForm({ ...contactForm, category: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General Inquiry</SelectItem>
                          <SelectItem value="membership">Membership Plan Inquiry</SelectItem>
                          <SelectItem value="payment">Payment Inquiry</SelectItem>
                          <SelectItem value="technical">Technical Support</SelectItem>
                          <SelectItem value="business">Business Solutions</SelectItem>
                          <SelectItem value="influencer">Influencer Partnership</SelectItem>
                          <SelectItem value="partnership">Partnership Opportunity</SelectItem>
                          <SelectItem value="media">Media Inquiry</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Subject *</label>
                      <Input
                        type="text"
                        value={contactForm.subject}
                        onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                        placeholder="Brief description of your inquiry"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Message *</label>
                      <Textarea
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        placeholder="Tell us more about your inquiry..."
                        rows={5}
                        required
                      />
                    </div>

                    {contactSuccess && (
                      <div className="p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <p className="text-sm text-green-700">
                          Message sent successfully! We'll get back to you soon.
                        </p>
                      </div>
                    )}

                    {contactError && (
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                        <p className="text-sm text-red-600">{contactError}</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowContactDialog(false)}
                        className="flex-1"
                        disabled={contactLoading}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={contactLoading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        {contactLoading ? (
                          <>Sending...</>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send Message
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-4">About</h3>
              <p className="text-sm">
                JCIL.AI Slingshot 2.0 - A powerful AI assistant built for Christians, by Christians. Grounded in Scripture, guided by truth.
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
