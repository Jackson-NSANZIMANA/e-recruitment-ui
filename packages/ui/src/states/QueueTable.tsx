import React from "react";
import DynamicTable from "@atlaskit/dynamic-table";
import Lozenge from "@atlaskit/lozenge";
import Button from "@atlaskit/button/new";
import { Inline, Text } from "@atlaskit/primitives/compiled";
import { useTranslation } from "@usrp/i18n";
import { ageOf, type AgeThresholds } from "./model.js";

export interface QueueTransition {
  readonly id: string;
  readonly label: string;
  readonly appearance?: "primary" | "danger" | "default";
  readonly isDisabled?: boolean;
}

export interface QueueRow {
  readonly id: string;
  readonly primary: string;
  readonly secondary?: string;
  /** Extra content under the primary label (a signal, a flag); already translated. */
  readonly detail?: React.ReactNode;
  /** Already-translated status label. */
  readonly status: string;
  /** ISO instant the record entered this queue (or last changed). */
  readonly since: string;
  readonly lastAction?: { readonly label: string; readonly at: string } | null;
  /** The transitions this officer may perform now (the model decides; the table only renders). */
  readonly transitions: readonly QueueTransition[];
  /** Per-row outcome of a bulk action loop. */
  readonly result?: { readonly ok: boolean; readonly text: string };
}

export interface QueueTableProps {
  readonly caption: string;
  readonly rows: readonly QueueRow[];
  readonly now?: Date;
  readonly thresholds?: AgeThresholds;
  readonly onOpen?: (id: string) => void;
  readonly onTransition: (rowId: string, transitionId: string) => void;
  readonly testId?: string;
}

const AGE_APPEARANCE = { fresh: "default", aging: "inprogress", overdue: "removed" } as const;

/**
 * A work queue: what it is, how long it has waited, what happened last, and
 * only the transitions the officer may perform now.
 */
export function QueueTable({ caption, rows, now = new Date(), thresholds, onOpen, onTransition, testId = "queue-table" }: QueueTableProps): React.ReactElement {
  const { t } = useTranslation();
  const head = {
    cells: [
      { key: "item", content: t("ui.queue.item"), isSortable: false },
      { key: "status", content: t("ui.queue.status"), isSortable: false },
      { key: "age", content: t("ui.queue.age"), isSortable: false },
      { key: "last", content: t("ui.queue.lastAction"), isSortable: false },
      { key: "actions", content: t("ui.queue.actions"), isSortable: false },
    ],
  };
  const agoLabel = (iso: string): string => {
    const a = ageOf(iso, now, thresholds);
    return a.unknown ? "—" : t(`ui.age.${a.unit}`, { count: a.value });
  };
  const body = rows.map((r) => {
    const age = ageOf(r.since, now, thresholds);
    return {
      key: r.id,
      cells: [
        {
          key: "item",
          content: (
            <Inline space="space.100" alignBlock="center">
              {onOpen !== undefined
                ? <Button appearance="subtle" spacing="compact" onClick={() => onOpen(r.id)}>{r.primary}</Button>
                : <Text weight="medium">{r.primary}</Text>}
              {r.secondary !== undefined && <Text size="small" color="color.text.subtle">{r.secondary}</Text>}
              {r.detail}
            </Inline>
          ),
        },
        { key: "status", content: <Lozenge>{r.status}</Lozenge> },
        { key: "age", content: <Lozenge appearance={AGE_APPEARANCE[age.bucket]}>{age.unknown ? "—" : t(`ui.age.${age.unit}`, { count: age.value })}</Lozenge> },
        { key: "last", content: r.lastAction ? <Text size="small">{`${r.lastAction.label} · ${agoLabel(r.lastAction.at)}`}</Text> : <Text size="small" color="color.text.subtle">—</Text> },
        {
          key: "actions",
          content: (
            <Inline space="space.100" shouldWrap alignBlock="center">
              {r.transitions.map((tr) => (
                <Button key={tr.id} aria-label={`${tr.label}: ${r.primary}`} appearance={tr.appearance ?? "default"} isDisabled={tr.isDisabled === true} onClick={() => onTransition(r.id, tr.id)}>{tr.label}</Button>
              ))}
              {r.result !== undefined && <Lozenge appearance={r.result.ok ? "success" : "removed"}>{r.result.text}</Lozenge>}
            </Inline>
          ),
        },
      ],
    };
  });
  return <div data-testid={testId}><DynamicTable caption={caption} head={head} rows={body} /></div>;
}
