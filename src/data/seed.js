// ─────────────────────────────────────────────────────────────
// Seed data, stored in 3NF: rows reference each other only by key.
// No subject_name inside Material, no uploader name inside Rating.
//
// Deterministic: a seeded PRNG means every reseed produces the same
// rows. Dates are relative to the moment of seeding so "this week"
// always has activity during a demo.
//
// Prototype-only fields live in a separate `_ui` object per row so the
// schema columns stay exactly as the DDL defines them.
// ─────────────────────────────────────────────────────────────
import { CAMPUS_DOMAIN } from './schema.js';

export const DEMO_PASSWORD = 'studyswap123';

// One-click logins for the reviewer (Login screen, §4.3).
export const DEMO_ACCOUNTS = [
  { student_id: 101, label: 'Student with pending requests', note: '5 uploads · 3 requests waiting · credibility ≈ 4.25' },
  { student_id: 102, label: 'Heavy contributor', note: 'Top Contributor tier · most uploads on campus' },
  { student_id: 107, label: 'New student', note: 'Joined this week · no uploads yet' },
];

// ── Deterministic helpers ────────────────────────────────────
function mulberry32(a) {
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTools(seed) {
  const rand = mulberry32(seed);
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const weighted = (pairs) => {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [v, w] of pairs) {
      if ((r -= w) <= 0) return v;
    }
    return pairs[pairs.length - 1][0];
  };
  const sample = (arr, n) => {
    const copy = [...arr];
    const out = [];
    while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
    return out;
  };
  return { rand, int, pick, weighted, sample };
}

