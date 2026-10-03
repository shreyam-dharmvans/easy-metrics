import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';
import { generateApiKey } from './projects.js';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  'easymetrics-dev-jwt-secret-replace-in-production-min-32-chars';

const CLIENT_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

/**
 * GET /api/v1/auth/google
 * Initiates the Google OAuth 2.0 flow or falls back to local dev session
 */
export async function initiateGoogleAuth(req: Request, res: Response) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  // If real Google OAuth credentials are provided, redirect to Google consent screen
  if (clientId && clientSecret) {
    const redirectUri =
      process.env.GOOGLE_CALLBACK_URL?.trim() ||
      `${req.protocol}://${req.get('host')}/api/v1/auth/google/callback`;

    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });

    return res.redirect(`${rootUrl}?${params.toString()}`);
  }

  // In production, Google OAuth credentials MUST be configured. No bypass allowed.
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ [Auth Error] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required in production.');
    return res.redirect(`${CLIENT_ORIGIN}/?auth_error=oauth_not_configured`);
  }

  // Local Dev / Demo Fallback (ONLY active in development/test environments)
  console.log(
    'ℹ️ [Auth] Local dev mode: GOOGLE_CLIENT_ID not configured. Logging in via developer session fallback.'
  );
  return res.redirect('/api/v1/auth/google/callback?dev=true');
}

/**
 * GET /api/v1/auth/google/callback
 * Handles OAuth callback from Google, exchanges authorization code for tokens,
 * upserts user in PostgreSQL, generates default project if first login,
 * and sets secure HttpOnly JWT session cookie.
 */
export async function handleGoogleCallback(req: Request, res: Response) {
  const code = req.query.code as string | undefined;
  const isDevFallback = req.query.dev === 'true' || !code;

  // Strict Security Guard: Block any ?dev=true bypass attempt in production
  if (isDevFallback && process.env.NODE_ENV === 'production') {
    console.error('🚨 [Security Violation] Dev fallback bypass rejected in production.');
    return res.redirect(`${CLIENT_ORIGIN}/?auth_error=dev_fallback_disabled`);
  }

  try {
    let userEmail: string;
    let userName: string | null = null;
    let userAvatar: string | null = null;

    if (isDevFallback) {
      // Dev mode fallback user (development only)
      userEmail = 'developer@easymetrics.local';
      userName = 'Demo Developer';
    } else {
      // Exchange authorization code for Google access token
      const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET!.trim();
      const redirectUri =
        process.env.GOOGLE_CALLBACK_URL?.trim() ||
        `${req.protocol}://${req.get('host')}/api/v1/auth/google/callback`;

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code!,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        console.error('Failed to exchange Google OAuth code:', errorText);
        return res.redirect(`${CLIENT_ORIGIN}/?auth_error=oauth_token_exchange_failed`);
      }

      const tokenData = (await tokenRes.json()) as { access_token: string };

      // Fetch user profile from Google userinfo API
      const userinfoRes = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }
      );

      if (!userinfoRes.ok) {
        return res.redirect(`${CLIENT_ORIGIN}/?auth_error=oauth_profile_fetch_failed`);
      }

      const profile = (await userinfoRes.json()) as {
        email: string;
        name?: string;
        picture?: string;
      };

      userEmail = profile.email;
      userName = profile.name || null;
      userAvatar = profile.picture || null;
    }

    // Upsert User in PostgreSQL
    const user = await prisma.user.upsert({
      where: { email: userEmail },
      update: {
        name: userName || undefined,
        avatar: userAvatar || undefined,
      },
      create: {
        email: userEmail,
        name: userName || 'Developer',
        avatar: userAvatar,
      },
    });

    // Ensure the user has at least one active project
    const existingProjectsCount = await prisma.project.count({
      where: { ownerId: user.id },
    });

    if (existingProjectsCount === 0) {
      const slug =
        (userName ? userName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'my-service') +
        '-' +
        crypto.randomBytes(3).toString('hex');

      const project = await prisma.project.create({
        data: {
          name: userName ? `${userName}'s Project` : 'My Project',
          slug,
          ownerId: user.id,
        },
      });

      // Generate default API key for ingestion
      await prisma.apiKey.create({
        data: {
          name: 'Default Key',
          key: generateApiKey(),
          projectId: project.id,
        },
      });
    }

    // Issue signed JWT session token (valid for 30 days)
    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Set secure HttpOnly cookie
    res.cookie('token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });

    // Clear any residual demo session cookies
    res.clearCookie('easymetrics_is_demo', { path: '/' });

    // Redirect to web dashboard with auth=success signal
    return res.redirect(`${CLIENT_ORIGIN}/dashboard?auth=success`);
  } catch (error) {
    console.error('Error during Google OAuth callback:', error);
    return res.redirect(`${CLIENT_ORIGIN}/?auth_error=server_error`);
  }
}

/**
 * GET /api/v1/auth/me
 * Returns current authenticated user profile
 */
export async function getAuthMe(req: Request, res: Response) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Error in getAuthMe:', error);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}

/**
 * POST /api/v1/auth/logout
 * Clears HttpOnly session cookie
 */
export async function handleLogout(req: Request, res: Response) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });

  return res.json({ success: true, message: 'Logged out successfully' });
}
