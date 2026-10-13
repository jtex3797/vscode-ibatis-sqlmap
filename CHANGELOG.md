# Changelog

## 0.2.1

- More dialect words. Functions: PostgreSQL `string_agg`, `array_agg`, `generate_series`, `date_trunc`; SQL Server `getdate`, `dateadd`, `iif`, `len`, `charindex`, `newid`; DB2 `varchar_format`. Keywords: `ilike`, `lateral`, `pivot`, `unpivot`, `nolock`, `conflict`.
- `TOP`, `VALUE`, `OUTPUT`, `DO`, `NOTHING` and `UR` stay uncolored on purpose: they are common column names.

## 0.2.0

- First public release.
- New: parameterMap-style `?` / `??` placeholders and JDBC escapes `{call ...}` / `{? = call ...}`.

## 0.1.0

- Private build, not published.
