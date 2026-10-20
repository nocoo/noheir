import { Button, Input, Label, LayerCard } from "@nocoo/basalt";
import { Badge } from "@nocoo/basalt/components/badge";
import { Banner } from "@nocoo/basalt/components/banner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nocoo/basalt/components/select";
import { toast } from "@nocoo/basalt/components/toast";
import { AlertCircle, Anchor, Calendar, Plus, Save, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRevalidator } from "react-router";
import { saveBalanceAnchors } from "@/app/actions/settings-actions";
import { FinancialSnapshotNotice } from "@/components/shared/financial-snapshot-notice";
import { groupAnchorsByAccount } from "@/domain/settings/balance-anchors";
import type { BalanceAnchor } from "@/domain/types";
import { getLocalDateString } from "@/lib/local-date";

interface BalanceAnchorsClientProps {
  accounts: string[];
  revision: number;
  initialAnchors: BalanceAnchor[];
}

export function BalanceAnchorsClient({
  accounts,
  initialAnchors,
  revision,
}: BalanceAnchorsClientProps) {
  const revalidator = useRevalidator();
  const [isPending, startTransition] = useTransition();

  const [anchors, setAnchors] = useState<BalanceAnchor[]>(initialAnchors);
  const [baseRevision, setBaseRevision] = useState(revision);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState("CNY");

  const anchorsByAccount = groupAnchorsByAccount(anchors);

  const handleAddAnchor = () => {
    if (!selectedAccount || !selectedDate || balance === "" || !Number.isFinite(Number(balance)))
      return;

    const newAnchor: BalanceAnchor = {
      accountName: selectedAccount,
      date: selectedDate,
      balance: parseFloat(balance),
      currency,
    };

    // Remove existing anchor for same account + date if exists
    const filtered = anchors.filter(
      (a) =>
        !(a.accountName === selectedAccount && a.date === selectedDate && a.currency === currency),
    );

    setAnchors([...filtered, newAnchor]);
    setSelectedAccount("");
    setSelectedDate("");
    setBalance("");
  };

  const handleRemoveAnchor = (accountName: string, date: string, currency: string | undefined) => {
    setAnchors((prev) =>
      prev.filter(
        (a) => !(a.accountName === accountName && a.date === date && a.currency === currency),
      ),
    );
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveBalanceAnchors(anchors, baseRevision);
      if (result.success) {
        toast.success("余额锚点已保存");
        revalidator.revalidate();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <FinancialSnapshotNotice
        changed={baseRevision !== revision}
        onReset={() => {
          setAnchors(initialAnchors);
          setBaseRevision(revision);
        }}
      />
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Anchor className="text-basalt-primary size-6" />
          余额锚点设置
        </h1>
        <p className="text-basalt-muted-foreground text-sm">
          为账户设置已知日期的余额，用于计算历史余额
        </p>
      </div>

      {/* Info Alert */}
      <Banner
        role="alert"
        icon={<AlertCircle className="size-4" />}
        description={
          <>
            余额锚点是指某一天<strong>结束时的余额</strong>
            。如果这一天有交易，计算时会将交易处理在余额调整之前。
          </>
        }
      />

      {/* Add New Anchor */}
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground text-base">
            添加余额锚点
          </h3>
          <p className="text-sm text-basalt-muted-foreground">为指定账户设置某日期的已知余额</p>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>账户</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="选择账户" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account} value={account}>
                      {account}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>日期</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={getLocalDateString()}
              />
            </div>

            <div className="space-y-2">
              <Label>余额</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>币种</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger aria-label="币种">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["CNY", "USD", "HKD"].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleAddAnchor}
                disabled={!selectedAccount || !selectedDate || balance === ""}
                className="w-full"
              >
                <Plus className="mr-1 size-4" />
                添加
              </Button>
            </div>
          </div>
        </LayerCard.Body>
      </LayerCard>

      {/* Existing Anchors */}
      <LayerCard>
        <LayerCard.Header className="items-stretch flex-col gap-1.5">
          <h3 className="font-semibold leading-none tracking-tight text-basalt-foreground text-base">
            已设置的余额锚点 ({anchors.length})
          </h3>
          <p className="text-sm text-basalt-muted-foreground">按账户分组显示所有余额锚点</p>
        </LayerCard.Header>
        <LayerCard.Body className="min-h-0 flex-1">
          {Object.keys(anchorsByAccount).length === 0 ? (
            <div className="text-basalt-muted-foreground py-8 text-center">暂无余额锚点</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(anchorsByAccount).map(([accountName, acctAnchors]) => (
                <div key={accountName} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">{accountName}</h4>
                    <Badge variant="secondary">{acctAnchors.length} 个锚点</Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {acctAnchors.map((anchor) => (
                      <div
                        key={`${anchor.accountName}-${anchor.date}-${anchor.currency}`}
                        className="bg-basalt-secondary flex items-center justify-between rounded-lg p-3"
                      >
                        <div className="flex flex-1 items-center gap-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="text-basalt-muted-foreground size-4" />
                            <span className="font-medium">{anchor.date}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-basalt-muted-foreground">余额: </span>
                            <span className="font-semibold">
                              {anchor.currency ?? "CNY"} {anchor.balance.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`移除 ${anchor.accountName} ${anchor.date} ${anchor.currency ?? "CNY"} 锚点`}
                          onClick={() =>
                            handleRemoveAnchor(anchor.accountName, anchor.date, anchor.currency)
                          }
                          className="text-basalt-muted-foreground hover:text-basalt-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </LayerCard.Body>
      </LayerCard>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          <Save className="mr-2 size-4" />
          {isPending ? "保存中..." : "保存设置"}
        </Button>
      </div>
    </div>
  );
}
