import { ToggleGroup, ToggleGroupItem } from "@nocoo/basalt/components/toggle-group";
import { useState } from "react";
import { toast } from "sonner";
import { currentEnvironment, type EnvironmentMode, switchEnvironment } from "./environment-runtime";

export function EnvironmentSwitch() {
  const environment = currentEnvironment();
  const [pending, setPending] = useState(false);
  if (!environment?.visible) return null;
  const select = async (mode: string) => {
    if (!mode || !["demo", "e2e", "prod"].includes(mode)) return;
    setPending(true);
    try {
      await switchEnvironment(mode as EnvironmentMode);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "环境切换失败");
    } finally {
      setPending(false);
    }
  };
  return (
    <ToggleGroup
      type="single"
      value={environment.mode}
      onValueChange={select}
      aria-label="环境"
      disabled={environment.locked || pending}
    >
      <ToggleGroupItem value="demo">Demo</ToggleGroupItem>
      <ToggleGroupItem value="e2e">E2E</ToggleGroupItem>
      <ToggleGroupItem value="prod">Prod</ToggleGroupItem>
    </ToggleGroup>
  );
}
