import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  Task,
  TaskModel,
  TaskStatus,
  TaskPriority,
  TaskUpdate,
} from "../models/task";
import { CollaborationService } from "./collaborationService";

export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private tasksFilePath: string | null = null;
  private collaborationService: CollaborationService;

  private readonly _onTasksChanged = new vscode.EventEmitter<void>();
  readonly onTasksChanged = this._onTasksChanged.event;

  constructor(collaborationService: CollaborationService) {
    this.collaborationService = collaborationService;
    this.initializeTasksFile();
    this.setupCollaborationListeners();
  }

  private setupCollaborationListeners(): void {
    this.collaborationService.onTaskUpdate((update: TaskUpdate) => {
      this.handleRemoteTaskUpdate(update);
    });
  }

  private handleRemoteTaskUpdate(update: TaskUpdate): void {
    const currentUsername =
      (vscode.workspace
        .getConfiguration("collaborative-todo-list")
        .get("username") as string) || "Unknown User";

    // Don't process updates from ourselves
    if (update.updatedBy === currentUsername) {
      return;
    }

    switch (update.type) {
      case "CREATE":
      case "UPDATE":
        this.tasks.set(update.task.id, update.task);
        break;
      case "DELETE":
        this.tasks.delete(update.task.id);
        break;
    }

    this.saveTasksToFile();
    this._onTasksChanged.fire();

    // Show notification for remote changes
    vscode.window.showInformationMessage(
      `Task "${update.task.title}" ${update.type.toLowerCase()}d by ${
        update.updatedBy
      }`
    );
  }

  private initializeTasksFile(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const vscodeDir = path.join(workspaceRoot, ".vscode");

    // Ensure .vscode directory exists
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    this.tasksFilePath = path.join(vscodeDir, "todo-tasks.json");
    this.loadTasksFromFile();
  }

  private loadTasksFromFile(): void {
    if (!this.tasksFilePath || !fs.existsSync(this.tasksFilePath)) {
      return;
    }

    try {
      const data = fs.readFileSync(this.tasksFilePath, "utf8");
      const tasksArray: Task[] = JSON.parse(data);

      this.tasks.clear();
      tasksArray.forEach((task) => {
        // Convert date strings back to Date objects
        task.createdAt = new Date(task.createdAt);
        task.updatedAt = new Date(task.updatedAt);
        if (task.dueDate) {
          task.dueDate = new Date(task.dueDate);
        }
        this.tasks.set(task.id, task);
      });
    } catch (error) {
      console.error("Error loading tasks from file:", error);
      vscode.window.showErrorMessage("Failed to load tasks from file");
    }
  }

  private saveTasksToFile(): void {
    if (!this.tasksFilePath) {
      return;
    }

    try {
      const tasksArray = Array.from(this.tasks.values());
      fs.writeFileSync(this.tasksFilePath, JSON.stringify(tasksArray, null, 2));
    } catch (error) {
      console.error("Error saving tasks to file:", error);
      vscode.window.showErrorMessage("Failed to save tasks to file");
    }
  }

  async createTask(
    title: string,
    description: string,
    assignee: string,
    priority: TaskPriority = TaskPriority.MEDIUM,
    dueDate?: Date,
    tags: string[] = []
  ): Promise<Task> {
    const currentUsername =
      (vscode.workspace
        .getConfiguration("collaborative-todo-list")
        .get("username") as string) || "Unknown User";

    const task = TaskModel.createTask(
      title,
      description,
      assignee,
      currentUsername,
      priority,
      dueDate,
      tags
    );

    this.tasks.set(task.id, task);
    this.saveTasksToFile();
    this._onTasksChanged.fire();

    // Broadcast to other users
    this.collaborationService.broadcastTaskUpdate("CREATE", task);

    return task;
  }

  async updateTask(
    taskId: string,
    updates: Partial<Task>
  ): Promise<Task | null> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }

    const updatedTask = TaskModel.updateTask(task, updates);
    this.tasks.set(taskId, updatedTask);
    this.saveTasksToFile();
    this._onTasksChanged.fire();

    // Broadcast to other users
    this.collaborationService.broadcastTaskUpdate("UPDATE", updatedTask);

    return updatedTask;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    this.tasks.delete(taskId);
    this.saveTasksToFile();
    this._onTasksChanged.fire();

    // Broadcast to other users
    this.collaborationService.broadcastTaskUpdate("DELETE", task);

    return true;
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  getTasksByStatus(status: TaskStatus): Task[] {
    return this.getAllTasks().filter((task) => task.status === status);
  }

  getTasksByAssignee(assignee: string): Task[] {
    return this.getAllTasks().filter((task) => task.assignee === assignee);
  }

  searchTasks(query: string): Task[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllTasks().filter(
      (task) =>
        task.title.toLowerCase().includes(lowerQuery) ||
        task.description.toLowerCase().includes(lowerQuery) ||
        task.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  dispose(): void {
    this._onTasksChanged.dispose();
  }
}
