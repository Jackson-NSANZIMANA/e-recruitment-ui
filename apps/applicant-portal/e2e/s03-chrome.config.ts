import { devices } from '@playwright/test';
import base from './playwright.config';
export default { ...base, projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }] };
