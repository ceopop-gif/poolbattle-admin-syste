import { createQrMatrix } from "@/lib/qr-code";

export function MemberQrCode({ value, label }: { value: string; label: string }) {
  const matrix = createQrMatrix(value);
  const quietZone = 4;
  const viewSize = matrix.length + quietZone * 2;
  const path = matrix.flatMap((row, y) => row.flatMap((dark, x) => dark ? [`M${x + quietZone} ${y + quietZone}h1v1h-1z`] : [])).join("");
  return (
    <svg className="member-qr-code" viewBox={`0 0 ${viewSize} ${viewSize}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={viewSize} height={viewSize} fill="#fff" />
      <path d={path} fill="#07110c" />
    </svg>
  );
}
