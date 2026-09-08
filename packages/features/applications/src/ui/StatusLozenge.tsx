import React from 'react';
import Lozenge from '@atlaskit/lozenge';
import {useTranslation} from '@usrp/i18n';
import type {ApplicationStatus} from '@usrp/contracts';
import {statusLabelKey,toneOf} from '../model/status.ts';
const APPEARANCE={default:'default',inprogress:'inprogress',new:'new',moved:'moved',removed:'removed',success:'success'} as const;
export function StatusLozenge({status}:{readonly status:ApplicationStatus}):React.ReactElement{const {t}=useTranslation('applications');return <Lozenge appearance={APPEARANCE[toneOf(status)]}>{t(statusLabelKey(status))}</Lozenge>}
