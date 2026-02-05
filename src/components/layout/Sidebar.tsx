'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Package, 
  Settings, 
  LogOut 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase/auth";

const navItems = [
  {
    title: "Dashboard",
    href: "/", // Assuming dashboard is root of app/
    icon: LayoutDashboard,
  },
  {
    title: "Presupuestos",
    href: "/presupuestos", // We might need to create this list page if not done, or reuse quotes/page
    icon: FileText,
  },
  {
    title: "Clientes",
    href: "/clientes",
    icon: Users,
  },
  {
    title: "Materiales",
    href: "/materiales", // Future
    icon: Package,
  },
  {
    title: "Configuración",
    href: "/settings", // Future
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="relative hidden h-screen border-r pt-16 md:block w-72 bg-slate-50">
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            Plataforma JM
          </h2>
          <div className="space-y-1">
            {navItems.map((item) => (
              <Button
                key={item.href}
                asChild
                variant={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) ? "secondary" : "ghost"}
                className={cn(
                    "w-full justify-start",
                    (pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))) && "bg-slate-200"
                )}
              >
                <Link href={item.href}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.title}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 w-full px-6">
        <Button 
            variant="outline" 
            className="w-full text-red-500 border-red-200 hover:bg-red-50"
            onClick={() => auth.signOut()}
        >
            <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
        </Button>
      </div>
    </nav>
  );
}
