'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '../components/ThemeToggle';
import { initiateGoogleSignIn } from '../context/ProjectContext';

interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

export default function LandingPage() {
  const [copied, setCopied] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  // Check if user already has an active session
  useEffect(() => {
    const rawBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
    const apiUrl = rawBase.endsWith('/api/v1') ? rawBase : `${rawBase}/api/v1`;
    fetch(`${apiUrl}/auth/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setAuthUser(data.user);
        } else {
          setAuthUser(null);
        }
      })
      .catch(() => {
        setAuthUser(null);
      });
  }, []);

  const totalSlides = 5;

  const slides = [
    {
      title: 'Overview',
      src: '/screenshots/dashboard.png',
      alt: 'EasyMetrics System Overview Dashboard',
    },
    {
      title: 'API Routes',
      src: '/screenshots/routes.png',
      alt: 'API Routes Explorer with Latency Percentiles',
    },
    {
      title: 'Traces Explorer',
      src: '/screenshots/traces.png',
      alt: 'Distributed Traces Explorer and Spans',
    },
    {
      title: 'Waterfall Timeline',
      src: '/screenshots/waterfall.png',
      alt: 'Trace Waterfall Execution Breakdown',
    },
    {
      title: 'SQL & Spans',
      src: '/screenshots/span_inspector.png',
      alt: 'SQL Query and Span Details Inspector',
    },
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  // Keyboard navigation for carousel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const snippetCode = `// 1. Install package: npm install @easy-metrics/node
import { init } from '@easy-metrics/node';
init({ apiKey: process.env.EASY_METRICS_KEY }); // Tracks routes & database calls automatically

// 2. Your existing Express app runs untouched:
import express from 'express';
const app = express();`;

  const copySnippet = () => {
    navigator.clipboard.writeText(snippetCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200 antialiased">
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION BAR                                                    */}
      {/* ========================================================================= */}
      <header className="border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand Logo & Subtitle Badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
              ⚡
            </div>
            <span className="font-bold text-lg tracking-tight text-zinc-950 dark:text-white">EasyMetrics</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 font-semibold">
              For Express.js
            </span>
          </div>

          {/* Links & CTA */}
          <div className="flex items-center gap-3 sm:gap-4 text-sm">
            <a href="#preview" className="hidden sm:inline text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium transition-colors">
              Product Tour
            </a>
            <a href="#features" className="hidden sm:inline text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium transition-colors">
              Features
            </a>
            <ThemeToggle />
            {authUser ? (
              <Link
                href="/dashboard"
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-xs transition-colors shadow-sm flex items-center gap-1.5"
              >
                <span>Go to Dashboard</span>
                <span>→</span>
              </Link>
            ) : (
              <Link
                href="/dashboard?demo=true"
                className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-xs transition-colors shadow-sm"
              >
                Explore Live Demo →
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION                                                          */}
      {/* ========================================================================= */}
      <section className="max-w-5xl mx-auto px-6 pt-16 sm:pt-20 pb-12 text-center">
        {/* Pulsing Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/70 mb-6 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Zero-Config Express Observability • 2 Lines of Code
        </div>

        {/* Approved Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-tight text-zinc-950 dark:text-white">
          Get real performance metrics for your apps <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 dark:from-emerald-400 dark:via-teal-300 dark:to-indigo-400">
            in 30 seconds.
          </span>
        </h1>

        {/* Plain-English Subtitle */}
        <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto mb-8 leading-relaxed font-normal">
          Stop guessing why your endpoints lag or cluttering your codebase with <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">console.time()</code>.
          EasyMetrics tracks incoming Express requests, route response times, and database/network calls — with direct <strong>FastMCP integration for Cursor</strong> and <strong>1-click export for ChatGPT</strong>.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-10">
          {authUser ? (
            <>
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Go to Dashboard</span>
                <span>→</span>
              </Link>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Signed in as <strong className="text-zinc-900 dark:text-zinc-100">{authUser.email}</strong></span>
              </div>
            </>
          ) : (
            <>
              {/* Primary Action: Explore Live Demo */}
              <Link
                href="/dashboard?demo=true"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Explore Live Demo (No sign up required)</span>
                <span>→</span>
              </Link>

              {/* Secondary Action: Continue with Google */}
              <button
                type="button"
                onClick={initiateGoogleSignIn}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3.5 bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 font-semibold text-sm transition-all shadow-xs text-zinc-800 dark:text-zinc-100 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z" />
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.02 0 12s.45 3.82 1.25 5.42l4.03-3.15Z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
                </svg>
                <span>Continue with Google</span>
              </button>
            </>
          )}
        </div>

        {/* 2-Line Express Integration Code Snippet */}
        <div className="max-w-xl mx-auto text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm overflow-hidden mb-16">
          <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
              <span className="ml-2 font-semibold">src/server.js</span>
            </div>
            <button
              onClick={copySnippet}
              className="text-[11px] px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="p-4 font-mono text-xs overflow-x-auto text-zinc-900 dark:text-zinc-200 leading-relaxed bg-zinc-50/50 dark:bg-transparent">
            <code>
              <span className="text-zinc-500">// 1. Install package: npm install @easy-metrics/node{'\n'}</span>
              <span className="text-indigo-700 dark:text-indigo-400 font-semibold">import</span>
              <span> {'{ init } '}</span>
              <span className="text-indigo-700 dark:text-indigo-400 font-semibold">from</span>
              <span className="text-amber-700 dark:text-amber-300"> '@easy-metrics/node'</span>;{'\n'}
              <span>init({'{'} apiKey: process.env.EASY_METRICS_KEY {'}'}); </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">// Tracks routes &amp; database calls automatically{'\n\n'}</span>
              <span className="text-zinc-400">// 2. Your existing Express app runs untouched:{'\n'}</span>
              <span className="text-indigo-700 dark:text-indigo-400 font-semibold">import</span>
              <span> express </span>
              <span className="text-indigo-700 dark:text-indigo-400 font-semibold">from</span>
              <span className="text-amber-700 dark:text-amber-300"> 'express'</span>;{'\n'}
              <span className="text-indigo-700 dark:text-indigo-400 font-semibold">const</span>
              <span> app = express();</span>
            </code>
          </pre>
        </div>

        {/* ===================================================================== */}
        {/* 3. PRODUCT SHOWCASE (REFINED CAROUSEL WITH INFINITE LOOP)             */}
        {/* ===================================================================== */}
        <div id="preview" className="text-left mb-24 max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white mb-2">
              See Exactly What EasyMetrics Gives You
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
              Real performance signals, bottleneck isolation, and trace breakdowns.
            </p>
          </div>

          {/* Clean, Elegant Tabs Bar (Above Window) */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center gap-1 p-1 bg-zinc-200/80 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl text-xs sm:text-sm font-medium shadow-2xs overflow-x-auto max-w-full">
              {slides.map((slide, idx) => (
                <button
                  key={idx}
                  onClick={() => goToSlide(idx)}
                  className={`px-4 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${currentSlide === idx
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                >
                  {slide.title}
                </button>
              ))}
            </div>
          </div>

          {/* Browser Window Mockup Frame */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden relative group">
            {/* Sleek Minimal Window Bar */}
            <div className="bg-zinc-100/90 dark:bg-zinc-900/90 backdrop-blur px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
                <div className="ml-2 px-2.5 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-mono text-[11px] hidden sm:flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0110 0v4"></path>
                  </svg>
                  <span>easymetrics.app/demo</span>
                </div>
              </div>

              {/* Direct Link to Live Demo */}
              <Link
                href="/dashboard?demo=true"
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800/60 font-semibold text-xs transition-colors cursor-pointer"
              >
                <span>Open Live Demo</span>
                <span>↗</span>
              </Link>
            </div>

            {/* Carousel Stage Viewport */}
            <div className="relative overflow-hidden bg-zinc-950">
              {/* Left Arrow Button (Infinite Loop Backward) */}
              <button
                onClick={prevSlide}
                aria-label="Previous view"
                className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-zinc-900/70 hover:bg-zinc-900 text-zinc-300 hover:text-white flex items-center justify-center backdrop-blur-md border border-zinc-700/60 shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <svg className="w-5 h-5 -ml-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>

              {/* Right Arrow Button (Infinite Loop Forward) */}
              <button
                onClick={nextSlide}
                aria-label="Next view"
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-zinc-900/70 hover:bg-zinc-900 text-zinc-300 hover:text-white flex items-center justify-center backdrop-blur-md border border-zinc-700/60 shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>

              {/* Slides Track */}
              <div
                className="flex transition-transform duration-350 ease-out"
                style={{
                  width: `${totalSlides * 100}%`,
                  transform: `translateX(-${(currentSlide * 100) / totalSlides}%)`,
                }}
              >
                {slides.map((slide, idx) => (
                  <div key={idx} style={{ width: `${100 / totalSlides}%` }} className="shrink-0">
                    <img
                      src={slide.src}
                      alt={slide.alt}
                      className="w-full h-auto block select-none"
                      loading={idx === 0 ? 'eager' : 'lazy'}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Bar: Minimal Indicators Only */}
            <div className="bg-zinc-100/60 dark:bg-zinc-900/80 px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-2">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goToSlide(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${currentSlide === idx
                    ? 'w-8 bg-emerald-600 dark:bg-emerald-400'
                    : 'w-2 bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600'
                    }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 4. THE 5 CORE DEVELOPER VALUE CARDS                                   */}
        {/* ===================================================================== */}
        <div id="features" className="text-left max-w-5xl mx-auto mb-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white mb-2">
              Built for How Modern Developers Actually Work
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No enterprise bloat. No complex collector setups. Just clarity for your Express code.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Tired of console.time & Expensive Tools? */}
            <div className="p-6 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:border-amber-500/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-lg mb-4 border border-amber-300 dark:border-amber-800">
                ⏱️
              </div>
              <h3 className="font-bold text-base text-zinc-950 dark:text-white mb-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                Tired of <code className="font-mono text-xs">console.time</code> &amp; Expensive Tools?
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                You don&apos;t want to litter your clean code with manual timers for every route, database query, and external fetch. You also don&apos;t want to pay $500/month SaaS bills or configure complex enterprise agents.
              </p>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-300 mb-3">
                <span className="text-amber-600 font-bold block mb-1">“1 npm package + 1 API key in .env”</span>
                No custom middleware or collectors. Auto-instruments HTTP, Express routes, and database network calls out of the box.
              </div>
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                ✓ Set up in under 30 seconds with zero boilerplate
              </span>
            </div>

            {/* Card 2: Don't Just Build Blindly with AI — See What's Slow */}
            <div className="p-6 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:border-indigo-500/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mb-4 border border-indigo-300 dark:border-indigo-800">
                🔍
              </div>
              <h3 className="font-bold text-base text-zinc-950 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Don&apos;t Just Build Blindly with AI — See What&apos;s Slow
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                Building apps with AI is rapid, but when an endpoint lags, AI code alone won&apos;t show you why. EasyMetrics visualizes the exact execution waterfall:
              </p>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-300 mb-3">
                <span className="text-indigo-600 font-bold block mb-1">“Instant Culprit Isolation”</span>
                See whether lag is coming from a slow database query or a slow third-party API response with visual bottleneck tags.
              </div>
              <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                ✓ Understand your app&apos;s true runtime behavior effortlessly
              </span>
            </div>

            {/* Card 3: FastMCP FEATURE: Feed Runtime Metrics to Your AI IDE via FastMCP */}
            <div className="p-6 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:border-indigo-500/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mb-4 border border-indigo-300 dark:border-indigo-800">
                🤖
              </div>
              <h3 className="font-bold text-base text-zinc-950 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Feed Runtime Metrics to Your AI IDE via FastMCP
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                Cursor, Antigravity, and Claude Code hallucinate when trying to optimize performance because they cannot see runtime latency. EasyMetrics bridges that gap:
              </p>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-300 mb-3">
                <span className="text-indigo-600 font-bold block mb-1">“FastMCP Integration for Cursor &amp; Claude”</span>
                EasyMetrics provides FastMCP tools so your AI queries live route health, SQL execution times, and error stacks directly inside your editor.
              </div>
              <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                ✓ Deterministic, verified fixes on the first prompt
              </span>
            </div>

            {/* Card 4: 1-Click "Copy AI Context" for Web LLMs */}
            <div className="p-6 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:border-emerald-500/50 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-lg mb-4 border border-emerald-300 dark:border-emerald-800">
                📋
              </div>
              <h3 className="font-bold text-base text-zinc-950 dark:text-white mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                1-Click &ldquo;Copy AI Context&rdquo; for Cursor, Copilot &amp; ChatGPT
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                When you ask an AI to optimize a route or review performance, it guesses blindly without knowing your real response times or error counts.
              </p>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-300 mb-3">
                <span className="text-emerald-600 font-bold block mb-1">“1-Click Overview Context Export”</span>
                Click one button on your dashboard toolbar to copy your real latency numbers, error rates, and route breakdown ready to paste into your AI.
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                ✓ Instant telemetry context for any LLM with a single click
              </span>
            </div>

            {/* Card 5: Defend Project Metrics in Interviews */}
            <div className="p-6 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:border-violet-500/50 transition-all group md:col-span-2">
              <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400 flex items-center justify-center font-bold text-lg mb-4 border border-violet-300 dark:border-violet-800">
                🎯
              </div>
              <h3 className="font-bold text-base text-zinc-950 dark:text-white mb-2 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                Defend Your Project Metrics on Resumes &amp; in Interviews
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                Technical interviewers quickly see through generic bullet points like <em>&ldquo;improved API speed&rdquo;</em>. With EasyMetrics, you get real, defendable numbers and traces:
              </p>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-300 mb-3">
                <span className="text-violet-600 font-bold block mb-1">“Real, Defendable Engineering Bullets”</span>
                Back up claims with concrete numbers: <em>&ldquo;Monitored 369 requests across 5 endpoints, identifying a 72.7ms SQL bottleneck on /api/products and reducing P95 latency from 1142ms.&rdquo;</em>
              </div>
              <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-400 flex items-center gap-1">
                ✓ Back up your resume bullet points with verifiable metrics
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-8 pb-12 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-900 dark:text-white">EasyMetrics</span>
            <span>•</span>
            <span>Zero-Config Observability for Express.js</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard?demo=true" className="hover:text-zinc-900 dark:hover:text-white">
              Live Demo
            </Link>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-zinc-900 dark:hover:text-white">
              GitHub
            </a>
            <span className="text-zinc-400">v0.1.0-alpha</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
