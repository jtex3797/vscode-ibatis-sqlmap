// sqlMap·mapper XML 주입 문법 회귀 검사: IDE 번들 토크나이저로 코퍼스 폴더의 XML 전부를 토큰화해 통과 조건 확인
// 사용: node test/tokenize_check.js [--corpus <dir>] [--exclude <a.xml,b.xml>] [--kw-base <N>] [--other <파일|폴더,...>] [--app <IDE resources/app>] [--uncolored]
//   기본 코퍼스 samples/, 기본 비교 대상 XML test/other/. --kw-base 를 주면 SQL 키워드 줄 하한(N 의 90%) 조건 추가
// 문법은 package.json 의 contributes.grammars 경유 로드(매니페스트 오류 검출). 불일치 시 파일:행 + 종료코드 1, 환경 오류는 2
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const list = (v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
const APP_CANDIDATES = [
  path.join(process.env.LOCALAPPDATA || "", "Programs", "Antigravity IDE", "resources", "app"),
  path.join(process.env.LOCALAPPDATA || "", "Programs", "Microsoft VS Code", "resources", "app"),
  "/Applications/Visual Studio Code.app/Contents/Resources/app",
  "/usr/share/code/resources/app",
];
const APP = opt("--app") || APP_CANDIDATES.find((p) => fs.existsSync(path.join(p, "node_modules", "vscode-textmate"))) || APP_CANDIDATES[0];
const CORPUS = path.resolve(opt("--corpus") || path.join(ROOT, "samples"));
const EXCLUDE = new Set(list(opt("--exclude")));
const OTHER = list(opt("--other")).map((p) => path.resolve(p));
if (!OTHER.length) OTHER.push(path.join(ROOT, "test", "other"));
const KW_LINES_BASE = opt("--kw-base") ? Number(opt("--kw-base")) : null;
const UNCOLORED = argv.includes("--uncolored");
const SHOW = 8; // 조건별 불일치 예시 출력 상한

const RT = "meta.sqlmap.xml";
const STMT = "meta.statement.sqlmap.xml";
const EMB = "meta.embedded.";
const SQLC = "meta.embedded.block.sql";
const SQLT = "meta.embedded.inline.sql";
const BIND = "variable.parameter.bind.sqlmap";
const SUB = "keyword.control.substitution.sqlmap";
const KW = "keyword.other.sql";
const FN = "support.function.sql";
const NUM = "constant.numeric.sql";
const STR = "string.quoted.single.sql";
const DQ = "string.quoted.double.sql";
const CMT = "comment";
const TAG = "entity.name.tag";
const TAGNAME = "entity.name.tag.localname.xml";
const ATTR = "entity.other.attribute-name";
const XSTR = "string.quoted.double.xml";
const CD = "punctuation.definition.tag.cdata";
const PTS = "punctuation.definition.tag";
const ENT = "constant.character.entity";
const CDATA_STR = "string.unquoted.cdata.xml";
const JEB = "punctuation.definition.jdbc-escape.begin.sqlmap";
const JEE = "punctuation.definition.jdbc-escape.end.sqlmap";
const FNAME = "entity.name.function.sql";
const ASSIGN = "keyword.operator.assignment.sql";
const TAGS = "select|insert|update|delete|statement|procedure|sql";
// 문법과 독립인 느슨한 자리표시자 형태(조건 6). 문법 쪽 정규식이 좁아져 놓치는 것이 생기면 여기서 드러남
const PH_RE = /#[A-Za-z_][^#\s]*#|\$[A-Za-z_][^$\s]*\$/g;

// 단어 목록: 문법의 sql-words 와 같아야 함(매니페스트 조건에서 대조). 고칠 때는 양쪽을 같이
const FNS = "nvl nvl2 decode coalesce nullif greatest least to_char to_number to_date to_timestamp cast convert substr substrb instr length lengthb lpad rpad ltrim rtrim trim upper lower initcap replace translate concat chr ascii regexp_replace regexp_substr regexp_instr regexp_like regexp_count round trunc ceil floor abs mod power sqrt sign exp ln log add_months months_between last_day next_day extract sum count avg max min stddev variance median listagg row_number rank dense_rank ntile lag lead first_value last_value ratio_to_report sys_connect_by_path xmlagg xmlelement wm_concat ifnull isnull if now date_format str_to_date concat_ws group_concat substring left right date_add date_sub datediff sys_guid curdate last_insert_id char_length to_clob string_agg array_agg generate_series date_trunc getdate dateadd iif len charindex newid varchar_format".split(" ");
const KWS = "select distinct from where and or not in is null like between exists case when then else end as on join inner left right full outer cross natural using union all intersect minus except group by order having asc desc nulls first last limit offset fetch with over partition rollup cube connect prior start level nocycle any some escape for insert into values update set delete merge matched returning create alter drop truncate table index view sequence commit rollback call begin declare rownum rowid dual sysdate systimestamp nextval currval true false rows only nowait within siblings unbounded preceding following current interval default duplicate key of recursive replace current_date current_timestamp ilike lateral pivot unpivot nolock conflict".split(" ");

// 고정 사례: 합성 조각. 실무 sqlMap 은 모양이 단조로운 경우가 많아(전부 CDATA, 닫는 태그는 자기 줄) 코퍼스 조건만으로는
// 규칙이 일부 망가져도 통과하므로 가장자리 모양을 여기서 단언. expect 항목: [줄(0부터), 토큰 문자열, 있어야 할 scope 접두, 없어야 할 scope 접두]
const S = (id) => "<select id=\"" + id + "\">";
const SM = "<sqlMap namespace=\"t\">";
const FIXTURES = [
  {
    name: "F1 iBatis 2 + CDATA",
    lines: ["<?xml version=\"1.0\" encoding=\"UTF-8\" ?>", "<!DOCTYPE sqlMap PUBLIC \"-//iBATIS.com//DTD SQL Map 2.0//EN\" \"http://ibatis.apache.org/dtd/sql-map-2.dtd\">", SM, "\t<typeAlias alias=\"Vo\" type=\"com.x.Vo\"/>", "\t<!-- note -->", "\t<select id=\"selA\" resultClass=\"Vo\" parameterClass=\"Map\">", "\t<![CDATA[", "\t\tSELECT NVL(A.CNT, 0) CNT, TO_CHAR(SYSDATE, 'YYYYMMDD') DT", "\t\tFROM T_A A", "\t\tWHERE A.CD = #cd# AND A.NM LIKE '%' || #nm# || '%'", "\t\t\t$query$", "\t\t\tAND A.X < 10 AND A.Y <> 'n$z$' AND <B> = 1", "\t\t#lead#, ROWNUM", "\t]]>", "\t</select>", "\t<update id=\"updA\">", "\t<![CDATA[", "\t\tUPDATE T_A SET X = #x:NUMERIC# WHERE ID IN (#ids[]#) AND S = #status#", "\t]]>", "\t</update>", "</sqlMap>", "<after/>"],
    expect: [[2, "sqlMap", TAG], [2, "sqlMap", RT], [3, "typeAlias", TAG], [3, "typeAlias", null, EMB], [4, "note", CMT], [5, "select", TAG], [5, "select", STMT], [5, "select", null, EMB], [5, "selA", XSTR], [5, "resultClass", ATTR], [6, "<![CDATA[", CD], [6, "<![CDATA[", SQLT], [6, "<![CDATA[", null, SQLC], [6, "<![CDATA[", null, "string.unquoted"],
      [7, "SELECT", KW], [7, "SELECT", SQLC], [7, "NVL", FN], [7, "TO_CHAR", FN], [7, "SYSDATE", KW], [7, "YYYYMMDD", STR], [7, "0", NUM], [8, "FROM", KW], [9, "cd#", BIND], [9, "nm#", BIND], [9, "%", STR], [9, "LIKE", KW], [10, "$query$", SUB], [11, "10", NUM], [11, "$z$", SUB], [11, "$z$", STR], [11, "B>", null, TAG], [12, "lead", BIND], [12, "ROWNUM", KW], [13, "]]>", CD], [13, "]]>", null, SQLC],
      [14, "select", TAG], [14, "select", null, EMB], [17, "UPDATE", KW], [17, "x:NUMERIC", BIND], [17, "ids[]", BIND], [17, "status", BIND], [17, "status", null, KW], [19, "update", TAG], [20, "sqlMap", TAG], [20, "sqlMap", RT], [21, "after", TAG], [21, "after", null, RT]],
  },
  {
    name: "F2 iBatis 2 동적 태그",
    lines: [SM, "<select id=\"a\" parameterClass=\"map\" resultClass=\"hmap\">", "  SELECT A, B FROM T", "  <dynamic prepend=\"WHERE\">", "    <isNotEmpty prepend=\"AND\" property=\"x\"> A = #x# </isNotEmpty>", "    <isGreaterThan prepend=\"AND\" property=\"n\" compareValue=\">\"> N &gt; #n# </isGreaterThan>", "    <iterate property=\"list\" open=\"(\" close=\")\" conjunction=\",\">#list[]#</iterate>", "  </dynamic>", "  <!-- c: </select> inside xml comment -->", "  ORDER BY $sort$", "</select>", "<procedure id=\"p\" parameterMap=\"pm\">{call PKG.PROC(#a#, #b#)}</procedure>", "<statement id=\"s\">", "  DELETE FROM T WHERE A = #a#", "</statement>", "</sqlMap>"],
    expect: [[2, "SELECT", KW], [2, "SELECT", SQLT], [2, "SELECT", null, SQLC], [3, "dynamic", TAG], [3, "dynamic", SQLT], [3, "WHERE", XSTR], [3, "WHERE", null, KW], [4, "isNotEmpty", TAG], [4, "x#", BIND], [5, "&gt;", ENT], [5, "n#", BIND], [5, " N ", null, "meta.tag"], [5, " N ", SQLT], [6, "list[]", BIND], [6, "iterate", TAG], [8, "inside", CMT], [9, "ORDER", KW], [9, "$sort$", SUB], [10, "</select", PTS], [10, "</select", null, EMB], [11, "procedure", TAG], [11, "call", KW], [11, "a#", BIND], [12, "statement", TAG], [12, "statement", STMT], [13, "DELETE", KW], [13, "a#", BIND], [14, "</statement", null, EMB], [15, "sqlMap", TAG]],
  },
  {
    name: "F3 MyBatis 3",
    lines: ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", "<!DOCTYPE mapper PUBLIC \"-//mybatis.org//DTD Mapper 3.0//EN\" \"http://mybatis.org/dtd/mybatis-3-mapper.dtd\">", "<mapper namespace=\"com.x.UserMapper\">", "  <resultMap id=\"r\" type=\"User\"><id column=\"id\" property=\"id\"/></resultMap>", "  <sql id=\"cols\">id, name</sql>", "  <select id=\"find\" resultMap=\"r\">SELECT <include refid=\"cols\"/> FROM users WHERE id = #{id}</select>", "  <select id=\"list\" resultType=\"User\">", "    SELECT * FROM users", "    <where>", "      <if test=\"name != null and name != ''\"> AND name LIKE CONCAT('%', #{name}, '%') </if>", "      <if test=\"age &gt; 0\"> AND age <![CDATA[ >= ]]> #{age} </if>", "    </where>", "    ORDER BY ${col}", "  </select>", "  <insert id=\"ins\" useGeneratedKeys=\"true\">", "    <selectKey keyProperty=\"id\" resultType=\"int\" order=\"BEFORE\">SELECT SEQ.NEXTVAL FROM DUAL</selectKey>", "    INSERT INTO users (id, name) VALUES (#{id}, #{name,jdbcType=VARCHAR})", "  </insert>", "</mapper>"],
    expect: [[3, "resultMap", TAG], [3, "resultMap", null, EMB], [4, "sql", TAG], [4, "id, name", SQLT], [4, "cols", null, EMB], [5, "SELECT", KW], [5, "include", TAG], [5, "FROM", KW], [5, "#{id}", BIND], [5, "</select", PTS], [5, "</select", null, EMB], [6, "select", STMT], [7, "FROM", KW], [8, "where", TAG], [9, "if", TAG], [9, "name != null", XSTR], [9, "LIKE", KW], [9, "CONCAT", FN], [9, "#{name}", BIND], [9, "'%'", STR], [10, "&gt;", ENT], [10, ">=", SQLC], [10, "#{age}", BIND], [10, "#{age}", null, SQLC], [10, "<![CDATA[", CD], [12, "ORDER", KW], [12, "${col}", SUB], [13, "</select", PTS], [13, "</select", null, EMB], [15, "selectKey", TAG], [15, "SEQ.NEXTVAL", SQLT], [15, "SEQ.NEXTVAL", null, KW], [15, "DUAL", KW], [16, "INSERT", KW], [16, "#{name,jdbcType=VARCHAR}", BIND], [17, "</insert", null, EMB], [18, "mapper", TAG]],
  },
  {
    name: "F4 닫는 태그가 SQL 줄 끝에",
    lines: [SM, S("x"), "  SELECT 1", "  FROM DUAL WHERE A > 0</select>", S("y"), "  SELECT 2 FROM DUAL", "</select>", "</sqlMap>"],
    expect: [[3, "FROM", KW], [3, "0", NUM], [3, "</select", PTS], [3, "</select", null, EMB], [4, "select", STMT], [5, "SELECT", KW], [6, "</select", null, EMB], [7, "sqlMap", TAG]],
  },
  {
    name: "F5 여러 줄 여는 태그",
    lines: ["<mapper namespace=\"t\">", "<select id=\"x\"", "        resultType=\"int\">", "  SELECT 1 FROM DUAL", "</select>", "<select", "   id=\"z\" resultType=\"int\"", ">SELECT 3 FROM DUAL</select>", "</mapper>"],
    expect: [[1, "id", ATTR], [2, "resultType", ATTR], [2, "resultType", null, EMB], [3, "SELECT", KW], [4, "</select", null, EMB], [6, "id", ATTR], [7, ">", PTS], [7, "SELECT", KW], [7, "</select", null, EMB], [8, "mapper", TAG]],
  },
  {
    name: "F6 자기닫힘·빈 문장",
    lines: ["<mapper namespace=\"t\">", "<sql id=\"e\"/>", "<resultMap id=\"r\" type=\"X\"/>", S("x") + "SELECT 1</select>", S("emp") + "</select>", S("y") + "SELECT 4</select>", "</mapper>", "<tail/>"],
    expect: [[1, "sql", TAG], [2, "resultMap", null, EMB], [2, "resultMap", null, STMT], [3, "SELECT", KW], [4, "</select", PTS], [5, "SELECT", KW], [7, "tail", null, RT], [7, "tail", TAG]],
  },
  {
    name: "F7 루트가 아닌 것",
    lines: ["<sqlMapConfig>", "  <settings useStatementNamespaces=\"true\"/>", "  <sqlMap resource=\"map/sqlMap/a.xml\"/>", "  <sqlMap", "     resource=\"map/sqlMap/b.xml\"/>", "  <sqlMap resource=\"c.xml\"></sqlMap>", "  <sqlMap resource=\"a>.xml\"/>", "</sqlMapConfig>", "<configuration><mappers><mapper resource=\"a.xml\"/></mappers></configuration>", "<mapper type=\"glob\"", "  from=\"*.java\" to=\"*.class\"/>", "<copy todir=\"x\"><mapper type=\"glob\" from=\"*\" to=\"*\"></mapper></copy>", "<mapper namespace=\"a\"/>", "<mapper type=\"a>b\"/>", "<mapper-x>", "<sql driver=\"d\">it's</sql>", S("x") + "SELECT 1</select>", "<mappers><mapper resource=\"a.xml\"></mapper><mapper resource=\"b.xml\"></mapper></mappers>", "<environments><select>x 1 from</select></environments>", "<mapper namespace=\"e\"></mapper><delete>where 2</delete>"],
    expect: [[2, "sqlMap", null, RT], [3, "sqlMap", null, RT], [4, "resource", null, RT], [6, "sqlMap", null, RT], [7, "sqlMapConfig", null, RT], [8, "mapper", null, RT], [9, "mapper", null, RT], [11, "copy", TAG], [12, "mapper", null, RT], [13, "mapper", null, RT], [14, "mapper-x", null, RT], [15, "it's", null, EMB], [15, "it's", null, "string"], [16, "SELECT", null, KW], [16, "SELECT", null, EMB], [17, "b.xml", XSTR], [17, "b.xml", null, RT], [17, "</mappers", PTS], [18, "from", null, KW], [18, " 1 ", null, EMB], [18, "select", null, STMT], [19, "where", null, KW], [19, "delete", null, STMT]],
  },
  {
    name: "F8 sqlMap 이 아닌 XML",
    lines: ["<project name=\"x\">", "  <target name=\"clean\"><delete dir=\"build\"/></target>", "  <sql driver=\"d\" url=\"u\">", "    DROP TABLE T;", "  </sql>", "  <select name=\"a\"><option>1</option></select>", "  <![CDATA[ <sqlMap namespace=\"t\"> <select id=\"q\">SELECT 9</select> ]]>", "</project>"],
    expect: [[2, "sql", null, STMT], [3, "DROP", null, KW], [3, "DROP", null, EMB], [5, "select", null, STMT], [5, "option", TAG], [6, "SELECT", null, KW], [6, "sqlMap", null, RT], [7, "project", null, RT]],
  },
  {
    name: "F9 주석 처리된 문장",
    lines: [SM, "<!--", S("old"), "  SELECT 1 FROM DUAL WHERE A = #a#", "</select>", "-->", S("live"), "  SELECT 2 FROM DUAL", "</select>", "</sqlMap>"],
    expect: [[2, "select", CMT], [3, "SELECT", CMT], [3, "SELECT", null, KW], [3, "a#", null, BIND], [7, "SELECT", KW], [9, "sqlMap", TAG]],
  },
  {
    name: "F10 CDATA 안에서 닫히지 않은 것",
    lines: [SM, S("a"), "<![CDATA[", "  SELECT 'abc FROM T", "  WHERE X = 1", "]]>", "</select>", S("b"), "<![CDATA[ SELECT 1 /* open", "]]>", "</select>", S("c"), "<![CDATA[ SELECT \"x FROM `y", "]]>", "</select>", S("d"), "<![CDATA[ SELECT a %{ b, c[1 ]]>", "</select>", S("d2"), "<![CDATA[ SELECT N'abc ]]> AND b = 'x'", "</select>", S("e"), "  SELECT 2 FROM DUAL", "</select>", "</sqlMap>"],
    expect: [[4, "WHERE", STR], [5, "]]>", CD], [6, "</select", PTS], [6, "</select", null, "string"], [9, "]]>", CD], [10, "</select", PTS], [10, "</select", null, CMT], [12, "x FROM", DQ], [13, "]]>", CD], [14, "</select", PTS], [16, "]]>", CD], [17, "</select", PTS], [17, "</select", null, EMB], [19, "]]>", CD], [19, "AND b", KW], [19, "AND b", null, SQLC], [19, "'x'", STR], [20, "</select", PTS], [20, "</select", null, "string"], [22, "SELECT", KW], [22, "SELECT", null, "string"], [22, "SELECT", null, CMT], [24, "sqlMap", TAG]],
  },
  {
    name: "F11 CDATA 안의 닫는 태그 글자",
    lines: [SM, S("e"), "<![CDATA[", "  SELECT '</select>' FROM DUAL -- </select>", "  WHERE A = 1 /* </select> */", "]]>", "</select>", S("f"), "  SELECT 2 FROM DUAL", "</select>", "</sqlMap>"],
    expect: [[3, "</select>", STR], [3, "FROM", KW], [3, "-- <", CMT], [4, "WHERE", KW], [4, "WHERE", SQLC], [4, "/* <", CMT], [5, "]]>", CD], [6, "</select", PTS], [6, "</select", null, EMB], [8, "SELECT", KW], [10, "sqlMap", TAG]],
  },
  {
    name: "F12 CDATA 밖에서 닫히지 않은 것",
    lines: [SM, "<select id=\"a\"", ">", "SELECT 1 /* open", "</select>", S("b"), "  SELECT 'abc", "  FROM T AS \"x </select>", S("c") + "SELECT 1 -- c</select>", S("d"), "  FROM t -- c</select>", S("d2") + "a[1</select><!-- ] -->", S("d3") + "SELECT N'x</select>" + S("d4") + "SELECT 'y'</select>", S("d5"), "COMMENT ON TABLE t</select> IS x", S("e"), "  SELECT 2 FROM DUAL a[<include refid=\"x\"/>]", "</select>", "</sqlMap>", "<x a=\"1\">t</x>"],
    expect: [[2, ">", PTS], [3, "SELECT", KW], [3, "open", CMT], [4, "</select", PTS], [4, "</select", null, CMT], [5, "select", STMT], [6, "abc", STR], [7, "x ", STR], [7, "</select", PTS], [7, "</select", null, "string"], [8, "SELECT", KW], [8, " c<", CMT], [8, "</select", PTS], [8, "</select", null, CMT], [9, "select", STMT], [10, "FROM", KW], [10, "</select", PTS], [11, "</select", PTS], [11, "</select", null, EMB], [11, "<!-- ]", CMT], [11, "<!-- ]", null, EMB], [12, "</select", PTS], [12, "</select", null, "string"], [12, "d4", XSTR], [12, "'y'", STR], [14, "</select", PTS], [14, "</select", null, EMB], [14, "IS x", null, EMB], [15, "select", STMT], [16, "SELECT", KW], [16, "include", TAG], [17, "</select", null, EMB], [18, "sqlMap", TAG], [19, "x", TAG], [19, "x", null, RT], [19, "t<", null, EMB]],
  },
  {
    name: "F13 CDATA 경계",
    lines: [SM, S("a"), "  <![CDATA[ AND a < 1 -- c ]]>", "  <isNotEmpty property=\"x\"> AND b = #x# </isNotEmpty>", "</select>", S("b") + "<![CDATA[", "  SELECT 1 FROM t WHERE a < 1", "]]></select>", S("c"), "  <![CDATA[ WHERE a < 'x' ]]> </select>", S("c2") + "<![CDATA[ AND T.ITEM#CD>=]]>#cd#</select>", S("c3") + "<![CDATA[ ${a ]]> + {b} 'x#b]]>'||#c#</select>", S("d"), "  SELECT 2 FROM DUAL", "</select", ">", "<update id=\"u\">", "  x", "</update>", "</sqlMap >", "<after/>"],
    expect: [[2, "-- c", CMT], [2, "]]>", CD], [3, "isNotEmpty", TAG], [3, "x#", BIND], [4, "</select", PTS], [5, "<![CDATA[", CD], [6, "SELECT", KW], [7, "]]>", CD], [7, "</select", PTS], [7, "</select", null, EMB], [9, "'x'", STR], [9, "]]>", CD], [9, "</select", PTS], [10, "]]>", CD], [10, "cd#", BIND], [10, "cd#", null, SQLC], [10, "</select", PTS], [10, "</select", null, EMB], [11, "]]>", CD], [11, "</select", PTS], [11, "</select", null, EMB], [13, "SELECT", KW], [14, "</select", PTS], [14, "</select", null, EMB], [16, "update", STMT], [16, "update", null, EMB], [18, "</update", PTS], [19, "sqlMap", TAG], [20, "after", null, RT]],
  },
  {
    name: "F14 SQL 주석",
    lines: [SM, S("g"), "<![CDATA[", "  SELECT /*+ INDEX(A IX1) */ A.X -- don't break", "  , /* multi", "       line */ A.Y", "  -- lead comment #x#", "  FROM T A", "]]>", "</select>", S("h"), "  SELECT 1 /* <if test=\"a\">AND a = #{a}</if> */ FROM T", "  -- note <isNotEmpty property=\"x\"> y", "  WHERE 1 = 1", "</select>", "</sqlMap>"],
    expect: [[3, "INDEX", CMT], [3, "don't", CMT], [4, "multi", CMT], [5, "line", CMT], [5, "A.Y", null, CMT], [6, "lead", CMT], [6, "--", CMT], [6, "x#", null, BIND], [7, "FROM", KW], [9, "</select", null, EMB], [11, "if", TAG], [11, "AND a", CMT], [11, "FROM", KW], [11, "FROM", null, CMT], [12, "note", CMT], [12, "isNotEmpty", TAG], [12, " y", CMT], [13, "WHERE", KW], [13, "WHERE", null, CMT], [14, "</select", PTS]],
  },
  {
    name: "F15 루트 변형",
    lines: [SM + S("x") + "SELECT 1</select></sqlMap>", "<sqlMap>", S("x") + "SELECT 5</select>", "</sqlMap>", "<!-- <sqlMap namespace=\"c\"> -->", S("x") + "SELECT 7</select>", "<mapper", "   namespace=\"n\">", S("x") + "SELECT 8</select>", "<mapper xmlns=\"u\" namespace=\"t\"", ">", S("x") + "SELECT 9</select>", "</mapper", ">", "<zz/>", "<mapper namespace=\"p\">" + S("x") + "SELECT 3</select></mapper><mapper namespace=\"q\">", S("x") + "SELECT 6</select>", "</mapper>", "<yy/>"],
    expect: [[0, "SELECT", KW], [2, "SELECT", KW], [5, "SELECT", null, KW], [8, "SELECT", null, KW], [11, "SELECT", KW], [12, "mapper", TAG], [14, "zz", null, RT], [15, "SELECT", KW], [15, "q", XSTR], [16, "SELECT", KW], [18, "yy", null, RT], [18, "yy", TAG]],
  },
  {
    name: "F16 자리표시자",
    lines: [SM, S("a") + "SELECT 1</select>" + S("b") + "SELECT 2 FROM V$SESSION WHERE SID = $sid$ AND SERIAL# = #ser# AND C = '&lt;'</select>", S("c"), "  SELECT ln, IS_DUAL, MINUS_AMT FROM V$SESSION a, V$LOCK b", "  WHERE n LIKE '%${nm}%' AND NVL(a,b)=1 AND m = '#{x}' AND k LIKE '%<isNotEmpty property=\"a\">$a$</isNotEmpty>%' AND z = 1", "</select>", "</sqlMap>"],
    expect: [[1, "SELECT 2", KW], [1, "SESSION", null, SUB], [1, "sid$", SUB], [1, "ser#", BIND], [1, "SERIAL", null, BIND], [1, "&lt;", ENT], [1, "&lt;", STR], [3, "ln", null, FN], [3, "DUAL", null, KW], [3, "MINUS", null, KW], [3, "SESSION", null, SUB], [3, "LOCK", null, SUB], [3, " a,", null, SUB], [4, "${nm}", SUB], [4, "${nm}", STR], [4, "NVL", FN], [4, "#{x}", BIND], [4, "isNotEmpty", TAG], [4, "$a$", SUB], [4, "AND z", KW], [4, "AND z", null, "string"], [5, "</select", PTS]],
  },
  {
    name: "F17 XML 주석 속 닫는 태그, 다른 문장 태그",
    lines: [SM, S("a"), "SELECT 1", "<!--", "</select>", "old 'x", "-->", "FROM t", "</select>", "<sql id=\"s\">", "  A, B", "</sql>", "<procedure id=\"p\">", "  {call P(#a#)}", "</procedure>", "<statement id=\"st\">", "  SELECT 3", "</statement>", S("z"), "  SELECT 2 FROM DUAL", "</select>", "</sqlMap>"],
    expect: [[4, "select", CMT], [5, "old", CMT], [7, "FROM", KW], [8, "</select", PTS], [8, "</select", null, EMB], [9, "sql", STMT], [10, "A, B", SQLT], [11, "</sql", null, EMB], [12, "procedure", STMT], [13, "a#", BIND], [14, "</procedure", null, EMB], [15, "statement", STMT], [16, "SELECT", KW], [17, "</statement", null, EMB], [18, "select", STMT], [19, "SELECT", KW], [20, "</select", null, EMB], [21, "sqlMap", TAG]],
  },
  {
    name: "F18 단어 목록 전체",
    lines: [SM, S("w"), "<![CDATA[", " " + FNS.map((f) => f.toUpperCase() + "(A)").join(" , "), " " + KWS.map((k) => k.toUpperCase()).join(" ") + " ", " select nvl, ln, substr from t where A.END = B.LEVEL and X.DESC = 1 and X90_CNT = 0.85 and IS_DUAL = MINUS_AMT and c = to_char (d)", "]]>", "</select>", "</sqlMap>"],
    expect: [].concat(FNS.map((f) => [3, " " + f.toUpperCase() + "(", FN]), KWS.map((k) => [4, " " + k.toUpperCase() + " ", KW]), [[5, "select", KW], [5, " nvl,", null, FN], [5, " ln,", null, FN], [5, " substr ", null, FN], [5, "END", null, KW], [5, "LEVEL", null, KW], [5, "DESC", null, KW], [5, "90", null, NUM], [5, "0.85", NUM], [5, "DUAL", null, KW], [5, "MINUS", null, KW], [5, "to_char", FN], [5, " 1 ", NUM]]),
  },
  {
    name: "F19 자리표시자·한정 이름 정밀도",
    lines: [SM, S("p"), "<![CDATA[", " SELECT DECODE(X,'#A',#{b},'c') AND y = 1 FROM T WHERE C IN ('#FF0000','#00FF00') AND D = DECODE(Z,'$A',${e},'f') AND g = 2", " SELECT ITEM#CD,STORE#CD FROM V$SESSION,V$LOCK WHERE V$SESSION.SID=V$LOCK.SID AND A.ITEM#CD=B.ITEM#CD", " SELECT OWNER.TB.LEVEL, S.T.END, $al$.DESC, #{a}.ORDER, SCH.SEQ.NEXTVAL FROM T WHERE X = :end AND Y = @set", " WHERE A = #x,jdbcType=VARCHAR,mode=IN# AND B = #y:NUMERIC:-9999# AND C = #d:DATE:1900/01/01# AND D = T_$sfx$.COL AND E = X.Y$z$ AND F = B.LEVEL#x2#", "]]>", "</select>", "</sqlMap>"],
    expect: [[3, "'#A'", STR], [3, "#A", null, BIND], [3, "#{b}", BIND], [3, "AND y", KW], [3, "AND y", null, "string"], [3, " 1 ", NUM], [3, "#FF0000", STR], [3, "#FF0000", null, BIND], [3, "#00FF00", STR], [3, "'$A'", STR], [3, "${e}", SUB], [3, "AND g", KW], [3, "AND g", null, "string"],
      [4, "#CD,STORE", null, BIND], [4, "$SESSION,V", null, SUB], [4, "$SESSION.SID", null, SUB], [4, "#CD=B", null, BIND], [4, "FROM", KW], [4, "WHERE", KW], [4, "AND A", KW],
      [5, "LEVEL", null, KW], [5, "END", null, KW], [5, "DESC", null, KW], [5, "ORDER", null, KW], [5, "NEXTVAL", null, KW], [5, "$al$", SUB], [5, "#{a}", BIND], [5, "end", null, KW], [5, "set", null, KW], [5, "FROM", KW], [5, "WHERE", KW],
      [6, "x,jdbcType=VARCHAR,mode=IN", BIND], [6, "y:NUMERIC:-9999", BIND], [6, "d:DATE:1900/01/01", BIND], [6, "$sfx$", SUB], [6, "$z$", SUB], [6, "#x2#", BIND], [6, "LEVEL", null, KW], [7, "]]>", CD], [8, "</select", PTS], [8, "</select", null, EMB]],
  },
  {
    // 변이 시험에서 다른 사례로는 드러나지 않던 규칙을 겨냥(백틱·큰따옴표, 점 뒤 함수, 키워드 이름의 별칭, 줄 주석 뒤 CDATA, 문자열 안 CDATA, #{ 가 ]]> 를 넘는 경우)
    name: "F20 보강",
    lines: [SM, S("q"), "<![CDATA[", " SELECT `a b`, \"c d\", $al$.NVL(1), KEY.A FROM T WHERE X = 1", "]]>", "  , `e f` , \"g h\" FROM T2", "  -- note2 <![CDATA[ a < 1 ]]>", "  WHERE Y = '<![CDATA[</select>]]>' AND Z = 2", "</select>", S("r") + "<![CDATA[ #{a ]]> + {b}</select>", "</sqlMap>"],
    expect: [[3, "a b", "string.quoted.other.backtick"], [3, "c d", DQ], [3, "NVL", null, FN], [3, "KEY", null, KW], [3, "FROM", KW], [3, " 1", NUM], [5, "e f", "string.quoted.other.backtick"], [5, "g h", DQ], [5, "FROM", KW], [6, "note2", CMT], [6, "<![CDATA[", CD], [6, "]]>", CD],
      [7, "WHERE", KW], [7, "<![CDATA[", CD], [7, "</select>", STR], [7, "AND Z", KW], [7, "AND Z", null, "string"], [8, "</select", PTS], [8, "</select", null, EMB], [9, "]]>", CD], [9, "</select", PTS], [9, "</select", null, EMB], [10, "sqlMap", TAG]],
  },
  {
    // parameterMap 식 ? 와 JDBC 이스케이프 {call ..}. ?? (PostgreSQL JSON 연산자의 JDBC 이스케이프)도 바인드 색으로 둠(사용자 결정)
    name: "F21 ? 자리표시자·{call}",
    lines: [SM, "<select id=\"b1\" parameterMap=\"pm\">", "  SELECT A FROM T WHERE X = ? AND Y = ?? AND Z = '?s' -- ?c", "  AND W /* ?b */ = ?</select>",
      S("b2") + "<![CDATA[ SELECT 1 FROM T WHERE A = ? AND B = '?q' AND C ?? 'k' -- ?d ]]></select>",
      "<procedure id=\"c1\" parameterMap=\"pm\">", "  {call PKG.PROC(?, #a#, 'x?')}", "</procedure>",
      "<procedure id=\"c2\">{? = call NEXT_ID(?)}</procedure>",
      "<procedure id=\"c3\"><![CDATA[ { call PKG.P2(?) } ]]></procedure>",
      "<procedure id=\"c4\">", "  {call PKG.MULTI(", "    ?, ?)}", "</procedure>",
      "<select id=\"c5\">SELECT '{call X(?)}' FROM DUAL WHERE A = {b} -- {call Y}</select>",
      "<select id=\"c6\" statementType=\"CALLABLE\">{call PKG.P3(#{a,mode=IN,jdbcType=VARCHAR}, #{b,mode=OUT,jdbcType=NUMERIC})}</select>",
      "<procedure id=\"c7\"><![CDATA[ {call PKG.P4(#a#) ]]> } </procedure>",
      // 이름 [\w$#]* 가 # · $ 를 먹은 뒤에도 되돌아가 {..} 전체를 칠하는지(머리+선택 꼬리 한 규칙으로 합치면 깨지는 모양)
      "<procedure id=\"c8\">{call P#{a}}</procedure>",
      "<procedure id=\"c9\">{call PKG_${env}.PROC(#{a})}</procedure>",
      "<procedure id=\"c10\">{call A.B${x}.C(?)}</procedure>",
      "</sqlMap>"],
    expect: [[2, "? AND Y", BIND], [2, "? AND Y", SQLT], [2, "?? AND Z", BIND], [2, "? AND Z", BIND], [2, "AND Y", KW], [2, "?s", STR], [2, "?s", null, BIND], [2, "?c", CMT], [2, "?c", null, BIND],
      [3, "?b", CMT], [3, "?b", null, BIND], [3, "?</select", BIND], [3, "</select", PTS], [3, "</select", null, EMB],
      [4, "? AND B", BIND], [4, "? AND B", SQLC], [4, "?q", STR], [4, "?q", null, BIND], [4, "?? 'k'", BIND], [4, "? 'k'", BIND], [4, "?d", CMT], [4, "?d", null, BIND], [4, "]]>", CD], [4, "</select", null, EMB],
      [6, "{call", JEB], [6, "{call", SQLT], [6, "call", KW], [6, "PKG.PROC", FNAME], [6, "?, #a#", BIND], [6, "a#", BIND], [6, "?')", STR], [6, "?')", null, BIND], [6, "}", JEE], [7, "</procedure", PTS], [7, "</procedure", null, EMB],
      [8, "{?", JEB], [8, "? = call", BIND], [8, "= call", ASSIGN], [8, "call", KW], [8, "NEXT_ID", FNAME], [8, "?)}", BIND], [8, "}</", JEE], [8, "</procedure", PTS], [8, "</procedure", null, EMB],
      [9, "{ call", JEB], [9, "{ call", SQLC], [9, "PKG.P2", FNAME], [9, "?)", BIND], [9, "} ]]>", JEE], [9, "]]>", CD], [9, "</procedure", PTS], [9, "</procedure", null, EMB],
      [11, "{call", JEB], [11, "PKG.MULTI", FNAME], [12, "?, ?", BIND], [12, "?)}", BIND], [12, "}", null, JEE], [13, "</procedure", null, EMB],
      [14, "{call X", STR], [14, "{call X", null, JEB], [14, "?)}'", STR], [14, "?)}'", null, BIND], [14, "FROM", KW], [14, "{b}", null, JEB], [14, "} --", null, JEE], [14, "{call Y", CMT], [14, "{call Y", null, JEB], [14, "</select", PTS],
      [15, "{call", JEB], [15, "PKG.P3", FNAME], [15, "#{a,", BIND], [15, "#{b,", BIND], [15, "}</select", JEE], [15, "</select", null, EMB],
      [16, "{call", JEB], [16, "a#", BIND], [16, "]]>", CD], [16, "]]>", null, SQLC], [16, "} </", null, JEE], [16, "</procedure", PTS], [16, "</procedure", null, EMB],
      [17, "{call", JEB], [17, "P#{a}", FNAME], [17, "#{a}", BIND], [17, "#{a}", null, FNAME], [17, "}</", JEE], [17, "</procedure", null, EMB],
      [18, "PKG_", FNAME], [18, "${env}", SUB], [18, "${env}", null, FNAME], [18, ".PROC(", null, FNAME], [18, "PROC(", null, FN], [18, "#{a}", BIND], [18, "}</", JEE],
      [19, "A.B", FNAME], [19, "${x}", SUB], [19, ".C(", null, FNAME], [19, "?)}", BIND], [19, "}</", JEE], [19, "</procedure", null, EMB],
      [20, "sqlMap", TAG]],
  },
  {
    // 단어 경계·대소문자·같은 단어의 두 역할·근접 오탐·합자(대소문자 접기로 fl→ﬂ 등이 맞는 현재 동작 고정). CDATA 밖(2~4행)과 안(7~9행) 같은 줄
    name: "F22 단어 경계·대소문자·합자",
    lines: [SM, S("k1"),
      "  Select NvL(a) Left Join t ON LEFT (a) = REPLACE (b) left join u REPLACE INTO v",
      "  INDEXES INTO_X ASCII2(1) LEFTY(1) ORDERS nv(1) nvl3(1) selects current_ SUBSTRI(1)",
      "  ﬂoor(1) ﬁrst oﬀset",
      "</select>", S("k2") + "<![CDATA[",
      "  Select NvL(a) Left Join t ON LEFT (a) = REPLACE (b) left join u REPLACE INTO v",
      "  INDEXES INTO_X ASCII2(1) LEFTY(1) ORDERS nv(1) nvl3(1) selects current_ SUBSTRI(1)",
      "  ﬂoor(1) ﬁrst oﬀset",
      "]]></select>", "</sqlMap>"],
    expect: [].concat(...[[2, SQLT], [7, SQLC]].map(([r, ctx]) => [
      [r, "Select", KW], [r, "Select", ctx], [r, "NvL", FN], [r, "Left Join", KW], [r, "Join t", KW], [r, "LEFT (a)", FN], [r, "REPLACE (b)", FN], [r, "left join", KW], [r, "join u", KW], [r, "REPLACE INTO", KW], [r, "INTO v", KW],
      [r + 1, "INDEXES", null, KW], [r + 1, "INTO_X", null, KW], [r + 1, "ASCII2", null, FN], [r + 1, "LEFTY", null, FN], [r + 1, "LEFTY", null, KW], [r + 1, "ORDERS", null, KW], [r + 1, "nv(", null, FN], [r + 1, "nvl3", null, FN], [r + 1, "selects", null, KW], [r + 1, "current_", null, KW], [r + 1, "SUBSTRI", null, FN],
      [r + 2, "ﬂoor", FN], [r + 2, "ﬁrst", KW], [r + 2, "oﬀset", KW],
    ]), [[10, "]]>", CD], [10, "</select", null, EMB], [11, "sqlMap", TAG]]),
  },
  {
    // 방언 단어. 함수는 여는 괄호가 뒤따를 때만, 키워드는 컬럼명으로 드문 것만. TOP·VALUE·OUTPUT·DO·NOTHING·UR 은 컬럼명과 겹쳐 일부러 무색(결정 고정). CDATA 밖(2~4행)과 안(7~9행) 같은 줄
    name: "F23 방언 단어",
    lines: [SM, S("d1"),
      "  SELECT TOP 5 len, LEN(a), value, output FROM t WITH (NOLOCK) WHERE n ILIKE 'x%' AND d = GETDATE()",
      "  INSERT INTO u (a) VALUES (1) ON CONFLICT (a) DO NOTHING",
      "  SELECT * FROM t CROSS JOIN LATERAL f(a) x PIVOT (SUM(v) FOR k IN (1)) p UNPIVOT (q FOR r IN (s)) z WITH UR",
      "</select>", S("d2") + "<![CDATA[",
      "  SELECT TOP 5 len, LEN(a), value, output FROM t WITH (NOLOCK) WHERE n ILIKE 'x%' AND d = GETDATE()",
      "  INSERT INTO u (a) VALUES (1) ON CONFLICT (a) DO NOTHING",
      "  SELECT * FROM t CROSS JOIN LATERAL f(a) x PIVOT (SUM(v) FOR k IN (1)) p UNPIVOT (q FOR r IN (s)) z WITH UR",
      "]]></select>", "</sqlMap>"],
    expect: [].concat(...[[2, SQLT], [7, SQLC]].map(([r, ctx]) => [
      [r, " TOP ", null, KW], [r, "len,", null, FN], [r, "LEN(", FN], [r, "LEN(", ctx], [r, "value", null, KW], [r, "output", null, KW], [r, "NOLOCK", KW], [r, "ILIKE", KW], [r, "GETDATE", FN],
      [r + 1, "CONFLICT", KW], [r + 1, "DO NOTHING", null, KW], [r + 1, "NOTHING", null, KW],
      [r + 2, "LATERAL", KW], [r + 2, "PIVOT", KW], [r + 2, "UNPIVOT", KW], [r + 2, " UR", null, KW],
    ]), [[10, "]]>", CD], [10, "</select", null, EMB], [11, "sqlMap", TAG]]),
  },
];

