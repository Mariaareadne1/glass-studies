interface SlotLabelsProps {
  xs: readonly number[];
  labels: readonly string[];
  active: number;
  top: number;
  colors?: readonly string[];
}

/** Quiet labels centred under each selector slot (decorative; radios carry the names). */
export function SlotLabels({ xs, labels, active, top, colors }: SlotLabelsProps) {
  return (
    <div className="slot-labels" aria-hidden="true" style={{ top }}>
      {xs.map((x, i) => (
        <span
          key={labels[i]}
          className={i === active ? 'is-active' : ''}
          style={{ left: x, color: i === active && colors ? colors[i] : undefined }}
        >
          {labels[i]}
        </span>
      ))}
    </div>
  );
}
