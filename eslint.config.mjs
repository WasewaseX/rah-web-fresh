import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";
import unicornPlugin from "eslint-plugin-unicorn";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Scanner parity: the external code scanner enforces the rules below. They
// were previously disabled here, which is why the gate lint stage passed while
// the scanner kept finding issues.
//
// Round-8 calibration notes:
// - function-too-long counts COMMENTS (skipBlankLines only) and applies to
//   src as well as scripts (limit 80, flagged above 88 lines). The round-7
//   evidence that scoped it to scripts was a sampling artifact.
// - file-too-large applies everywhere too (limit 400, flagged above 441
//   non-blank lines).
// - no-undef is enforced even on TS files (it caught a genuinely missing fs
//   import that tsc missed because scripts/pg-validate.ts is excluded from
//   the type-checked program on purpose).
// - the scanner runs the broad react-hooks compiler family (purity,
//   set-state-in-effect), so the whole non-deprecated plugin rule set is on.
// - every plugin the config imports must be a declared package.json
//   dependency (ai-slop/hallucinated-import checks the manifest).
const jsxA11yRules = {};
for (const [name, def] of Object.entries(jsxA11yPlugin.rules ?? {})) {
  if (def?.meta?.deprecated) continue;
  jsxA11yRules[`jsx-a11y/${name}`] = "error";
}

const reactHooksRules = { "react-hooks/exhaustive-deps": "error" };
for (const [name, def] of Object.entries(reactHooksPlugin.rules ?? {})) {
  if (def?.meta?.deprecated) continue;
  reactHooksRules[`react-hooks/${name}`] = "error";
}
// Scanner-evidence exclusions: four scanner rounds (5-8) reported react/
// findings only in the exhaustive-deps, set-state-in-effect and purity
// classes while scanning these exact files. react-hooks/todo reports
// compiler lowering limitations (try/finally, throw-in-try) that are not
// code defects, and react-hooks/hooks false-positives on the clean
// single-useRef+useEffect canvas components - neither class was ever
// scanner-reported, so both stay off.
delete reactHooksRules["react-hooks/todo"];
delete reactHooksRules["react-hooks/hooks"];

const scannerRules = {
  "no-unused-vars": "off", // core rule: the TS version below owns TS files
  "@typescript-eslint/no-unused-vars": ["error", {
    args: "all",
    argsIgnorePattern: "^_",
    varsIgnorePattern: "^_",
    caughtErrors: "all",
    caughtErrorsIgnorePattern: "^_",
  }],
  "no-empty": "error",
  "no-empty-pattern": "error",
  "no-undef": "error",
  "no-self-assign": "error",
  "no-useless-escape": "error",
  "@typescript-eslint/no-useless-empty-export": "error",
  "import/no-duplicates": "error",
  "unicorn/no-new-array": "error",
  "unicorn/no-useless-spread": "error",
  "unicorn/no-useless-fallback-in-spread": "error",
  "unicorn/prefer-string-starts-ends-with": "error",
  "max-params": ["error", 6],
  ...reactHooksRules,
  ...jsxA11yRules,
};

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  plugins: {
    import: importPlugin,
    unicorn: unicornPlugin,
    "react-hooks": reactHooksPlugin,
  },
  rules: {
    ...scannerRules,
  },
  languageOptions: {
    globals: {
      RequestInit: "readonly",
      RequestInfo: "readonly",
    },
  },
  settings: {
    "import/resolver": { typescript: true },
  },
}, {
  // node-side scripts get node + bun globals so no-undef can do its job there
  files: ["scripts/**"],
  languageOptions: {
    globals: {
      process: "readonly",
      console: "readonly",
      Bun: "readonly",
      fetch: "readonly",
      URL: "readonly",
      URLSearchParams: "readonly",
      setTimeout: "readonly",
      clearTimeout: "readonly",
      setInterval: "readonly",
      clearInterval: "readonly",
      performance: "readonly",
      AbortController: "readonly",
      Request: "readonly",
      Response: "readonly",
      Headers: "readonly",
      FormData: "readonly",
      WebSocket: "readonly",
      TextEncoder: "readonly",
      TextDecoder: "readonly",
      Buffer: "readonly",
      crypto: "readonly",
      structuredClone: "readonly",
      queueMicrotask: "readonly",
    },
  },
}, {
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",

    // React rules
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",

    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",

    // General JavaScript rules
    "prefer-const": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-unreachable": "off",
  },
}, {
  // Length rules: the scanner counts PHYSICAL lines and flags at a 10% grace
  // band over the limit - its own messages say so ("limit: 80, flagged above
  // 88 lines", "limit: 400, flagged above 441 lines"; 88 = 80 x 1.1, 441 ~=
  // 400 x 1.1). All round-8 flagged functions verify as > 88 physical lines
  // while non-blank counting contradicts several samples, so the local rule
  // mirrors the observed thresholds exactly.
  rules: {
    "max-lines-per-function": ["error", { max: 88 }],
    "max-lines": ["error", { max: 441 }],
  },
}, {
  ignores: ["node_modules/**", ".next/**", ".next-battery/**", ".next-isolation/**", ".next-mobile/**", ".next-teach/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "rah-repo/**", "download/**", "tests/**"]
}];

export default eslintConfig;
