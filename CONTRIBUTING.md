# Contributing

## Checks

    node test/tokenize_check.js            # tokenizes samples/ and runs the fixture assertions
    node test/tokenize_check.js --corpus <folder with your sqlMap files>
    node tools/preview.js                  # writes tools/out/preview.html (without / with the extension)

Both scripts load the TextMate tokenizer (`vscode-textmate`, `vscode-oniguruma`) from an installed editor's `resources/app/node_modules`; `preview.js` also reads its default Dark Modern and Light Modern themes. Use `--app <.../resources/app>` to point at another editor.

## Design notes

- The built-in SQL grammar is deliberately not reused: its multi-line rules swallow `]]>` and closing tags, and its large word list made large map files much slower to tokenize.
- A `{call ...}` that spans several lines gets only its head colored, so an unclosed `{` never swallows `]]>`.
- The keyword and function lists live in two places: `sql-words` in `syntaxes/sqlmap-sql.injection.json` and `FNS` / `KWS` in `test/tokenize_check.js`. Change both; the check fails if they differ.
- SQL bodies get `meta.embedded.block.sql` (inside CDATA) or `meta.embedded.inline.sql` (outside CDATA).