export function isoDaysAgo(days, now = new Date()) {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ── Subjects ─────────────────────────────────────────────────
const SUBJECTS = [
  { subject_id: 1, subject_name: 'Data Structures and Algorithms', department: 'CSE', semester: 3, code: 'BCSE202L', short: 'DSA',
    topics: ['Arrays and Linked Lists', 'Stacks and Queues', 'Trees and Binary Search Trees', 'AVL and Red-Black Trees', 'Graphs — BFS, DFS and Shortest Paths', 'Sorting and Searching', 'Hashing', 'Dynamic Programming'] },
  { subject_id: 2, subject_name: 'Discrete Mathematics', department: 'CSE', semester: 3, code: 'BMAT205L', short: 'Discrete Maths',
    topics: ['Propositional Logic', 'Sets, Relations and Functions', 'Combinatorics and Pigeonhole Principle', 'Recurrence Relations', 'Graph Theory', 'Group Theory', 'Lattices and Boolean Algebra'] },
  { subject_id: 3, subject_name: 'Database Systems', department: 'CSE', semester: 5, code: 'BCSE302L', short: 'DBMS',
    topics: ['ER and EER Modelling', 'Relational Algebra', 'SQL Joins and Subqueries', 'Normalization — 1NF to BCNF', 'Functional Dependencies', 'Transactions and Concurrency Control', 'Indexing and B+ Trees', 'Query Optimization'] },
  { subject_id: 4, subject_name: 'Operating Systems', department: 'CSE', semester: 5, code: 'BCSE303L', short: 'OS',
    topics: ['Process Scheduling', 'Threads and Synchronization', "Deadlocks — Banker's Algorithm", 'Memory Management and Paging', 'Virtual Memory and Page Replacement', 'File Systems', 'Disk Scheduling'] },
  { subject_id: 5, subject_name: 'Computer Networks', department: 'CSE', semester: 5, code: 'BCSE308L', short: 'CN',
    topics: ['OSI and TCP/IP Models', 'Data Link Layer — Framing and ARQ', 'IP Addressing and Subnetting', 'Routing Algorithms', 'TCP Congestion Control', 'Application Layer — DNS and HTTP', 'Network Security Basics'] },
  { subject_id: 6, subject_name: 'Signals and Systems', department: 'ECE', semester: 3, code: 'BECE202L', short: 'Signals and Systems',
    topics: ['Classification of Signals', 'LTI Systems and Convolution', 'Fourier Series', 'Fourier Transform', 'Laplace Transform', 'Sampling Theorem', 'Z-Transform'] },
  { subject_id: 7, subject_name: 'Digital Signal Processing', department: 'ECE', semester: 5, code: 'BECE301L', short: 'DSP',
    topics: ['DFT and FFT', 'Z-Transform and ROC', 'FIR Filter Design by Windowing', 'IIR Filters — Bilinear Transformation', 'Multirate Signal Processing', 'Finite Word Length Effects'] },
  { subject_id: 8, subject_name: 'Microprocessors and Microcontrollers', department: 'ECE', semester: 5, code: 'BECE204L', short: 'MPMC',
    topics: ['8086 Architecture', '8086 Instruction Set and Addressing Modes', 'Assembly Language Programming', '8051 Microcontroller', 'Interrupts and Timers', 'Interfacing — 8255 and 8259', 'ARM Cortex-M Basics'] },
  { subject_id: 9, subject_name: 'Analog Circuits', department: 'ECE', semester: 3, code: 'BECE206L', short: 'Analog Circuits',
    topics: ['Diode Circuits', 'BJT Biasing', 'Small-Signal Amplifiers', 'MOSFET Amplifiers', 'Feedback Amplifiers', 'Oscillators', 'Op-Amp Applications'] },
  { subject_id: 10, subject_name: 'Engineering Thermodynamics', department: 'MECH', semester: 3, code: 'BMEE203L', short: 'Thermodynamics',
    topics: ['Basic Concepts and Zeroth Law', 'First Law for Closed Systems', 'First Law for Open Systems', 'Second Law and Entropy', 'Properties of Pure Substances', 'Gas Power Cycles', 'Vapour Power Cycles'] },
  { subject_id: 11, subject_name: 'Fluid Mechanics', department: 'MECH', semester: 5, code: 'BMEE204L', short: 'Fluid Mechanics',
    topics: ['Fluid Properties', 'Fluid Statics and Manometry', 'Buoyancy and Floatation', 'Fluid Kinematics', "Bernoulli's Equation", 'Flow Through Pipes', 'Boundary Layer Theory', 'Dimensional Analysis'] },
  { subject_id: 12, subject_name: 'Strength of Materials', department: 'MECH', semester: 3, code: 'BMEE202L', short: 'SOM',
    topics: ['Simple Stresses and Strains', 'Shear Force and Bending Moment', 'Bending Stresses in Beams', 'Torsion of Shafts', 'Deflection of Beams', 'Columns and Struts', 'Thin Cylinders'] },

  // Electives and later-semester core subjects.
  { subject_id: 13, subject_name: 'Artificial Intelligence', department: 'CSE', semester: 5, code: 'BCSE306L', short: 'AI',
    topics: ['Search — BFS, DFS and A*', 'Adversarial Search and Game Trees', 'Constraint Satisfaction', 'Knowledge Representation', 'First-Order Logic', 'Planning', 'Uncertainty and Bayesian Networks', 'Expert Systems'] },
  { subject_id: 14, subject_name: 'Machine Learning', department: 'CSE', semester: 6, code: 'BCSE332L', short: 'ML',
    topics: ['Linear and Logistic Regression', 'Decision Trees and Random Forests', 'Support Vector Machines', 'Clustering — k-Means and Hierarchical', 'Neural Networks and Backpropagation', 'Dimensionality Reduction — PCA', 'Model Evaluation and Cross-Validation', 'Overfitting and Regularization'] },
  { subject_id: 15, subject_name: 'Blockchain Technology', department: 'CSE', semester: 6, code: 'BCSE428L', short: 'Blockchain',
    topics: ['Cryptographic Hashing and Merkle Trees', 'Distributed Ledger Fundamentals', 'Consensus — Proof of Work', 'Consensus — Proof of Stake', 'Bitcoin Architecture', 'Ethereum and the EVM', 'Smart Contracts in Solidity', 'Hyperledger Fabric', 'Wallets, Keys and Digital Signatures', 'Scalability and Layer-2 Solutions'] },
  { subject_id: 16, subject_name: 'Software Engineering', department: 'CSE', semester: 5, code: 'BCSE301L', short: 'SE',
    topics: ['Software Process Models', 'Requirements Engineering', 'UML and Design Patterns', 'Software Architecture', 'Testing Strategies', 'Agile and Scrum', 'Project Estimation — COCOMO', 'Software Maintenance'] },
  { subject_id: 17, subject_name: 'Web Technologies', department: 'CSE', semester: 4, code: 'BCSE203E', short: 'Web Tech',
    topics: ['HTML and CSS Fundamentals', 'JavaScript and the DOM', 'Responsive Design', 'HTTP and REST APIs', 'Server-Side Rendering', 'Databases for the Web', 'Authentication and Sessions', 'Web Security — XSS and CSRF'] },
  { subject_id: 18, subject_name: 'Theory of Computation', department: 'CSE', semester: 5, code: 'BCSE304L', short: 'TOC',
    topics: ['Finite Automata — DFA and NFA', 'Regular Expressions and Languages', 'Pumping Lemma', 'Context-Free Grammars', 'Pushdown Automata', 'Turing Machines', 'Decidability and the Halting Problem', 'NP-Completeness'] },
  { subject_id: 19, subject_name: 'Compiler Design', department: 'CSE', semester: 6, code: 'BCSE307L', short: 'Compiler Design',
    topics: ['Lexical Analysis', 'Parsing — LL and LR', 'Syntax-Directed Translation', 'Intermediate Code Generation', 'Code Optimization', 'Runtime Environments', 'Register Allocation', 'Data Flow Analysis'] },
  { subject_id: 20, subject_name: 'Computer Architecture', department: 'CSE', semester: 3, code: 'BCSE205L', short: 'Computer Architecture',
    topics: ['Instruction Set Architecture', 'Pipelining and Hazards', 'Cache Memory and Locality', 'Memory Hierarchy', 'Branch Prediction', 'Parallel Processing', 'I/O Organisation'] },
  { subject_id: 21, subject_name: 'Cyber Security', department: 'CSE', semester: 7, code: 'BCSE353E', short: 'Cyber Security',
    topics: ['Symmetric Cryptography — AES', 'Public-Key Cryptography — RSA', 'Hashing and Message Authentication', 'Network Attacks and Defences', 'SQL Injection and Web Exploits', 'Digital Forensics', 'Security Policies and Risk'] },
  { subject_id: 22, subject_name: 'Cloud Computing', department: 'CSE', semester: 7, code: 'BCSE355L', short: 'Cloud Computing',
    topics: ['Virtualization and Hypervisors', 'IaaS, PaaS and SaaS', 'Containers and Orchestration', 'Cloud Storage Models', 'Load Balancing and Autoscaling', 'Serverless Computing', 'Cloud Security'] },
  { subject_id: 23, subject_name: 'VLSI System Design', department: 'ECE', semester: 5, code: 'BECE303L', short: 'VLSI',
    topics: ['MOS Transistor Theory', 'CMOS Inverter Characteristics', 'Combinational CMOS Logic', 'Sequential Circuit Design', 'Layout and Design Rules', 'Verilog HDL', 'Timing and Power Analysis'] },
  { subject_id: 24, subject_name: 'Embedded Systems', department: 'ECE', semester: 6, code: 'BECE352L', short: 'Embedded Systems',
    topics: ['Embedded Architecture and ARM', 'Real-Time Operating Systems', 'Sensors and Actuators', 'Communication Protocols — I2C, SPI and UART', 'Interrupt Handling', 'Power Optimisation', 'IoT Interfacing'] },
  { subject_id: 25, subject_name: 'Control Systems', department: 'ECE', semester: 5, code: 'BEEE301L', short: 'Control Systems',
    topics: ['Transfer Functions and Block Diagrams', 'Time Response Analysis', 'Root Locus', 'Bode and Nyquist Plots', 'Stability — Routh-Hurwitz', 'State-Space Representation', 'PID Controllers'] },
  { subject_id: 26, subject_name: 'Antennas and Wave Propagation', department: 'ECE', semester: 6, code: 'BECE306L', short: 'Antennas',
    topics: ['Radiation Fundamentals', 'Dipole and Monopole Antennas', 'Antenna Arrays', 'Microstrip Antennas', 'Wave Propagation Modes', 'Smith Chart and Matching'] },
  { subject_id: 27, subject_name: 'Heat and Mass Transfer', department: 'MECH', semester: 5, code: 'BMEE302L', short: 'Heat Transfer',
    topics: ['Conduction — Fourier Law', 'Fins and Extended Surfaces', 'Convection — Free and Forced', 'Boiling and Condensation', 'Heat Exchangers — LMTD and NTU', 'Radiation Heat Transfer', 'Mass Diffusion'] },
  { subject_id: 28, subject_name: 'Machine Design', department: 'MECH', semester: 6, code: 'BMEE303L', short: 'Machine Design',
    topics: ['Design for Static Loading', 'Fatigue and Endurance Limit', 'Shafts and Keys', 'Bearings — Rolling and Journal', 'Gears and Gear Trains', 'Springs', 'Welded and Bolted Joints'] },
  { subject_id: 29, subject_name: 'Manufacturing Processes', department: 'MECH', semester: 4, code: 'BMEE205L', short: 'Manufacturing',
    topics: ['Casting Processes', 'Metal Forming', 'Welding and Joining', 'Machining and Tool Life', 'CNC and Automation', 'Metrology and Tolerances', 'Additive Manufacturing'] },
  { subject_id: 30, subject_name: 'Kinematics and Dynamics of Machinery', department: 'MECH', semester: 5, code: 'BMEE301L', short: 'Kinematics',
    topics: ['Mechanisms and Linkages', 'Velocity and Acceleration Analysis', 'Cams and Followers', 'Gyroscopic Effects', 'Balancing of Rotating Masses', 'Flywheels', 'Vibration Basics'] },
];

// Subject rows as they are stored. db.js also uses this to add subjects to a
// browser that was seeded before they existed, without wiping anyone's data.
export const SUBJECT_CATALOGUE = SUBJECTS.map(({ subject_id, subject_name, department, semester, code }) => ({
  subject_id,
  subject_name,
  department,
  semester,
  _ui: { code },
}));

// Generated materials per subject — deliberately uneven, like a real campus.
const GENERATED_PER_SUBJECT = {
  1: 22, 2: 16, 3: 30, 4: 22, 5: 20, 6: 12, 7: 16, 8: 14, 9: 10, 10: 14, 11: 12, 12: 12,
  13: 14, 14: 18, 15: 16, 16: 12, 17: 12, 18: 10, 19: 8, 20: 8, 21: 10, 22: 10,
  23: 10, 24: 10, 25: 8, 26: 6, 27: 10, 28: 8, 29: 8, 30: 6,
};

// ── Students ─────────────────────────────────────────────────
const NAMED_STUDENTS = [
  { student_id: 101, name: 'Aarav Mehta', department: 'CSE', semester: 5, reg: '24BCE1042', joinedDaysAgo: 172 },
  { student_id: 102, name: 'Ananya Iyer', department: 'CSE', semester: 5, reg: '24BCE0871', joinedDaysAgo: 178 },
  { student_id: 103, name: 'Diya Raghavan', department: 'CSE', semester: 5, reg: '24BCE1180', joinedDaysAgo: 160 },
  { student_id: 104, name: 'Kabir Sethi', department: 'CSE', semester: 3, reg: '25BCE0415', joinedDaysAgo: 131 },
  { student_id: 105, name: 'Meera Nair', department: 'ECE', semester: 5, reg: '24BEC0632', joinedDaysAgo: 150 },
  { student_id: 106, name: 'Ishaan Verma', department: 'MECH', semester: 3, reg: '25BME0219', joinedDaysAgo: 118 },
  { student_id: 107, name: 'Rohan Kulkarni', department: 'CSE', semester: 5, reg: '24BCE1377', joinedDaysAgo: 3 },
  { student_id: 108, name: 'Sneha Pillai', department: 'ECE', semester: 3, reg: '25BEC0508', joinedDaysAgo: 140 },
];

const FIRST = ['Nikhil', 'Priya', 'Arjun', 'Kavya', 'Siddharth', 'Riya', 'Aditya', 'Pooja', 'Varun', 'Shreya', 'Karthik', 'Nandini',
  'Rahul', 'Ishita', 'Vikram', 'Tanvi', 'Harsh', 'Aishwarya', 'Manish', 'Lakshmi', 'Yash', 'Divya', 'Pranav', 'Sanjana',
  'Abhinav', 'Neha', 'Gautam', 'Madhuri', 'Rishabh', 'Swathi', 'Dev', 'Bhavya', 'Omkar', 'Keerthana', 'Tejas', 'Zoya',
  'Sameer', 'Anjali', 'Farhan', 'Gayathri'];
const LAST = ['Joshi', 'Menon', 'Reddy', 'Srinivasan', 'Rao', 'Kapoor', 'Chatterjee', 'Deshpande', 'Gupta', 'Krishnan', 'Bhat',
  'Naidu', 'Agarwal', 'Banerjee', 'Hegde', 'Patil', 'Subramanian', 'Malhotra', 'Shetty', 'Kaur', 'Das', 'Pandey',
  'Venkatesh', 'Mishra', 'Sharma', 'Khan', 'Chauhan', 'Nair', 'Bose', 'Thakur'];
const DEPT_REG = { CSE: 'BCE', ECE: 'BEC', MECH: 'BME' };

// ── Hand-written materials (the 40 "detailed" rows) ──────────
// uploader: a student_id, or a { gen: dept, sem } placeholder resolved to
// a generated student. q = underlying quality used to draw rating scores.
const DETAILED = [
  // Aarav Mehta — the demo user. Ratings are fixed below, not drawn.
  { key: 'a_norm', title: 'DBMS Unit 3 — Normalization, Handwritten', subject: 3, uploader: 101, type: 'Notes', days: 34, pages: 18, tags: ['normalization', 'bcnf', 'functional-dependencies', 'handwritten'],
    desc: 'Handwritten notes for Unit 3: functional dependencies, attribute closure, candidate keys, and step-by-step decomposition from 1NF to BCNF with lossless-join and dependency-preservation checks.' },
  { key: 'a_joins', title: 'DBMS SQL Joins Cheat Sheet with Relational Algebra', subject: 3, uploader: 101, type: 'Summary', days: 52, pages: 2, tags: ['sql', 'joins', 'relational-algebra'],
    desc: 'Two-page cheat sheet mapping every SQL join to its relational algebra expression, with a worked example on the Student–Material schema.' },
  { key: 'a_banker', title: "OS Deadlocks — Banker's Algorithm Solved Problems", subject: 4, uploader: 101, type: 'Notes', days: 21, pages: 11, tags: ['deadlock', 'bankers-algorithm', 'solved'],
    desc: "Eight solved Banker's algorithm problems in the CAT format: need matrix, safety sequence and resource-request checks, each worked line by line." },
  { key: 'a_cnpyq', title: 'CN Mid-Sem PYQ 2023 with Solutions', subject: 5, uploader: 101, type: 'PYQ', days: 60, pages: 7, tags: ['pyq', 'mid-sem', 'solved', 'subnetting'],
    desc: 'The 2023 Computer Networks mid-semester paper with full solutions, including the subnetting and sliding-window numericals.' },
  { key: 'a_dsa', title: 'DSA Assignment 4 — AVL and Red-Black Trees', subject: 1, uploader: 101, type: 'Assignment', days: 95, pages: 9, tags: ['avl', 'red-black', 'rotations'],
    desc: 'Assignment 4 answers: AVL insertions with every rotation drawn, red-black recolouring cases, and height proofs.' },

  // Ananya Iyer — heavy contributor.
  { key: 'n_subnet', title: 'CN Unit 3 — IP Addressing and Subnetting, Typed', subject: 5, uploader: 102, type: 'Notes', days: 18, q: 4.8, n: 16, pages: 22, tags: ['subnetting', 'cidr', 'ipv4', 'typed'],
    desc: 'Typed notes on classful and classless addressing, CIDR, VLSM and 20 subnetting drills with answers.' },
  { key: 'n_txn', title: 'DBMS Transactions and Concurrency Control — Summary', subject: 3, uploader: 102, type: 'Summary', days: 26, q: 4.7, n: 12, pages: 3, tags: ['transactions', 'acid', 'locking', 'serializability'],
    desc: 'ACID, conflict and view serializability, two-phase locking and timestamp ordering condensed into three pages.' },
  { key: 'n_ospyq', title: 'OS End-Sem PYQ 2024 with Solutions', subject: 4, uploader: 102, type: 'PYQ', days: 40, q: 4.6, n: 19, pages: 10, tags: ['pyq', 'end-sem', 'solved'],
    desc: 'The 2024 Operating Systems end-semester paper, every question solved, with the marks split noted beside each answer.' },
  { key: 'n_dp', title: 'DSA Dynamic Programming — 25 Solved Problems', subject: 1, uploader: 102, type: 'Notes', days: 120, q: 4.9, n: 22, pages: 34, tags: ['dynamic-programming', 'solved', 'recurrences'],
    desc: 'Twenty-five DP problems from knapsack to edit distance, each with the recurrence, table fill order and complexity.' },
  { key: 'n_bplus', title: 'DBMS Indexing and B+ Trees — Handwritten', subject: 3, uploader: 102, type: 'Notes', days: 9, q: 4.7, n: 8, pages: 14, tags: ['indexing', 'b-plus-tree', 'handwritten'],
    desc: 'Dense vs sparse indexes, B+ tree insertion and deletion with splits drawn at every step, and hashing-based indexes.' },
  { key: 'n_tcp', title: 'CN TCP Congestion Control One-Page Summary', subject: 5, uploader: 102, type: 'Summary', days: 4, q: 4.8, n: 6, pages: 1, tags: ['tcp', 'congestion-control', 'aimd'],
    desc: 'Slow start, congestion avoidance, fast retransmit and fast recovery on one page, with the cwnd graph annotated.' },
  { key: 'n_graph', title: 'Discrete Maths — Graph Theory One-Page Summary', subject: 2, uploader: 102, type: 'Summary', days: 150, q: 4.9, n: 15, pages: 1, tags: ['graph-theory', 'euler', 'hamilton'],
    desc: 'Every graph theory definition and theorem from the syllabus on one page: Euler and Hamilton paths, planarity, colouring.' },
  { key: 'n_paging', title: 'OS Memory Management and Paging — Class Notes', subject: 4, uploader: 102, type: 'Notes', days: 70, q: 4.5, n: 11, pages: 19, tags: ['paging', 'segmentation', 'tlb'],
    desc: 'Class notes on contiguous allocation, paging, TLB effective access time and segmentation, with the numericals from lectures.' },
  { key: 'n_dbcat', title: 'DBMS CAT-1 PYQ 2025 with Answer Key', subject: 3, uploader: 102, type: 'PYQ', days: 6, q: 4.6, n: 9, pages: 5, tags: ['pyq', 'cat-1', 'answer-key'],
    desc: 'The 2025 CAT-1 paper for Database Systems with a concise answer key and the ER diagram question fully drawn.' },
  { key: 'n_routing', title: 'CN Routing Algorithms — Dijkstra and Distance Vector Worked Examples', subject: 5, uploader: 102, type: 'Assignment', days: 33, q: 4.4, n: 7, pages: 8, tags: ['routing', 'dijkstra', 'distance-vector'],
    desc: 'Assignment solutions tracing Dijkstra and Bellman-Ford tables round by round, plus the count-to-infinity example.' },

  // Diya Raghavan
  { key: 'd_sched', title: 'OS Process Scheduling — FCFS, SJF, Round Robin Worked Problems', subject: 4, uploader: 103, type: 'Notes', days: 15, q: 4.1, n: 7, pages: 12, tags: ['scheduling', 'gantt-chart', 'solved'],
    desc: 'Gantt charts, waiting and turnaround times for FCFS, SJF, SRTF, priority and round robin, with a comparison table.' },
  { key: 'd_dll', title: 'CN Data Link Layer — Framing and ARQ Summary', subject: 5, uploader: 103, type: 'Summary', days: 11, q: 3.9, n: 5, pages: 2, tags: ['data-link', 'arq', 'framing'],
    desc: 'Framing methods, stop-and-wait, Go-Back-N and Selective Repeat ARQ compared side by side.' },
  { key: 'd_er', title: 'DBMS ER to Relational Mapping — Assignment 2 Solutions', subject: 3, uploader: 103, type: 'Assignment', days: 44, q: 4.0, n: 6, pages: 6, tags: ['er-model', 'mapping', 'eer'],
    desc: 'Assignment 2: mapping strong and weak entities, relationships and specialisation hierarchies to relations.' },
  { key: 'd_sync', title: 'OS Threads and Synchronization — Semaphores Explained', subject: 4, uploader: 103, type: 'Notes', days: 3, q: 4.3, n: 4, pages: 9, tags: ['semaphores', 'mutex', 'producer-consumer'],
    desc: 'Semaphores and mutexes through the producer–consumer, readers–writers and dining philosophers problems.' },

  // Kabir Sethi
  { key: 'k_stack', title: 'DSA Stacks and Queues — Handwritten with Dry Runs', subject: 1, uploader: 104, type: 'Notes', days: 28, q: 3.8, n: 6, pages: 13, tags: ['stacks', 'queues', 'handwritten'],
    desc: 'Stack and queue implementations with dry runs for infix-to-postfix conversion and circular queue edge cases.' },
  { key: 'k_rec', title: 'Discrete Maths Recurrence Relations Assignment Solutions', subject: 2, uploader: 104, type: 'Assignment', days: 47, q: 3.5, n: 5, pages: 7, tags: ['recurrence', 'generating-functions'],
    desc: 'Homogeneous and non-homogeneous recurrences solved by characteristic roots and generating functions.' },
  { key: 'k_dsapyq', title: 'DSA CAT-2 PYQ 2024', subject: 1, uploader: 104, type: 'PYQ', days: 12, q: 3.9, n: 4, pages: 3, tags: ['pyq', 'cat-2'],
    desc: 'The 2024 CAT-2 question paper for Data Structures and Algorithms, scanned clearly. No solutions.' },

  // Meera Nair
  { key: 'm_dsppyq', title: 'DSP End-Sem PYQ 2024 — Z-Transform and FIR Design', subject: 7, uploader: 105, type: 'PYQ', days: 22, q: 4.4, n: 9, pages: 8, tags: ['pyq', 'z-transform', 'fir'],
    desc: 'End-semester 2024 paper with solutions for the Z-transform, ROC and FIR windowing questions.' },
  { key: 'm_fft', title: 'DSP FFT — Radix-2 DIT and DIF Butterfly Diagrams', subject: 7, uploader: 105, type: 'Notes', days: 38, q: 4.5, n: 8, pages: 16, tags: ['fft', 'butterfly', 'dit', 'dif'],
    desc: 'Radix-2 decimation-in-time and decimation-in-frequency FFT with every butterfly stage drawn for N = 8.' },
  { key: 'm_8086', title: 'MPMC 8086 Instruction Set — Quick Reference', subject: 8, uploader: 105, type: 'Summary', days: 5, q: 4.2, n: 5, pages: 3, tags: ['8086', 'instruction-set', 'reference'],
    desc: 'All 8086 instruction groups with flags affected and addressing modes, formatted for quick lookup in the lab.' },
  { key: 'm_ft', title: 'Signals and Systems — Fourier Transform Properties Table', subject: 6, uploader: 105, type: 'Summary', days: 130, q: 4.0, n: 6, pages: 2, tags: ['fourier-transform', 'properties'],
    desc: 'Fourier transform properties and standard pairs in one table, with duality and Parseval examples.' },

  // Ishaan Verma
  { key: 'i_open', title: 'Thermodynamics Unit 2 — First Law for Open Systems', subject: 10, uploader: 106, type: 'Notes', days: 80, q: 3.9, n: 6, pages: 15, tags: ['first-law', 'sfee', 'nozzles'],
    desc: 'Steady-flow energy equation applied to nozzles, turbines, compressors and heat exchangers, with solved numericals.' },
  { key: 'i_sfbm', title: 'SOM Shear Force and Bending Moment — 15 Solved Beams', subject: 12, uploader: 106, type: 'Assignment', days: 45, q: 4.2, n: 7, pages: 12, tags: ['sfd', 'bmd', 'beams'],
    desc: 'Fifteen SFD and BMD problems for cantilever, simply supported and overhanging beams under point and UDL loads.' },
  { key: 'i_fmpyq', title: 'Fluid Mechanics FAT PYQ 2023 with Solutions', subject: 11, uploader: 106, type: 'PYQ', days: 19, q: 3.7, n: 5, pages: 6, tags: ['pyq', 'fat', 'solved'],
    desc: 'The 2023 Fluid Mechanics FAT paper with worked solutions for the manometry and pipe-flow questions.' },

  // Sneha Pillai
  { key: 's_bjt', title: 'Analog Circuits — BJT Biasing Handwritten Notes', subject: 9, uploader: 108, type: 'Notes', days: 26, q: 4.1, n: 5, pages: 11, tags: ['bjt', 'biasing', 'handwritten'],
    desc: 'Fixed, collector-feedback and voltage-divider bias with stability factor derivations and solved examples.' },
  { key: 's_sspyq', title: 'Signals and Systems CAT-1 PYQ 2025', subject: 6, uploader: 108, type: 'PYQ', days: 8, q: 3.8, n: 4, pages: 3, tags: ['pyq', 'cat-1'],
    desc: 'CAT-1 2025 paper for Signals and Systems. Questions only; solutions for Q1–Q3 on the last page.' },
  { key: 's_8051', title: 'MPMC 8051 Timers and Interrupts — Lab Assignment', subject: 8, uploader: 108, type: 'Assignment', days: 36, q: 3.6, n: 3, pages: 6, tags: ['8051', 'timers', 'interrupts', 'lab'],
    desc: 'Lab assignment: timer modes, delay generation and interrupt-driven serial transmission on the 8051, with code.' },

  // Generated students
  { key: 'g_logic', title: 'Discrete Maths Propositional Logic — Truth Tables and Proofs', subject: 2, uploader: { gen: 'CSE', sem: 3 }, type: 'Notes', days: 64, q: 3.9, n: 5, pages: 10, tags: ['logic', 'truth-tables', 'proofs'],
    desc: 'Truth tables, logical equivalences, normal forms and rules of inference with twelve worked proofs.' },
  { key: 'g_dbfat', title: 'DBMS FAT PYQ 2024 with Solutions', subject: 3, uploader: { gen: 'CSE', sem: 5 }, type: 'PYQ', days: 30, q: 4.3, n: 10, pages: 9, tags: ['pyq', 'fat', 'solved'],
    desc: 'The 2024 Database Systems FAT paper, solved, including the normalization and query-optimization questions.' },
  { key: 'g_pagerep', title: 'OS Page Replacement — FIFO, LRU, Optimal Compared', subject: 4, uploader: { gen: 'CSE', sem: 5 }, type: 'Summary', days: 14, q: 4.0, n: 6, pages: 2, tags: ['page-replacement', 'lru', 'belady'],
    desc: 'FIFO, LRU and Optimal traced on the same reference string, with Belady’s anomaly shown in one table.' },
  { key: 'g_app', title: 'CN Application Layer — DNS and HTTP Notes', subject: 5, uploader: { gen: 'CSE', sem: 5 }, type: 'Notes', days: 57, q: 3.6, n: 4, pages: 10, tags: ['dns', 'http', 'application-layer'],
    desc: 'DNS resolution, record types, HTTP methods, persistent connections and cookies, from the lecture slides.' },
  { key: 'g_iir', title: 'DSP IIR Filter Design — Bilinear Transformation Assignment', subject: 7, uploader: { gen: 'ECE', sem: 5 }, type: 'Assignment', days: 25, q: 4.1, n: 5, pages: 8, tags: ['iir', 'bilinear', 'butterworth'],
    desc: 'Butterworth and Chebyshev IIR designs via the bilinear transformation, with pre-warping shown for each problem.' },
  { key: 'g_opamp', title: 'Analog Circuits Op-Amp Applications — Formula Sheet', subject: 9, uploader: { gen: 'ECE', sem: 3 }, type: 'Summary', days: 16, q: 4.2, n: 5, pages: 1, tags: ['op-amp', 'formula-sheet'],
    desc: 'Gain formulas for inverting, non-inverting, summing, integrator and differentiator circuits on one sheet.' },
  { key: 'g_cycles', title: 'Thermodynamics Gas Power Cycles — Otto, Diesel, Brayton', subject: 10, uploader: { gen: 'MECH', sem: 3 }, type: 'Notes', days: 41, q: 4.0, n: 6, pages: 14, tags: ['otto', 'diesel', 'brayton'],
    desc: 'P-v and T-s diagrams and efficiency derivations for the Otto, Diesel, Dual and Brayton cycles.' },
  { key: 'g_bern', title: "Fluid Mechanics Bernoulli's Equation — Solved Numericals", subject: 11, uploader: { gen: 'MECH', sem: 5 }, type: 'Notes', days: 2, q: 4.1, n: 2, pages: 9, tags: ['bernoulli', 'venturimeter', 'solved'],
    desc: "Bernoulli's equation applied to venturimeters, orifice meters and pitot tubes, with twelve solved numericals." },
];

// The demo user's credibility is fixed so the dashboard reads ≈ 4.25.
// [material key, score, rater (student_id or {gen}), comment|null, daysAgo]
const AARAV_RATINGS = [
  ['a_norm', 5, { gen: 'CSE', sem: 5, i: 3 }, 'Clearest BCNF decomposition I have seen — the closure steps are all written out.', 30],
  ['a_norm', 5, 102, 'Neat handwriting and every dependency-preservation check is shown.', 28],
  ['a_norm', 4, 104, 'Very good. One example in the 3NF section skips a step.', 20],
  ['a_norm', 4, { gen: 'CSE', sem: 5, i: 2 }, null, 12],
  ['a_joins', 5, 105, null, 38], // rated after swap request (Completed)
  ['a_joins', 4, 103, 'Handy before the lab exam. Would love the outer-join cases expanded.', 45],
  ['a_joins', 4, { gen: 'CSE', sem: 5, i: 3 }, null, 33],
  ['a_banker', 4, { gen: 'CSE', sem: 5, i: 4 }, 'Solved problems match the CAT pattern exactly.', 14],
  ['a_banker', 3, 106, 'Correct, but the handwriting gets small on the last few pages.', 9],
  ['a_cnpyq', 4, { gen: 'CSE', sem: 5, i: 0 }, 'Solutions are right; the sliding-window one is especially clear.', 27], // after swap
  ['a_cnpyq', 5, 103, 'Exactly the paper I was looking for, and fully solved.', 50],
  ['a_dsa', 4, 104, 'Good rotation diagrams. Red-black deletion is not covered.', 80],
];

// Comments by score band, drawn without repeats per material.
const COMMENTS = {
  5: ['Exactly what I needed for the CAT — clear and complete.', 'Every derivation is shown step by step. Brilliant.', 'Saved me before the FAT. Worked examples match the question pattern.',
    'Best material on this unit I have found; diagrams are very clean.', 'Solutions are correct and well explained. Thank you!', 'Covers the whole unit, nothing missing.',
    'Studied only from this for the quiz and scored full marks.', 'Beautifully organised — reads like a textbook chapter, but shorter.'],
  4: ['Good coverage, though a couple of pages are slightly blurry.', 'Solid notes; a summary page at the end would make it perfect.', 'Helpful. The last question has a small calculation slip.',
    'Well organised and matches what was taught in class.', 'Clear explanations, a few diagrams could be bigger.', 'Very useful for revision, some topics are brief.'],
  3: ['Decent, but skips some derivations.', 'Fine for revision, not enough for learning it the first time.', 'Some pages are out of order; the content itself is fine.',
    'Useful questions, but only half have solutions.', 'Average scan quality, readable with zoom.'],
  2: ['Scan quality is poor and hard to read in places.', 'Mostly copied from the textbook with no explanation.', 'Several answers in the second half are wrong.'],
  1: ['Not the current syllabus — most topics were removed last year.', 'File is incomplete; only the first three pages are there.'],
};

// Swap requests. [requester, material key, status, requestDaysAgo, responseDaysAgo, message, extras]
const REQUESTS = [
  // Incoming to Aarav
  [103, 'a_norm', 'Pending', 1, null, 'Hi Aarav, could I get the normalization notes? Happy to share my OS scheduling notes in return.', { offer: 'd_sched' }],
  [104, 'a_joins', 'Pending', 2, null, 'Need the joins cheat sheet before the DBMS lab exam on Friday. Thanks!'],
  [{ gen: 'CSE', sem: 5, i: 1 }, 'a_banker', 'Pending', 3, null, "Your Banker's algorithm problems look great — requesting for CAT-2 prep."],
  [102, 'a_cnpyq', 'Accepted', 9, 8, 'Could I see your CN mid-sem solutions? I can check them against mine.'],
  [{ gen: 'CSE', sem: 5, i: 4 }, 'a_norm', 'Rejected', 20, 19, 'Requesting Unit 3 notes please.', { reason: 'Already shared the updated version in the class group — check there.' }],
  [105, 'a_joins', 'Completed', 40, 39, 'Would like the joins sheet for my minor in CSE.'],
  [{ gen: 'CSE', sem: 5, i: 0 }, 'a_cnpyq', 'Completed', 30, 29, 'Requesting the 2023 mid-sem paper.'],
  // Outgoing from Aarav
  [101, 'n_subnet', 'Accepted', 5, 4, 'Your subnetting notes are the best on here — could I get a copy for CAT-2?'],
  [101, 'd_sched', 'Accepted', 6, 5, 'Could I get your scheduling problems? Happy to swap my Banker’s algorithm set.', { offer: 'a_banker' }],
  [101, 'n_txn', 'Completed', 12, 11, 'Requesting the transactions summary for the FAT.'], // received, not yet rated
  [101, 'k_stack', 'Completed', 50, 48, 'Need the stacks and queues dry runs for a friend’s tutoring session.'],
  [101, 'g_pagerep', 'Completed', 70, 68, 'Requesting the page replacement comparison.'],
  [101, 'n_ospyq', 'Rejected', 25, 24, 'Could I see the OS end-sem solutions?', { reason: 'Sharing this one only after the re-test, sorry!' }],
  [101, 'd_dll', 'Pending', 1, null, 'Could I get the ARQ summary for revision?'],
  // Between other students
  [103, 'n_bplus', 'Pending', 2, null, 'B+ tree deletion always confuses me — requesting your notes.'],
  [104, 'n_dp', 'Pending', 4, null, 'Starting DP this week, would love the solved set.'],
  [108, 'm_dsppyq', 'Accepted', 7, 6, 'Requesting the DSP end-sem paper for next semester prep.'],
  [106, 'g_cycles', 'Completed', 60, 58, 'Need the gas power cycle derivations.'],
  [105, 'g_opamp', 'Rejected', 35, 34, 'Requesting the op-amp formula sheet.', { reason: 'Updating it with the lab formulas first.' }],
  [{ gen: 'CSE', sem: 5, i: 2 }, 'n_subnet', 'Completed', 80, 79, 'Requesting the subnetting notes.'],
  [{ gen: 'CSE', sem: 5, i: 3 }, 'd_sync', 'Pending', 3, null, 'Could I get the semaphore notes?'],
  [{ gen: 'CSE', sem: 3, i: 0 }, 'k_stack', 'Accepted', 10, 9, 'Requesting stacks and queues notes for DSA.'],
  [108, 'm_fft', 'Completed', 90, 88, 'Would like the FFT butterfly diagrams.'],
  [{ gen: 'MECH', sem: 3, i: 0 }, 'i_open', 'Pending', 5, null, 'Requesting the open-system first law notes.'],
  [103, 'n_ospyq', 'Completed', 100, 99, 'Requesting the OS end-sem paper.'],
];

// ─────────────────────────────────────────────────────────────
export function buildSeed(now = new Date()) {
  const { rand, int, pick, weighted, sample } = makeTools(20260919);
  const day = (n) => isoDaysAgo(n, now);

  // ── Student ──
  const Student = [];
  const emailFor = (name, reg) => {
    const [f, ...rest] = name.toLowerCase().split(' ');
    return `${f}.${rest.join('')}${reg.slice(0, 2)}@${CAMPUS_DOMAIN}`;
  };
  for (const s of NAMED_STUDENTS) {
    Student.push({
      student_id: s.student_id,
      name: s.name,
      email: emailFor(s.name, s.reg),
      department: s.department,
      semester: s.semester,
      _ui: { reg_no: s.reg, joined: day(s.joinedDaysAgo) },
    });
  }
  const usedNames = new Set(Student.map((s) => s.name));
  const firsts = sample(FIRST, FIRST.length);
  for (let i = 0; i < 40; i++) {
    let name;
    do name = `${firsts[i % firsts.length]} ${pick(LAST)}`;
    while (usedNames.has(name));
    usedNames.add(name);
    const drawn = weighted([['CSE', 5], ['ECE', 3], ['MECH', 2]]);
    const department = i < 10 ? ['CSE', 'CSE', 'CSE', 'CSE', 'CSE', 'CSE', 'ECE', 'ECE', 'MECH', 'MECH'][i] : drawn;
    const semester = i < 10 ? [5, 5, 5, 5, 5, 3, 3, 5, 3, 5][i] : weighted([[1, 1], [2, 1], [3, 4], [4, 1], [5, 4], [6, 1], [7, 3], [8, 1]]);
    const year = { 1: 26, 2: 26, 3: 25, 4: 25, 5: 24, 6: 24, 7: 23, 8: 23 }[semester];
    const reg = `${year}${DEPT_REG[department]}${String(int(100, 1499)).padStart(4, '0')}`;
    Student.push({
      student_id: 109 + i,
      name,
      email: emailFor(name, reg),
      department,
      semester,
      _ui: { reg_no: reg, joined: day(int(20, 180)) },
    });
  }
  const generated = Student.filter((s) => s.student_id >= 109);
  const genStudent = ({ gen, sem, i = 0 }) => {
    const pool = generated.filter((s) => s.department === gen && s.semester === sem);
    return (pool[i % pool.length] || generated.find((s) => s.department === gen)).student_id;
  };
  const resolve = (who) => (typeof who === 'number' ? who : genStudent(who));

  // ── Subject ──
  const Subject = SUBJECTS.map(({ subject_id, subject_name, department, semester, code }) => ({
    subject_id,
    subject_name,
    department,
    semester,
    _ui: { code },
  }));
  const subjectMeta = Object.fromEntries(SUBJECTS.map((s) => [s.subject_id, s]));

  // ── Material ──
  const Material = [];
  const quality = {}; // material_id → q (seed-only, not stored)
  const ratingTarget = {}; // material_id → number of ratings to draw
  const byKey = {};
  let nextMaterial = 1001;

  const uiFor = (type, pages, tags, desc, yearHint) => ({
    thumbnail: null, // generated on the client from material_id
    pageCount: pages,
    fileSize: Math.round(pages * (120 + rand() * 260) * 1024),
    tags,
    description: desc,
    syllabus_year: yearHint ?? weighted([[2026, 4], [2025, 4], [2024, 2], [2023, 1], [2022, 1], [2021, 1]]),
    anonymous: false,
  });

  for (const d of DETAILED) {
    const id = nextMaterial++;
    byKey[d.key] = id;
    const yearMatch = d.title.match(/20\d\d/);
    Material.push({
      material_id: id,
      title: d.title,
      subject_id: d.subject,
      uploaded_by: resolve(d.uploader),
      material_type: d.type,
      upload_date: day(d.days),
      file_link: `https://files.studyswap.in/m/${id}.pdf`,
      _ui: uiFor(d.type, d.pages, d.tags, d.desc, yearMatch ? Number(yearMatch[0]) : 2025 + (d.days < 120 ? 1 : 0)),
    });
    if (d.q) {
      quality[id] = d.q;
      ratingTarget[id] = d.n;
    }
  }

  const TYPE_WEIGHTS = [['Notes', 45], ['PYQ', 22], ['Assignment', 15], ['Summary', 18]];
  const EXAMS = ['CAT-1', 'CAT-2', 'Mid-Sem', 'End-Sem', 'FAT'];
  const titles = new Set(Material.map((m) => m.title));

  const eligibleUploaders = (subj) => {
    const canUpload = (s) => s.student_id !== 101 && s.student_id !== 107;
    const senior = Student.filter((s) => s.department === subj.department && s.semester >= subj.semester && canUpload(s));
    // A late-semester elective may have no senior in that department yet.
    return senior.length ? senior : Student.filter((s) => s.department === subj.department && canUpload(s));
  };

  for (const subj of SUBJECTS) {
    const pool = eligibleUploaders(subj);
    const weights = pool.map((s) => [s.student_id, s.student_id === 102 ? 4 : s.student_id <= 108 ? 3 : 1]);
    for (let n = 0; n < GENERATED_PER_SUBJECT[subj.subject_id]; n++) {
      const type = weighted(TYPE_WEIGHTS);
      let title;
      let desc;
      let pages;
      let tags;
      let year;
      let tries = 0;
      do {
        const ti = int(0, subj.topics.length - 1);
        const topic = subj.topics[ti];
        const topicTag = topic.split(/[ —,]+/)[0].toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (type === 'Notes') {
          const style = pick([', Handwritten', ' — Typed Notes', ' — Class Notes', ' with Diagrams', ' — Detailed Notes', '']);
          title = `${subj.short} Unit ${ti + 1} — ${topic}${style}`;
          desc = `${style.includes('Hand') ? 'Handwritten' : 'Typed'} notes on ${topic} for ${subj.subject_name}, covering definitions, key results and worked examples from the lectures.`;
          pages = int(6, 36);
          tags = [topicTag, 'notes', style.includes('Hand') ? 'handwritten' : 'typed'];
        } else if (type === 'PYQ') {
          const exam = pick(EXAMS);
          year = int(2021, 2025);
          const solved = rand() < 0.55;
          title = `${subj.short} ${exam} PYQ ${year}${solved ? ' with Solutions' : pick(['', ' (Scanned)', ' — Question Paper'])}`;
          desc = `Previous-year ${exam} paper for ${subj.subject_name} (${year})${solved ? ', with fully worked solutions' : ', questions only'}. Useful for the question pattern and marks split.`;
          pages = int(2, 12);
          tags = ['pyq', exam.toLowerCase(), solved ? 'solved' : 'unsolved'];
        } else if (type === 'Assignment') {
          const no = int(1, 6);
          title = `${subj.short} Assignment ${no} — ${topic}${pick([' Solutions', '', ' — Worked Answers'])}`;
          desc = `Solutions to assignment ${no} on ${topic} for ${subj.subject_name}. Each answer shows the method, not just the final result.`;
          pages = int(3, 15);
          tags = [topicTag, 'assignment', 'solved'];
        } else {
          const form = pick(['One-Page Summary', 'Formula Sheet', 'Quick Revision Notes', 'Cheat Sheet']);
          title = `${subj.short} — ${topic} ${form}`;
          desc = `A condensed ${form.toLowerCase()} on ${topic} for last-minute revision in ${subj.subject_name}.`;
          pages = int(1, 4);
          tags = [topicTag, 'summary', 'revision'];
        }
        tries++;
      } while (titles.has(title) && tries < 6);
      titles.add(title);

      const id = nextMaterial++;
      const days = Math.floor(Math.pow(rand(), 1.25) * 180);
      Material.push({
        material_id: id,
        title,
        subject_id: subj.subject_id,
        uploaded_by: weighted(weights),
        material_type: type,
        upload_date: day(days),
        file_link: `https://files.studyswap.in/m/${id}.pdf`,
        _ui: uiFor(type, pages, tags, desc, year),
      });
      const uploader = Material[Material.length - 1].uploaded_by;
      quality[id] = uploader === 102 ? 4.4 + rand() * 0.5 : 2.4 + rand() * 2.5;
      ratingTarget[id] = weighted([[0, 30], [1, 20], [2, 18], [3, 14], [4, 10], [5, 5], [6, 3]]);
    }
  }
  const daysSinceUpload = (m) => Math.round((now - new Date(`${m.upload_date}T12:00:00`)) / 86400000);

  // ── Rating ──
  const Rating = [];
  const rated = new Set(); // `${material_id}:${student_id}` — uq_rating_student_material
  let nextRating = 7001;
  const addRating = (material_id, rated_by, score, comment, daysAgo, subs) => {
    const k = `${material_id}:${rated_by}`;
    if (rated.has(k)) return false;
    rated.add(k);
    Rating.push({
      rating_id: nextRating++,
      material_id,
      rated_by,
      score,
      comment,
      rating_date: day(daysAgo),
      _ui: subs || subScoresFor(score),
    });
    return true;
  };
  // Completeness / Legibility / Accuracy (§7.5) — score is their rounded mean.
  function subScoresFor(score) {
    const j = () => Math.max(1, Math.min(5, score + pick([-1, 0, 0, 0, 1])));
    let s;
    do s = { completeness: j(), legibility: j(), accuracy: j() };
    while (Math.round((s.completeness + s.legibility + s.accuracy) / 3) !== score);
    return s;
  }

  // 1. Demo user's fixed ratings.
  for (const [key, score, who, comment, daysAgo] of AARAV_RATINGS) {
    addRating(byKey[key], resolve(who), score, comment, daysAgo);
  }

  // 2. Swap_Request, plus the rating each Completed request produced.
  const Swap_Request = [];
  let nextRequest = 5001;
  const reservedNoRating = new Set();
  for (const [who, key, status, reqDays, respDays, message, extra = {}] of REQUESTS) {
    const requester_id = resolve(who);
    const material_id = byKey[key];
    Swap_Request.push({
      request_id: nextRequest++,
      requester_id,
      material_id,
      status,
      request_date: day(reqDays),
      response_date: respDays === null ? null : day(respDays),
      message,
      _ui: {
        offer_material_id: extra.offer ? byKey[extra.offer] : null,
        reject_reason: extra.reason ?? null,
        linked_request_id: null,
      },
    });
    const k = `${material_id}:${requester_id}`;
    // Nobody rates a material they are still waiting on.
    if (status !== 'Completed') reservedNoRating.add(k);
    if (status === 'Completed' && requester_id === 101 && key === 'n_txn') {
      reservedNoRating.add(k); // "received, awaiting your rating"
    } else if (status === 'Completed' && !rated.has(k)) {
      const q = quality[material_id] ?? 4.2;
      const score = Math.max(1, Math.min(5, Math.round(q + (rand() - 0.5))));
      addRating(material_id, requester_id, score, pick(COMMENTS[score]), Math.max(0, respDays - 1));
    }
  }
  for (const k of reservedNoRating) rated.add(k); // keep the random pass off it

  // 3. Everyone else's ratings, drawn from each material's quality.
  const raterPool = Student.filter((s) => s.student_id !== 107);
  for (const m of Material) {
    if (m.uploaded_by === 101) continue; // fixed above
    const q = quality[m.material_id];
    const want = ratingTarget[m.material_id] ?? 0;
    const subj = subjectMeta[m.subject_id];
    // Raters are mostly from the subject's department.
    const pool = raterPool.filter((s) => s.student_id !== m.uploaded_by && (s.department === subj.department || rand() < 0.15));
    const raters = sample(pool, want);
    const age = daysSinceUpload(m);
    const detailed = m.material_id < 1041;
    const usedComments = new Set();
    for (const r of raters) {
      const score = Math.max(1, Math.min(5, Math.round(q + (rand() - 0.5) * 1.6)));
      let comment = null;
      if (rand() < (detailed ? 0.6 : 0.22)) {
        const options = COMMENTS[score].filter((c) => !usedComments.has(c));
        if (options.length) {
          comment = pick(options);
          usedComments.add(comment);
        }
      }
      addRating(m.material_id, r.student_id, score, comment, int(0, Math.max(0, age)));
    }
  }
  for (const k of reservedNoRating) rated.delete(k);

  Rating.sort((a, b) => a.rating_id - b.rating_id);

  // Prototype-only credential store — NOT part of the schema. The real
  // backend keeps hashed passwords in its own auth table.
  const auth = Object.fromEntries(Student.map((s) => [s.student_id, DEMO_PASSWORD]));

  return { tables: { Student, Subject, Material, Swap_Request, Rating }, auth, seededAt: now.toISOString() };
}
