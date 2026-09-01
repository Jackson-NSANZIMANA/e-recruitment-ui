import React from 'react';import {Stack,Text} from '@atlaskit/primitives/compiled';import {useTranslation} from '@usrp/i18n';
export default function ListPage():React.ReactElement{const {t}=useTranslation('applications');return <Stack space="space.200"><Text as="p">{t('applications.list.title')}</Text></Stack>}
