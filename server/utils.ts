import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function asyncHandler<
  TRequest extends Request = Request,
  TResponse extends Response = Response,
>(handler: (request: TRequest, response: TResponse, next: NextFunction) => Promise<unknown>) {
  return (request: TRequest, response: TResponse, next: NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function generateTemporaryPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(length);

  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

export function toDateTimeString(value?: string | null) {
  if (!value) {
    return null;
  }

  if (value.length === 10) {
    return `${value} 00:00:00`;
  }

  return value.replace("T", " ").slice(0, 19);
}

export function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}
