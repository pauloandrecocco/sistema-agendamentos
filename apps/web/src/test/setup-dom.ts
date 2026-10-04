import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Imported by the component tests (`// @vitest-environment jsdom`); the other web tests run in
// `node` and do not load the DOM. Without Vitest globals, Testing Library does not clean up itself.
afterEach(cleanup);
