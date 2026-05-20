"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Cpu,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  Copy,
  Check,
  Clock,
} from "lucide-react";

interface Device {
  id: string;
  name: string;
  isOnline: boolean;
  lastSeen: string | null;
  createdAt: string;
  token?: string; // only present immediately after registration
}

function formatRelative(dateStr: string | null) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function TokenDisplay({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-muted p-3 font-mono text-xs break-all">
        {token}
      </div>
      <Button size="sm" variant="outline" onClick={copy} className="w-full gap-2">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied!" : "Copy Token"}
      </Button>
    </div>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [registering, setRegistering] = useState(false);
  const [newDevice, setNewDevice] = useState<Device | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function loadDevices() {
    const res = await fetch("/api/devices");
    const data = await res.json();
    setDevices(data);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDevices();
  }, []);

  async function handleRegister() {
    if (!name.trim()) return;
    setRegistering(true);
    const res = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const device: Device = await res.json();
    setNewDevice(device);
    setDevices((prev) => [device, ...prev]);
    setName("");
    setRegistering(false);
  }

  async function handleDelete(deviceId: string) {
    await fetch(`/api/devices/${deviceId}`, { method: "DELETE" });
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    setDeleteConfirm(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Register your ESP32 wearables here to generate secure connection tokens. 
            Once registered, copy the token to your device&apos;s WiFi portal to start streaming data.
          </p>
        </div>

        <Dialog
          open={registerOpen}
          onOpenChange={(open) => {
            setRegisterOpen(open);
            if (!open) setNewDevice(null);
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Register Device
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            {newDevice ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    Device Registered
                  </DialogTitle>
                  <DialogDescription>
                    Save this token — it will not be shown again. Paste it into
                    your ESP32 firmware config.
                  </DialogDescription>
                </DialogHeader>
                <TokenDisplay token={newDevice.token!} />
                <Button
                  variant="outline"
                  onClick={() => {
                    setRegisterOpen(false);
                    setNewDevice(null);
                  }}
                >
                  Done
                </Button>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Register New Device</DialogTitle>
                  <DialogDescription>
                    Give your ESP32 a name to identify it in the dashboard.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="device-name">Device Name</Label>
                    <Input
                      id="device-name"
                      placeholder="e.g. Wrist Band #1"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleRegister}
                    disabled={registering || !name.trim()}
                  >
                    {registering ? "Registering…" : "Register"}
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Separator />

      {/* Devices table */}
      {loading ? (
        <div className="text-center text-muted-foreground py-16">
          Loading devices…
        </div>
      ) : devices.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <Cpu className="h-10 w-10 text-muted-foreground" />
            <CardTitle className="text-base">No devices registered</CardTitle>
            <CardDescription>
              Register your first device to get a secure pairing token.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">{device.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={device.isOnline ? "default" : "secondary"}
                      className="gap-1"
                    >
                      {device.isOnline ? (
                        <Wifi className="h-3 w-3" />
                      ) : (
                        <WifiOff className="h-3 w-3" />
                      )}
                      {device.isOnline ? "Online" : "Offline"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelative(device.lastSeen)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(device.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Dialog
                      open={deleteConfirm === device.id}
                      onOpenChange={(open) =>
                        setDeleteConfirm(open ? device.id : null)
                      }
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Remove Device</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to remove{" "}
                            <strong>{device.name}</strong>? This cannot be
                            undone.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex gap-3 justify-end">
                          <Button
                            variant="outline"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleDelete(device.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
