import type { BottomTabId } from "@/lib/poolbattle-data";
import { BarChart3, ClipboardList, Home, ListOrdered, Settings } from "lucide-react";

type BottomNavProps = { activeTab: BottomTabId; onChange: (tab: BottomTabId) => void };

const ITEMS = [
  { id: "scores" as const, label: "ผลคะแนน", icon: ClipboardList },
  { id: "order" as const, label: "ลำดับ", icon: ListOrdered },
  { id: "home" as const, label: "หน้าหลัก", icon: Home },
  { id: "ranking" as const, label: "แร้งกิ้ง", icon: BarChart3 },
  { id: "settings" as const, label: "ตั้งค่า", icon: Settings },
];

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="เมนูหลักด้านล่าง">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.id;
        return (
          <button key={item.id} className={`nav-item ${active ? "active" : ""} ${item.id === "home" ? "home-item" : ""}`} type="button" aria-current={active ? "page" : undefined} onClick={() => onChange(item.id)}>
            <span className="nav-icon"><Icon size={item.id === "home" ? 25 : 22} strokeWidth={2} /></span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
