import type { TestRunnerConfig } from '@storybook/test-runner';
import { getStoryContext } from '@storybook/test-runner';
import { injectAxe, checkA11y } from 'axe-playwright';

/**
 * THE ACCESSIBILITY GATE. This is the part that fails a build.
 *
 * @storybook/addon-a11y renders a panel a human may or may not look at.
 * This runner visits every story in a real browser, injects axe-core, and
 * throws on any WCAG 2.1 A/AA violation. `pnpm --filter @usrp/design-system
 * test:a11y` runs it locally; the a11y job in .github/workflows/ci.yml runs the
 * exact same script. There is no CI-only variant to drift.
 *
 * `detailedReport` is on because "3 violations" in a CI log is not actionable
 * and an unactionable failure gets skipped.
 */
const config: TestRunnerConfig = {
  async preVisit(page) {
    await injectAxe(page);
  },
  async postVisit(page, context) {
    const storyContext = await getStoryContext(page, context);

    // A story may narrow which rules apply, but it cannot switch the gate off.
    // If someone needs that, they change this file in review, where the
    // decision is visible.
    if (storyContext.parameters?.['a11y']?.['disable'] === true) {
      throw new Error(
        'Story "' +
          context.title +
          ' / ' +
          context.name +
          '" sets a11y.disable. Accessibility is not opt-out in this repo: fix the ' +
          'violation, or narrow the rule set with a written reason in the story.',
      );
    }

    await checkA11y(page, '#storybook-root', {
      detailedReport: true,
      detailedReportOptions: { html: true },
      axeOptions: storyContext.parameters?.['a11y']?.['config'] ?? {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        },
      },
    });
  },
};

export default config;
