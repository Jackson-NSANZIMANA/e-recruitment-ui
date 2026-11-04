// @ts-check
/**
 * @usrp local ESLint plugin - the boundary rules, as ESLint rules.
 *
 * These wrap the SAME predicates that tooling/repo-hygiene/check-boundaries.mjs
 * uses (tooling/repo-hygiene/lib/predicates.mjs). One implementation, two
 * consumers: the editor and CI. If they ever disagree, one of them is lying,
 * and the whole quality contract goes with it.
 *
 * Loaded via an in-process ESM bridge because predicates.mjs is ESM and ESLint
 * flat configs in this repo are CJS. The alternative was a .cjs twin of ~100
 * lines of regex, and a twin is a future divergence.
 */

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const PREDICATES_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'tooling',
  'repo-hygiene',
  'lib',
  'predicates.mjs',
);

let cached = null;
function predicates() {
  if (cached) return cached;
  const source = readFileSync(PREDICATES_PATH, 'utf8');
  // Strip ESM syntax into a CJS-evaluable form, then collect the named exports.
  const transformed = source
    .replace(/^export\s+(const|function|class|let)\s/gm, '$1 ')
    .replace(/^export\s+type\s.*$/gm, '');
  const names = [...source.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_$]+)/gm)].map(
    (m) => m[1],
  );
  const sandbox = { module: { exports: {} }, exports: {}, require, console };
  vm.createContext(sandbox);
  new vm.Script(transformed + '\n;module.exports = {' + names.join(', ') + '};', {
    filename: PREDICATES_PATH,
  }).runInContext(sandbox);
  cached = sandbox.module.exports;
  return cached;
}

// --- helpers -----------------------------------------------------------------

/** Every shape that names a module: import, export-from, dynamic, require. */
function moduleSpecifierVisitors(check) {
  return {
    ImportDeclaration: (node) => check(node.source, node.source.value),
    ExportNamedDeclaration: (node) => node.source && check(node.source, node.source.value),
    ExportAllDeclaration: (node) => node.source && check(node.source, node.source.value),
    ImportExpression: (node) =>
      node.source && node.source.type === 'Literal' && check(node.source, node.source.value),
    'CallExpression[callee.name="require"]': (node) => {
      const arg = node.arguments[0];
      if (arg && arg.type === 'Literal') check(arg, arg.value);
    },
  };
}

/** Property key name whether written `width`, `"width"` or `['width']`. */
function keyName(prop) {
  if (!prop || !prop.key) return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'Literal') return String(prop.key.value);
  return null;
}

// --- rules -------------------------------------------------------------------

/** @type {import('eslint').Rule.RuleModule} */
const noDomainImports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'The domain-free layer may not import a USRP domain package. Domain knowledge in the package every screen imports is how a design system rots into an app.',
    },
    schema: [
      {
        type: 'object',
        properties: { extraScopes: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    messages: {
      forbidden:
        'Domain-free layer may not import "{{specifier}}". Take the data as a prop, or put this component in a feature slice (see tooling/repo-hygiene/MIGRATION-MAP.md).',
    },
  },
  create(context) {
    const { isForbiddenDomainImport } = predicates();
    const extra = context.options?.[0]?.extraScopes ?? [];
    return moduleSpecifierVisitors((node, value) => {
      if (typeof value !== 'string') return;
      const hit =
        isForbiddenDomainImport(value) || extra.some((s) => value === s || value.startsWith(s + '/'));
      if (hit) context.report({ node, messageId: 'forbidden', data: { specifier: value } });
    });
  },
};

/** @type {import('eslint').Rule.RuleModule} */
const noDomainVocabulary = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'The domain-free layer may not name domain concepts, including nationalId and nationalIdHash (brief invariant 2).',
    },
    schema: [],
    messages: {
      identifier: '"{{name}}" is domain vocabulary and may not appear in the domain-free layer.',
      pii: '"{{name}}" must never appear in presentation code. Raw National ID is request-only and nationalIdHash must not reach the browser.',
    },
  },
  create(context) {
    const { FORBIDDEN_DOMAIN_IDENTIFIERS } = predicates();
    const forbidden = new Set(FORBIDDEN_DOMAIN_IDENTIFIERS);
    const pii = new Set(['nationalId', 'nationalIdHash']);

    const report = (node, name) =>
      context.report({ node, messageId: pii.has(name) ? 'pii' : 'identifier', data: { name } });

    return {
      Identifier(node) {
        if (forbidden.has(node.name)) report(node, node.name);
      },
      Literal(node) {
        if (typeof node.value === 'string' && forbidden.has(node.value)) report(node, node.value);
      },
      TSTypeReference(node) {
        if (node.typeName?.type === 'Identifier' && forbidden.has(node.typeName.name)) {
          report(node, node.typeName.name);
        }
      },
    };
  },
};

