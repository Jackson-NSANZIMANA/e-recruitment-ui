import React from 'react';import {Stack,Text} from '@atlaskit/primitives/compiled';import {useTranslation} from '@usrp/i18n';
export default function DetailPage():React.ReactElement{const {t}=useTranslation('applications');return <Stack space="space.200"><Text as="p">{t('applications.detail.title')}</Text><Text as="p">{t('applications.detail.history_officer_only')}</Text></Stack>}
