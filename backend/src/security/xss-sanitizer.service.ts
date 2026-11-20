import { Injectable } from '@nestjs/common';

@Injectable()
export class XssSanitizerService {
  private readonly entityMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };

  /**
   * Applies strict HTML entity output encoding to prevent Cross-Site Scripting (XSS) (Section 4.1)
   */
  encodeHtml(str: string): string {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/[&<>"'`=\/]/g, (char) => this.entityMap[char] || char);
  }

  /**
   * Strips hazardous HTML tags, script elements, and event handlers
   */
  sanitizeText(str: string): string {
    if (!str || typeof str !== 'string') return str;

    let sanitized = str;

    // 1. Strip script tags and their contents
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // 2. Strip dangerous inline pseudo-protocols
    sanitized = sanitized.replace(/javascript:[^"'\s]*/gi, '');
    sanitized = sanitized.replace(/data:text\/html[^"'\s]*/gi, '');
    sanitized = sanitized.replace(/vbscript:[^"'\s]*/gi, '');

    // 3. Strip dangerous HTML attributes / event handlers (onload, onerror, onclick, etc.)
    sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

    // 4. Strip iframe, object, embed, form, and base tags
    sanitized = sanitized.replace(/<\/?(?:iframe|object|embed|form|base|meta)\b[^>]*>/gi, '');

    return sanitized;
  }

  /**
   * Recursively sanitizes and output-encodes string properties in objects
   */
  sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return this.encodeHtml(this.sanitizeText(obj));
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.sanitizeObject(value);
    }
    return result;
  }
}
