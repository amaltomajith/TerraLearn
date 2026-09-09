import { Globe, Check, ChevronDown } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/I18nProvider';
import { useIdentity } from '@/lib/identity/identity';
import { updateFarmerLanguage } from '@/lib/saath/queries';
import type { LanguageCode } from '@/lib/i18n/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

interface LanguageSelectorProps {
  compact?: boolean;
  className?: string;
}

export function LanguageSelector({ compact = false, className = '' }: LanguageSelectorProps) {
  const { language, setLanguage, supportedLanguages, currentLanguageInfo } = useTranslation();
  let farmerId: string | null = null;
  try {
    const ident = useIdentity();
    farmerId = ident?.activeFarmerId ?? null;
  } catch {
    /* when rendered outside IdentityProvider e.g. landing */
  }

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code);
    if (farmerId) {
      void updateFarmerLanguage(farmerId, code);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-2.5 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-card hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 active:scale-95 ${className}`}
        aria-label="Change language"
      >
        <Globe className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">{currentLanguageInfo.name}</span>
        {!compact && (
          <span className="hidden md:inline text-[11px] text-muted-foreground">
            ({currentLanguageInfo.englishName})
          </span>
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground opacity-70" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5 shadow-xl border-border/60">
        <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground border-b border-border/40 mb-1 flex items-center justify-between">
          <span>ಭಾರತೀಯ ಭಾಷೆಗಳು / Languages</span>
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">7</span>
        </div>

        {supportedLanguages.map((lang) => {
          const isSelected = lang.code === language;
          return (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                isSelected
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-foreground hover:bg-muted/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{lang.flag}</span>
                <div className="flex flex-col">
                  <span className="text-xs font-medium leading-tight">{lang.name}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    {lang.englishName}
                  </span>
                </div>
              </div>
              {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
