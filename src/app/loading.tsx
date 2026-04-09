export default function GlobalLoading() {
  return (
    <div className="container stack-xl">
      <div className="skeleton-shell">
        <div className="skeleton-block" />
        <div className="card stack-md">
          <div className="skeleton-line medium" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      </div>
    </div>
  );
}
