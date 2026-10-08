// ─────────────────────────────────────────────────────────────
// JS mirror of the StudySwap DDL.
// Table names, column names, types, CHECK values and foreign keys
// here are the single source of truth for the UI and the mock DB.
// The UI builds every dropdown from these exports — never hardcode
// an option list in JSX.
// ─────────────────────────────────────────────────────────────

// ── CHECK constraint domains ─────────────────────────────────
export const MATERIAL_TYPES = ['Notes', 'PYQ', 'Assignment', 'Summary'];
export const REQUEST_STATUS = ['Pending', 'Accepted', 'Rejected', 'Completed'];
export const RATING_RANGE = { min: 1, max: 5 };
export const SEMESTER_RANGE = { min: 1, max: 8 };
export const CAMPUS_DOMAIN = 'vitstudent.ac.in';

export const DEPARTMENTS = [
  { code: 'CSE', name: 'Computer Science and Engineering' },
  { code: 'ECE', name: 'Electronics and Communication Engineering' },
  { code: 'MECH', name: 'Mechanical Engineering' },
];
export const departmentName = (code) => DEPARTMENTS.find((d) => d.code === code)?.name ?? code;

// VARCHAR limits, used for live counters in forms.
export const LIMITS = {
  'Student.name': 100,
  'Student.email': 100,
  'Student.department': 50,
  'Subject.subject_name': 100,
  'Material.title': 150,
  'Material.file_link': 255,
  'Swap_Request.message': 255,
  'Rating.comment': 500,
};

// ── Tables ───────────────────────────────────────────────────
// check kinds: { in: [...] } | { min, max } | { endsWith } | { notBefore: column }
// `derived: true` marks a column that is never written — it is computed
// by a view on read (credibility_score → vw_student_credibility).
export const TABLES = {
  Student: {
    pk: 'student_id',
    columns: [
      { name: 'student_id', type: 'INT', pk: true },
      { name: 'name', type: 'VARCHAR', length: 100, notNull: true },
      { name: 'email', type: 'VARCHAR', length: 100, notNull: true, unique: true, check: { endsWith: `@${CAMPUS_DOMAIN}` } },
      { name: 'department', type: 'VARCHAR', length: 50, notNull: true },
      { name: 'semester', type: 'INT', notNull: true, check: SEMESTER_RANGE },
      { name: 'credibility_score', type: 'DECIMAL(3,2)', derived: true },
    ],
  },
  Subject: {
    pk: 'subject_id',
    columns: [
      { name: 'subject_id', type: 'INT', pk: true },
      { name: 'subject_name', type: 'VARCHAR', length: 100, notNull: true },
      { name: 'department', type: 'VARCHAR', length: 50, notNull: true },
      { name: 'semester', type: 'INT', notNull: true, check: SEMESTER_RANGE },
    ],
  },
  Material: {
    pk: 'material_id',
    columns: [
      { name: 'material_id', type: 'INT', pk: true },
      { name: 'title', type: 'VARCHAR', length: 150, notNull: true },
      { name: 'subject_id', type: 'INT', notNull: true },
      { name: 'uploaded_by', type: 'INT', notNull: true },
      { name: 'material_type', type: 'VARCHAR', length: 20, notNull: true, check: { in: MATERIAL_TYPES } },
      { name: 'upload_date', type: 'DATE', notNull: true, default: 'CURRENT_DATE' },
      { name: 'file_link', type: 'VARCHAR', length: 255, notNull: true },
    ],
  },
  Swap_Request: {
    pk: 'request_id',
    columns: [
      { name: 'request_id', type: 'INT', pk: true },
      { name: 'requester_id', type: 'INT', notNull: true },
      { name: 'material_id', type: 'INT', notNull: true },
      { name: 'status', type: 'VARCHAR', length: 20, notNull: true, default: "'Pending'", check: { in: REQUEST_STATUS } },
      { name: 'request_date', type: 'DATE', notNull: true, default: 'CURRENT_DATE' },
      { name: 'response_date', type: 'DATE', check: { notBefore: 'request_date' } },
      { name: 'message', type: 'VARCHAR', length: 255 },
    ],
  },
  Rating: {
    pk: 'rating_id',
    columns: [
      { name: 'rating_id', type: 'INT', pk: true },
      { name: 'material_id', type: 'INT', notNull: true },
      { name: 'rated_by', type: 'INT', notNull: true },
      { name: 'score', type: 'INT', notNull: true, check: RATING_RANGE },
      { name: 'comment', type: 'VARCHAR', length: 500 },
      { name: 'rating_date', type: 'DATE', notNull: true, default: 'CURRENT_DATE' },
    ],
  },
};

export const TABLE_NAMES = Object.keys(TABLES);

