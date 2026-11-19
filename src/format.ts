import { getLang } from "./i18n";
import { meStore } from "./store";

/** Currency display uses USD micro-units as the accounting source of truth. Currency changes never
 * mutate ledger/order values, avoiding rounding drift across repeated preference changes. */
export const starsRate = () => meStore.get()?.starsPerUsd ?? 0;
function currencyAmount(micro: number, sign = false): string {
  const me = meStore.get();
  const c = me?.currencies?.find(x => x.code === me.currencyCode) ?? me?.currencies?.find(x => x.code === "USD");
  const value = (micro / 1_000_000) * (c?.per_usd ?? 1);
  const digits = c?.decimals ?? 2;
  const abs = Math.abs(value).toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const prefix = micro < 0 ? "−" : sign && micro > 0 ? "+" : "";
  return `${prefix}${c?.symbol_visible === 0 ? "" : (c?.symbol ?? "$")}${abs}`;
}
export function amount(micro: number, opts: { sign?: boolean } = {}): string { return currencyAmount(micro, !!opts.sign); }
export function balance(micro: number): string {
  const me = meStore.get();
  const c = me?.currencies?.find(x => x.code === me.currencyCode);
  if (me && me.balance === micro && Number.isFinite(me.walletBalanceMinor) && c) {
    const digits = c.decimals ?? 2;
    const scale = 10 ** digits;
    const value = (me.walletBalanceMinor ?? 0) / scale;
    const abs = Math.abs(value).toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return `${c.symbol_visible === 0 ? "" : (c.symbol ?? "$")}${abs}`;
  }
  return currencyAmount(micro);
}
export function starsAmount(starCount: number): string { const rate = starsRate(); return currencyAmount(rate > 0 ? Math.ceil(starCount * 1_000_000 / rate) : 0); }
/** Legacy Star formatter retained for Telegram Stars checkout only. */
export function stars(n: number, opts: { sign?: boolean } = {}): string {
  const v = Math.round(Math.abs(n));
  const sign = n < 0 ? "−" : opts.sign && n > 0 ? "+" : "";
  return `${sign}${num(v)} ⭐`;
}

/**
 * BCP 47 tag for Intl formatting. Arabic uses Latin digits ("ar-u-nu-latn") so num() and dateTime() match stars();
 * Hindi keeps Indian digit grouping.
 */
export function locale(): string {
  const l = getLang();
  // Latin digits wherever the locale would switch to its own numerals, so num() matches stars()
  if (l === "zh") return "zh-CN";
  if (l === "ar" || l === "fa" || l === "ur" || l === "bn") return `${l}-u-nu-latn`;
  return l;
}

/** Lower-cases with the UI language's rules (Turkish dotted/dotless i), for words shown inside sentences. */
export function lower(s: string): string {
  try {
    return s.toLocaleLowerCase(getLang());
  } catch {
    return s.toLowerCase();
  }
}

export function num(n: number): string {
  return n.toLocaleString(locale());
}

export function short(n: number): string {
  if (n >= 1_000_000) return +(n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return +(n / 1000).toFixed(1) + "K";
  return String(n);
}

export function dateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString(locale(), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function dayKey(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(ts: number, today: string, yesterday: string): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return today;
  if (d.toDateString() === y.toDateString()) return yesterday;
  return d.toLocaleDateString(locale(), { month: "short", day: "numeric", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export function duration(minutes: number, units: { m: string; h: string; d: string }): string {
  if (minutes < 60) return `${minutes} ${units.m}`;
  if (minutes <= 2880) return `${+(minutes / 60).toFixed(1)} ${units.h}`;
  return `${Math.round(minutes / 1440)} ${units.d}`;
}

/**
 * Left-to-right isolate (U+2066…U+2069) for an amount of Stars or an order number placed into a translated sentence by t(), which
 * returns plain text. In Arabic, "12 ⭐" or "#123" right after Arabic letters would otherwise show as "⭐ 12" or
 * "123#". Elements use <Num> instead.
 */
export const iso = (s: string) => `⁦${s}⁩`;

/** iso() around every "#123" in a translated sentence ('#' has to be inside the isolate too). */
export const isoIds = (s: string) => s.replace(/#\d+/g, (m) => iso(m));

/**
 * For text Telegram draws natively (MainButton, popups), where some clients may not support isolates: a left-to-right
 * mark in front keeps "12 ⭐" or "#123" in order inside Arabic. It is invisible everywhere else.
 */
export const lrm = (s: string) => `‎${s}`;

/** Strips the scheme for display */
export function prettyLink(link: string): string {
  return link.replace(/^https?:\/\/(www\.)?/, "");
}
