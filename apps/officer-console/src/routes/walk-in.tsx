import React, { useState } from "react";
import { Box, Stack, Inline, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button";
import LoadingButton from "@atlaskit/button/loading-button";
import TextField from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import { CharacterCounterField } from "@atlaskit/form";
import { token } from "@atlaskit/tokens";
import { cssMap } from "@atlaskit/css";
import { useSimpleForm, useSimpleField } from "@usrp/design-system";
import { ApiError, createApiClient, useRegisterWalkIn, useVerifyIdentity, useVetWalkIn } from "@usrp/api-client";
import { useOfficerSession } from "@usrp/auth";
import { useTranslation } from "@usrp/i18n";
import { EDGE_BASE_URL } from "../env.js";

const client = createApiClient({ baseUrl: EDGE_BASE_URL });

const pageStyles = cssMap({ 
  base: { 
    maxWidth: "600px", 
    marginInline: "auto", 
    paddingBlock: token("space.500"), 
    paddingInline: token("space.400") 
  }, 
  spacing: { marginTop: token("space.300") } 
});

interface WalkInFormValues { readonly nationalId: string; readonly category: string; }
interface Registered { readonly applicationId: string; readonly processingCode: string; readonly qrInvitationCode: string; }

// Helper: Hook-based field wrapper upgraded with CharacterCounterField capabilities
const SimpleTextField = ({ 
  name, 
  label, 
  isRequired, 
  maxChars,
  ...props 
}: { 
  name: string; 
  label: string; 
  isRequired?: boolean; 
  maxChars?: number;
} & React.ComponentProps<typeof TextField>) => {
  const { fieldProps, error } = useSimpleField({ name, isRequired });
  
  return (
    <Box>
      {/* 
        CharacterCounterField manages the Label layout, character remaining strings, 
        and sets up proper ARIA links dynamically for accessibility tree announcements.
      */}
      <CharacterCounterField
        {...fieldProps}
        label={label}
        isRequired={isRequired}
        maxChars={maxChars}
      >
        {({ fieldProps: counterFieldProps }) => (
          <TextField {...counterFieldProps} {...props} />
        )}
      </CharacterCounterField>
      {error && <Text color="color.text.danger">{error}</Text>}
    </Box>
  );
};

// Sub-component: Encapsulates form hooks to prevent "hooks call" errors during early returns in parent
function WalkInForm({ 
  onSubmit, 
  isPending, 
  isDisabled 
}: { 
  onSubmit: (values: WalkInFormValues) => Promise<void>;
  isPending: boolean;
  isDisabled: boolean;
}) {
  const { t } = useTranslation();
  
  const { formProps, formState: { isSubmitting } } = useSimpleForm<WalkInFormValues>({
    onSubmit
  });

  return (
    <form {...formProps}>
      <Stack space="space.400">
        <SimpleTextField 
          name="nationalId" 
          label="National ID number" 
          isRequired 
          inputMode="numeric" 
          maxChars={16} 
          autoComplete="off" 
          autoFocus 
        />
        
        <SimpleTextField 
          name="category" 
          label="Recruitment category" 
          isRequired 
        />
        
        <Box style={{ marginTop: token('space.300') }}>
          <Inline space="space.200">
            <LoadingButton 
              type="submit" 
              appearance="primary" 
              isLoading={isSubmitting || isPending} 
              isDisabled={isDisabled}
            >
              Register walk-in
            </LoadingButton>
            <Button href="/dashboard" appearance="subtle">{t("actions.cancel")}</Button>
          </Inline>
        </Box>
      </Stack>
    </form>
  );
}

export default function WalkInPage(): React.ReactElement {
  const { t } = useTranslation();
  const session = useOfficerSession();
  const agency = session?.agency ?? "RDF";
  
  const verifyMutation = useVerifyIdentity(client);
  const registerMutation = useRegisterWalkIn(client, agency);
  const vetMutation = useVetWalkIn(client, agency);
  
  const [registered, setRegistered] = useState<Registered | null>(null);
  const [agePending, setAgePending] = useState(false);
  const [vetted, setVetted] = useState(false);

  const handleSubmit = async (values: WalkInFormValues): Promise<void> => { 
    const identity = await verifyMutation.mutateAsync({ nationalId: values.nationalId.trim(), channel: "WALK_IN" }); 
    const created = await registerMutation.mutateAsync({ applicantId: identity.applicantId, category: values.category.trim() }); 
    setRegistered({ applicationId: created.applicationId, processingCode: created.processingCode, qrInvitationCode: created.qrInvitationCode }); 
    if (navigator.vibrate !== undefined) navigator.vibrate([100, 50, 100]); 
  };

  const handleVet = async (applicationId: string): Promise<void> => { 
    setAgePending(false); 
    try { 
      await vetMutation.mutateAsync({ applicationId }); 
      setVetted(true); 
    } catch (error) { 
      if (error instanceof ApiError && error.normalised.kind === "conflict" && error.normalised.outcome === "AGE_PENDING") { 
        setAgePending(true); 
        return; 
      } 
      throw error; 
    } 
  };

  const reset = (): void => { 
    setRegistered(null); 
    setAgePending(false); 
    setVetted(false); 
    verifyMutation.reset(); 
    registerMutation.reset(); 
    vetMutation.reset(); 
  };

  // Success State (Early Return)
  if (registered !== null) return (
    <Box xcss={pageStyles.base}>
      <Stack space="space.400">
        <SectionMessage appearance="success" title="Walk-in registered" headingLevel="h3">
          <Stack space="space.100">
            <Text>{t("application.id")}: {registered.processingCode}</Text>
            <Text>Invitation code: {registered.qrInvitationCode}</Text>
          </Stack>
        </SectionMessage>
        {agePending && <SectionMessage appearance="warning" title="Age verification still in progress" headingLevel="h3"><Text>The age check has not landed yet. This is normal and usually clears within seconds. Try the vetting step again.</Text></SectionMessage>}
        {vetMutation.isError && !agePending && <SectionMessage appearance="error" title={t("errors.generic")} headingLevel="h3">{t("errors.generic")}</SectionMessage>}
        {vetted && <SectionMessage appearance="success" title="On-site vetting recorded" headingLevel="h3"><Text>The application has moved into on-site vetting. The candidate keeps the invitation code above for the physical test.</Text></SectionMessage>}
        <Box xcss={pageStyles.spacing}>
          <Inline space="space.200">
            {!vetted && <LoadingButton appearance="primary" isLoading={vetMutation.isPending} onClick={() => { void handleVet(registered.applicationId); }}>{agePending ? "Retry vetting" : "Record on-site vetting"}</LoadingButton>}
            <Button appearance={vetted ? "primary" : "subtle"} onClick={reset}>Next candidate</Button>
          </Inline>
        </Box>
      </Stack>
    </Box>
  );

  // Form State
  return (
    <Box xcss={pageStyles.base}>
      <Stack space="space.400">
        <Heading size="large" as="h1">{t("nav.walk_in")}</Heading>
        {(verifyMutation.isError || registerMutation.isError) && <SectionMessage appearance="error" title={t("errors.generic")} headingLevel="h3">{t("errors.generic")}</SectionMessage>}
        <Text size="small" color="color.text.subtle">Confirm the candidate&apos;s identity document in person. The registry returns no name or date of birth to check against.</Text>
        
        {/* Render the extracted form component */}
        <WalkInForm 
          onSubmit={handleSubmit} 
          isPending={verifyMutation.isPending || registerMutation.isPending}
          isDisabled={session === null}
        />
      </Stack>
    </Box>
  );
}