export const FOREIGN_KEYS = [
  { table: 'Material', column: 'subject_id', references: 'Subject', refColumn: 'subject_id' },
  { table: 'Material', column: 'uploaded_by', references: 'Student', refColumn: 'student_id' },
  { table: 'Swap_Request', column: 'requester_id', references: 'Student', refColumn: 'student_id' },
  { table: 'Swap_Request', column: 'material_id', references: 'Material', refColumn: 'material_id' },
  { table: 'Rating', column: 'material_id', references: 'Material', refColumn: 'material_id' },
  { table: 'Rating', column: 'rated_by', references: 'Student', refColumn: 'student_id' },
];

// Composite UNIQUE keys (single-column ones are flagged on the column).
export const UNIQUE_KEYS = [
  { table: 'Rating', name: 'uq_rating_student_material', columns: ['material_id', 'rated_by'] },
  // Stops two students filing the same subject twice when adding one by hand.
  { table: 'Subject', name: 'uq_subject_name_department', columns: ['subject_name', 'department'] },
];

// Secondary indexes. db.js keeps a real Map for each one.
export const INDEXES = [
  { name: 'idx_material_subject', table: 'Material', column: 'subject_id' },
  { name: 'idx_material_type', table: 'Material', column: 'material_type' },
  { name: 'idx_material_uploader', table: 'Material', column: 'uploaded_by' },
  { name: 'idx_rating_material', table: 'Rating', column: 'material_id' },
  { name: 'idx_request_material', table: 'Swap_Request', column: 'material_id' },
  { name: 'idx_request_requester', table: 'Swap_Request', column: 'requester_id' },
];

// ── Credibility tiers (§7.2) — presentation of the derived score ──
export const CREDIBILITY_TIERS = [
  { id: 'top', label: 'Top Contributor', minScore: 4.5, minRatings: 15 },
  { id: 'trusted', label: 'Trusted', minScore: 3.5, minRatings: 5 },
  { id: 'new', label: 'New', minScore: 0, minRatings: 0 },
];
export function credibilityTier(score, ratingCount) {
  return CREDIBILITY_TIERS.find((t) => (score ?? 0) >= t.minScore && ratingCount >= t.minRatings);
}

// ── DDL text, generated from the metadata above ──────────────
function checkSql(col) {
  const c = col.check;
  if (!c) return '';
  if (c.in) return ` CHECK (${col.name} IN (${c.in.map((v) => `'${v}'`).join(', ')}))`;
  if (c.min !== undefined) return ` CHECK (${col.name} BETWEEN ${c.min} AND ${c.max})`;
  if (c.endsWith) return ` CHECK (${col.name} LIKE '%${c.endsWith}')`;
  if (c.notBefore) return ` CHECK (${col.name} IS NULL OR ${col.name} >= ${c.notBefore})`;
  return '';
}

export function ddlFor(table) {
  const t = TABLES[table];
  const width = Math.max(...t.columns.map((c) => c.name.length));
  const lines = t.columns.map((c) => {
    let type = c.type === 'VARCHAR' ? `VARCHAR(${c.length})` : c.type;
    let s = `  ${c.name.padEnd(width)}  ${type}`;
    if (c.pk) s += ' PRIMARY KEY';
    if (c.notNull) s += ' NOT NULL';
    if (c.unique) s += ' UNIQUE';
    if (c.default) s += ` DEFAULT ${c.default}`;
    s += checkSql(c);
    if (c.derived) s += '  -- derived: read through vw_student_credibility';
    return s;
  });
  for (const fk of FOREIGN_KEYS.filter((f) => f.table === table)) {
    lines.push(`  FOREIGN KEY (${fk.column}) REFERENCES ${fk.references}(${fk.refColumn}) ON DELETE RESTRICT`);
  }
  for (const uq of UNIQUE_KEYS.filter((u) => u.table === table)) {
    lines.push(`  CONSTRAINT ${uq.name} UNIQUE (${uq.columns.join(', ')})`);
  }
  return `CREATE TABLE ${table} (\n${lines.join(',\n')}\n);`;
}

export const VIEW_DDL = `CREATE VIEW vw_student_credibility AS
SELECT st.student_id,
       ROUND(AVG(r.score), 2) AS credibility_score,
       COUNT(r.rating_id)     AS rating_count
FROM Student st
LEFT JOIN Material m ON m.uploaded_by = st.student_id
LEFT JOIN Rating   r ON r.material_id = m.material_id
GROUP BY st.student_id;`;

export const INDEX_DDL = INDEXES.map((i) => `CREATE INDEX ${i.name} ON ${i.table}(${i.column});`).join('\n');

export const DDL = [...TABLE_NAMES.map(ddlFor), INDEX_DDL, VIEW_DDL].join('\n\n');
