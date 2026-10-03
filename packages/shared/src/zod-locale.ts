import { z } from 'zod';

// Zod's built-in messages (e.g. a missing body) also reach the API `details` and the UI, so they
// follow the interface language. Imported by every schema module; the config is global to Zod.
z.config(z.locales.ptBR());
