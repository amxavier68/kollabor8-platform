import { Home, BarChart3, FolderKanban, Settings } from "lucide-react";

const navItems = [
  { name: "Dashboard", icon: Home },
  { name: "Projects", icon: FolderKanban },
  { name: "SEO Audits", icon: BarChart3 },
  { name: "Settings", icon: Settings },
];

export const Sidebar = () => (
  <aside className="w-64 bg-white shadow-md p-4 flex flex-col">
    <div className="text-xl font-semibold mb-8">Kollabor8</div>
    <nav className="space-y-2">
      {navItems.map(({ name, icon: Icon }) => (
        <button
          key={name}
          className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <Icon size={18} />
          <span>{name}</span>
        </button>
      ))}
    </nav>
  </aside>
);
