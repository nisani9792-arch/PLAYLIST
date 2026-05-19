import Settings from '@/pages/admin/Settings';
import { OperatorWorkspaceSettings } from '@/components/settings/OperatorWorkspaceSettings';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';

export default function SettingsPage({ operatorName }: { operatorName: string }) {
  return (
    <div className="app-shell-bg min-h-[100dvh] flex flex-col">
      <header className="bp-glass-strip flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <Link href="/">
          <Button variant="ghost" size="sm" className="rounded-xl gap-1">
            <ArrowRight className="h-4 w-4" />
            חזרה לעבודה
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-sm font-bold">הגדרות</h1>
          <p className="text-[10px] text-muted-foreground truncate">{operatorName}</p>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 max-w-3xl mx-auto w-full">
        <Tabs defaultValue="operator" dir="rtl">
          <TabsList className="mb-4 w-full justify-start">
            <TabsTrigger value="operator">מפעיל</TabsTrigger>
            <TabsTrigger value="system">מערכת</TabsTrigger>
          </TabsList>
          <TabsContent value="operator">
            <OperatorWorkspaceSettings />
          </TabsContent>
          <TabsContent value="system">
            <Settings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
