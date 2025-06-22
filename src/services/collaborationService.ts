import * as vscode from "vscode";
const WebSocket = require("ws");
import { Task, TaskUpdate } from "../models/task";

export class CollaborationService {
  private ws: any | null = null;
  private serverUrl: string;
  private username: string;
  private isConnected: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly reconnectDelay = 5000; // 5 seconds

  private readonly _onTaskUpdate = new vscode.EventEmitter<TaskUpdate>();
  readonly onTaskUpdate = this._onTaskUpdate.event;

  private readonly _onConnectionChange = new vscode.EventEmitter<boolean>();
  readonly onConnectionChange = this._onConnectionChange.event;

  constructor() {
    this.serverUrl = this.getServerUrl();
    this.username = this.getUsername();

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("collaborative-todo-list.serverUrl") ||
        e.affectsConfiguration("collaborative-todo-list.username")
      ) {
        this.serverUrl = this.getServerUrl();
        this.username = this.getUsername();
        this.reconnect();
      }
    });
  }

  private getServerUrl(): string {
    return (
      vscode.workspace
        .getConfiguration("collaborative-todo-list")
        .get("serverUrl") || "ws://localhost:3001"
    );
  }

  private getUsername(): string {
    return (
      vscode.workspace
        .getConfiguration("collaborative-todo-list")
        .get("username") || "Unknown User"
    );
  }

  async connect(): Promise<void> {
    if (this.isConnected || !this.username) {
      return;
    }

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.on("open", () => {
        console.log("Connected to collaboration server");
        this.isConnected = true;
        this._onConnectionChange.fire(true);

        // Send initial connection message with username
        this.send({
          type: "CONNECT",
          username: this.username,
          timestamp: new Date(),
        });
      });

      this.ws.on("message", (data: any) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      });

      this.ws.on("close", () => {
        console.log("Disconnected from collaboration server");
        this.isConnected = false;
        this._onConnectionChange.fire(false);
        this.scheduleReconnect();
      });

      this.ws.on("error", (error: any) => {
        console.error("WebSocket error:", error);
        this.isConnected = false;
        this._onConnectionChange.fire(false);
        this.scheduleReconnect();
      });
    } catch (error) {
      console.error("Failed to connect to collaboration server:", error);
      this.scheduleReconnect();
    }
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case "TASK_UPDATE":
        const taskUpdate: TaskUpdate = {
          type: message.updateType,
          task: message.task,
          updatedBy: message.updatedBy,
          timestamp: new Date(message.timestamp),
        };
        this._onTaskUpdate.fire(taskUpdate);
        break;

      case "USER_JOINED":
        vscode.window.showInformationMessage(
          `${message.username} joined the collaboration session`
        );
        break;

      case "USER_LEFT":
        vscode.window.showInformationMessage(
          `${message.username} left the collaboration session`
        );
        break;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log("Attempting to reconnect...");
      this.connect();
    }, this.reconnectDelay);
  }

  private reconnect(): void {
    this.disconnect();
    this.connect();
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this._onConnectionChange.fire(false);
  }

  broadcastTaskUpdate(type: "CREATE" | "UPDATE" | "DELETE", task: Task): void {
    if (!this.isConnected) {
      return;
    }

    const update: TaskUpdate = {
      type,
      task,
      updatedBy: this.username,
      timestamp: new Date(),
    };

    this.send({
      type: "TASK_UPDATE",
      updateType: type,
      task,
      updatedBy: this.username,
      timestamp: new Date(),
    });
  }

  private send(message: any): void {
    if (this.ws && this.ws.readyState === 1) {
      // 1 = OPEN state
      this.ws.send(JSON.stringify(message));
    }
  }

  isConnectedToServer(): boolean {
    return this.isConnected;
  }

  dispose(): void {
    this.disconnect();
    this._onTaskUpdate.dispose();
    this._onConnectionChange.dispose();
  }
}
