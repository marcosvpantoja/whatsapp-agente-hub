import { createHash, randomBytes } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import type { NextFunction, Request, Response } from "express";
import { env, isProduction } from "./env.js";
import { pool } from "./db.js";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  company: string;
  role: "master" | "client";
  themePreference: "dark" | "light";
  agentName?: string | null;
  status: "active" | "inactive" | "blocked";
  lastLogin: string;
  createdAt: string;
  mustChangePassword: boolean;
  whatsappConnected: boolean;
  whatsappNumber?: string | null;
  lastSync?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser | null;
  sessionId?: string | null;
}

interface SessionUserRow extends RowDataPacket {
  sessionId: string;
  id: string;
  name: string;
  email: string;
  company: string;
  role: "master" | "client";
  agentName: string | null;
  status: "active" | "inactive" | "blocked";
  lastLogin: string;
  createdAt: string;
  mustChangePassword: number;
  themePreference: "dark" | "light";
  whatsappConnected: number;
  whatsappNumber: string | null;
  lastSync: string | null;
}

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.SESSION_COOKIE_SECURE ?? isProduction,
  path: "/",
};

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return randomBytes(48).toString("hex");
}

export function setSessionCookie(response: Response, token: string) {
  response.cookie(env.SESSION_COOKIE_NAME, token, {
    ...baseCookieOptions,
    maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(env.SESSION_COOKIE_NAME, baseCookieOptions);
}

export async function attachCurrentUser(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  const token = request.cookies?.[env.SESSION_COOKIE_NAME];

  if (!token) {
    request.user = null;
    request.sessionId = null;
    return next();
  }

  try {
    const tokenHash = hashSessionToken(token);
    const [rows] = await pool.execute<SessionUserRow[]>(
      `
        SELECT
          s.id AS sessionId,
          u.id,
          u.name,
          u.email,
          u.company,
          u.role,
          COALESCE(us.theme_preference, 'dark') AS themePreference,
          u.agent_name AS agentName,
          u.status,
          COALESCE(DATE_FORMAT(u.last_login_at, '%Y-%m-%d'), '') AS lastLogin,
          DATE_FORMAT(u.created_at, '%Y-%m-%d') AS createdAt,
          u.must_change_password AS mustChangePassword,
          CASE WHEN wc.status = 'connected' THEN 1 ELSE 0 END AS whatsappConnected,
          wc.phone_number AS whatsappNumber,
          CASE
            WHEN wc.last_sync_at IS NULL THEN NULL
            ELSE DATE_FORMAT(wc.last_sync_at, '%Y-%m-%d %H:%i')
          END AS lastSync
        FROM auth_sessions s
        INNER JOIN users u ON u.id = s.user_id
        LEFT JOIN user_settings us ON us.user_id = u.id
        LEFT JOIN whatsapp_connections wc ON wc.user_id = u.id
        WHERE s.refresh_token_hash = ?
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
        LIMIT 1
      `,
      [tokenHash],
    );

    const sessionUser = rows[0] ?? null;

    if (!sessionUser) {
      clearSessionCookie(response);
      request.user = null;
      request.sessionId = null;
      return next();
    }

    request.user = {
      id: sessionUser.id,
      name: sessionUser.name,
      email: sessionUser.email,
      company: sessionUser.company,
      role: sessionUser.role,
      themePreference: sessionUser.themePreference,
      agentName: sessionUser.agentName,
      status: sessionUser.status,
      lastLogin: sessionUser.lastLogin,
      createdAt: sessionUser.createdAt,
      mustChangePassword: Boolean(sessionUser.mustChangePassword),
      whatsappConnected: Boolean(sessionUser.whatsappConnected),
      whatsappNumber: sessionUser.whatsappNumber,
      lastSync: sessionUser.lastSync,
    };
    request.sessionId = sessionUser.sessionId;

    await pool.execute("UPDATE auth_sessions SET last_used_at = NOW() WHERE id = ?", [sessionUser.sessionId]);

    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireAuth(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  if (!request.user) {
    return response.status(401).json({ message: "Autenticacao obrigatoria." });
  }

  return next();
}

export function requireRole(role: "master" | "client") {
  return (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    if (!request.user) {
      return response.status(401).json({ message: "Autenticacao obrigatoria." });
    }

    if (request.user.role !== role) {
      return response.status(403).json({ message: "Acesso negado." });
    }

    return next();
  };
}

export function requireAnyRole(roles: Array<"master" | "client">) {
  return (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    if (!request.user) {
      return response.status(401).json({ message: "Autenticacao obrigatoria." });
    }

    if (!roles.includes(request.user.role)) {
      return response.status(403).json({ message: "Acesso negado." });
    }

    return next();
  };
}
