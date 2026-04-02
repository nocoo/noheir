"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Anchor,
  Save,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { BalanceAnchor } from "@/domain/types"
import { groupAnchorsByAccount } from "@/domain/settings/balance-anchors"
import { saveBalanceAnchors } from "@/app/actions/settings-actions"

interface BalanceAnchorsClientProps {
  accounts: string[]
  initialAnchors: BalanceAnchor[]
}

export function BalanceAnchorsClient({
  accounts,
  initialAnchors,
}: BalanceAnchorsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [anchors, setAnchors] = useState<BalanceAnchor[]>(initialAnchors)
  const [selectedAccount, setSelectedAccount] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [balance, setBalance] = useState("")

  const anchorsByAccount = groupAnchorsByAccount(anchors)

  const handleAddAnchor = () => {
    if (!selectedAccount || !selectedDate || balance === "") return

    const newAnchor: BalanceAnchor = {
      accountName: selectedAccount,
      date: selectedDate,
      balance: parseFloat(balance),
    }

    // Remove existing anchor for same account + date if exists
    const filtered = anchors.filter(
      (a) => !(a.accountName === selectedAccount && a.date === selectedDate),
    )

    setAnchors([...filtered, newAnchor])
    setSelectedAccount("")
    setSelectedDate("")
    setBalance("")
  }

  const handleRemoveAnchor = (accountName: string, date: string) => {
    setAnchors((prev) =>
      prev.filter((a) => !(a.accountName === accountName && a.date === date)),
    )
  }

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveBalanceAnchors(anchors)
      if (result.success) {
        toast.success("余额锚点已保存")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Anchor className="text-primary size-6" />
          余额锚点设置
        </h1>
        <p className="text-muted-foreground text-sm">
          为账户设置已知日期的余额，用于计算历史余额
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="size-4" />
        <AlertDescription className="text-sm">
          余额锚点是指某一天<strong>结束时的余额</strong>
          。如果这一天有交易，计算时会将交易处理在余额调整之前。
        </AlertDescription>
      </Alert>

      {/* Add New Anchor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">添加余额锚点</CardTitle>
          <CardDescription>为指定账户设置某日期的已知余额</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
                max={new Date().toISOString().split("T")[0]}
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
        </CardContent>
      </Card>

      {/* Existing Anchors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            已设置的余额锚点 ({anchors.length})
          </CardTitle>
          <CardDescription>按账户分组显示所有余额锚点</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(anchorsByAccount).length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              暂无余额锚点
            </div>
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
                        key={`${anchor.accountName}-${anchor.date}`}
                        className="bg-card flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex flex-1 items-center gap-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="text-muted-foreground size-4" />
                            <span className="font-medium">{anchor.date}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">余额: </span>
                            <span className="font-semibold">
                              ¥{anchor.balance.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleRemoveAnchor(anchor.accountName, anchor.date)
                          }
                          className="text-muted-foreground hover:text-destructive size-8"
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
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          <Save className="mr-2 size-4" />
          {isPending ? "保存中..." : "保存设置"}
        </Button>
      </div>
    </div>
  )
}
