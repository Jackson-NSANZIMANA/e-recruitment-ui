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
    const { findRawHexColors } = predicates();
    const check = (node, text) => {
      if (typeof text !== 'string') return;
      for (const hit of findRawHexColors(text)) {
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

module.exports = {
  meta: { name: 'usrp', version: '1.0.0' },
  rules: {
    'no-domain-imports': noDomainImports,
    'no-domain-vocabulary': noDomainVocabulary,
    'no-raw-hex': noRawHex,
    'min-touch-target': minTouchTarget,
  },
};
