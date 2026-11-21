import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Scanner parity: the external code scanner enforces the rules below. They
// were previously disabled here, which is why the gate lint stage passed while
// the scanner kept finding issues. The option shapes mirror the scanner's
// messages (unused things are removed or _-prefixed, empty catches carry a
// documented reason).
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
  "react-hooks/exhaustive-deps": "error",
  "jsx-a11y/no-autofocus": "error",
  "jsx-a11y/control-has-associated-label": "error",
  "import/no-duplicates": "error",
};

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  plugins: {
    import: importPlugin,
  },
  rules: scannerRules,
  settings: {
    "import/resolver": { typescript: true },
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
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
  },
}, {
  ignores: ["node_modules/**", ".next/**", ".next-battery/**", ".next-isolation/**", ".next-mobile/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "rah-repo/**", "download/**", "scripts/**", "tests/**"]
}];

export default eslintConfig;
