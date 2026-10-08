// Page title block: small-caps eyebrow, serif title, one line of context,
// and actions on the right. Separated from the page by a rule.
export default function PageHeader({ eyebrow, title, description, actions, aside, children }) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__desc">{description}</p>}
        {children}
      </div>
      {(actions || aside) && <div className="page-header__aside">{aside || <div className="row gap-2">{actions}</div>}</div>}
    </header>
  );
}
