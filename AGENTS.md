# AGENTS.md - Forgesteel Codebase Guidelines

This document provides guidelines for AI coding agents operating in the Forgesteel repository.
Forgesteel is a React/TypeScript web application for the Draw Steel TTRPG system.

## Build, Lint, and Test Commands

### Development
```bash
npm start              # Start dev server with hot reload (vite --host)
npm run build          # Production build (vite build)
```

### Linting
```bash
npm run lint           # Run ESLint on src/**/*.{ts,tsx}
npm run fix            # Run ESLint with --fix to auto-fix issues
```

### Testing
```bash
npm test               # Run vitest in watch mode
npm test -- --run      # Run tests once without watch mode
npm test -- --run src/utils/utils.test.ts              # Run a single test file
npm test -- --run -t "isNullOrEmpty"                   # Run tests matching name pattern
npm test -- --run src/logic/hero-logic.test.ts -t "getFeatures"  # File + pattern
```

### Full Check (CI-style)
```bash
npm run check          # Runs: lint + tsc + vitest run + npm audit
```

## Project Structure

```
src/
├── assets/           # Static assets (images, fonts)
├── components/       # React components
│   ├── controls/     # Reusable UI controls (buttons, inputs, etc.)
│   ├── features/     # Feature-specific components
│   ├── main/         # Main app layout and routing
│   ├── modals/       # Modal dialogs
│   ├── pages/        # Page-level components
│   └── panels/       # Panel components (sidebars, cards)
├── data/             # Static data definitions (sourcebooks, monsters, etc.)
├── enums/            # TypeScript enums
├── hooks/            # Custom React hooks
├── logic/            # Business logic classes (pure functions)
├── models/           # TypeScript interfaces/types
├── service/          # External services (storage, API)
└── utils/            # Utility functions
```

## Code Style Guidelines

### Formatting (enforced by ESLint)
- **Indentation**: Tabs (not spaces)
- **Quotes**: Single quotes for strings, single quotes for JSX attributes
- **Semicolons**: Required
- **Trailing commas**: None (no dangling commas)
- **Array brackets**: Spaces inside `[ item1, item2 ]`
- **Object braces**: Spaces inside `{ key: value }`
- **Arrow functions**: Omit parens for single param `x => x.id`

### Imports
- Use path alias `@/` for all imports from `src/` directory
- Sort imports alphabetically within groups (ESLint enforced)
- Separate import groups with blank lines:
  1. External packages (react, antd, etc.)
  2. Internal modules (@/...)

```typescript
// Good
import { Navigate, Route, Routes } from 'react-router';
import { ReactNode, useState } from 'react';

import { Ability } from '@/models/ability';
import { AbilityLogic } from '@/logic/ability-logic';
import { Hero } from '@/models/hero';
```

### TypeScript Types
- Use `interface` for object shapes (models)
- Use `type` for unions, intersections, and aliases
- Prefer explicit types over `any`
- Use `null` (not `undefined`) for optional object properties
- Strict mode is enabled (`noUnusedLocals`, `noUnusedParameters`)

```typescript
// Models use interfaces
export interface Hero {
  id: string;
  name: string;
  ancestry: Ancestry | null;  // Use null for optional refs
}

// Enums use PascalCase with string values
export enum Characteristic {
  Might = 'Might',
  Agility = 'Agility'
}
```

### Naming Conventions
- **Files**: kebab-case (`hero-logic.ts`, `hero-edit-page.tsx`)
- **Components**: PascalCase (`HeroEditPage`)
- **Classes**: PascalCase (`HeroLogic`, `FactoryLogic`)
- **Interfaces/Types**: PascalCase (`Hero`, `HeroState`)
- **Enums**: PascalCase (`Characteristic`, `DamageType`)
- **Functions/Methods**: camelCase (`getFeatures`, `createHero`)
- **Constants**: camelCase or SCREAMING_SNAKE_CASE for true constants
- **Test files**: Same name with `.test.ts` suffix (`utils.test.ts`)

### Component Patterns
- Functional components with hooks (no class components for new code)
- Use Ant Design (`antd`) for UI components
- SCSS modules for component-specific styles (co-located with component)
- Custom hooks in `src/hooks/` with `use` prefix

```typescript
// Component structure
import { useState } from 'react';
import { Button } from 'antd';
import { Hero } from '@/models/hero';
import './hero-panel.scss';

interface Props {
  hero: Hero;
  onSave: (hero: Hero) => void;
}

export const HeroPanel = ({ hero, onSave }: Props) => {
  const [ editing, setEditing ] = useState(false);
  // ...
};
```

### Logic Classes
- Business logic in `src/logic/` as static class methods
- Keep logic pure (no side effects, no state)
- Name pattern: `{Domain}Logic` (e.g., `HeroLogic`, `EncounterLogic`)

```typescript
export class HeroLogic {
  static getFeatures = (hero: Hero) => {
    // Pure function - no side effects
  };

  static getAbilities = (hero: Hero, sourcebooks: Sourcebook[]) => {
    // ...
  };
}
```

### Error Handling
- Use `ErrorBoundary` component to wrap error-prone UI sections
- Log errors with `console.error()` (allowed by ESLint)
- Warnings with `console.warn()` (allowed by ESLint)
- Avoid `console.log()` (triggers ESLint warning)

### Testing
- Use Vitest with `describe`, `test`, `expect`
- Test files co-located with source files
- Use `test.each()` for parameterized tests

```typescript
import { describe, expect, test } from 'vitest';
import { Utils } from '@/utils/utils';

describe('Utils', () => {
  describe('isNullOrEmpty', () => {
    test.each([
      [ '', true ],
      [ null, true ],
      [ 'a', false ]
    ])('returns expected result for %s', (value, expected) => {
      expect(Utils.isNullOrEmpty(value)).toBe(expected);
    });
  });
});
```

## Important Notes

- **No TODO/FIXME comments**: ESLint warns on `todo`, `hack`, `fix`, `fixme`, `xxx`
- **No deprecated APIs**: `@typescript-eslint/no-deprecated` is enforced
- **React hooks rules**: `eslint-plugin-react-hooks` is enabled
- **Storage**: Uses `localforage` (IndexedDB) for browser persistence
- **Routing**: Uses `react-router` with hash-based routing
- **PWA**: Service worker in `src/sw.ts`, manifest generated by Vite plugin
