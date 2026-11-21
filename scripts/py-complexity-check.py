#!/usr/bin/env python3
"""Scanner-parity complexity check for Python sources.

The external code scanner enforces three complexity budgets on .py files that
eslint cannot reach: file-too-large (limit 400, flagged above 441 lines),
function-too-long (limit 80, flagged above 88 lines) and too-many-params
(max 6). Both length rules use PHYSICAL lines with a 10% grace band - the
same calibration observed for the TypeScript rules (see eslint.config.mjs).
Exit 1 prints every finding; silent exit 0 means clean.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

FILE_LIMIT = 441   # 400 x 1.1 grace band
FUNC_LIMIT = 88    # 80 x 1.1 grace band
PARAM_LIMIT = 6

# duolingo-reference is vendored third-party material (Duolingo's published
# HLR reference implementation) - same exclusion class as vendored bundles in
# the security gate; its reference signatures are kept verbatim by design.
EXCLUDE_PARTS = {"node_modules", "skills", ".github", "rah-repo", "download",
                 "examples", "tests", "tmp-sweep", "upload", "build", "out",
                 "duolingo-reference"}


def physical(text: str) -> int:
    return len(text.splitlines())


def func_len(node: ast.AST, lines: list[str]) -> tuple[int, int]:
    """physical line span of a function node (start to matching end)."""
    start = node.lineno - 1
    end = node.end_lineno  # exclusive
    return start, end - start


def main() -> int:
    findings: list[str] = []
    roots = [Path("."), Path("scripts"), Path("src")]
    seen: set[Path] = set()
    for root in roots:
        if not root.exists():
            continue
        for f in root.rglob("*.py"):
            if f in seen or any(part in f.parts for part in EXCLUDE_PARTS):
                continue
            seen.add(f)
            text = f.read_text(errors="ignore")
            n = physical(text)
            if n > FILE_LIMIT:
                findings.append(f"{f}:0 [file-too-large] File has too many lines ({n}). Maximum allowed is {FILE_LIMIT}.")
            lines = text.splitlines()
            tree = ast.parse(text)
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    start, length = func_len(node, lines)
                    if length > FUNC_LIMIT:
                        findings.append(f"{f}:{start + 1} [function-too-long] Function '{node.name}' has too many lines ({length}). Maximum allowed is {FUNC_LIMIT}.")
                    args = node.args
                    nparams = len(args.args) + len(args.posonlyargs) + len(args.kwonlyargs)
                    if args.vararg:
                        nparams += 1
                    if args.kwarg:
                        nparams += 1
                    if nparams > PARAM_LIMIT:
                        findings.append(f"{f}:{node.lineno} [too-many-params] Function '{node.name}' has too many parameters ({nparams}). Maximum allowed is {PARAM_LIMIT}.")
    if findings:
        print(f"py-complexity-check: {len(findings)} finding(s)")
        for x in findings:
            print(" ", x)
        return 1
    print(f"py-complexity-check: CLEAN ({len(seen)} python files in scope)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