function die(msg) {
  console.error("환경 오류: " + msg);
  process.exit(2);
}

function loadModules() {
  const rel = (...p) => path.join(APP, "node_modules", ...p);
  const tmPath = rel("vscode-textmate", "release", "main.js");
  const onPath = rel("vscode-oniguruma", "release", "main.js");
  const wasmPath = rel("vscode-oniguruma", "release", "onig.wasm");
  for (const p of [tmPath, onPath, wasmPath]) {
    if (!fs.existsSync(p)) die("IDE 번들 모듈 없음: " + p + " (IDE 업데이트로 경로가 바뀌었으면 --app 지정)");
  }
  const b = fs.readFileSync(wasmPath);
  return { tm: require(tmPath), on: require(onPath), wasm: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
}

// 내장 확장의 package.json 에서 scopeName 으로 문법 파일 경로 조회
function builtinGrammar(extDir, scopeName) {
  const dir = path.join(APP, "extensions", extDir);
  const pj = path.join(dir, "package.json");
  if (!fs.existsSync(pj)) die("내장 확장 없음: " + dir);
  const g = ((JSON.parse(fs.readFileSync(pj, "utf8")).contributes || {}).grammars || []).find((x) => x.scopeName === scopeName);
  if (!g) die("내장 확장 " + extDir + " 에 " + scopeName + " 문법 없음");
  return path.join(dir, g.path);
}

// 문법의 sql-words 에서 단어 목록을 꺼내 스크립트 목록과 대조
function diffWords(label, pattern, mine, problems) {
  const m = /\(\?:([a-z0-9_|]+)\)/.exec((pattern || {}).match || "");
  if (!m) { problems.push(label + " 목록을 문법에서 찾지 못함"); return; }
  const theirs = m[1].split("|");
  const onlyG = theirs.filter((w) => !mine.includes(w)), onlyS = mine.filter((w) => !theirs.includes(w));
  if (onlyG.length || onlyS.length) problems.push(label + " 목록 불일치(문법에만: " + (onlyG.join(",") || "-") + " / 스크립트에만: " + (onlyS.join(",") || "-") + ")");
}

// 이 확장의 매니페스트 검사 + 문법 로드. IDE 가 읽는 것과 같은 경로(package.json)를 거쳐야 매니페스트 오류가 드러남
function loadContributed(problems) {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const grammars = (pkg.contributes || {}).grammars || [];
  if (!grammars.length) problems.push("contributes.grammars 비어 있음");
  const out = [];
  for (const g of grammars) {
    const file = path.join(ROOT, g.path || "");
    if (!g.path || !fs.existsSync(file)) { problems.push("path 없음: " + g.path); continue; }
    let raw;
    try { raw = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { problems.push(g.path + " JSON 오류: " + e.message); continue; }
    if (raw.scopeName !== g.scopeName) problems.push(g.path + " scopeName 불일치(매니페스트 " + g.scopeName + ", 파일 " + raw.scopeName + ")");
    if (!Array.isArray(g.injectTo) || !g.injectTo.includes("text.xml")) problems.push(g.scopeName + " injectTo 에 text.xml 없음");
    if (!raw.injectionSelector) problems.push(g.path + " injectionSelector 없음");
    const words = ((raw.repository || {})["sql-words"] || {}).patterns || [];
    diffWords("함수", words[2], FNS, problems);
    diffWords("키워드", words[3], KWS, problems);
    out.push({ scopeName: raw.scopeName, injectTo: g.injectTo || [], raw });
  }
  if (!grammars.some((g) => (g.embeddedLanguages || {})[SQLC] === "sql")) problems.push("embeddedLanguages 에 " + SQLC + " → sql 매핑 없음");
  return out;
}

// sqlMap 이 아닌 XML(조건 10). --other 의 파일은 그대로, 폴더는 직하의 .xml 전부. 시크릿이 든 설정 파일은 넘기지 않음
function otherXml() {
  const out = [];
  for (const p of OTHER) {
    if (!fs.existsSync(p)) die("--other 경로 없음: " + p);
    if (fs.statSync(p).isDirectory()) { for (const f of fs.readdirSync(p).sort()) if (f.endsWith(".xml")) out.push(path.join(p, f)); }
    else out.push(p);
  }
  return out;
}

// 문법과 독립인 집계: XML 주석과 CDATA 를 걷어 낸 뒤 문장 태그 수, CDATA 안의 내용 있는 줄 수
function census(text) {
  const blank = (m) => m.replace(/[^\n]/g, " ");
  let cdataLines = 0;
  const bare = text.replace(/<!--[\s\S]*?-->/g, blank).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (m, body) => {
    for (const ln of body.split("\n")) if (/\S/.test(ln)) cdataLines++;
    return blank(m);
  });
  const count = (re) => (bare.match(re) || []).length;
  return {
    open: count(new RegExp("<(?:" + TAGS + ")(?=[\\s/>])", "g")),
    self: count(new RegExp("<(?:" + TAGS + ")(?=[\\s/>])(?:\"[^\"]*\"|'[^']*'|[^>\"'])*/>", "g")),
    close: count(new RegExp("</(?:" + TAGS + ")\\s*>", "g")),
    cdataLines,
  };
}

const depth = (s) => { let d = 0; while (s) { d++; s = s.parent; } return d; };

// scope 대조는 마디 단위 접두(같거나 그 아래 마디). 글자 접두로 하면 meta.embedded.inline.sqlx 같은 오타가 통과함
const has = (scopes, p) => scopes.some((s) => s === p || s.startsWith(p.endsWith(".") ? p : p + "."));

// 고정 사례 단언 실행. 토큰은 문자열이 놓인 열로 찾음(토큰 경계가 달라져도 같은 글자를 가리키도록). 사례 끝의 상태 깊이도 내장과 대조. 반환: 단언 수
function runFixtures(ours, base, initial, hit) {
  let n = 0;
  for (const fx of FIXTURES) {
    let state = initial, sb = initial;
    const rows = fx.lines.map((ln) => { const r = ours.tokenizeLine(ln, state); state = r.ruleStack; sb = base.tokenizeLine(ln, sb).ruleStack; return r.tokens; });
    for (const [li, text, must, mustNot] of fx.expect) {
      n++;
      const found = fx.lines[li].indexOf(text);
      const idx = found + (text.length - text.trimStart().length);
      const tok = found < 0 ? null : rows[li].find((t) => t.startIndex <= idx && idx < t.endIndex);
      const sc = tok ? tok.scopes : [];
      const at = fx.name + " " + (li + 1) + "행 [" + text.trim().slice(0, 30) + "]";
      if (!tok) hit("fixture", at + " 토큰 없음");
      else if (must && !has(sc, must)) hit("fixture", at + " 에 " + must + " 없음");
      else if (mustNot && has(sc, mustNot)) hit("fixture", at + " 에 " + mustNot + " 있음");
    }
    n++;
    if (depth(state) !== depth(sb)) hit("fixture", fx.name + " 끝 상태 깊이 " + depth(state) + " (내장 " + depth(sb) + ")");
  }
  return n;
}

async function main() {
  const SQLMAP = CORPUS;
  if (!fs.existsSync(SQLMAP)) die("코퍼스 폴더 없음: " + SQLMAP + " (--corpus 로 지정)");
  const { tm, on, wasm } = loadModules();
  await on.loadWASM(wasm);

  const manifestProblems = [];
  const contributed = loadContributed(manifestProblems);
  const xmlPath = builtinGrammar("xml", "text.xml");
  const onigLib = Promise.resolve({
    createOnigScanner: (patterns) => new on.OnigScanner(patterns),
    createOnigString: (s) => new on.OnigString(s),
  });
  const load = (inject) => new tm.Registry({
    onigLib,
    loadGrammar: async (scope) => {
      const c = contributed.find((g) => g.scopeName === scope);
      if (c) return JSON.parse(JSON.stringify(c.raw));
      return scope === "text.xml" ? JSON.parse(fs.readFileSync(xmlPath, "utf8")) : null;
    },
    getInjections: (scope) => (inject ? contributed.filter((g) => g.injectTo.includes(scope)).map((g) => g.scopeName) : []),
  }).loadGrammar("text.xml");
  const base = await load(false);
  const ours = await load(true);

  const T = { files: 0, lines: 0, tgtOpen: 0, tgtSelf: 0, tgtClose: 0, tgtCdata: 0, opened: 0, closed: 0, sqlcLines: 0, sqlLines: 0, kwLines: 0, outLines: 0, phMissed: 0, slowest: ["", 0, 0] };
  const scopeCount = { [KW]: 0, [FN]: 0, [BIND]: 0, [SUB]: 0 };
  const bad = {};
  const hit = (key, at) => { const b = bad[key] || (bad[key] = { n: 0, ex: [] }); b.n++; if (b.ex.length < SHOW) b.ex.push(at); };
  const cnt = (key) => (bad[key] ? bad[key].n : 0);
  const words = new Map(), calls = new Map();

  for (const f of fs.readdirSync(SQLMAP).filter((x) => x.endsWith(".xml") && !EXCLUDE.has(x)).sort()) {
    const text = fs.readFileSync(path.join(SQLMAP, f), "utf8");
    const c0 = census(text);
    T.tgtOpen += c0.open; T.tgtSelf += c0.self; T.tgtClose += c0.close; T.tgtCdata += c0.cdataLines;
    const lines = text.split(/\r?\n/);
    let sBase = tm.INITIAL, state = tm.INITIAL, ms = 0;
    T.files++;

    lines.forEach((ln, i) => {
      const a = base.tokenizeLine(ln, sBase); sBase = a.ruleStack;
      const t0 = process.hrtime.bigint();
      const r = ours.tokenizeLine(ln, state); state = r.ruleStack;
      ms += Number(process.hrtime.bigint() - t0) / 1e6;
      T.lines++;
      const at = f + ":" + (i + 1);
      let inStmt = false, cdStr = false, sql = false, sqlc = false, kw = false, missed = 0;

      for (const t of r.tokens) {
        const sc = t.scopes;
        const emb = sc.some((s) => s.startsWith(EMB));
        if (sc.includes(STMT)) inStmt = true;
        if (sc.includes(CDATA_STR)) cdStr = true;
        if (sc.includes(STMT) && sc.includes(TAGNAME) && !emb) {
          const before = ln.slice(0, t.startIndex);
          if (before.endsWith("</")) T.closed++; else if (before.endsWith("<")) T.opened++;
        }
        if (!emb) continue;

        const tx = ln.slice(t.startIndex, t.endIndex);
        if (/\S/.test(tx)) { sql = true; if (sc.includes(SQLC)) sqlc = true; }
        const inner = sc[sc.length - 1];
        if (inner in scopeCount) scopeCount[inner]++;
        if (inner === KW) kw = true;
        const isPh = sc.some((s) => s === BIND || s === SUB || s.startsWith("punctuation.definition.variable"));
        if (!isPh && !sc.some((s) => s.startsWith(CMT))) missed += (tx.match(PH_RE) || []).length;
        if (UNCOLORED && inner.startsWith(EMB)) {
          for (const w of tx.toUpperCase().match(/\b[A-Z][A-Z0-9_$#]*\b/g) || []) words.set(w, (words.get(w) || 0) + 1);
          for (const m of tx.toUpperCase().matchAll(/\b([A-Z_][A-Z0-9_$#]*)\s*\(/g)) calls.set(m[1], (calls.get(m[1]) || 0) + 1);
        }
      }

      if (sql) T.sqlLines++;
      if (sqlc) T.sqlcLines++;
      if (kw) T.kwLines++;
      if (missed) { T.phMissed += missed; hit("phMissed", at); }
      if (inStmt) { if (cdStr) hit("cdataStr", at); }
      else {
        // 문장 밖 줄은 내장 문법 결과와 같아야 함(루트 scope 만 추가)
        T.outLines++;
        const strip = r.tokens.map((t) => ({ startIndex: t.startIndex, endIndex: t.endIndex, scopes: t.scopes.filter((s) => s !== RT) }));
        if (JSON.stringify(a.tokens) !== JSON.stringify(strip)) hit("outDiff", at);
      }
      // 줄이 SQL 문자열 안에서 끝나면 다음 줄로 번진 것(닫히지 않은 따옴표)
      const last = r.tokens[r.tokens.length - 1];
      if (last && last.scopes.some((s) => s.startsWith("string.quoted.") && s.endsWith(".sql")) && !last.scopes.includes("punctuation.definition.string.end.sql")) hit("strCarry", at);
    });

    if (depth(state) !== depth(sBase)) hit("dirty", f + " (깊이 " + depth(state) + ", 내장 " + depth(sBase) + ")");
    if (ms > T.slowest[1]) T.slowest = [f, ms, lines.length];
  }

  // 조건 10: sqlMap 이 아닌 XML 은 내장과 완전 동일
  const others = otherXml();
  let otherLines = 0;
  for (const rel of others) {
    const lines = fs.readFileSync(rel, "utf8").split(/\r?\n/);
    let s1 = tm.INITIAL, s2 = tm.INITIAL;
    lines.forEach((ln, i) => {
      const a = base.tokenizeLine(ln, s1), r = ours.tokenizeLine(ln, s2);
      s1 = a.ruleStack; s2 = r.ruleStack; otherLines++;
      if (JSON.stringify(a.tokens) !== JSON.stringify(r.tokens)) hit("otherDiff", rel + ":" + (i + 1));
    });
    if (depth(s1) !== depth(s2)) hit("otherDiff", rel + " (파일 끝 상태)");
  }

  const fixtureCount = runFixtures(ours, base, tm.INITIAL, hit);
  const kwMin = KW_LINES_BASE === null ? null : Math.ceil(KW_LINES_BASE * 0.9);
  const stmtOk = T.tgtOpen > 0 && T.tgtOpen === T.opened && T.tgtClose === T.closed && T.opened - T.tgtSelf === T.closed;
  const checks = [
    ["매니페스트", manifestProblems.length === 0, manifestProblems.length ? manifestProblems.join(" / ") : "grammars " + contributed.length + "건, path·scopeName·injectTo·embeddedLanguages·단어 목록(함수 " + FNS.length + ", 키워드 " + KWS.length + ") 정상", []],
    ["1 문장 개폐", stmtOk, "대상 여는 태그 " + T.tgtOpen + "(자기닫힘 " + T.tgtSelf + ")·닫는 태그 " + T.tgtClose + " = 열림 " + T.opened + "·닫힘 " + T.closed, []],
    ["2 CDATA 가 SQL 블록", cnt("cdataStr") === 0 && T.tgtCdata > 0 && T.tgtCdata === T.sqlcLines, "문장 안 내장 CDATA 문자열 " + cnt("cdataStr") + "줄, CDATA 내용 " + T.tgtCdata + "줄 = SQL 블록 " + T.sqlcLines + "줄", ["cdataStr"]],
    ["3 문장 밖 줄", cnt("outDiff") === 0 && T.outLines > 0, T.outLines + "줄 중 내장과 다른 줄 " + cnt("outDiff"), ["outDiff"]],
    ["4 파일 끝 잔여 상태", cnt("dirty") === 0, cnt("dirty") + "개 파일", ["dirty"]],
    ["5 SQL 키워드 줄", kwMin === null ? T.kwLines > 0 : T.kwLines >= kwMin, T.kwLines + "줄 (하한 " + (kwMin === null ? "없음, --kw-base 미지정" : kwMin) + ", SQL " + T.sqlLines + "줄)", []],
    ["6 자리표시자", T.phMissed === 0 && scopeCount[BIND] >= 1, "무색 " + T.phMissed + "곳, 바인드 " + scopeCount[BIND] + "·치환 " + scopeCount[SUB], ["phMissed"]],
    ["7 줄 넘는 문자열", cnt("strCarry") === 0, cnt("strCarry") + "줄", ["strCarry"]],
    ["8 scope 4종", Object.values(scopeCount).every((n) => n >= 1), Object.entries(scopeCount).map(([k, n]) => k + " " + n).join(", "), []],
    ["9 고정 사례 단언", cnt("fixture") === 0, fixtureCount + "건 중 불일치 " + cnt("fixture"), ["fixture"]],
    ["10 sqlMap 이 아닌 XML", cnt("otherDiff") === 0 && others.length > 0, others.length + "개 파일 " + otherLines + "줄 중 내장과 다른 곳 " + cnt("otherDiff"), ["otherDiff"]],
  ];

  console.log("대상: " + T.files + "개 파일, " + T.lines + "줄 (" + SQLMAP + ")");
  console.log("문법: " + contributed.map((g) => g.scopeName).join(", ") + " (package.json 경유)");
  let failed = 0;
  for (const [label, ok, detail, keys] of checks) {
    if (!ok) failed++;
    console.log((ok ? "[통과] " : "[실패] ") + label + ": " + detail);
    if (!ok) for (const k of keys) if (bad[k]) console.log("        " + k + " " + bad[k].n + "건: " + bad[k].ex.join(", "));
  }
  console.log("참고: 가장 오래 걸린 파일 " + T.slowest[0] + " " + T.slowest[2] + "줄 " + Math.round(T.slowest[1]) + "ms");

  if (UNCOLORED) {
    const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w, c]) => w + ":" + c).join(" ");
    console.log("\nSQL 안 무색 단어 중 밑줄 없는 것 상위(전체 " + words.size + "종):");
    console.log(top(new Map([...words].filter(([w]) => !w.includes("_"))), 80));
    console.log("\n무색인데 여는 괄호가 뒤따르는 단어(함수 후보):");
    console.log(top(calls, 40));
  }

  console.log(failed ? "\n결과: 실패 " + failed + "건" : "\n결과: 통과");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
