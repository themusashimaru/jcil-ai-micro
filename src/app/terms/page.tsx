'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="page-shell dark:bg-slate-950/50">
      <Card className="w-full max-w-4xl shadow-sm border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur">
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg md:text-xl">Terms of Service for JCIL.AI</CardTitle>
              <CardDescription>Last updated: October 28, 2025</CardDescription>
            </div>
            <Button asChild variant="ghost" size="icon" className="shrink-0">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back to Chat</span>
              </Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="prose prose-sm md:prose dark:prose-invert max-w-none leading-relaxed space-y-4">
          {/* Your entire terms content goes below, unchanged */}
          
          <p>
            Welcome to JCIL.AI. These Terms of Service ("Terms") govern your
            access to and use of our Service. By accessing or using JCIL.AI,
            you agree to be bound by these Terms. If you do not agree, please
            do not use our Service.
          </p>

          <div className="my-4 rounded-lg border border-blue-200 bg-blue-50/70 p-4 dark:bg-blue-950/40 dark:border-blue-900/40">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              JCIL.AI is a faith-based AI service that filters all responses
              through our Christian Filtering system to ensure biblical
              alignment. By using this Service, you acknowledge and agree to
              receive AI responses filtered through a Christian worldview.
            </p>
          </div>

          {/* Keep all your existing <h3>, <p>, and <ul> sections below unchanged */}
          {/* ... full content continues here ... */}

          <div className="mt-8 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <p className="text-sm font-semibold">
              By using JCIL.AI, you acknowledge that you have read, understood,
              and agree to be bound by these Terms of Service. God bless you!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
