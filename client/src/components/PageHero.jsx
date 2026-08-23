export default function PageHero({ kicker, chips, title, lede, children, aside }) {
  return (
    <section className="page-hero">
      <div className="hero-grid-bg" aria-hidden="true" />
      <div className={`wrap${aside ? ' page-hero-split' : ''}`}>
        <div>
          {kicker && <p className="kicker">{kicker}</p>}
          {chips && (
            <div className="chip-pills">
              {chips.map((c) => (
                <span key={c} className="mini-chip">{c}</span>
              ))}
            </div>
          )}
          <h1>{title}</h1>
          {lede && <p className="lede">{lede}</p>}
          {children}
        </div>
        {aside}
      </div>
    </section>
  );
}
