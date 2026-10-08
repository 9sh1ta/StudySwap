-- StudySwap database (SQLite). Mirrors src/shared/schema.js table-for-table:
-- same names, columns, CHECKs, UNIQUEs, FOREIGN KEYs (ON DELETE RESTRICT),
-- indexes and the vw_student_credibility view. Idempotent.
--
-- Two additions the DDL in schema.js does not list:
--   * _ui         : JSON text with presentation-only fields (tags, page count...)
--   * Credential  : password hashes, kept out of Student so Student stays 3NF

CREATE TABLE IF NOT EXISTS Student (
  student_id  INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL CHECK (length(name) <= 100),
  email       TEXT    NOT NULL UNIQUE COLLATE NOCASE
              CHECK (length(email) <= 100 AND email LIKE '%@vitstudent.ac.in'),
  department  TEXT    NOT NULL CHECK (length(department) <= 50),
  semester    INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
  _ui         TEXT
);

CREATE TABLE IF NOT EXISTS Credential (
  student_id    INTEGER PRIMARY KEY REFERENCES Student(student_id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Subject (
  subject_id   INTEGER PRIMARY KEY,
  subject_name TEXT    NOT NULL CHECK (length(subject_name) <= 100),
  department   TEXT    NOT NULL CHECK (length(department) <= 50),
  semester     INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
  _ui          TEXT,
  CONSTRAINT uq_subject_name_department UNIQUE (subject_name, department)
);

CREATE TABLE IF NOT EXISTS Material (
  material_id   INTEGER PRIMARY KEY,
  title         TEXT    NOT NULL CHECK (length(title) <= 150),
  subject_id    INTEGER NOT NULL,
  uploaded_by   INTEGER NOT NULL,
  material_type TEXT    NOT NULL CHECK (material_type IN ('Notes', 'PYQ', 'Assignment', 'Summary')),
  upload_date   TEXT    NOT NULL DEFAULT (date('now')),
  file_link     TEXT    NOT NULL CHECK (length(file_link) <= 255),
  _ui           TEXT,
  FOREIGN KEY (subject_id)  REFERENCES Subject(subject_id)  ON DELETE RESTRICT,
  FOREIGN KEY (uploaded_by) REFERENCES Student(student_id)  ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS Swap_Request (
  request_id    INTEGER PRIMARY KEY,
  requester_id  INTEGER NOT NULL,
  material_id   INTEGER NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'Pending'
                CHECK (status IN ('Pending', 'Accepted', 'Rejected', 'Completed')),
  request_date  TEXT    NOT NULL DEFAULT (date('now')),
  response_date TEXT    CHECK (response_date IS NULL OR response_date >= request_date),
  message       TEXT    CHECK (message IS NULL OR length(message) <= 255),
  _ui           TEXT,
  FOREIGN KEY (requester_id) REFERENCES Student(student_id)  ON DELETE RESTRICT,
  FOREIGN KEY (material_id)  REFERENCES Material(material_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS Rating (
  rating_id   INTEGER PRIMARY KEY,
  material_id INTEGER NOT NULL,
  rated_by    INTEGER NOT NULL,
  score       INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment     TEXT    CHECK (comment IS NULL OR length(comment) <= 500),
  rating_date TEXT    NOT NULL DEFAULT (date('now')),
  _ui         TEXT,
  FOREIGN KEY (material_id) REFERENCES Material(material_id) ON DELETE RESTRICT,
  FOREIGN KEY (rated_by)    REFERENCES Student(student_id)   ON DELETE RESTRICT,
  CONSTRAINT uq_rating_student_material UNIQUE (material_id, rated_by)
);

CREATE INDEX IF NOT EXISTS idx_material_subject   ON Material(subject_id);
CREATE INDEX IF NOT EXISTS idx_material_type      ON Material(material_type);
CREATE INDEX IF NOT EXISTS idx_material_uploader  ON Material(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_rating_material    ON Rating(material_id);
CREATE INDEX IF NOT EXISTS idx_request_material   ON Swap_Request(material_id);
CREATE INDEX IF NOT EXISTS idx_request_requester  ON Swap_Request(requester_id);

CREATE VIEW IF NOT EXISTS vw_student_credibility AS
SELECT st.student_id,
       ROUND(AVG(r.score), 2) AS credibility_score,
       COUNT(r.rating_id)     AS rating_count
FROM Student st
LEFT JOIN Material m ON m.uploaded_by = st.student_id
LEFT JOIN Rating   r ON r.material_id = m.material_id
GROUP BY st.student_id;
