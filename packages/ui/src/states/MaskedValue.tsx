import React from "react";
import Button from "@atlaskit/button/new";
import { Inline, Text } from "@atlaskit/primitives/compiled";
import { useTranslation } from "@usrp/i18n";
import { maskValue } from "./model.js";

export interface MaskedValueProps {
  readonly value: string;
  readonly keep?: number;
  /**
   * Called when an officer asks to reveal; the host records it. The value is
   * shown only if this returns (or resolves) true, so a failed audit write
   * keeps it masked. Omit to forbid reveal.
   */
  readonly onReveal?: () => boolean | Promise<boolean>;
  readonly label: string;
}

/** Masked by default; re-masks whenever the value changes; reveal is gated by the host. */
export function MaskedValue({ value, keep, onReveal, label }: MaskedValueProps): React.ReactElement {
  const { t } = useTranslation();
  const [shown, setShown] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    setShown(false);
  }, [value]);
  const toggle = async (): Promise<void> => {
    if (shown) {
      setShown(false);
      return;
    }
    if (onReveal === undefined) return;
    setBusy(true);
    try {
      if ((await onReveal()) === true) setShown(true);
    } catch {
      setShown(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Inline space="space.100" alignBlock="center">
      <Text as="span" testId="masked-value">{shown ? value : maskValue(value, keep)}</Text>
      {onReveal !== undefined && (
        <Button
          appearance="subtle"
          isDisabled={busy}
          aria-label={`${shown ? t("ui.mask.hide") : t("ui.mask.reveal")}: ${label}`}
          onClick={() => void toggle()}
        >
          {shown ? t("ui.mask.hide") : t("ui.mask.reveal")}
        </Button>
      )}
    </Inline>
  );
}
