import React from "react";
import type { Agency } from "@usrp/contracts";
import { AGENCY_EMBLEMS, COAT_OF_ARMS, type EmblemSource } from "./emblems.js";

interface EmblemImageProps {
  readonly source: EmblemSource;
  /** Rendered height in CSS px. Width follows the emblem's own proportions. */
  readonly height: number;
  /**
   * Text alternative. Pass "" when the emblem sits next to text that already
   * names the institution (a lockup), so a screen reader does not say it twice.
   */
  readonly alt: string;
  /** Use the 512 px rendition (documents, watermarks) instead of the 128 px one. */
  readonly large?: boolean;
  readonly testId?: string;
}

/**
 * One emblem, drawn exactly as issued: proportional scaling only, no crop, no
 * recolour (assets/PROVENANCE.md). Width and height are written as attributes
 * so the browser reserves the box before the file arrives - no layout shift on
 * a slow connection.
 */
function EmblemImage({ source, height, alt, large = false, testId }: EmblemImageProps): React.ReactElement {
  return (
    // eslint-disable-next-line @atlaskit/design-system/no-html-image -- @atlaskit/image is not a dependency; an emblem is a single-mode raster with fixed intrinsic size and needs nothing it adds
    <img
      src={large ? source.large : source.small}
      alt={alt}
      height={height}
      width={Math.round(height * source.aspect)}
      decoding="async"
      draggable={false}
      {...(testId !== undefined ? { "data-testid": testId } : {})}
    />
  );
}

interface CoatOfArmsProps {
  readonly height: number;
  readonly alt: string;
  readonly large?: boolean;
  readonly testId?: string;
}

/** The national coat of arms. */
export function CoatOfArms(props: CoatOfArmsProps): React.ReactElement {
  return <EmblemImage source={COAT_OF_ARMS} {...props} />;
}

interface AgencyEmblemProps {
  readonly agency: Agency;
  readonly height: number;
  readonly alt: string;
  readonly large?: boolean;
  readonly testId?: string;
}

/** The emblem of RDF, RNP or RCS. */
export function AgencyEmblem({ agency, ...rest }: AgencyEmblemProps): React.ReactElement {
  return <EmblemImage source={AGENCY_EMBLEMS[agency]} {...rest} />;
}
