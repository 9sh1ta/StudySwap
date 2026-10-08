import { Modal } from '../ui';

const GROUPS = [
  {
    title: 'Get around',
    items: [
      [['g', 'd'], 'Dashboard'],
      [['g', 'b'], 'Browse'],
      [['g', 'r'], 'Requests'],
      [['g', 'm'], 'Swap matches'],
      [['g', 'l'], 'Leaderboard'],
      [['g', 'x'], 'DB Lab'],
      [['g', 'p'], 'Profile'],
      [['u'], 'Upload a material'],
    ],
  },
  {
    title: 'Find things',
    items: [
      [['Ctrl', 'K'], 'Command palette'],
      [['/'], 'Jump to the search box'],
    ],
  },
  {
    title: 'The database',
    items: [
      [['Ctrl', '/'], 'Query Inspector'],
      [['e'], 'Exam Mode'],
    ],
  },
  {
    title: 'Everything else',
    items: [
      [['t'], 'Light or dark theme'],
      [['?'], 'This list'],
      [['Esc'], 'Close whatever is open'],
    ],
  },
];

export default function ShortcutsOverlay({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Keyboard shortcuts" description="Single keys work anywhere except inside a text field.">
      <div className="shortcuts">
        {GROUPS.map((g) => (
          <section key={g.title} className="stack gap-3">
            <p className="eyebrow">{g.title}</p>
            <dl className="shortcuts__list">
              {g.items.map(([keys, label]) => (
                <div key={label}>
                  <dt>
                    {keys.map((k, i) => (
                      <span key={k}>
                        {i > 0 && <span className="shortcuts__then">then</span>}
                        <kbd>{k}</kbd>
                      </span>
                    ))}
                  </dt>
                  <dd>{label}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
