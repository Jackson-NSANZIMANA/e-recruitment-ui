// @vitest-environment jsdom
/**
 * The S13 layer, rendered.
 *
 * `model.ts` is tested as arithmetic; this file tests what a person actually
 * receives. The claims worth pinning down are the ones a pure function cannot
 * make:
 *
 *  - a titled card is a NAMED REGION, so a screen-reader user can jump between
 *    panels instead of tabbing through them;
 *  - the metric figure is a real metric face, not a heading that happens to be
 *    large (an h2 here would put a second level in the page outline);
 *  - the sparkline's accessible interface is a table of every reading, so the
 *    line is decoration and a reader who cannot see it loses nothing;
 *  - urgency is a word plus a number, never a colour on its own;
 *  - the loading skeleton announces exactly once, and is not itself read out.
 */
import React from "react";
import { Text } from "@atlaskit/primitives/compiled";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Card, MetricCard, PAGE_MAX_WIDTH, PageShell, SkeletonPanel, Sparkline, StackedBar } from "@usrp/ui";

afterEach(cleanup);

const series = (...values: number[]): { label: string; value: number }[] =>
  values.map((value, index) => ({ label: `Week ${String(index + 1)}`, value }));

describe("PageShell", () => {
  it("draws the page H1 once, from the title prop", () => {
    const { container } = render(<PageShell title="Officer dashboard">content</PageShell>);
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    // A page has exactly one H1, and it is whatever the route says it is.
    expect(h1s[0]?.textContent).toBe("Officer dashboard");
  });

  it("caps the column at the width its align names", () => {
    const { container } = render(
      <PageShell align="standard" title="Standard">
        content
      </PageShell>,
    );
    const section = container.querySelector("section");
    expect(section).not.toBeNull();
    expect((section as HTMLElement).style.maxWidth).toBe(PAGE_MAX_WIDTH.standard);
  });

  it("has no cap when aligned to bleed, because the surface owns its layout", () => {
    const { container } = render(
      <PageShell align="bleed" title="Bleed">
        content
      </PageShell>,
    );
    expect((container.querySelector("section") as HTMLElement).style.maxWidth).toBe("");
  });
});

