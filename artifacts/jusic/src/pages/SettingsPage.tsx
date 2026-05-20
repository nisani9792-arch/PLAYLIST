import Settings from '@/pages/admin/Settings';
import { OperatorWorkspaceSettings } from '@/components/settings/OperatorWorkspaceSettings';
import { Button } from '@/components/ui/button';
import { JusicLogo } from '@/components/ui/jusic-logo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeUpVariants } from '@/lib/motion-presets';

export default function SettingsPage({ operatorName }: { operatorName: string }) {
  return (
    <div className="app-shell-bg min-h-[100dvh] flex flex-col">
      <header className="j-glass-strip bp-glass-strip flex items-center gap-3 px-4 py-3.5 border-b border-border/40">
        <Link href="/">
          <Button variant="ghost" size="sm" className="rounded-full gap-1">
            <ArrowRight className="h-4 w-4" />
            חזרה לעבודה
          </Button>
        </Link>
        <JusicLogo size={34} />
        <div className="min-w-0">
          <h1 className="text-sm font-bold font-display">הגדרות</h1>
          <p className="text-[10px] text-secondary truncate">{operatorName}</p>
        </div>
      </header>
      <motion.main
        variants={fadeUpVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 overflow-y-auto custom-scrollbar p-4 max-w-3xl mx-auto w-full"
      >
        <Tabs defaultValue="operator" dir="rtl">
          <TabsList className="mb-4 w-full justify-start rounded-2xl bg-card/60 backdrop-blur-sm p-1">
            <TabsTrigger value="operator" className="rounded-xl">מפעיל</TabsTrigger>
            <TabsTrigger value="system" className="rounded-xl">מערכת</TabsTrigger>
          </TabsList>          <TabsContent value="operator">
            <OperatorWorkspaceSettings />
          </TabsContent>
          <TabsContent value="system">
            <Settings />
          </TabsContent>
        </Tabs>
      </motion.main>
    </div>
  );
}