/** @type {import('eslint').Rule.RuleModule} */
const noRawHex = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'No raw hex colour literals anywhere. Invariant 5: every colour is an @atlaskit/tokens token.',
    },
    schema: [],
    messages: {
      hex: 'Raw colour "{{value}}". Use token("color....") from @atlaskit/tokens - hardcoded colour breaks theming, high contrast and the ADS contract.',
    },
  },
  create(context) {
    const { findRawHexColors, ALLOW_HEX_MARKER } = predicates();
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    /**
     * A hex literal is exempt when `hygiene-allow-hex` appears on its line or in
     * the comment block directly above it - the same rule, and the same marker,
     * that check-boundaries.mjs applies.
     *
     * WHY THIS HAD TO BE ADDED. The two consumers of `findRawHexColors` drifted:
     * the sweep honoured the marker and this rule did not, so the three app
     * `vite.config.ts` manifests - whose colours are the OS-read PWA theme and
     * carry written justifications - were "exempt" in CI and red in the editor.
     * A rule that disagrees with the gate beside it is worse than either alone,
     * because the next person to see the red assumes the marker does not work.
     */
    const isExempt = (node) => {
      const lines = sourceCode.getText().split(/\r?\n/);
      const index = node.loc.start.line - 1;
      if ((lines[index] ?? '').includes(ALLOW_HEX_MARKER)) return true;
      for (let i = index - 1; i >= 0; i -= 1) {
        const line = lines[i] ?? '';
        if (line.includes(ALLOW_HEX_MARKER)) return true;
        // Only walk a contiguous comment block, so an unrelated remark far above
        // can never reach down and exempt code below it.
        if (!/^\s*(\/\/|\*|\/\*)/.test(line)) return false;
      }
      return false;
    };

    const check = (node, text) => {
      if (typeof text !== 'string') return;
      for (const hit of findRawHexColors(text)) {
        if (isExempt(node)) continue;
        context.report({ node, messageId: 'hex', data: { value: hit.value } });
      }
    };
    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value?.cooked ?? node.value?.raw);
      },
    };
  },
};

/** @type {import('eslint').Rule.RuleModule} */
const minTouchTarget = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Interactive dimensions may not fall below the 48px floor (WCAG 2.1 AA SC 2.5.5, plus USRP outdoor/gloved field use).',
    },
    schema: [
      { type: 'object', properties: { min: { type: 'number' } }, additionalProperties: false },
    ],
    messages: {
      tooSmall:
        '{{property}}: {{px}}px is below the {{min}}px interactive floor. Wrap the control in <TouchTarget> from @usrp/design-system rather than shrinking the target.',
    },
  },
  create(context) {
    const { MIN_TOUCH_TARGET_PX, TOUCH_TARGET_PROPERTIES } = predicates();
    const min = context.options?.[0]?.min ?? MIN_TOUCH_TARGET_PX;
    const props = new Set(TOUCH_TARGET_PROPERTIES);

    /** Pull a px number out of '40px', `40px` or 40. */
    const pxOf = (valueNode) => {
      if (!valueNode) return null;
      if (valueNode.type === 'Literal') {
        if (typeof valueNode.value === 'number') return valueNode.value;
        if (typeof valueNode.value === 'string') {
          const m = /^(\d+(?:\.\d+)?)px$/.exec(valueNode.value.trim());
          return m ? Number(m[1]) : null;
        }
      }
      if (valueNode.type === 'TemplateLiteral' && valueNode.expressions.length === 0) {
        const raw = valueNode.quasis.map((q) => q.value.cooked ?? '').join('');
        const m = /^(\d+(?:\.\d+)?)px$/.exec(raw.trim());
        return m ? Number(m[1]) : null;
      }
      return null;
    };

    return {
      Property(node) {
        const name = keyName(node);
        if (!name || !props.has(name)) return;
        const px = pxOf(node.value);
        if (px !== null && px > 0 && px < min) {
          context.report({
            node,
            messageId: 'tooSmall',
            data: { property: name, px: String(px), min: String(min) },
          });
        }
      },
    };
  },
};