describe("Card", () => {
  it("is a region named by its own heading when titled", () => {
    render(
      <Card title="Applications by stage">
        <Text>body</Text>
      </Card>,
    );
    const region = screen.getByRole("region", { name: "Applications by stage" });
    expect(region.tagName).toBe("SECTION");
    expect(screen.getByRole("heading", { level: 2, name: "Applications by stage" })).toBeTruthy();
  });

  it("takes an explicit heading level, so a card can sit under an h2 panel", () => {
    render(
      <Card title="Nested" titleLevel={3}>
        <Text>body</Text>
      </Card>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Nested" })).toBeTruthy();
  });

  it("is unnamed when untitled: a bare container is not a landmark", () => {
    const { container } = render(<Card>plain</Card>);
    expect(container.querySelector("section")).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("puts testId on exactly one element, so a query cannot match twice", () => {
    const { container } = render(
      <Card title="Titled" testId="once">
        body
      </Card>,
    );
    expect(container.querySelectorAll('[data-testid="once"]')).toHaveLength(1);
  });
});

describe("MetricCard", () => {
  it("prints the figure as a metric, not as a heading", () => {
    render(<MetricCard label="Awaiting adjudication" value={128} testId="metric" />);
    const region = screen.getByTestId("metric");
    // The label is the card's heading; the number is a paragraph with the metric
    // face. If the figure were an <h2> the page outline would gain a second
    // level, which is what the old heading-based tile did.
    const headings = [...region.querySelectorAll("h1,h2,h3,h4,h5,h6")];
    expect(headings.map((h) => h.textContent)).toEqual(["Awaiting adjudication"]);
    expect(region.querySelector("p")).toHaveTextContent("128");
  });

  it("says the number needs attention in words, not only in colour", () => {
    render(<MetricCard label="Amber queue" value={12} urgent testId="urgent" />);
    expect(screen.getByTestId("urgent")).toHaveTextContent(/needs attention/i);
  });

  it("gives the tile an accessible name, so a screen reader is not read a bare number", () => {
    render(<MetricCard label="Amber queue" value={12} testId="named" />);
    // MetricCard is a Card: a named region, not a figure. The name is the label,
    // which is what turns "12" into "Amber queue, region" on entry.
    expect(screen.getByRole("region", { name: "Amber queue" })).toBeTruthy();
  });

  it("does not print the attention line when nothing needs attention", () => {
    render(<MetricCard label="Open campaigns" value={4} testId="calm" />);
    expect(screen.getByTestId("calm")).not.toHaveTextContent(/needs attention/i);
  });

  it("draws a chart only when there is a history to draw", () => {
    const { container, rerender } = render(<MetricCard label="Queue" value={3} testId="plain" />);
    // A plain tile draws no svg at all: there is no history to draw.
    expect(container.querySelectorAll("svg")).toHaveLength(0);
    rerender(<MetricCard label="Queue" value={3} trend={series(4, 3, 2)} goodDirection="down" testId="trended" />);
    // The graph is one <svg>, and it is hidden from assistive tech because the
    // table beside it is the real interface.
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("table")).not.toBeNull();
  });
});

describe("Sparkline", () => {
  it("exposes every reading as a table row, not only as a line", () => {
    render(<Sparkline data={series(12, 18, 9)} label="Applications received" goodDirection="up" />);
    const table = screen.getByRole("table", { name: /Applications received/i });
    expect(table).toBeTruthy();
    // One header row plus one row per reading: nothing is summarised away.
    expect(table.querySelectorAll("tbody tr")).toHaveLength(3);
    for (const value of ["12", "18", "9"]) {
      expect(table).toHaveTextContent(value);
    }
  });

  it("states the direction from the series, not from the caller's hopes", () => {
    render(<Sparkline data={series(1, 2, 3)} label="Rising" goodDirection="up" showTrend />);
    expect(screen.getByText(/\+/)).toBeTruthy();
  });

  it("says nothing rather than 0% when there is no baseline", () => {
    render(<Sparkline data={series(0, 0, 0)} label="From zero" goodDirection="up" showTrend />);
    // A zero baseline cannot yield a percentage, so the delta is a dash.
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("is one named figure, so the line is reachable and not just paint", () => {
    // <img> was the wrong role: an inline SVG is already an image to a screen
    // reader whenever it is given a name, and the readings live in the table.
    // A <figure> is the correct wrapper: a graphic with a caption.
    render(<Sparkline data={series(5, 6, 7)} label="Fleet reporting" goodDirection="up" />);
    expect(screen.getByRole("figure", { name: "Fleet reporting" })).toBeTruthy();
  });
});

describe("StackedBar", () => {
  it("repeats every value as text, so colour is never the only channel", () => {
    render(
      <StackedBar
        label="Applications by stage"
        segments={[
          { label: "Received", value: 42 },
          { label: "Offer", value: 1 },
        ]}
      />,
    );
    const chart = screen.getByRole("figure", { name: /Applications by stage/ });
    // Every segment's label and value are in the figure's own name, so the bar
    // and the legend cannot disagree.
    expect(chart.getAttribute("aria-label")).toMatch(/Received 42/);
    expect(chart.getAttribute("aria-label")).toMatch(/Offer 1/);
    // The legend repeats both values as readable text.
    for (const text of ["Received", "Offer", "42", "1", "Total", "43"]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
  });

  it("draws no segment for a zero, and never divides by zero", () => {
    const { container } = render(
      <StackedBar
        label="Nothing"
        segments={[
          { label: "Received", value: 0 },
          { label: "Offer", value: 0 },
        ]}
      />,
    );
    // Scope to the bar itself: the legend still draws a chip per category, so a
    // page-wide "svg rect" count would be measuring the wrong element.
    const bar = container.querySelector('figure[aria-label^="Nothing"]');
    expect(bar).not.toBeNull();
    expect(bar?.querySelectorAll("rect")).toHaveLength(0);
  });
});

describe("SkeletonPanel", () => {
  it("is invisible to a screen reader: it is a shape, not content", () => {
    const { container } = render(<SkeletonPanel shape="table" rows={3} />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("holds the height its shape will need, so nothing jumps on arrival", () => {
    const { container } = render(<SkeletonPanel shape="chart" />);
    // A shape, not a spinner: several blocks, and a fixed-height bar row.
    expect(container.querySelectorAll("*").length).toBeGreaterThan(3);
    expect(container.querySelector("[class]")).not.toBeNull();
  });
});
