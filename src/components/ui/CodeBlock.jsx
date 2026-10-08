import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import Button from './Button.jsx';

const SQL_KEYWORDS = new Set(
  `select from where join left right inner outer full on and or not in is null as group by order having
   limit offset distinct insert into values update set delete create table primary key foreign references
   unique check default constraint index view between like asc desc union all exists case when then else end
   varchar int integer date decimal text cascade restrict auto_increment serial enum`
    .split(/\s+/)
    .filter(Boolean)
);
const SQL_FUNCS = new Set(['count', 'avg', 'sum', 'min', 'max', 'round', 'coalesce', 'now', 'current_date', 'lower', 'upper']);

// Tiny SQL tokenizer — just enough for readable highlighting. Not a parser.
const TOKEN = /(--[^\n]*)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\sA-Za-z0-9_'])/g;

function highlightSql(line) {
  const out = [];
  let m;
  let i = 0;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line)) !== null) {
    const [text, com, str, num, word] = m;
    let cls = null;
    if (com) cls = 'tok-com';
    else if (str) cls = 'tok-str';
    else if (num) cls = 'tok-num';
    else if (word) {
      const lw = word.toLowerCase();
      if (SQL_FUNCS.has(lw) && line[TOKEN.lastIndex] === '(') cls = 'tok-fn';
      else if (SQL_KEYWORDS.has(lw)) cls = 'tok-kw';
    } else if (m[6]) cls = 'tok-op';
    out.push(cls ? <span key={i++} className={cls}>{text}</span> : text);
  }
  return out;
}

//   <CodeBlock language="sql" title="Browse query" code={sql} numbered />
export default function CodeBlock({ code, language = 'sql', title, numbered = false, copyable = true, className = '' }) {
  const [copied, setCopied] = useState(false);
  const lines = code.replace(/\n$/, '').split('\n');

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can still select the text */
    }
  }

  return (
    <div className={`code${numbered ? ' code--numbered' : ''} ${className}`.trim()}>
      {(title || copyable) && (
        <div className="code__head">
          <span className="eyebrow">{title || language}</span>
          {copyable && (
            <Button variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={copy} aria-label={copied ? 'Copied' : 'Copy code'}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
        </div>
      )}
      <pre className="code__pre">
        <code>
          {lines.map((ln, i) => (
            <span key={i} className="code__line" data-n={i + 1}>
              {language === 'sql' ? highlightSql(ln) : ln}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
