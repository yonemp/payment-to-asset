const NODES = [
  [140, 150], [190, 120], [240, 155], [210, 200],
  [320, 130], [370, 170], [410, 120], [450, 190],
  [520, 140], [580, 165], [640, 125], [700, 180],
  [760, 145], [820, 170], [880, 130], [840, 220],
  [280, 250], [340, 280], [400, 260], [620, 250],
  [180, 240], [740, 250], [500, 220],
];

const ARCS = [
  [0, 4], [1, 5], [4, 8], [5, 10], [8, 12], [10, 14],
  [2, 16], [16, 17], [6, 9], [12, 21], [9, 22], [7, 19],
];

export default function RadarBg() {
  return (
    <div className="radar-bg" aria-hidden="true">
      <div className="radar-rings" />
      <div className="radar-cross" />
      <div className="radar-net">
        <svg viewBox="0 0 1000 400" fill="none">
          <defs>
            <filter id="netglow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {ARCS.map(([a, b], i) => {
            const [x1, y1] = NODES[a];
            const [x2, y2] = NODES[b];
            const cx = (x1 + x2) / 2;
            const cy = Math.min(y1, y2) - 36 - (i % 3) * 10;
            return (
              <path
                key={`${a}-${b}`}
                d={`M${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                stroke="#a3e635"
                strokeWidth="1.1"
                opacity={0.28 + (i % 4) * 0.08}
                filter="url(#netglow)"
              />
            );
          })}
          {NODES.map(([x, y], i) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={i % 5 === 0 ? 3.2 : 2.1}
              fill={i % 5 === 0 ? "#a3e635" : "#d4d4d8"}
              opacity={i % 5 === 0 ? 0.9 : 0.35}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
