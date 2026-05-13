import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    setIsInstalled(
      window.matchMedia('(display-mode: standalone)').matches ||
        navigatorWithStandalone.standalone === true,
    );

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    const prompt = installPrompt;
    setInstallPrompt(null);
    await prompt.prompt();
    await prompt.userChoice.catch(() => undefined);
  };

  if (isInstalled || !installPrompt) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-full text-[11px] font-semibold border-primary/35 bg-gradient-to-bl from-white to-primary/8 shadow-sm hover:shadow-md hover:border-primary/50"
      onClick={handleInstall}
      aria-label="התקן את BUILD PLAY"
    >
      <Download className="w-3.5 h-3.5 mr-1.5" />
      <span className="hidden sm:inline">התקן אפליקציה</span>
      <span className="sm:hidden">התקן</span>
    </Button>
  );
}
