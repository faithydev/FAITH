import { Body, PipeTransform, Query } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { z, ZodType } from 'zod';
import { badRequest } from './errors';

class ZodPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}
  transform(value: unknown) {
    return this.schema.parse(value);
  }
}

function jsonSchema(schema: ZodType): Record<string, unknown> {
  try {
    return z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' }) as Record<string, unknown>;
  } catch {
    return { type: 'object' };
  }
}

/** Validates the body and publishes the same schema to OpenAPI, so docs cannot drift. */
export function ZBody(schema: ZodType): ParameterDecorator {
  return (target, key, index) => {
    Body(new ZodPipe(schema))(target, key as string, index);
    const descriptor = Object.getOwnPropertyDescriptor(target, key as string);
    if (descriptor) ApiBody({ schema: jsonSchema(schema) })(target, key as string, descriptor);
  };
}

export function ZQuery(schema: ZodType): ParameterDecorator {
  return (target, key, index) => {
    Query(new ZodPipe(schema))(target, key as string, index);
    const descriptor = Object.getOwnPropertyDescriptor(target, key as string);
    const props = (jsonSchema(schema).properties ?? {}) as Record<string, Record<string, unknown>>;
    if (descriptor) {
      for (const [name, s] of Object.entries(props)) {
        ApiQuery({ name, required: false, schema: s })(target, key as string, descriptor);
      }
    }
  };
}

export type Page = { page: number; pageSize: number };
export const skipTake = (p: Page) => ({ skip: (p.page - 1) * p.pageSize, take: p.pageSize });
export const paged = <T>(items: T[], total: number, p: Page) => ({
  items,
  total,
  page: p.page,
  pageSize: p.pageSize,
  pages: Math.max(1, Math.ceil(total / p.pageSize)),
});

/**
 * One short text from the query string. `?q=a&q=b` arrives as an array and an overlong value
 * could reach a database query; both are folded into a trimmed string (or undefined).
 */
class TextPipe implements PipeTransform {
  constructor(private readonly max: number) {}
  transform(value: unknown) {
    const first: unknown = Array.isArray(value) ? value[0] : value;
    return typeof first === 'string' ? first.trim().slice(0, this.max) || undefined : undefined;
  }
}
export const QText = (name: string, max = 100) => Query(name, new TextPipe(max));

/** A filter that must be one of known values; anything else is a 400, never a database error. */
class EnumPipe implements PipeTransform {
  constructor(private readonly values: readonly string[]) {}
  transform(value: unknown) {
    const first: unknown = Array.isArray(value) ? value[0] : value;
    if (first === undefined || first === '') return undefined;
    if (typeof first !== 'string' || !this.values.includes(first)) throw badRequest('INVALID_FILTER');
    return first;
  }
}
export const QEnum = (name: string, values: readonly string[]) => Query(name, new EnumPipe(values));
