# iBATIS sqlMap SQL

SQL highlighting for **iBATIS 2 sqlMap** (Java and .NET) and **MyBatis 3 mapper** XML files.

VS Code shows the SQL in these files as plain text, and a `<![CDATA[ ... ]]>` block as one long string. This extension highlights that SQL. The file stays XML, and other XML files are not affected.

![Without the extension (left) and with it (right)](images/before-after.png)

## What gets colored

- SQL inside `<select>`, `<insert>`, `<update>`, `<delete>`, `<statement>`, `<procedure>` and `<sql>`, with or without CDATA
- Parameters: iBATIS `#id#`, `#amount:NUMERIC#` and MyBatis `#{id}`
- Text substitution `$column$` and `${column}`, in a different color so it stands out
- `?` placeholders and `{call PKG.PROC(?, ?)}`
- Keywords and functions: mostly Oracle and MySQL, plus common PostgreSQL, SQL Server and DB2 ones

Dynamic tags such as `<isNotEmpty>` and `<if>` keep their XML colors. Inside CDATA, `Ctrl+/` comments out a line with `--`.

## Good to know

- It only adds colors. There is no completion, validation or formatting.
- Only files whose root tag is `<sqlMap>` or `<mapper>` are colored. If the root tag is split across several lines, it must include a `namespace` attribute; otherwise the file is not detected.
- Only SQL keywords and functions from a built-in list are colored. `TOP`, `VALUE`, `OUTPUT`, `DO`, `NOTHING` and `UR` are left plain on purpose, because they are often used as column names.

## Changing the colors

Colors come from your theme. To change one, add a rule for its scope in `settings.json`:

```json
"editor.tokenColorCustomizations": {
  "textMateRules": [
    { "scope": "keyword.control.substitution.sqlmap", "settings": { "foreground": "#E06C75" } }
  ]
}
```

| What | Scope |
|---|---|
| `#id#`, `#{id}`, `?` | `variable.parameter.bind.sqlmap` |
| `$column$`, `${column}` | `keyword.control.substitution.sqlmap` |
| Keywords | `keyword.other.sql` |
| Functions | `support.function.sql` |
| Procedure name in `{call ...}` | `entity.name.function.sql` |

## 한국어 안내

iBATIS 2 sqlMap(Java, .NET)과 MyBatis 3 mapper XML 파일 안의 SQL에 색을 입히는 확장입니다. VS Code는 이 파일 안의 SQL을 일반 텍스트로, CDATA 블록은 하나의 긴 문자열로 표시합니다. 이 확장을 설치하면 그 SQL에 색이 입혀집니다. 파일 형식은 XML 그대로이고, 다른 XML 파일에는 영향이 없습니다.

- `<select>`, `<insert>`, `<update>`, `<delete>`, `<sql>` 같은 SQL 태그 안의 SQL을 CDATA 안팎 구분 없이 칠합니다.
- `#id#`, `#{id}`, `?` 같은 파라미터와 `$column$`, `${column}` 같은 문자열 치환은 서로 구분되도록 다른 색으로 칠합니다.
- 키워드와 함수는 Oracle·MySQL 위주이고, PostgreSQL·SQL Server·DB2에서 자주 쓰는 것도 들어 있습니다.
- 색만 입힙니다. 자동 완성, 문법 검사, 코드 포맷팅 기능은 없습니다.
- 루트 태그가 `<sqlMap>` 또는 `<mapper>`인 파일에만 적용됩니다. 루트 태그를 여러 줄에 걸쳐 쓴 경우에는 `namespace` 속성이 있어야 합니다.

## License

[MIT](LICENSE)
