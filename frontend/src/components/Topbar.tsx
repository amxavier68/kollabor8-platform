import { User } from "lucide-react";

export const Topbar = () => (
  <header className="flex justify-between items-center px-6 py-3 bg-white shadow-sm">
    <h1 className="text-lg font-medium">Dashboard</h1>
    <div className="flex items-center gap-3">
      <User className="text-gray-600" />
      <span className="font-medium">Hello, Steve</span>
    </div>
  </header>
);
