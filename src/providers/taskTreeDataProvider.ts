import * as vscode from "vscode";
import { Task, TaskStatus, TaskPriority, TaskModel } from "../models/task";
import { TaskManager } from "../services/taskManager";

export type TaskTreeViewItem = TaskTreeItem | TaskCategoryItem;

export class TaskTreeDataProvider
  implements vscode.TreeDataProvider<TaskTreeViewItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    TaskTreeViewItem | undefined | null | void
  > = new vscode.EventEmitter<TaskTreeViewItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TaskTreeViewItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private taskManager: TaskManager) {
    this.taskManager.onTasksChanged(() => {
      this._onDidChangeTreeData.fire();
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TaskTreeViewItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TaskTreeViewItem): Thenable<TaskTreeViewItem[]> {
    if (!element) {
      // Root level - show status categories
      return Promise.resolve([
        new TaskCategoryItem(
          "Todo",
          TaskStatus.TODO,
          vscode.TreeItemCollapsibleState.Expanded
        ),
        new TaskCategoryItem(
          "In Progress",
          TaskStatus.IN_PROGRESS,
          vscode.TreeItemCollapsibleState.Expanded
        ),
        new TaskCategoryItem(
          "Done",
          TaskStatus.DONE,
          vscode.TreeItemCollapsibleState.Collapsed
        ),
      ]);
    } else if (element instanceof TaskCategoryItem) {
      // Show tasks for this status
      const tasks = this.taskManager.getTasksByStatus(element.status);
      return Promise.resolve(tasks.map((task) => new TaskTreeItem(task)));
    }

    return Promise.resolve([]);
  }

  getParent(
    element: TaskTreeViewItem
  ): vscode.ProviderResult<TaskTreeViewItem> {
    if (element instanceof TaskTreeItem) {
      // Find the parent category
      const status = element.task.status;
      const categoryLabel =
        status === TaskStatus.TODO
          ? "Todo"
          : status === TaskStatus.IN_PROGRESS
          ? "In Progress"
          : "Done";
      return new TaskCategoryItem(
        categoryLabel,
        status,
        vscode.TreeItemCollapsibleState.Expanded
      );
    }
    return null;
  }
}

export class TaskCategoryItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly status: TaskStatus,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label} tasks`;
    this.contextValue = "taskCategory";

    // Set icon based on status
    switch (status) {
      case TaskStatus.TODO:
        this.iconPath = new vscode.ThemeIcon("circle-outline");
        break;
      case TaskStatus.IN_PROGRESS:
        this.iconPath = new vscode.ThemeIcon("sync");
        break;
      case TaskStatus.DONE:
        this.iconPath = new vscode.ThemeIcon("check");
        break;
    }
  }
}

export class TaskTreeItem extends vscode.TreeItem {
  constructor(public readonly task: Task) {
    super(task.title, vscode.TreeItemCollapsibleState.None);

    this.tooltip = this.getTooltip();
    this.description = this.getDescription();
    this.contextValue = "task";
    this.iconPath = this.getIcon();

    // Add command to open task details when clicked
    this.command = {
      command: "collaborative-todo-list.openTaskDetails",
      title: "Open Task Details",
      arguments: [this.task],
    };
  }

  private getTooltip(): string {
    const dueDate = this.task.dueDate
      ? ` (Due: ${this.task.dueDate.toLocaleDateString()})`
      : "";
    return (
      `${this.task.title}\n` +
      `Assigned to: ${this.task.assignee}\n` +
      `Priority: ${this.task.priority}\n` +
      `Created by: ${this.task.createdBy}\n` +
      `Status: ${this.task.status}${dueDate}\n\n` +
      `${this.task.description}`
    );
  }

  private getDescription(): string {
    const priorityIcon = TaskModel.getPriorityIcon(this.task.priority);
    const assignee =
      this.task.assignee.length > 10
        ? this.task.assignee.substring(0, 10) + "..."
        : this.task.assignee;

    let description = `${priorityIcon} @${assignee}`;

    if (this.task.dueDate) {
      const now = new Date();
      const dueDate = this.task.dueDate;
      const daysDiff = Math.ceil(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff < 0) {
        description += ` (Overdue)`;
      } else if (daysDiff === 0) {
        description += ` (Due today)`;
      } else if (daysDiff <= 3) {
        description += ` (Due in ${daysDiff}d)`;
      }
    }

    return description;
  }

  private getIcon(): vscode.ThemeIcon {
    // Combine status and priority for icon selection
    const baseIcon = TaskModel.getStatusIcon(this.task.status);

    switch (this.task.status) {
      case TaskStatus.TODO:
        return this.task.priority === TaskPriority.URGENT
          ? new vscode.ThemeIcon(
              "circle-outline",
              new vscode.ThemeColor("errorForeground")
            )
          : new vscode.ThemeIcon("circle-outline");
      case TaskStatus.IN_PROGRESS:
        return new vscode.ThemeIcon(
          "sync",
          new vscode.ThemeColor("warningForeground")
        );
      case TaskStatus.DONE:
        return new vscode.ThemeIcon(
          "check",
          new vscode.ThemeColor("successForeground")
        );
      default:
        return new vscode.ThemeIcon("circle-outline");
    }
  }
}
