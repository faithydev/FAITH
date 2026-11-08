#!/usr/bin/env node
/** Writes the design tokens as CSS, so tokens have one source of truth. */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(resolve(root, 'packages/design-tokens/package.json'));
const { tokensCss } = require(resolve(root, 'packages/design-tokens/dist/index.js'));
writeFileSync(resolve(root, 'apps/web/src/app/tokens.css'), tokensCss());
