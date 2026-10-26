import React, { useId, useMemo } from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import Heading from "@atlaskit/heading";
import { Code } from "@atlaskit/code";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import type { Agency } from "@usrp/contracts";
import { Microtext, SecurityPattern, composeMachineLine } from "@usrp/design-system";
import { useTranslation } from "@usrp/i18n";
import { AgencyEmblem, CoatOfArms } from "./Emblem.js";
import { COAT_OF_ARMS, agencyNameFor } from "./emblems.js";
import { FlagRule } from "./FlagRule.js";
import { STATE_NAME } from "./identity.js";

const styles = cssMap({
  document: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: token("elevation.surface"),
    borderWidth: token("border.width"),
    borderStyle: "solid",
    borderColor: token("color.border.bold"),
    borderRadius: token("radius.small"),
    boxShadow: token("elevation.shadow.raised"),
  },
  layer: {
    // A flex container blockifies the inline <svg>, so it fills this box
    // instead of sitting on a text baseline below it (and being clipped).
    display: "flex",
    position: "absolute",
    insetBlockStart: token("space.0"),
    insetBlockEnd: token("space.0"),
    insetInlineStart: token("space.0"),
    insetInlineEnd: token("space.0"),
    pointerEvents: "none",
  },
  body: { position: "relative", padding: token("space.300") },
  stateNames: { textAlign: "center" },
  mrz: {
    overflowWrap: "anywhere",
    backgroundColor: token("color.background.neutral"),
    paddingInline: token("space.150"),
    paddingBlock: token("space.100"),
    borderRadius: token("radius.xsmall"),
  },
});

/** The coat of arms as a watermark: desaturated and faint, drawn as an SVG image so both are properties of the drawing. */
function CoatOfArmsWatermark(): React.ReactElement {
  const filterId = `wm-${useId().replace(/:/g, "")}`;
  return (
    // Bottom-anchored so the emblem sits behind the document's text, not behind
    // the QR code's white quiet zone, which would hide it.
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" focusable="false">
      <defs>
        <filter id={filterId}>
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
      <image href={COAT_OF_ARMS.large} x="22" y="30" width="56" height="62" opacity="0.08" filter={`url(#${filterId})`} />
    </svg>
  );
}

interface OfficialDocumentProps {
  /** The document's title, e.g. "Exam pass". */
  readonly title: string;
  /** Issuing agency; its emblem faces the coat of arms across the header. */
  readonly agency: Agency;
  /** The document's own number. Seeds the background line-work and the verification line. */
  readonly serial: string;
  /** Extra fields for the verification line (dates as YYMMDD). Agency and serial are always first. */
  readonly verificationFields?: readonly string[];
  readonly children: React.ReactNode;
  readonly testId?: string;
}

/**
 * The verification line: "USRP<agency", then the serial and each field with its
 * ICAO 9303 check digit, then a composite check digit over the whole line.
 */
export function verificationLineFor(agency: string, serial: string, fields: readonly string[] = []): string {
  return composeMachineLine(`USRP<${agency}`, [serial, ...fields]);
}

/**
 * An official document rendered on screen with the anatomy of a passport data
 * page: the state named in all three official languages between the coat of
 * arms and the issuing agency's emblem; a microprinted rule; seeded guilloche
 * line-work unique to this serial; the coat of arms as a faint watermark; the
 * serial number set in the code face; and a machine-readable
 * verification line with ICAO 9303 check digits.
 *
 * None of this replaces the signed QR as the integrity control. It is what
 * lets a person recognise a genuine document at a glance and notice a crude
 * forgery before any device is involved - the same job those features do on
 * paper.
 */
export function OfficialDocument({ title, agency, serial, verificationFields = [], children, testId }: OfficialDocumentProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const verificationLine = useMemo(() => verificationLineFor(agency, serial, verificationFields), [agency, serial, verificationFields]);
  const agencyName = agencyNameFor(agency, i18n.language);

  return (
    <Box as="article" xcss={styles['document']} {...(testId !== undefined ? { testId } : {})}>
      <SecurityPattern seed={serial} variant="band" />
      <Box xcss={styles['layer']} aria-hidden>
        <CoatOfArmsWatermark />
      </Box>
      <FlagRule weight="thick" />
      <Box xcss={styles['body']}>
        <Stack space="space.200">
          <Inline space="space.200" alignBlock="center" spread="space-between">
            <CoatOfArms height={56} alt={t("national.coat_of_arms_alt")} />
            <Box xcss={styles['stateNames']}>
              <Stack space="space.025">
                <span lang="rw"><Text weight="bold" size="small">{STATE_NAME.rw.toLocaleUpperCase("rw")}</Text></span>
                <span lang="en"><Text size="small">{STATE_NAME.en.toLocaleUpperCase("en")}</Text></span>
                <span lang="fr"><Text size="small">{STATE_NAME.fr.toLocaleUpperCase("fr")}</Text></span>
              </Stack>
            </Box>
            <AgencyEmblem agency={agency} height={56} alt={t("national.emblem_alt", { agency: agencyName })} />
          </Inline>
          <Microtext text={`${STATE_NAME.rw} · USRP · ${agency}`} />
          <Inline space="space.200" alignBlock="end" spread="space-between" shouldWrap>
            <Stack space="space.050">
              <Text size="small" color="color.text.subtle">{agencyName}</Text>
              <Heading size="medium" as="h2">{title}</Heading>
            </Stack>
            <Stack space="space.025">
              <Text size="small" color="color.text.subtle">{t("national.document_serial")}</Text>
              <Text weight="bold"><Code>Nº {serial}</Code></Text>
            </Stack>
          </Inline>
          {children}
          <Microtext text={`${STATE_NAME.en} · ${STATE_NAME.fr}`} />
          <Stack space="space.050">
            <Text size="small" color="color.text.subtle">{t("national.verification_line")}</Text>
            <Box xcss={styles['mrz']} testId="verification-line">
              <Text><Code>{verificationLine}</Code></Text>
            </Box>
            <Text size="small" color="color.text.subtlest">{t("national.verification_hint")}</Text>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
