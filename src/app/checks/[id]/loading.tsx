export default function CheckLoading() {
  return (
    <div className="container stack-xl">
      <div className="skeleton-shell">
        <div className="skeleton-block" />
        <div className="card stack-md">
          <div className="skeleton-line short" />
          <div className="skeleton-line medium" />
          <div className="skeleton-block" />
        </div>
      </div>
    </div>
  );
}
