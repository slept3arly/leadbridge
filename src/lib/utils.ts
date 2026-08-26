import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: Date | string | null | undefined, fallback = "-", timeZone?: string): string {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}

export function formatDateShort(value: Date | string | null | undefined, fallback = "-", timeZone?: string): string {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}

export function formatTimeValue(value: Date | string | null | undefined, fallback = "-", timeZone?: string): string {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit", minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined, fallback = "-", timeZone?: string): string {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}

export function formatTime(value: string): string {
  const [h, m] = value.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export function formatTimeAgo(value: Date | string, timeZone?: string, now: Date | string | number = Date.now()): string {
  const diff = new Date(now).getTime() - new Date(value).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value, "-", timeZone);
}

export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}
