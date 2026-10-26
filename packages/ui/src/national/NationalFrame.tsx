import React from "react";
import { Anchor, Box, Inline, Text } from "@atlaskit/primitives/compiled";
import { cssMap } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import type { Agency } from "@usrp/contracts";
import { useTranslation } from "@usrp/i18n";
import { FlagRule } from "./FlagRule.js";
import { HandlingMarking } from "./HandlingMarking.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { NationalFooter } from "./NationalFooter.js";
import { NationalHeader } from "./NationalHeader.js";
import { OfficialBanner } from "./OfficialBanner.js";

const MAIN_ID = "main-content";

const styles = cssMap({
  page: {
    display: "flex",
    flexDirection: "column",
    minBlockSize: "100vh",
    backgroundColor: token("elevation.surface.sunken"),
  },
  main: { flexGrow: 1 },
  // Off-screen until focused, then the first thing on the page (WCAG 2.4.1).
  skip: {
    position: "absolute",
    insetInlineStart: token("space.200"),
    insetBlockStart: token("space.200"),
    transform: "translateY(-200%)",
    zIndex: 600,
    backgroundColor: token("elevation.surface.overlay"),
    paddingInline: token("space.200"),
    paddingBlock: token("space.150"),
    borderRadius: token("radius.small"),
    boxShadow: token("elevation.shadow.overlay"),
    "&:focus": { transform: "none" },
  },
  staffFoot: {
    backgroundColor: token("elevation.surface"),
    paddingInline: token("space.300"),
    paddingBlock: token("space.150"),
  },
});

interface NationalFrameProps {
  /**
   * "public": the official-site banner, the national header and the statutory
   * footer - every page a citizen can reach. "staff": the handling marking in
   * place of the banner and a one-line footer - the sign-in and activation
   * screens of the officer and field apps, before their own shells take over.
   */
  readonly audience: "public" | "staff";
  readonly serviceName?: string;
  readonly agency?: Agency | null;
  readonly children: React.ReactNode;
}

/**
 * The page frame every route that is not inside an app shell renders in, so
 * there is no screen in USRP - not even sign-in - that opens without the state
 * identifying itself.
 */
export function NationalFrame({ audience, serviceName, agency = null, children }: NationalFrameProps): React.ReactElement {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <Box xcss={styles['page']}>
      <Anchor href={`#${MAIN_ID}`} xcss={styles['skip']}>{t("national.skip_to_content")}</Anchor>
      {audience === "public" ? <OfficialBanner /> : <HandlingMarking />}
      <NationalHeader
        agency={agency}
        end={<LanguageSwitcher />}
        {...(serviceName !== undefined ? { serviceName } : {})}
      />
      <Box as="main" id={MAIN_ID} xcss={styles['main']} tabIndex={-1}>
        {children}
      </Box>
      {audience === "public" ? (
        <NationalFooter />
      ) : (
        <Box as="footer">
          <Box xcss={styles['staffFoot']}>
            <Inline spread="space-between" shouldWrap>
              <Text size="small" color="color.text.subtle">{t("national.footer_rights", { year })}</Text>
            </Inline>
          </Box>
          <FlagRule weight="thick" />
        </Box>
      )}
    </Box>
  );
}
