import React from 'react';
import Button from '@atlaskit/button/new';
import TextArea from '@atlaskit/textarea';
import Form, {
  Field,
  ErrorMessage,
  HelperMessage,
  MessageWrapper,
} from '@atlaskit/form';
import ModalDialog, {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  CloseButton,
} from '@atlaskit/modal-dialog';
import { Stack, Text, Box, Flex } from '@atlaskit/primitives/compiled';
import { useTranslation } from '@usrp/i18n';
import { DECLINE_NOTE_MAX, validateDecline } from '../model/erasure.ts';

interface FormValues {
  note: string;
}

export function DeclineGroundsDialog({
  onCancel,
  onConfirm,
}: {
  readonly onCancel: () => void;
  readonly onConfirm: (note: string) => void;
}): React.ReactElement {
  const { t } = useTranslation('compliance');

  const handleSubmit = (values: FormValues): void => {
    const result = validateDecline(values.note);
    if (result.ok) onConfirm(result.note);
  };

  return (
    <Form<FormValues> onSubmit={handleSubmit}>
      {({ formProps, submitting, getState }) => {
        const { errors, dirty } = getState();
        const hasErrors = Object.keys(errors ?? {}).length > 0;

        return (
          <ModalDialog onClose={onCancel}>
            <form {...formProps}>
              <ModalHeader>
                <ModalTitle appearance="warning">
                  {t('compliance.decline.title')}
                </ModalTitle>
                <CloseButton onClick={onCancel} />
              </ModalHeader>

              <ModalBody>
                <Stack space="space.150">
                  <Text as="p">{t('compliance.decline.ground_required')}</Text>

                  <Field<string>
                    name="note"
                    label={t('compliance.decline.note_label')}
                    isRequired
                    validate={(value) => {
                      if (!value) return 'required';
                      return validateDecline(value).ok ? undefined : 'invalid';
                    }}
                  >
                    {({ fieldProps: { onChange, ...restFieldProps }, error }) => {
                      const value = typeof restFieldProps.value === 'string' ? restFieldProps.value : '';
                      const currentLength = value.length;

                      return (
                        <Stack space="space.050">
                          <TextArea
                            {...restFieldProps}
                            resize="vertical"
                            onChange={(event) =>
                              onChange(event.currentTarget.value.slice(0, DECLINE_NOTE_MAX))
                            }
                          />

                          <Flex justifyContent="space-between" alignItems="start">
                            <MessageWrapper>
                              {error ? (
                                <ErrorMessage>
                                  {t(`compliance.decline.error.${error}`)}
                                </ErrorMessage>
                              ) : (
                                <HelperMessage>
                                  {t('compliance.decline.helper_text', { defaultValue: '' })}
                                </HelperMessage>
                              )}
                            </MessageWrapper>

                            <Box paddingInlineStart="space.100">
                              <Text size="small" color="color.text.subtlest">
                                {currentLength} / {DECLINE_NOTE_MAX}
                              </Text>
                            </Box>
                          </Flex>
                        </Stack>
                      );
                    }}
                  </Field>
                </Stack>
              </ModalBody>

              <ModalFooter>
                <Flex gap="space.100" justifyContent="end">
                  <Button appearance="subtle" onClick={onCancel} isDisabled={submitting}>
                    {t('compliance.decline.cancel')}
                  </Button>
                  <Button
                    appearance="warning"
                    type="submit"
                    isDisabled={!dirty || hasErrors || submitting}
                  >
                    {t('compliance.decline.confirm')}
                  </Button>
                </Flex>
              </ModalFooter>
            </form>
          </ModalDialog>
        );
      }}
    </Form>
  );
}
