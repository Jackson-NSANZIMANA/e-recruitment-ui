import React from 'react';
import { Box, Stack, Text } from '@atlaskit/primitives/compiled';
import Heading from '@atlaskit/heading';
import { cssMap } from '@atlaskit/css';
import { token } from '@atlaskit/tokens';

const styles = cssMap({
  page: { maxWidth: '960px', marginInline: 'auto', paddingBlock: token('space.400'), paddingInline: token('space.300') },
});

/** The page frame every station uses: one title, one intro, then content. */
export function StationPage({ title, intro, children, testId }: { readonly title: string; readonly intro?: string; readonly children: React.ReactNode; readonly testId?: string }): React.ReactElement {
  return (
    <Box xcss={styles.page} {...(testId === undefined ? {} : { testId })}>
      <Stack space="space.300">
        <Heading size="large" as="h1">{title}</Heading>
        {intro !== undefined && <Text color="color.text.subtle">{intro}</Text>}
        {children}
      </Stack>
    </Box>
  );
}
