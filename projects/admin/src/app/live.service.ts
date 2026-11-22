import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { environment } from '@shared/environments/environment';
import { AuthService } from '@shared/core/auth.service';

export interface LiveEvent { area: 'orders' | 'accounting' | 'inventory'; kind: string; at: string; }

// The live channel (SignalR): the server says WHAT changed, the dashboard then reads the new numbers through the normal endpoints.
@Injectable({ providedIn: 'root' })
export class LiveService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private hub: HubConnection | null = null;

  readonly connected = signal(false);
  readonly events = new Subject<LiveEvent>();

  start(): void {
    if (this.hub) return;

    const hub = new HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/dashboard`, { accessTokenFactory: () => this.auth.token() ?? '', withCredentials: false })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
      .configureLogging(LogLevel.None)
      .build();

    hub.on('changed', (e: LiveEvent) => this.events.next(e));
    hub.onreconnecting(() => this.connected.set(false));
    // After a break the dashboard may have missed things: a "reconnected" event makes it read everything again
    hub.onreconnected(() => { this.connected.set(true); this.events.next({ area: 'orders', kind: 'Reconnected', at: new Date().toISOString() }); });
    hub.onclose(() => this.connected.set(false));

    this.hub = hub;
    void this.connect();
  }

  private async connect(): Promise<void> {
    const hub = this.hub;
    if (!hub) return;

    try {
      await hub.start();
      this.connected.set(hub.state === HubConnectionState.Connected);
    } catch {
      this.connected.set(false);
      // The server may be starting: try again in a while (while the dashboard is open)
      setTimeout(() => { if (this.hub === hub && hub.state === HubConnectionState.Disconnected) void this.connect(); }, 10000);
    }
  }

  stop(): void {
    const hub = this.hub;
    this.hub = null;
    this.connected.set(false);
    void hub?.stop();
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
