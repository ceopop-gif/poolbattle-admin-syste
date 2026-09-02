import type { MenuItem } from "@/lib/poolbattle-data";
import { ChevronRight } from "lucide-react";

type MenuCardProps = { item: MenuItem; onOpen: (item: MenuItem) => void };

export function MenuCard({ item, onOpen }: MenuCardProps) {
  const Icon = item.icon;
  return (
    <button className={`menu-card tone-${item.tone}`} type="button" onClick={() => onOpen(item)} aria-label={`เปิดเมนู ${item.title}`}>
      <span className="menu-number" aria-hidden="true">{item.number}</span>
      <span className="card-glow" aria-hidden="true" />
      {item.id === "margie" ? <span className="margie-portrait" aria-hidden="true" /> : <span className="menu-icon-wrap" aria-hidden="true"><Icon size={40} strokeWidth={1.7} /></span>}
      <span className="menu-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
      <ChevronRight className="menu-arrow" size={18} aria-hidden="true" />
    </button>
  );
}
