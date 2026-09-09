import { NavLink, Outlet } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import NavAuthControl from '@/components/saath/NavAuthControl';
import { useTranslation } from '@/lib/i18n/I18nProvider';
import { cn } from '@/lib/utils';

export function VayuLayout() {
  const { t } = useTranslation();

  const TABS = [
    { to: 'drought', label: t('vayu_drought_tab') },
    { to: 'flood',   label: t('vayu_flood_tab')   },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation authSlot={<NavAuthControl />} />

      {/* Sub-nav strip — same pattern as CascadeLayout */}
      <div className="fixed top-16 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-[1800px] mx-auto px-6 flex items-center gap-4 h-12">
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-thin -mx-2 px-2">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 pb-20 pt-32">
        <Outlet />
      </main>
    </div>
  );
}