/**
 * The 16px body-text floor, on every ADS `<Text>`.
 *
 * WHY THIS RULE EXISTS AT ALL. `packages/design-system/src/a11y/index.ts`
 * declared `MIN_BODY_TEXT_PX = 16` and nothing called it. A 2026-11-04 audit
 * counted 390 of 393 `<Text>` nodes below the floor. A constant with no caller
 * is a comment, and a comment does not fail a build.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not guess. A `size={expression}`
 * is reported as `undecidable` (and the rule's option decides whether that is a
 * violation), because a gate that flags a computed value it cannot read is a
 * gate people learn to switch off. It also does not fire inside the national
 * lockup or the agency logo - both are marks whose type is proportional to a
 * symbol; see BODY_TEXT_SCAN in tooling/repo-hygiene/lib/predicates.mjs.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const minBodyText = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'ADS Text may not render below the 16px body floor (MIN_BODY_TEXT_PX): mobile browsers zoom on focus and small type disappears in sunlight.',
    },
    schema: [
      {
        type: 'object',
        properties: { min: { type: 'number' }, allowUndecidable: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    messages: {
      tooSmall:
        'Text size="{{size}}" renders {{px}}px, below the {{min}}px body floor. Use size="large"; if 12px is genuinely required for a mark, add "hygiene-allow-small-text" with the reason.',
      undecidable:
        'Text size={...} cannot be checked against the {{min}}px body floor. Inline a literal size so the gate can read it.',
      unknown:
        'Text size="{{size}}" is not a size @atlaskit/primitives accepts (small | medium | large).',
    },
  },
  create(context) {
    const { BODY_TEXT_SCAN, TEXT_SIZE_PX, bodyTextSizeOf } = predicates();
    const min = context.options?.[0]?.min ?? 16;
    const allowUndecidable = context.options?.[0]?.allowUndecidable ?? false;

    const filename = String(context.filename ?? '').replace(/\\/g, '/');
    if (BODY_TEXT_SCAN.exemptPaths.some((prefix) => filename.includes(prefix))) return {};

    const jsxName = (node) => {
      const n = node.name;
      if (!n) return null;
      if (n.type === 'JSXIdentifier') return n.name;
      if (n.type === 'JSXMemberExpression' && n.property?.name) return n.property.name;
      return null;
    };

    return {
      JSXOpeningElement(node) {
        if (jsxName(node) !== 'Text') return;
        const sizeAttr = node.attributes.find(
          (a) => a.type === 'JSXAttribute' && a.name?.name === 'size',
        );

        /** Rebuild the attribute as source text so ONE parser serves both consumers. */
        const attrText = sizeAttr
          ? context.sourceCode.getText(sizeAttr)
          : '';
        const size = bodyTextSizeOf(attrText);

        if ('literal' in size) {
          context.report({
            node: sizeAttr ?? node,
            messageId: 'unknown',
            data: { size: size.literal },
          });
          return;
        }
        if ('expression' in size) {
          if (allowUndecidable) return;
          context.report({ node: sizeAttr ?? node, messageId: 'undecidable', data: { min: String(min) } });
          return;
        }
        if (size.px < min) {
          const name = Object.keys(TEXT_SIZE_PX).find((k) => TEXT_SIZE_PX[k] === size.px);
          context.report({
            node: sizeAttr ?? node,
            messageId: 'tooSmall',
            data: { size: name ?? String(size.px) + 'px', px: String(size.px), min: String(min) },
          });
        }
      },
    };
  },
};

module.exports = {
  meta: { name: 'usrp', version: '1.0.0' },
  rules: {
    'no-domain-imports': noDomainImports,
    'no-domain-vocabulary': noDomainVocabulary,
    'no-raw-hex': noRawHex,
    'min-touch-target': minTouchTarget,
    'min-body-text': minBodyText,
  },
};
