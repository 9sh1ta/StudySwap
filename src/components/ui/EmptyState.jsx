// Ruled-paper panel: one line naming what is missing, then the next action.
//   <EmptyState icon={Inbox} title="No incoming requests yet"
//               text="When someone asks for one of your uploads it lands here."
//               action={<Button …>Upload a material</Button>} />
export default function EmptyState({ icon: Icon, title, text, action, center = false, className = '' }) {
  return (
    <div className={`empty${center ? ' empty--center' : ''} ${className}`.trim()}>
      {Icon && (
        <span className="empty__icon" aria-hidden="true">
          <Icon />
        </span>
      )}
      <p className="empty__title">{title}</p>
      {text && <p className="empty__text">{text}</p>}
      {action && <div className="row gap-2">{action}</div>}
    </div>
  );
}
