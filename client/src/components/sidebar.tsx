import { Link, useLocation } from "wouter";
import { Play, History, CheckSquare, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const [location] = useLocation();

  const navigation = [
    { name: 'Query Executor', href: '/', icon: Play, current: location === '/' },
    { name: 'Query History', href: '/history', icon: History, current: location === '/history' },
    { name: 'Approvals', href: '/approvals', icon: CheckSquare, current: location === '/approvals', badge: 3 },
    { name: 'Analytics', href: '/analytics', icon: BarChart3, current: location === '/analytics' },
    { name: 'Settings', href: '/settings', icon: Settings, current: location === '/settings' },
  ];

  return (
    <nav className="w-64 bg-white border-r border-gray-200 shadow-sm overflow-y-auto">
      <div className="p-4">
        <ul className="space-y-2">
          {navigation.map((item) => (
            <li key={item.name}>
              <Link href={item.href}>
                <div
                  className={cn(
                    "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                    item.current
                      ? "text-enterprise-blue bg-blue-50"
                      : "text-gray-700 hover:text-enterprise-blue hover:bg-gray-50"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className="ml-auto bg-enterprise-warning text-white text-xs px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
