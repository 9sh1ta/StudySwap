// The query plan as a vertical diagram of ruled boxes, in relational
// algebra: σ selection, ⋈ join, ⟕ left outer join, γ grouping,
// τ sort/limit, π projection. Children hang below their parent.
//
// The point of showing both trees: in the optimized one σ sits directly on
// the relation it constrains (pushed below the joins), so the join sees a
// handful of rows instead of the whole table.
const OP_NAME = {
  π: 'Project',
  τ: 'Sort / Limit',
  γ: 'Group and aggregate',
  σ: 'Select (filter)',
  '⋈': 'Join',
  '⟕': 'Left outer join',
  scan: 'Relation',
};

function Node({ node, depth = 0 }) {
  const isScan = node.op === 'scan';
  const indexed = isScan && node.access?.startsWith('Index');
  return (
    <li className="plan__node">
      <div className={`plan__box${isScan ? ' plan__box--scan' : ''}${node.op === 'σ' ? ' plan__box--filter' : ''}`}>
        <span className="plan__op" title={OP_NAME[node.op] || node.op}>
          {isScan ? '▤' : node.op}
        </span>
        <span className="plan__label">{node.label}</span>
        {node.access && <span className={`plan__access${indexed ? ' plan__access--index' : ''}`}>{node.access}</span>}
      </div>
      {node.children?.length > 0 && (
        <ul className="plan__children">
          {node.children.map((c, i) => (
            <Node key={`${depth}-${i}-${c.label}`} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function PlanTree({ plan, variant = 'optimized' }) {
  const tree = plan?.[variant];
  if (!tree) {
    return <p className="small faint">This statement did not record a plan — the Inspector keeps plans for the screen-level queries.</p>;
  }
  return (
    <ul className="plan" aria-label={`${variant} query plan`}>
      <Node node={tree} />
    </ul>
  );
}
