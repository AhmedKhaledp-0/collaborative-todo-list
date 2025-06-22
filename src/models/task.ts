import { v4 as uuidv4 } from "uuid";

export enum TaskStatus {
  TODO = "todo",
  IN_PROGRESS = "in-progress",
  DONE = "done",
}

export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  tags: string[];
}

export interface TaskUpdate {
  type: "CREATE" | "UPDATE" | "DELETE";
  task: Task;
  updatedBy: string;
  timestamp: Date;
}

export class TaskModel {
  static createTask(
    title: string,
    description: string,
    assignee: string,
    createdBy: string,
    priority: TaskPriority = TaskPriority.MEDIUM,
    dueDate?: Date,
    tags: string[] = []
  ): Task {
    return {
      id: uuidv4(),
      title,
      description,
      status: TaskStatus.TODO,
      priority,
      assignee,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate,
      tags,
    };
  }

  static updateTask(task: Task, updates: Partial<Task>): Task {
    return {
      ...task,
      ...updates,
      updatedAt: new Date(),
    };
  }

  static getStatusIcon(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.TODO:
        return "○";
      case TaskStatus.IN_PROGRESS:
        return "◐";
      case TaskStatus.DONE:
        return "●";
      default:
        return "○";
    }
  }

  static getPriorityIcon(priority: TaskPriority): string {
    switch (priority) {
      case TaskPriority.LOW:
        return "🔵";
      case TaskPriority.MEDIUM:
        return "🟡";
      case TaskPriority.HIGH:
        return "🟠";
      case TaskPriority.URGENT:
        return "🔴";
      default:
        return "🟡";
    }
  }
}
