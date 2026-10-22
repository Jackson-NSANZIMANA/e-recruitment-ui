import React from "react";
import Button from "@atlaskit/button/new";
import { Inline, Text } from "@atlaskit/primitives/compiled";
import { useTranslation } from "@usrp/i18n";
import { maskValue } from "./model.js";

export interface MaskedValueProps {
  readonly value: string;
  readonly keep?: number;
  /** Called when an officer reveals; the host records it. Omit to forbid reveal. */
  readonly onReveal?: () => void;
  readonly label: string;
}

/** Masked by default; the reveal is an explicit, host-observable action and re-masks on request. */
export function MaskedValue({ value, keep, onReveal, label }: MaskedValueProps): React.ReactElement {
  const { t } = useTranslation();
  const [shown, setShown] = React.useState(false);
  return (
    <Inline space="space.100" alignBlock="center">
      <Text as="span" testId="masked-value">{shown ? value : maskValue(value, keep)}</Text>
      {onReveal !== undefined && (
        <Button
          appearance="subtle"
          aria-label={`${shown ? t("ui.mask.hide") : t("ui.mask.reveal")}: ${label}`}
          onClick={() => {
            if (!shown) onReveal();
            setShown(!shown);
          }}
        >
          {shown ? t("ui.mask.hide") : t("ui.mask.reveal")}
        </Button>
      )}
    </Inline>
  );
}
