// Loads the addon straight from src/ while developing this repo.
import { fileURLToPath } from 'node:url';

const src = (file: string) => fileURLToPath(new URL(`../src/${file}`, import.meta.url));

export const managerEntries = (entry: string[] = []) => [...entry, src('manager.tsx')];
export const previewAnnotations = (entry: string[] = []) => [...entry, src('preview.ts')];
