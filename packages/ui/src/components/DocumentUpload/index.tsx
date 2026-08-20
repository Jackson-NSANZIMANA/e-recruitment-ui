/* eslint-disable @atlaskit/ui-styling-standard/enforce-style-prop, @atlaskit/design-system/no-unsafe-design-token-usage, @atlaskit/ui-styling-standard/no-imported-style-values */
import React, { useCallback, useId, useRef, useState } from "react";
import { Box, Inline, Stack, Text } from "@atlaskit/primitives/compiled";
import Button from "@atlaskit/button";
import { cssMap, cx } from "@atlaskit/css";
import { token } from "@atlaskit/tokens";
import { useTranslation } from "@usrp/i18n";

interface DocumentUploadProps {
  /** Allowed file extensions or MIME types — e.g. [".pdf", ".jpg", "image/png"]. Defaults to any. */
  readonly acceptedTypes?: readonly string[];
  /** Maximum file size in bytes. Defaults to 5 MB. */
  readonly maxSizeBytes?: number;
  readonly onFilesSelected: (files: File[]) => void;
  readonly onValidationError?: (msg: string) => void;
  readonly testId?: string;
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const dropzoneStyles = cssMap({
  base: {
    padding: token("space.400"),
    textAlign: "center",
    cursor: "pointer",
    transition: "background-color 150ms ease, border-color 150ms ease",
    backgroundColor: token("color.background.neutral.subtle"),
  },
  active: {
    // Visual highlight when a drag is in progress over the zone.
    backgroundColor: token("color.background.selected.hovered"),
  },
});

const fileRowStyles = cssMap({
  base: {
    padding: token("space.150"),
    backgroundColor: token("color.background.neutral"),
  },
});

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isTypeAllowed(file: File, acceptedTypes: readonly string[]): boolean {
  if (acceptedTypes.length === 0) return true;
  return acceptedTypes.some((type) => {
    // Accept by extension (".pdf") or MIME prefix/exact ("image/", "image/png").
    if (type.startsWith(".")) {
      return file.name.toLowerCase().endsWith(type.toLowerCase());
    }
    if (type.endsWith("/*")) {
      return file.type.startsWith(type.slice(0, -1));
    }
    return file.type === type;
  });
}

/**
 * Multi-file uploader with drag-and-drop.
 *
 * Validates each dropped/selected file against acceptedTypes and maxSizeBytes.
 * Does not perform any network upload — hands the valid File list to the
 * caller via onFilesSelected.
 */
export function DocumentUpload({
  acceptedTypes = [],
  maxSizeBytes = DEFAULT_MAX_SIZE,
  onFilesSelected,
  onValidationError,
  testId,
}: DocumentUploadProps): React.ReactElement {
  const { t } = useTranslation();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useState<readonly File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const validateAndAdd = useCallback(
    (incoming: FileList | null): void => {
      if (incoming === null) return;
      const valid: File[] = [];
      for (const file of Array.from(incoming)) {
        if (!isTypeAllowed(file, acceptedTypes)) {
          onValidationError?.(t("upload.error_type", { name: file.name }));
          continue;
        }
        if (file.size > maxSizeBytes) {
          onValidationError?.(
            t("upload.error_size", {
              name: file.name,
              maxSize: formatBytes(maxSizeBytes),
            }),
          );
          continue;
        }
        valid.push(file);
      }
      if (valid.length > 0) {
        setFiles((prev) => {
          const merged = [...prev, ...valid];
          onFilesSelected(merged);
          return merged;
        });
      }
    },
    [acceptedTypes, maxSizeBytes, onFilesSelected, onValidationError, t],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    },
    [],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      validateAndAdd(e.dataTransfer.files);
    },
    [validateAndAdd],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      validateAndAdd(e.target.files);
      // Reset so the same file can be re-selected if removed then re-added.
      e.target.value = "";
    },
    [validateAndAdd],
  );

  const handleClick = useCallback((): void => {
    inputRef.current?.click();
  }, []);

  const handleRemove = useCallback(
    (index: number): void => {
      setFiles((prev) => {
        const next = prev.filter((_, i) => i !== index);
        onFilesSelected([...next]);
        return next;
      });
    },
    [onFilesSelected],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        inputRef.current?.click();
      }
    },
    [],
  );

  return (
    <Stack space="space.200" {...(testId !== undefined ? { testId } : {})}>
      {/* Hidden file input — triggered programmatically from the drop zone. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={acceptedTypes.length > 0 ? acceptedTypes.join(",") : undefined}
        onChange={handleInputChange}
        style={{ display: "none" }}
        aria-hidden="true"
      />

      {/* Drop zone — border handled via style because StrictXCSSProp rejects the shorthand */}
      <Box
        xcss={isDragOver ? cx(dropzoneStyles['base'], dropzoneStyles['active']) : dropzoneStyles['base']}
        style={{
          borderRadius: "var(--ds-border-radius-200, 8px)",
          border: isDragOver
            ? "2px dashed var(--ds-border-selected, #0c66e4)"
            : "2px dashed var(--ds-border, #ccc)",
        }}
        role="button"
        tabIndex={0}
        aria-label={t("upload.drop_hint")}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <Stack space="space.150" alignInline="center">
          <Text color="color.text.subtle">
            {isDragOver ? t("upload.drag_active") : t("upload.drop_hint")}
          </Text>
          <Button appearance="default" onClick={handleClick} tabIndex={-1}>
            {t("upload.select_files")}
          </Button>
        </Stack>
      </Box>

      {/* Selected file list */}
      {files.length > 0 && (
        <Stack space="space.100">
          {files.map((file, index) => (
            <Box
              key={`${file.name}-${file.size}-${index}`}
              xcss={fileRowStyles['base']}
              style={{ borderRadius: "var(--ds-border-radius-100, 3px)" }}
            >
              <Inline space="space.200" alignBlock="center" spread="space-between">
                <Stack space="space.025">
                  <Text>{file.name}</Text>
                  <Text size="small" color="color.text.subtlest">
                    {formatBytes(file.size)}
                  </Text>
                </Stack>
                <Button
                  appearance="subtle"
                  onClick={() => {
                    handleRemove(index);
                  }}
                  aria-label={t("upload.remove_file", { name: file.name })}
                >
                  ×
                </Button>
              </Inline>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
